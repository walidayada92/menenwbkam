import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';
import { randomUUID } from 'node:crypto';
import { CheckoutDto, CouponDto, PlanDto } from './billing.dto';
import { billingTransaction, entitlements } from './entitlements';
import { featureKeys, invoiceAmounts, periodEnd } from './policy';
@Injectable()
export class BillingService {
  testEnabled() {
    return (
      process.env.NODE_ENV !== 'production' &&
      (process.env.BILLING_MODE || 'test') === 'test'
    );
  }
  assertTest() {
    if (!this.testEnabled())
      throw new ForbiddenException(
        'Test billing is disabled. No live payment provider is configured',
      );
  }
  async locked(tx: Prisma.TransactionClient, userId: string) {
    const seller = await tx.seller.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!seller) throw new NotFoundException('Create a seller profile first');
    await tx.$queryRaw`SELECT id FROM "Seller" WHERE id=${seller.id} FOR UPDATE`;
    return seller;
  }
  async plans(admin = false) {
    return prisma.plan.findMany({
      where: admin ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }
  async state(userId: string) {
    return billingTransaction(async (tx) => {
      const seller = await this.locked(tx, userId);
      const access = await entitlements(tx, seller.id);
      return {
        ...access,
        trialAvailable: !seller.trialUsedAt,
        offerCount: await tx.offer.count({ where: { sellerId: seller.id } }),
        testEnabled: this.testEnabled(),
        invoices: await tx.invoice.findMany({
          where: { subscription: { sellerId: seller.id } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      };
    });
  }
  async trial(userId: string, planId: string) {
    this.assertTest();
    return billingTransaction(async (tx) => {
      const seller = await this.locked(tx, userId);
      if (seller.status !== 'APPROVED')
        throw new ForbiddenException('Seller approval required');
      const access = await entitlements(tx, seller.id);
      if (
        seller.trialUsedAt ||
        ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'].includes(access.status)
      )
        throw new ConflictException('Trial is unavailable');
      const plan = await tx.plan.findUnique({ where: { id: planId } });
      if (!plan?.isActive || plan.isCustom || plan.trialDays <= 0)
        throw new BadRequestException('This plan has no trial');
      const count = await tx.offer.count({ where: { sellerId: seller.id } });
      if (plan.productLimit >= 0 && count > plan.productLimit)
        throw new ConflictException(
          'Remove listings above the target plan limit first',
        );
      const now = new Date(),
        endDate = new Date(now.getTime() + plan.trialDays * 86400000);
      const data = {
        planId,
        interval: 'MONTHLY' as const,
        status: 'TRIALING' as const,
        startDate: now,
        endDate,
        cancelAtPeriodEnd: false,
        graceEnd: null,
        pendingPlanId: null,
        pendingInterval: null,
      };
      const sub = await tx.subscription.upsert({
        where: { sellerId: seller.id },
        create: { ...data, sellerId: seller.id },
        update: data,
      });
      await tx.invoice.updateMany({
        where: { subscriptionId: sub.id, status: { in: ['OPEN', 'FAILED'] } },
        data: { status: 'VOID' },
      });
      await tx.seller.update({
        where: { id: seller.id },
        data: { trialUsedAt: now, currentPlanId: plan.id },
      });
      return sub;
    });
  }
  async checkout(userId: string, body: CheckoutDto, renew = false) {
    this.assertTest();
    return billingTransaction(async (tx) => {
      const seller = await this.locked(tx, userId);
      if (seller.status !== 'APPROVED')
        throw new ForbiddenException('Seller approval required');
      const access = await entitlements(tx, seller.id);
      const current = access.subscription;
      if (
        renew &&
        (!current ||
          current.cancelAtPeriodEnd ||
          current.status === 'PENDING' ||
          current.status === 'CANCELLED')
      )
        throw new BadRequestException('No renewable subscription');
      const planId = renew
        ? current!.pendingPlanId || current!.planId
        : body.planId;
      const interval = renew
        ? current!.pendingInterval || current!.interval
        : body.interval;
      const plan = await tx.plan.findUnique({ where: { id: planId } });
      if (!plan?.isActive || plan.isCustom || plan.id === 'free')
        throw new BadRequestException(
          'Choose an active self-service paid plan',
        );
      if (
        plan.productLimit >= 0 &&
        (await tx.offer.count({ where: { sellerId: seller.id } })) >
          plan.productLimit
      )
        throw new ConflictException(
          'Remove listings above the target plan limit first',
        );
      const price =
        interval === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
      if (price.lte(0))
        throw new BadRequestException('Paid plan price must be positive');
      let coupon = null;
      if (body.coupon) {
        coupon = await tx.coupon.findUnique({
          where: { code: body.coupon.toUpperCase() },
        });
        if (
          !coupon?.isActive ||
          (coupon.expiresAt && coupon.expiresAt <= new Date()) ||
          coupon.redemptionCount >= coupon.maxRedemptions
        )
          throw new BadRequestException(
            'Coupon is invalid, expired or exhausted',
          );
      }
      const vat = Number(process.env.BILLING_VAT_BPS || 1500);
      if (!Number.isInteger(vat) || vat < 0 || vat > 10000)
        throw new Error('Invalid BILLING_VAT_BPS');
      const amounts = invoiceAmounts(price, coupon?.percentOff || 0, vat);
      const now = new Date();
      const sub =
        current ||
        (await tx.subscription.create({
          data: {
            sellerId: seller.id,
            planId: plan.id,
            interval,
            status: 'PENDING',
            startDate: now,
            endDate: now,
          },
        }));
      await tx.invoice.updateMany({
        where: { subscriptionId: sub.id, status: { in: ['OPEN', 'FAILED'] } },
        data: { status: 'VOID' },
      });
      return tx.invoice.create({
        data: {
          number: 'TEST-' + randomUUID().toUpperCase(),
          subscriptionId: sub.id,
          planId: plan.id,
          planName: plan.name,
          planNameAr: plan.nameAr,
          productLimit: plan.productLimit,
          features: plan.features || {},
          interval,
          ...amounts,
          couponId: coupon?.id,
          buyerName: seller.businessName,
          buyerEmail: seller.user.email,
          sellerName: process.env.BILLING_BUSINESS_NAME || 'Menenwbkam (test)',
          sellerVatNumber: process.env.BILLING_VAT_NUMBER || null,
          isTest: true,
          kind: renew ? 'RENEWAL' : 'CHANGE',
        },
      });
    });
  }
  async settle(userId: string, id: string, outcome: 'paid' | 'failed') {
    this.assertTest();
    return billingTransaction(async (tx) => {
      const seller = await this.locked(tx, userId);
      const invoice = await tx.invoice.findFirst({
        where: { id, subscription: { sellerId: seller.id } },
        include: { subscription: { include: { plan: true } } },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (!invoice.isTest)
        throw new ForbiddenException('Cannot simulate a live payment');
      if (invoice.status === 'PAID') return invoice;
      if (invoice.status === 'VOID')
        throw new ConflictException('Invoice was replaced or cancelled');
      if (outcome === 'failed') {
        await tx.invoice.update({ where: { id }, data: { status: 'FAILED' } });
        await entitlements(tx, seller.id);
        return { status: 'FAILED' };
      }
      const plan = await tx.plan.findUnique({ where: { id: invoice.planId } });
      if (!plan?.isActive)
        throw new ConflictException('Plan is no longer available');
      if (
        plan.productLimit >= 0 &&
        (await tx.offer.count({ where: { sellerId: seller.id } })) >
          plan.productLimit
      )
        throw new ConflictException('Target plan limit exceeded');
      if (invoice.couponId) {
        await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id=${invoice.couponId} FOR UPDATE`;
        const coupon = await tx.coupon.findUniqueOrThrow({
          where: { id: invoice.couponId },
        });
        if (
          !coupon.isActive ||
          (coupon.expiresAt && coupon.expiresAt <= new Date()) ||
          coupon.redemptionCount >= coupon.maxRedemptions
        )
          throw new ConflictException(
            'Coupon is no longer available; create a new invoice',
          );
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { redemptionCount: { increment: 1 } },
        });
      }
      const now = new Date();
      const start =
        // Renewals apply only when due; scheduled plan changes must not revoke current benefits early.
        invoice.kind === 'RENEWAL' &&
        invoice.subscription.status !== 'TRIALING' &&
        invoice.subscription.endDate > now
          ? invoice.subscription.endDate
          : now;
      if (invoice.kind === 'RENEWAL' && invoice.subscription.endDate > now)
        throw new ConflictException(
          'Renewal is not due yet. In test mode, simulate the period end first',
        );
      await tx.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          planId: invoice.planId,
          interval: invoice.interval,
          status: 'ACTIVE',
          startDate:
            invoice.kind === 'RENEWAL' ? invoice.subscription.startDate : now,
          endDate: periodEnd(start, invoice.interval),
          graceEnd: null,
          cancelAtPeriodEnd: false,
          pendingPlanId: null,
          pendingInterval: null,
        },
      });
      await tx.seller.update({
        where: { id: seller.id },
        data: { currentPlanId: invoice.planId },
      });
      return tx.invoice.update({
        where: { id },
        data: { status: 'PAID', paidAt: now },
      });
    });
  }
  async simulateTime(userId: string, stage: 'DUE' | 'GRACE_EXPIRED') {
    this.assertTest();
    return billingTransaction(async (tx) => {
      const seller = await this.locked(tx, userId);
      const sub = await tx.subscription.findUnique({
        where: { sellerId: seller.id },
        include: { plan: true },
      });
      if (!sub || !['ACTIVE', 'TRIALING', 'GRACE_PERIOD'].includes(sub.status))
        throw new BadRequestException(
          'A current test subscription is required',
        );
      const elapsed =
        stage === 'DUE' ? 1000 : (sub.plan.graceDays + 1) * 86400000;
      await tx.subscription.update({
        where: { id: sub.id },
        data: { endDate: new Date(Date.now() - elapsed), graceEnd: null },
      });
      return entitlements(tx, seller.id);
    });
  }
  async schedule(userId: string, body: CheckoutDto) {
    return billingTransaction(async (tx) => {
      const seller = await this.locked(tx, userId);
      const access = await entitlements(tx, seller.id),
        sub = access.subscription;
      if (
        !sub ||
        !['ACTIVE', 'TRIALING', 'GRACE_PERIOD'].includes(access.status)
      )
        throw new BadRequestException('No current subscription');
      const plan = await tx.plan.findUnique({ where: { id: body.planId } });
      if (!plan?.isActive || plan.isCustom || plan.id === 'free')
        throw new BadRequestException('Use cancellation to return to Free');
      if (
        plan.productLimit >= 0 &&
        (await tx.offer.count({ where: { sellerId: seller.id } })) >
          plan.productLimit
      )
        throw new ConflictException(
          'Remove listings above target plan limit first',
        );
      await tx.invoice.updateMany({
        where: { subscriptionId: sub.id, status: { in: ['OPEN', 'FAILED'] } },
        data: { status: 'VOID' },
      });
      return tx.subscription.update({
        where: { id: sub.id },
        data: {
          pendingPlanId: plan.id,
          pendingInterval: body.interval,
          cancelAtPeriodEnd: false,
        },
      });
    });
  }
  async cancel(userId: string) {
    return billingTransaction(async (tx) => {
      const seller = await this.locked(tx, userId);
      const access = await entitlements(tx, seller.id);
      if (!access.subscription)
        throw new BadRequestException('No subscription');
      await tx.invoice.updateMany({
        where: {
          subscriptionId: access.subscription.id,
          status: { in: ['OPEN', 'FAILED'] },
        },
        data: { status: 'VOID' },
      });
      const endNow = ['PENDING', 'EXPIRED', 'CANCELLED'].includes(
        access.status,
      );
      return tx.subscription.update({
        where: { id: access.subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          pendingPlanId: null,
          pendingInterval: null,
          ...(endNow ? { status: 'CANCELLED' as const } : {}),
        },
      });
    });
  }
  async invoice(userId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, subscription: { seller: { userId } } },
    });
    if (!invoice) throw new NotFoundException();
    return invoice;
  }
  async savePlan(id: string, body: PlanDto) {
    if (!/^[a-z0-9_-]{1,60}$/.test(id))
      throw new BadRequestException('Invalid plan ID');
    for (const [key, value] of Object.entries(body.features))
      if (
        !featureKeys.includes(key as (typeof featureKeys)[number]) ||
        typeof value !== 'boolean'
      )
        throw new BadRequestException('Unknown or invalid feature: ' + key);
    if (
      id === 'free' &&
      (body.monthlyPrice !== 0 ||
        body.yearlyPrice !== 0 ||
        !body.isActive ||
        body.isCustom ||
        body.trialDays !== 0 ||
        body.productLimit < 0)
    )
      throw new BadRequestException(
        'Free must remain active, free, limited and without a trial',
      );
    const data = {
      name: body.name,
      nameAr: body.nameAr,
      monthlyPrice: body.monthlyPrice,
      yearlyPrice: body.yearlyPrice,
      productLimit: body.productLimit,
      features: body.features,
      isActive: body.isActive,
      isCustom: body.isCustom,
      trialDays: body.trialDays,
      graceDays: body.graceDays,
      sortOrder: body.sortOrder,
    };
    return prisma.plan.upsert({
      where: { id },
      create: { ...data, id },
      update: data,
    });
  }
  async saveCoupon(id: string | undefined, body: CouponDto) {
    const data = {
      code: body.code.toUpperCase(),
      percentOff: body.percentOff,
      maxRedemptions: body.maxRedemptions,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      isActive: body.isActive,
    };
    try {
      return id
        ? await prisma.coupon.update({ where: { id }, data })
        : await prisma.coupon.create({ data });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('Coupon code already exists');
      if ((error as { code?: string }).code === 'P2025')
        throw new NotFoundException('Coupon not found');
      throw error;
    }
  }
  async revenue() {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        subscription: {
          select: { seller: { select: { businessName: true } } },
        },
      },
    });
    const totals = await prisma.invoice.aggregate({
      where: { status: 'PAID', isTest: true },
      _sum: { totalHalalas: true, vatHalalas: true, discountHalalas: true },
      _count: true,
    });
    return {
      testRevenueHalalas: totals._sum.totalHalalas || 0,
      testVatHalalas: totals._sum.vatHalalas || 0,
      paidInvoices: totals._count,
      liveRevenueHalalas: 0,
      invoices,
    };
  }
}
