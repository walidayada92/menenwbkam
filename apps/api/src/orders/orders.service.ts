import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';
import { createHash, randomUUID } from 'node:crypto';
import { AuthRequest } from '../auth/roles.guard';
import { CreateOrderDto, OrderStatusDto, PageDto } from './orders.dto';
import { operationTransaction } from './transaction';
import { canTransition, statusWords } from './policy';
import { notify } from './notifications';
import { workspaceFor } from '../workspace/access';
import { visitorHash } from '../workspace/metrics';
import { refreshStockAlert } from '../workspace/alerts';
export const orderInclude = {
  items: true,
  events: { orderBy: { createdAt: 'asc' as const } },
  seller: { select: { id: true, userId: true, businessName: true } },
  shopper: { select: { id: true, email: true } },
  reviews: {
    select: {
      id: true,
      target: true,
      productId: true,
      rating: true,
      comment: true,
      isHidden: true,
    },
  },
  dispute: {
    include: {
      messages: {
        include: { author: { select: { role: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
} as const;
@Injectable()
export class OrdersService {
  async participant(
    tx: Prisma.TransactionClient,
    id: string,
    user: AuthRequest['user'],
  ) {
    let sellerId: string | undefined;
    if (user.role === 'SELLER') {
      const target = await tx.order.findUnique({
        where: { id },
        select: { sellerId: true },
      });
      if (!target) throw new NotFoundException('Order not found');
      try {
        sellerId = (await workspaceFor(user.sub, target.sellerId, 'orders'))
          .seller.id;
      } catch (error) {
        if (
          error instanceof ForbiddenException ||
          error instanceof NotFoundException
        )
          throw new NotFoundException('Order not found');
        throw error;
      }
    }
    const order = await tx.order.findFirst({
      where: {
        id,
        ...(user.role === 'ADMIN'
          ? {}
          : user.role === 'SELLER'
            ? { sellerId }
            : { shopperId: user.sub }),
      },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
  async list(user: AuthRequest['user'], query: PageDto) {
    const sellerScope =
      user.role === 'SELLER'
        ? await workspaceFor(user.sub, user.workspaceId, 'orders')
        : null;
    const where: Prisma.OrderWhereInput = {
      ...(user.role === 'ADMIN'
        ? {}
        : user.role === 'SELLER'
          ? { sellerId: sellerScope!.seller.id }
          : { shopperId: user.sub }),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          seller: { select: { businessName: true } },
          dispute: { select: { id: true, status: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        skip: (query.page - 1) * 20,
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: 20 };
  }
  async detail(user: AuthRequest['user'], id: string) {
    return this.participant(prisma, id, user);
  }
  async place(user: AuthRequest['user'], body: CreateOrderDto) {
    if (user.role !== 'SHOPPER')
      throw new ForbiddenException('Shopper account required');
    if (new Set(body.items.map((i) => i.offerId)).size !== body.items.length)
      throw new BadRequestException('Duplicate order items');
    const input = {
      items: body.items
        .map((i) => ({
          offerId: i.offerId,
          quantity: i.quantity,
          expectedUnitPrice: new Prisma.Decimal(i.expectedUnitPrice).toFixed(2),
        }))
        .sort((a, b) => a.offerId.localeCompare(b.offerId)),
      recipientName: body.recipientName.trim(),
      contactPhone: body.contactPhone,
      shippingAddress: body.shippingAddress.trim(),
      notes: body.notes?.trim() || null,
    };
    if (input.recipientName.length < 2 || input.shippingAddress.length < 10)
      throw new BadRequestException('Recipient and address are required');
    const requestHash = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    return operationTransaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.sub} FOR UPDATE`;
      const previous = await tx.order.findUnique({
        where: {
          shopperId_checkoutKey: {
            shopperId: user.sub,
            checkoutKey: body.checkoutKey,
          },
        },
        include: orderInclude,
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new ConflictException(
            'Checkout key was used with different order details',
          );
        return previous;
      }
      const ids = input.items.map((i) => i.offerId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Offer" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`,
      );
      const offers = await tx.offer.findMany({
        where: { id: { in: ids } },
        include: { seller: true },
      });
      if (offers.length !== ids.length)
        throw new NotFoundException('One or more offers are unavailable');
      if (new Set(offers.map((o) => o.sellerId)).size !== 1)
        throw new BadRequestException('Each order must belong to one seller');
      if (offers.some((o) => o.seller.status !== 'APPROVED'))
        throw new ConflictException('Seller is unavailable');
      let total = new Prisma.Decimal(0);
      const lines = [];
      for (const item of input.items) {
        const offer = offers.find((o) => o.id === item.offerId)!;
        if (!offer.price.equals(item.expectedUnitPrice))
          throw new ConflictException(
            'Price changed for ' +
              offer.title +
              '. Refresh the checkout before placing the order',
          );
        const result = await tx.offer.updateMany({
          where: { id: offer.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (!result.count)
          throw new ConflictException('Insufficient stock for ' + offer.title);
        await refreshStockAlert(tx, offer.id);
        total = total.plus(offer.price.times(item.quantity));
        const images = Array.isArray(offer.images) ? offer.images : [];
        lines.push({
          offerId: offer.id,
          productId: offer.productId,
          title: offer.title,
          imageUrl: typeof images[0] === 'string' ? images[0] : null,
          quantity: item.quantity,
          priceAtPurchase: offer.price,
        });
      }
      const order = await tx.order.create({
        data: {
          shopperId: user.sub,
          sellerId: offers[0].sellerId,
          number:
            'MW-' + randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase(),
          checkoutKey: body.checkoutKey,
          requestHash,
          totalAmount: total,
          sourceVisitorHash: body.visitorId
            ? visitorHash(body.visitorId, offers[0].sellerId)
            : null,
          recipientName: input.recipientName,
          contactPhone: input.contactPhone,
          shippingAddress: input.shippingAddress,
          notes: input.notes,
          items: { create: lines },
          events: { create: { status: 'PENDING', actorRole: 'SHOPPER' } },
        },
        include: orderInclude,
      });
      await notify(tx, [user.sub, offers[0].seller.userId], {
        titleAr: 'طلب جديد',
        titleEn: 'New order',
        bodyAr: order.number,
        bodyEn: order.number,
        href: '/orders/' + order.id,
      });
      return order;
    });
  }
  async update(user: AuthRequest['user'], id: string, body: OrderStatusDto) {
    if (user.role === 'SELLER') {
      const order = await this.participant(prisma, id, user);
      await workspaceFor(user.sub, order.sellerId, 'writeOrders');
    }
    return operationTransaction(async (tx) => {
      await this.participant(tx, id, user);
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
      const order = await this.participant(tx, id, user);
      if (order.status === body.status) return order;
      if (!canTransition(order.status, body.status, user.role))
        throw new ConflictException(
          'This order status transition is not allowed',
        );
      if (
        body.status === 'SHIPPED' &&
        (!body.deliveryMethod?.trim() || !body.trackingNumber?.trim())
      )
        throw new BadRequestException(
          'Delivery method and tracking number are required when shipping',
        );
      if (
        user.role === 'SHOPPER' &&
        (body.deliveryMethod || body.trackingNumber || body.trackingUrl)
      )
        throw new ForbiddenException(
          'Only the seller can set delivery details',
        );
      if (['CANCELLED', 'RETURNED'].includes(body.status))
        for (const item of [...order.items].sort((a, b) =>
          a.offerId.localeCompare(b.offerId),
        )) {
          await tx.offer.update({
            where: { id: item.offerId },
            data: { stock: { increment: item.quantity } },
          });
          await refreshStockAlert(tx, item.offerId);
        }
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: body.status,
          ...(body.status === 'SHIPPED'
            ? {
                deliveryMethod: body.deliveryMethod!.trim(),
                trackingNumber: body.trackingNumber!.trim(),
                trackingUrl: body.trackingUrl || null,
                shippedAt: new Date(),
              }
            : {}),
          ...(body.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
          events: {
            create: {
              status: body.status,
              actorRole: user.role,
              message: body.message?.trim() || null,
            },
          },
        },
        include: orderInclude,
      });
      const words = statusWords[body.status];
      await notify(tx, [order.shopperId, order.seller.userId], {
        titleAr: words.ar,
        titleEn: words.en,
        bodyAr: order.number,
        bodyEn: order.number,
        href: '/orders/' + order.id,
      });
      return updated;
    });
  }
}
