import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';
import { workspaceFor, permitted } from './access';
import { operationTransaction } from '../orders/transaction';
import { entitlements, requireFeature } from '../billing/entitlements';
import { hasFeature } from '../billing/policy';
import { rangeStart, riyadhDay } from './metrics';
@Injectable()
export class AnalyticsService {
  async overview(userId: string, storeId: string | undefined, days: number) {
    const scope = await workspaceFor(userId, storeId);
    const { seller, role, permissions } = scope;
    const access = await operationTransaction((tx) =>
      entitlements(tx, seller.id),
    );
    const [products, lowStock, pendingOrders, alerts, recent] =
      await Promise.all([
        prisma.offer.count({ where: { sellerId: seller.id } }),
        prisma.offer.count({
          where: {
            sellerId: seller.id,
            stock: { lte: seller.lowStockThreshold },
          },
        }),
        permitted(role, 'orders')
          ? prisma.order.count({
              where: { sellerId: seller.id, status: 'PENDING' },
            })
          : null,
        prisma.sellerAlert.findMany({
          where: { sellerId: seller.id, resolvedAt: null },
          include: {
            offer: { select: { title: true, price: true, stock: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 8,
        }),
        permitted(role, 'orders')
          ? prisma.order.findMany({
              where: { sellerId: seller.id },
              select: {
                id: true,
                number: true,
                status: true,
                totalAmount: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            })
          : [],
      ]);
    const analyticsEnabled =
      permitted(role, 'analytics') &&
      hasFeature(access.features, 'basicAnalytics');
    return {
      store: {
        id: seller.id,
        businessName: seller.businessName,
        status: seller.status,
        logo: seller.logo,
        slug: seller.slug,
        description: seller.description,
        brandColor: seller.brandColor,
        bannerUrl: seller.bannerUrl,
        lowStockThreshold: seller.lowStockThreshold,
        lowStockAlerts: seller.lowStockAlerts,
        priceDropAlerts: seller.priceDropAlerts,
      },
      role,
      permissions,
      plan: access.plan?.name || 'Free',
      products,
      lowStock,
      pendingOrders,
      alerts,
      recent,
      analyticsEnabled,
      analytics: analyticsEnabled
        ? await this.aggregate(seller.id, days)
        : null,
    };
  }
  async analytics(userId: string, storeId: string | undefined, days: number) {
    const { seller } = await workspaceFor(userId, storeId, 'analytics');
    await operationTransaction((tx) =>
      requireFeature(tx, seller.id, 'basicAnalytics'),
    );
    return this.aggregate(seller.id, days);
  }
  async aggregate(sellerId: string, days: number) {
    const start = rangeStart(days),
      now = new Date();
    const [orders, traffic, dailyTraffic, dailyOrders, top, converted] =
      await Promise.all([
        prisma.order.groupBy({
          by: ['status'],
          where: { sellerId, createdAt: { gte: start, lte: now } },
          _count: true,
          _sum: { totalAmount: true },
        }),
        prisma.$queryRaw<{ views: bigint; clicks: bigint; sessions: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) FILTER(WHERE m.kind='IMPRESSION') AS views,COUNT(*) FILTER(WHERE m.kind='CLICK') AS clicks,COUNT(DISTINCT m."visitorHash") FILTER(WHERE m.kind='IMPRESSION') AS sessions FROM "OfferMetric" m JOIN "Offer" o ON o.id=m."offerId" WHERE o."sellerId"=${sellerId} AND m."createdAt">=${start} AND m."createdAt"<=${now}`,
        ),
        prisma.$queryRaw<{ day: string; views: bigint; clicks: bigint }[]>(
          Prisma.sql`SELECT TO_CHAR(m."createdAt" AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD') AS day,COUNT(*) FILTER(WHERE m.kind='IMPRESSION') AS views,COUNT(*) FILTER(WHERE m.kind='CLICK') AS clicks FROM "OfferMetric" m JOIN "Offer" o ON o.id=m."offerId" WHERE o."sellerId"=${sellerId} AND m."createdAt">=${start} AND m."createdAt"<=${now} GROUP BY 1`,
        ),
        prisma.$queryRaw<
          { day: string; orders: bigint; value: Prisma.Decimal }[]
        >(
          Prisma.sql`SELECT TO_CHAR("createdAt" AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD') AS day,COUNT(*) AS orders,COALESCE(SUM("totalAmount") FILTER(WHERE status='DELIVERED'),0) AS value FROM "Order" WHERE "sellerId"=${sellerId} AND "createdAt">=${start} AND "createdAt"<=${now} GROUP BY 1`,
        ),
        prisma.$queryRaw<
          {
            productId: string;
            title: string;
            quantity: bigint;
            value: Prisma.Decimal;
          }[]
        >(
          Prisma.sql`SELECT i."productId",MAX(i.title) AS title,SUM(i.quantity) AS quantity,SUM(i.quantity*i."priceAtPurchase") AS value FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId" WHERE o."sellerId"=${sellerId} AND o.status='DELIVERED' AND o."createdAt">=${start} AND o."createdAt"<=${now} GROUP BY i."productId" ORDER BY value DESC LIMIT 8`,
        ),
        prisma.$queryRaw<{ count: bigint }[]>(
          Prisma.sql`SELECT COUNT(DISTINCT r."sourceVisitorHash") AS count FROM "Order" r WHERE r."sellerId"=${sellerId} AND r.status NOT IN ('CANCELLED','RETURNED') AND r."createdAt">=${start} AND r."createdAt"<=${now} AND EXISTS(SELECT 1 FROM "OfferMetric" m JOIN "Offer" o ON o.id=m."offerId" WHERE o."sellerId"=${sellerId} AND m.kind='IMPRESSION' AND m."visitorHash"=r."sourceVisitorHash" AND m."createdAt">=${start} AND m."createdAt"<=${now})`,
        ),
      ]);
    const views = Number(traffic[0].views),
      clicks = Number(traffic[0].clicks),
      sessions = Number(traffic[0].sessions);
    const delivered = orders.find((o) => o.status === 'DELIVERED');
    const daily = Array.from({ length: days }, (_, index) => {
      const day = riyadhDay(new Date(start.getTime() + index * 86400000));
      const m = dailyTraffic.find((v) => v.day === day),
        o = dailyOrders.find((v) => v.day === day);
      return {
        day,
        views: Number(m?.views || 0),
        clicks: Number(m?.clicks || 0),
        orders: Number(o?.orders || 0),
        deliveredValue: String(o?.value || 0),
      };
    });
    return {
      days,
      start: start.toISOString(),
      end: now.toISOString(),
      views,
      clicks,
      sessions,
      conversionRate: sessions
        ? Number(((Number(converted[0].count) * 100) / sessions).toFixed(2))
        : 0,
      orders: orders.reduce((sum, o) => sum + o._count, 0),
      deliveredOrders: delivered?._count || 0,
      deliveredValue: delivered?._sum.totalAmount?.toString() || '0',
      cancelledOrders:
        orders.find((o) => o.status === 'CANCELLED')?._count || 0,
      returnedOrders: orders.find((o) => o.status === 'RETURNED')?._count || 0,
      daily,
      topProducts: top.map((p) => ({
        ...p,
        quantity: Number(p.quantity),
        value: p.value.toString(),
      })),
    };
  }
  async insights(userId: string, storeId: string | undefined, page: number) {
    const { seller } = await workspaceFor(userId, storeId, 'catalog');
    await operationTransaction((tx) =>
      requireFeature(tx, seller.id, 'basicAnalytics'),
    );
    const offers = await prisma.offer.findMany({
      where: { sellerId: seller.id },
      include: { product: { select: { modelName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: (page - 1) * 20,
    });
    const competitors = await prisma.offer.findMany({
      where: {
        productId: { in: offers.map((o) => o.productId) },
        sellerId: { not: seller.id },
        stock: { gt: 0 },
        seller: { status: 'APPROVED' },
      },
      select: {
        productId: true,
        price: true,
        seller: { select: { businessName: true } },
      },
      orderBy: { price: 'asc' },
    });
    const items = offers.map((o) => {
      const prices = competitors.filter((c) => c.productId === o.productId);
      const best = prices[0];
      return {
        id: o.id,
        title: o.title,
        price: o.price,
        stock: o.stock,
        productId: o.productId,
        competitorCount: prices.length,
        position: 1 + prices.filter((c) => c.price.lt(o.price)).length,
        bestCompetitor: best
          ? { price: best.price, seller: best.seller.businessName }
          : null,
        suggestedPrice:
          best && o.price.gte(best.price)
            ? Prisma.Decimal.max('0.01', best.price.minus('0.01')).toFixed(2)
            : null,
      };
    });
    return {
      items,
      total: await prisma.offer.count({ where: { sellerId: seller.id } }),
      page,
      pageSize: 20,
    };
  }
  async history(
    userId: string,
    storeId: string | undefined,
    id: string,
    days: number,
  ) {
    const { seller } = await workspaceFor(userId, storeId, 'catalog');
    await operationTransaction((tx) =>
      requireFeature(tx, seller.id, 'priceHistory'),
    );
    if (!(await prisma.offer.findFirst({ where: { id, sellerId: seller.id } })))
      throw new NotFoundException();
    const items = await prisma.offerPrice.findMany({
      where: { offerId: id, createdAt: { gte: rangeStart(days) } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    return items.reverse();
  }
  async alerts(userId: string, storeId: string | undefined, page: number) {
    const { seller } = await workspaceFor(userId, storeId);
    const where = { sellerId: seller.id, resolvedAt: null };
    const [items, total] = await Promise.all([
      prisma.sellerAlert.findMany({
        where,
        include: {
          offer: { select: { title: true, price: true, stock: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: (page - 1) * 20,
      }),
      prisma.sellerAlert.count({ where }),
    ]);
    return { items, total, page, pageSize: 20 };
  }
}
