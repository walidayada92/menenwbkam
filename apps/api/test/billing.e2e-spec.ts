import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@menenwbkam/database';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
describe('Test-mode subscription billing', () => {
  let app: INestApplication;
  const run = randomUUID(),
    pro = 'pro-' + run,
    starter = 'starter-' + run,
    brand = 'brand-' + run,
    category = 'category-' + run;
  const users: { id: string; token: string; sellerId: string }[] = [];
  let admin = '',
    invoiceId = '',
    couponId = '';
  const headers = (token: string) => ({ Authorization: 'Bearer ' + token });
  const buyer = () => users[0];
  const call = (
    method: 'get' | 'post' | 'put',
    path: string,
    token: string,
    body?: unknown,
  ) => {
    const req = request(app.getHttpServer())[method](path).set(headers(token));
    return body ? req.send(body) : req;
  };
  const checkout = (token: string, planId = pro, coupon?: string) =>
    call('post', '/seller/billing/checkout', token, {
      planId,
      interval: 'MONTHLY',
      ...(coupon ? { coupon } : {}),
    });
  async function account(name: string, role = 'SELLER') {
    const email = name + '-' + run + '@example.com',
      password = 'billing-test-password';
    const created = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, role })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    let sellerId = '';
    if (role === 'SELLER')
      sellerId = (
        await prisma.seller.create({
          data: {
            userId: created.body.id,
            businessName: name,
            commercialRegNo: '1234567890',
            status: 'APPROVED',
          },
        })
      ).id;
    const result = {
      id: created.body.id,
      token: login.body.access_token as string,
      sellerId,
    };
    users.push(result);
    return result;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await account('buyer-a');
    await account('buyer-b');
    await account('buyer-c');
    const a = await account('billing-admin', 'SHOPPER');
    await prisma.user.update({ where: { id: a.id }, data: { role: 'ADMIN' } });
    admin = a.token;
    for (const plan of [
      {
        id: pro,
        name: 'Test Pro',
        monthlyPrice: 100,
        yearlyPrice: 1000,
        productLimit: 1000,
        features: { bulkUpload: true, featuredBadge: true },
      },
      {
        id: starter,
        name: 'Test Starter',
        monthlyPrice: 50,
        yearlyPrice: 500,
        productLimit: 100,
        features: { bulkUpload: false },
      },
    ])
      await prisma.plan.create({
        data: { ...plan, nameAr: 'اختبار', trialDays: 7, graceDays: 3 },
      });
    await prisma.brand.create({
      data: { id: brand, nameAr: 'اختبار', nameEn: 'Billing test' },
    });
    await prisma.category.create({
      data: { id: category, nameAr: 'اختبار', nameEn: 'Billing test' },
    });
  });
  afterAll(async () => {
    const sellerIds = users.map((u) => u.sellerId).filter(Boolean);
    await prisma.invoice.deleteMany({
      where: { subscription: { sellerId: { in: sellerIds } } },
    });
    await prisma.subscription.deleteMany({
      where: { sellerId: { in: sellerIds } },
    });
    await prisma.offer.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.product.deleteMany({ where: { brandId: brand } });
    await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
    await prisma.user.deleteMany({
      where: { id: { in: users.map((u) => u.id) } },
    });
    await prisma.plan.deleteMany({ where: { id: { in: [pro, starter] } } });
    await prisma.coupon.deleteMany({
      where: {
        code: { endsWith: run.toUpperCase().replace(/-/g, '').slice(0, 12) },
      },
    });
    await prisma.brand.delete({ where: { id: brand } });
    await prisma.category.delete({ where: { id: category } });
    await app?.close();
    await prisma.$disconnect();
  });
  it('requires seller/admin roles and never permits self-assignment', async () => {
    await request(app.getHttpServer()).get('/seller/billing').expect(401);
    await call('get', '/admin/billing/plans', buyer().token).expect(403);
    await call('get', '/seller/billing', admin).expect(403);
    await checkout(buyer().token, 'missing').expect(400);
  });
  it('starts a trial once and gates free bulk upload', async () => {
    const csv =
      'title,brandId,categoryId,images,price,stock\nBilling Phone,' +
      brand +
      ',' +
      category +
      ',,10,2';
    await request(app.getHttpServer())
      .post('/seller/import')
      .set(headers(buyer().token))
      .attach('file', Buffer.from(csv), 'products.csv')
      .expect(403);
    await call('post', '/seller/billing/trial', buyer().token, {
      planId: pro,
    }).expect(201);
    const state = await call('get', '/seller/billing', buyer().token).expect(
      200,
    );
    expect(state.body.status).toBe('TRIALING');
    expect(state.body.features.bulkUpload).toBe(true);
    await call('post', '/seller/billing/trial', buyer().token, {
      planId: pro,
    }).expect(409);
    await request(app.getHttpServer())
      .post('/seller/import')
      .set(headers(buyer().token))
      .attach('file', Buffer.from(csv), 'products.csv')
      .expect(201);
  });
  it('creates discounted VAT invoices and isolates seller data', async () => {
    const code = 'SAVE' + run.toUpperCase().replace(/-/g, '').slice(0, 12);
    const coupon = await call('post', '/admin/billing/coupons', admin, {
      code,
      percentOff: 10,
      maxRedemptions: 1,
      isActive: true,
    }).expect(201);
    couponId = coupon.body.id;
    const invoice = await checkout(buyer().token, pro, code).expect(201);
    invoiceId = invoice.body.id;
    expect(invoice.body).toMatchObject({
      subtotalHalalas: 10000,
      discountHalalas: 1000,
      vatHalalas: 1350,
      totalHalalas: 10350,
      isTest: true,
      status: 'OPEN',
    });
    await call(
      'get',
      '/seller/billing/invoices/' + invoiceId,
      users[1].token,
    ).expect(404);
    await call(
      'post',
      '/seller/billing/invoices/' + invoiceId + '/simulate',
      users[1].token,
      { outcome: 'paid' },
    ).expect(404);
  });
  it('settles once under concurrent repeated payment callbacks', async () => {
    const responses = await Promise.all(
      [1, 2].map(() =>
        call(
          'post',
          '/seller/billing/invoices/' + invoiceId + '/simulate',
          buyer().token,
          { outcome: 'paid' },
        ),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(
      (await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } }))
        .redemptionCount,
    ).toBe(1);
    expect(
      (await call('get', '/seller/billing', buyer().token)).body.status,
    ).toBe('ACTIVE');
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    expect(invoice.status).toBe('PAID');
    expect(invoice.paidAt).not.toBeNull();
    await call(
      'post',
      '/seller/billing/invoices/' + invoiceId + '/simulate',
      buyer().token,
      { outcome: 'failed' },
    ).expect(201);
    expect(
      (await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } }))
        .status,
    ).toBe('PAID');
  });
  it('snapshots historical invoice prices and rejects exhausted coupons', async () => {
    await prisma.plan.update({
      where: { id: pro },
      data: { monthlyPrice: 120 },
    });
    const invoice = await call(
      'get',
      '/seller/billing/invoices/' + invoiceId,
      buyer().token,
    ).expect(200);
    expect(invoice.body.subtotalHalalas).toBe(10000);
    const coupon = await prisma.coupon.findUniqueOrThrow({
      where: { id: couponId },
    });
    await checkout(users[1].token, pro, coupon.code).expect(400);
  });
  it('applies featured-badge entitlements server side', async () => {
    const data = {
      title: 'Featured billing phone',
      brandId: brand,
      categoryId: category,
      images: [],
      price: 99,
      stock: 2,
      isFeatured: true,
    };
    await call('post', '/seller/offers', users[1].token, data).expect(403);
    const offered = await call(
      'post',
      '/seller/offers',
      buyer().token,
      data,
    ).expect(201);
    const detail = await request(app.getHttpServer())
      .get('/catalog/products/' + offered.body.productId)
      .expect(200);
    expect(detail.body.offers[0].isFeatured).toBe(true);
  });
  it('schedules changes at renewal and preserves access after an early failure', async () => {
    await call('post', '/seller/billing/schedule', buyer().token, {
      planId: starter,
      interval: 'YEARLY',
    }).expect(201);
    const state = await call('get', '/seller/billing', buyer().token).expect(
      200,
    );
    expect(state.body.plan.id).toBe(pro);
    expect(state.body.subscription.pendingPlanId).toBe(starter);
    const invoice = await call(
      'post',
      '/seller/billing/renew',
      buyer().token,
    ).expect(201);
    expect(invoice.body.planId).toBe(starter);
    expect(invoice.body.interval).toBe('YEARLY');
    await call(
      'post',
      '/seller/billing/invoices/' + invoice.body.id + '/simulate',
      buyer().token,
      { outcome: 'paid' },
    ).expect(409);
    await call(
      'post',
      '/seller/billing/invoices/' + invoice.body.id + '/simulate',
      buyer().token,
      { outcome: 'failed' },
    ).expect(201);
    expect(
      (await call('get', '/seller/billing', buyer().token)).body.status,
    ).toBe('ACTIVE');
  });
  it('applies a scheduled yearly plan only once its period becomes due', async () => {
    const state = await call('get', '/seller/billing', buyer().token);
    const invoice = state.body.invoices.find(
      (i: { status: string }) => i.status === 'FAILED',
    );
    await call('post', '/seller/billing/simulate-time', buyer().token, {
      stage: 'DUE',
    }).expect(201);
    await call(
      'post',
      '/seller/billing/invoices/' + invoice.id + '/simulate',
      buyer().token,
      { outcome: 'paid' },
    ).expect(201);
    const renewed = await call('get', '/seller/billing', buyer().token);
    expect(renewed.body.plan.id).toBe(starter);
    expect(renewed.body.subscription.interval).toBe('YEARLY');
    expect(renewed.body.subscription.pendingPlanId).toBeNull();
  });
  it('provides grace after a due failure, then falls back to Free without deleting offers', async () => {
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { sellerId: buyer().sellerId },
    });
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { endDate: new Date(Date.now() - 86400000) },
    });
    expect(
      (await call('get', '/seller/billing', buyer().token)).body.status,
    ).toBe('GRACE_PERIOD');
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { endDate: new Date(Date.now() - 5 * 86400000) },
    });
    const state = await call('get', '/seller/billing', buyer().token).expect(
      200,
    );
    expect(state.body.status).toBe('EXPIRED');
    expect(state.body.plan?.id || 'free').toBe('free');
    expect(
      await prisma.offer.count({ where: { sellerId: buyer().sellerId } }),
    ).toBe(2);
    const csv =
      'title,brandId,categoryId,images,price,stock\nAfter expiry,' +
      brand +
      ',' +
      category +
      ',,10,2';
    await request(app.getHttpServer())
      .post('/seller/import')
      .set(headers(buyer().token))
      .attach('file', Buffer.from(csv), 'products.csv')
      .expect(403);
    const product = await prisma.product.findFirstOrThrow({
      where: { brandId: brand, modelName: 'Featured billing phone' },
    });
    expect(
      (
        await request(app.getHttpServer()).get(
          '/catalog/products/' + product.id,
        )
      ).body.offers[0].isFeatured,
    ).toBe(false);
  });
  it('cancels at period end, voids unpaid invoices and disallows trial reuse', async () => {
    const invoice = await checkout(buyer().token, starter).expect(201);
    await call(
      'post',
      '/seller/billing/invoices/' + invoice.body.id + '/simulate',
      buyer().token,
      { outcome: 'paid' },
    ).expect(201);
    const pending = await call(
      'post',
      '/seller/billing/renew',
      buyer().token,
    ).expect(201);
    await call('post', '/seller/billing/cancel', buyer().token).expect(201);
    expect(
      (await call('get', '/seller/billing', buyer().token)).body.status,
    ).toBe('ACTIVE');
    await call(
      'post',
      '/seller/billing/invoices/' + pending.body.id + '/simulate',
      buyer().token,
      { outcome: 'paid' },
    ).expect(409);
    await prisma.subscription.update({
      where: { sellerId: buyer().sellerId },
      data: { endDate: new Date(Date.now() - 1) },
    });
    expect(
      (await call('get', '/seller/billing', buyer().token)).body.status,
    ).toBe('CANCELLED');
    await call('post', '/seller/billing/trial', buyer().token, {
      planId: pro,
    }).expect(409);
  });
  it('expires trials without granting a paid grace period', async () => {
    await call('post', '/seller/billing/trial', users[1].token, {
      planId: pro,
    }).expect(201);
    await prisma.subscription.update({
      where: { sellerId: users[1].sellerId },
      data: { endDate: new Date(Date.now() - 1) },
    });
    expect(
      (await call('get', '/seller/billing', users[1].token)).body.status,
    ).toBe('EXPIRED');
  });
  it('rejects unavailable plans, expired coupons and disabled production simulation', async () => {
    const code = 'OLD' + run.toUpperCase().replace(/-/g, '').slice(0, 12);
    await call('post', '/admin/billing/coupons', admin, {
      code,
      percentOff: 10,
      maxRedemptions: 1,
      isActive: true,
      expiresAt: '2020-01-01T00:00:00Z',
    }).expect(201);
    await checkout(users[2].token, pro, code).expect(400);
    await prisma.plan.update({
      where: { id: starter },
      data: { isActive: false },
    });
    await checkout(users[2].token, starter).expect(400);
    const mode = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      await checkout(users[2].token, pro).expect(403);
    } finally {
      process.env.NODE_ENV = mode;
    }
  });
  it('does not oversubscribe a coupon when different sellers pay concurrently', async () => {
    const code = 'RACE' + run.toUpperCase().replace(/-/g, '').slice(0, 12);
    const coupon = await call('post', '/admin/billing/coupons', admin, {
      code,
      percentOff: 20,
      maxRedemptions: 1,
      isActive: true,
    }).expect(201);
    const invoices = await Promise.all(
      [users[1], users[2]].map((u) => checkout(u.token, pro, code).expect(201)),
    );
    const replies = await Promise.all(
      invoices.map((invoice, index) =>
        call(
          'post',
          '/seller/billing/invoices/' + invoice.body.id + '/simulate',
          users[index + 1].token,
          { outcome: 'paid' },
        ),
      ),
    );
    expect(replies.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      (await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.body.id } }))
        .redemptionCount,
    ).toBe(1);
  });
  it('keeps test revenue separate from live revenue', async () => {
    const summary = await call('get', '/admin/billing/revenue', admin).expect(
      200,
    );
    expect(summary.body.liveRevenueHalalas).toBe(0);
    expect(summary.body.testRevenueHalalas).toBeGreaterThan(0);
    expect(
      summary.body.invoices.some((i: { id: string }) => i.id === invoiceId),
    ).toBe(true);
  });
});
