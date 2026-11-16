import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@menenwbkam/database';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
describe('Orders, fulfillment, reviews, disputes and notifications', () => {
  let app: INestApplication,
    orderId = '',
    sellerReviewId = '',
    productReviewId = '',
    disputeId = '';
  const run = randomUUID(),
    brand = 'orders-brand-' + run,
    category = 'orders-category-' + run;
  const users: {
    id: string;
    token: string;
    sellerId: string;
    email: string;
  }[] = [];
  const productIds: string[] = [],
    offerIds: string[] = [];
  async function account(name: string, role: 'SHOPPER' | 'SELLER' | 'ADMIN') {
    const email = name + '-' + run + '@example.com',
      password = 'orders-test-password';
    const created = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, role: role === 'ADMIN' ? 'SHOPPER' : role })
      .expect(201);
    if (role === 'ADMIN')
      await prisma.user.update({
        where: { id: created.body.id },
        data: { role },
      });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const sellerId =
      role === 'SELLER'
        ? (
            await prisma.seller.create({
              data: {
                userId: created.body.id,
                businessName: name,
                status: 'APPROVED',
                commercialRegNo: '1234567890',
              },
            })
          ).id
        : '';
    const user = {
      id: created.body.id,
      token: login.body.access_token as string,
      sellerId,
      email,
    };
    users.push(user);
    return user;
  }
  const call = (
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    userIndex: number,
    body?: unknown,
  ) => {
    const req = request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer ' + users[userIndex].token);
    return body ? req.send(body) : req;
  };
  async function body(offerId = offerIds[0], quantity = 1) {
    const offer = await prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
    });
    return {
      checkoutKey: randomUUID(),
      items: [{ offerId, quantity, expectedUnitPrice: offer.price.toString() }],
      recipientName: 'Test recipient',
      contactPhone: '+966500000001',
      shippingAddress: 'Test district, test street, building 10',
      notes: 'Order test fixture',
    };
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await account('shopper-a', 'SHOPPER');
    await account('shopper-b', 'SHOPPER');
    await account('seller-a', 'SELLER');
    await account('seller-b', 'SELLER');
    await account('admin', 'ADMIN');
    await prisma.brand.create({
      data: { id: brand, nameAr: 'اختبار', nameEn: 'Order test brand' },
    });
    await prisma.category.create({
      data: { id: category, nameAr: 'اختبار', nameEn: 'Order test category' },
    });
    for (let i = 0; i < 3; i++) {
      const product = await prisma.product.create({
        data: {
          brandId: brand,
          categoryId: category,
          matchKey: 'order-test-' + run + '-' + i,
          modelName: 'Order Product ' + i,
          images: [],
        },
      });
      const offer = await prisma.offer.create({
        data: {
          productId: product.id,
          sellerId: users[i === 1 ? 3 : 2].sellerId,
          title: product.modelName,
          images: [],
          price: '100.25',
          stock: i === 2 ? 1 : 10,
        },
      });
      productIds.push(product.id);
      offerIds.push(offer.id);
    }
  });
  afterAll(async () => {
    const ids = users.map((u) => u.id),
      sellerIds = users.map((u) => u.sellerId).filter(Boolean);
    const orders = await prisma.order.findMany({
        where: { shopperId: { in: ids } },
        select: { id: true },
      }),
      orderIds = orders.map((o) => o.id);
    await prisma.review.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.dispute.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.offer.deleteMany({ where: { id: { in: offerIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.brand.deleteMany({ where: { id: brand } });
    await prisma.category.deleteMany({ where: { id: category } });
    await app?.close();
    await prisma.$disconnect();
  });
  it('requires shopper authorization, validated quantities and server totals', async () => {
    const data = await body();
    await request(app.getHttpServer()).post('/orders').send(data).expect(401);
    await call('post', '/orders', 2, data).expect(403);
    await call('post', '/orders', 0, { ...data, totalAmount: 1 }).expect(400);
    await call('post', '/orders', 0, {
      ...data,
      items: [{ ...data.items[0], quantity: -1 }],
    }).expect(400);
    await call('post', '/orders', 0, {
      ...data,
      items: [{ ...data.items[0], expectedUnitPrice: '0.01' }],
    }).expect(409);
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: offerIds[0] } }))
        .stock,
    ).toBe(10);
  });
  it('rejects mixed sellers, duplicate lines and unavailable sellers atomically', async () => {
    const data = await body(),
      other = (await body(offerIds[1])).items[0];
    await call('post', '/orders', 0, {
      ...data,
      items: [...data.items, other],
    }).expect(400);
    await call('post', '/orders', 0, {
      ...data,
      items: [data.items[0], data.items[0]],
    }).expect(400);
    await prisma.seller.update({
      where: { id: users[3].sellerId },
      data: { status: 'PENDING' },
    });
    await call('post', '/orders', 0, await body(offerIds[1])).expect(409);
    await prisma.seller.update({
      where: { id: users[3].sellerId },
      data: { status: 'APPROVED' },
    });
  });
  it('reserves stock once and creates immutable purchase snapshots', async () => {
    const data = await body(offerIds[0], 2);
    const replies = await Promise.all([
      call('post', '/orders', 0, data),
      call('post', '/orders', 0, data),
    ]);
    expect(replies.map((r) => r.status)).toEqual([201, 201]);
    expect(replies[0].body.id).toBe(replies[1].body.id);
    orderId = replies[0].body.id;
    expect(Number(replies[0].body.totalAmount)).toBe(200.5);
    expect(replies[0].body.items[0]).toMatchObject({
      quantity: 2,
      title: 'Order Product 0',
      priceAtPurchase: '100.25',
    });
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: offerIds[0] } }))
        .stock,
    ).toBe(8);
    await call('post', '/orders', 0, {
      ...data,
      shippingAddress: 'A different valid delivery address',
    }).expect(409);
    await prisma.offer.update({
      where: { id: offerIds[0] },
      data: { price: 200 },
    });
    expect(
      Number((await call('get', '/orders/' + orderId, 0)).body.totalAmount),
    ).toBe(200.5);
    expect(
      await prisma.notification.count({
        where: { href: '/orders/' + orderId },
      }),
    ).toBe(2);
    expect(await prisma.orderEvent.count({ where: { orderId } })).toBe(1);
  });
  it('prevents overselling the last unit across different shoppers', async () => {
    const [a, b] = await Promise.all([body(offerIds[2]), body(offerIds[2])]);
    const replies = await Promise.all([
      call('post', '/orders', 0, a),
      call('post', '/orders', 1, b),
    ]);
    expect(replies.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: offerIds[2] } }))
        .stock,
    ).toBe(0);
  });
  it('isolates shopper and seller order data and protects referenced offers', async () => {
    await call('get', '/orders/' + orderId, 1).expect(404);
    await call('get', '/orders/' + orderId, 3).expect(404);
    await call('put', '/orders/' + orderId + '/status', 3, {
      status: 'CANCELLED',
    }).expect(404);
    expect(
      (await call('get', '/orders', 3)).body.items.some(
        (o: { id: string }) => o.id === orderId,
      ),
    ).toBe(false);
    await call('delete', '/seller/offers/' + offerIds[0], 2).expect(409);
  });
  it('validates the fulfillment state machine and shipping metadata', async () => {
    await call('put', '/orders/' + orderId + '/status', 0, {
      status: 'SHIPPED',
    }).expect(409);
    await call('put', '/orders/' + orderId + '/status', 2, {
      status: 'DELIVERED',
    }).expect(409);
    await call('put', '/orders/' + orderId + '/status', 2, {
      status: 'ACCEPTED',
    }).expect(200);
    await call('put', '/orders/' + orderId + '/status', 0, {
      status: 'CANCELLED',
    }).expect(409);
    await call('put', '/orders/' + orderId + '/status', 2, {
      status: 'SHIPPED',
    }).expect(400);
    await call('put', '/orders/' + orderId + '/status', 2, {
      status: 'SHIPPED',
      deliveryMethod: 'Seller courier',
      trackingNumber: 'TRACK-123',
      trackingUrl: 'https://example.com/tracking/TRACK-123',
    }).expect(200);
    const order = await call('get', '/orders/' + orderId, 0).expect(200);
    expect(order.body.trackingNumber).toBe('TRACK-123');
    expect(order.body.events.map((e: { status: string }) => e.status)).toEqual([
      'PENDING',
      'ACCEPTED',
      'SHIPPED',
    ]);
  });
  it('restores cancelled stock exactly once and keeps terminal states closed', async () => {
    const placed = await call(
      'post',
      '/orders',
      1,
      await body(offerIds[1], 2),
    ).expect(201);
    const before = (
      await prisma.offer.findUniqueOrThrow({ where: { id: offerIds[1] } })
    ).stock;
    await call('put', '/orders/' + placed.body.id + '/status', 1, {
      status: 'CANCELLED',
    }).expect(200);
    await call('put', '/orders/' + placed.body.id + '/status', 1, {
      status: 'CANCELLED',
    }).expect(200);
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: offerIds[1] } }))
        .stock,
    ).toBe(before + 2);
    await call('put', '/orders/' + placed.body.id + '/status', 3, {
      status: 'ACCEPTED',
    }).expect(409);
  });
  it('allows only verified purchasers to review delivered products and sellers', async () => {
    await call('post', '/orders/' + orderId + '/reviews', 0, {
      target: 'SELLER',
      rating: 4,
      comment: 'Helpful and reliable seller',
    }).expect(409);
    await call('put', '/orders/' + orderId + '/status', 2, {
      status: 'DELIVERED',
    }).expect(200);
    await call('post', '/orders/' + orderId + '/reviews', 1, {
      target: 'SELLER',
      rating: 4,
      comment: 'Not my actual purchase',
    }).expect(404);
    await call('post', '/orders/' + orderId + '/reviews', 0, {
      target: 'PRODUCT',
      productId: productIds[1],
      rating: 5,
      comment: 'Wrong product review',
    }).expect(400);
    const seller = await call('post', '/orders/' + orderId + '/reviews', 0, {
      target: 'SELLER',
      rating: 4,
      comment: 'Helpful and reliable seller',
    }).expect(201);
    sellerReviewId = seller.body.id;
    const product = await call('post', '/orders/' + orderId + '/reviews', 0, {
      target: 'PRODUCT',
      productId: productIds[0],
      rating: 5,
      comment: 'Product matched the listing',
    }).expect(201);
    productReviewId = product.body.id;
    await call('post', '/orders/' + orderId + '/reviews', 0, {
      target: 'SELLER',
      rating: 1,
      comment: 'Duplicate seller review',
    }).expect(409);
    expect(
      Number(
        (
          await prisma.seller.findUniqueOrThrow({
            where: { id: users[2].sellerId },
          })
        ).rating,
      ),
    ).toBe(4);
    const publicReviews = await request(app.getHttpServer())
      .get('/catalog/products/' + productIds[0] + '/reviews')
      .expect(200);
    expect(publicReviews.body.rating).toBe(5);
    expect(JSON.stringify(publicReviews.body)).not.toContain(users[0].email);
  });
  it('supports abuse reports, admin moderation and rating recalculation', async () => {
    await call('post', '/operations/reviews/' + sellerReviewId + '/report', 2, {
      reason: 'Please review this rating for abusive wording',
    }).expect(201);
    await call('post', '/operations/reviews/' + sellerReviewId + '/report', 2, {
      reason: 'Duplicate abuse report',
    }).expect(409);
    await call('put', '/admin/operations/reviews/' + sellerReviewId, 2, {
      isHidden: true,
      reason: 'Attempt without admin permissions',
    }).expect(403);
    await call('put', '/admin/operations/reviews/' + sellerReviewId, 4, {
      isHidden: true,
      reason: 'Hidden following moderation review',
    }).expect(200);
    expect(
      Number(
        (
          await prisma.seller.findUniqueOrThrow({
            where: { id: users[2].sellerId },
          })
        ).rating,
      ),
    ).toBe(0);
    expect(
      (
        await request(app.getHttpServer()).get(
          '/catalog/sellers/' + users[2].sellerId + '/reviews',
        )
      ).body.total,
    ).toBe(0);
    await call('put', '/admin/operations/reviews/' + sellerReviewId, 4, {
      isHidden: false,
      reason: 'Restored after further review',
    }).expect(200);
    expect(
      Number(
        (
          await prisma.seller.findUniqueOrThrow({
            where: { id: users[2].sellerId },
          })
        ).rating,
      ),
    ).toBe(4);
  });
  it('supports private dispute conversations and admin mediation', async () => {
    await call('post', '/orders/' + orderId + '/dispute', 1, {
      reason: 'An unrelated shopper cannot open this dispute',
    }).expect(404);
    const created = await call('post', '/orders/' + orderId + '/dispute', 0, {
      reason: 'Need help resolving the delivery issue with this seller',
    }).expect(201);
    disputeId = created.body.id;
    await call('post', '/orders/' + orderId + '/dispute', 2, {
      reason: 'A second dispute should not be created',
    }).expect(409);
    await call('post', '/operations/disputes/' + disputeId + '/messages', 3, {
      body: 'Unrelated seller message',
    }).expect(404);
    await call('post', '/operations/disputes/' + disputeId + '/messages', 2, {
      body: 'We will investigate the delivery issue.',
    }).expect(201);
    await call('post', '/operations/disputes/' + disputeId + '/messages', 4, {
      body: 'Please provide an agreed settlement.',
    }).expect(201);
    await call('put', '/admin/operations/disputes/' + disputeId, 2, {
      status: 'UNDER_REVIEW',
    }).expect(403);
    await call('put', '/admin/operations/disputes/' + disputeId, 4, {
      status: 'UNDER_REVIEW',
    }).expect(200);
    await call('put', '/admin/operations/disputes/' + disputeId, 4, {
      status: 'RESOLVED',
    }).expect(400);
    await call('put', '/admin/operations/disputes/' + disputeId, 4, {
      status: 'RESOLVED',
      resolution:
        'The seller will arrange a replacement directly with the shopper.',
    }).expect(200);
    await call('post', '/operations/disputes/' + disputeId + '/messages', 0, {
      body: 'Closed disputes cannot receive more messages.',
    }).expect(409);
    await call('put', '/admin/operations/disputes/' + disputeId, 4, {
      status: 'UNDER_REVIEW',
    }).expect(409);
  });
  it('restores returned stock once without changing purchase snapshots', async () => {
    const before = (
      await prisma.offer.findUniqueOrThrow({ where: { id: offerIds[0] } })
    ).stock;
    await call('put', '/orders/' + orderId + '/status', 2, {
      status: 'RETURNED',
    }).expect(200);
    await call('put', '/orders/' + orderId + '/status', 2, {
      status: 'RETURNED',
    }).expect(200);
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: offerIds[0] } }))
        .stock,
    ).toBe(before + 2);
    expect(
      Number(
        (await call('get', '/orders/' + orderId, 0)).body.items[0]
          .priceAtPurchase,
      ),
    ).toBe(100.25);
  });
  it('keeps notifications private and external delivery in preview mode', async () => {
    const inbox = await call('get', '/operations/notifications', 0).expect(200);
    expect(inbox.body.unread).toBeGreaterThan(0);
    expect(
      inbox.body.items.every(
        (n: { userId: string }) => n.userId === users[0].id,
      ),
    ).toBe(true);
    expect(inbox.body.items[0].deliveries).toHaveLength(3);
    expect(
      inbox.body.items[0].deliveries.every(
        (d: { status: string }) => d.status === 'PREVIEW',
      ),
    ).toBe(true);
    const otherUnread = await prisma.notification.count({
      where: { userId: users[1].id, readAt: null },
    });
    await call('put', '/operations/notifications/read', 0, {}).expect(200);
    expect(
      (await call('get', '/operations/notifications', 0)).body.unread,
    ).toBe(0);
    expect(
      await prisma.notification.count({
        where: { userId: users[1].id, readAt: null },
      }),
    ).toBe(otherUnread);
  });
  it('preserves order and review history when canonical products are merged', async () => {
    await call('post', '/admin/products/merge', 4, {
      sourceId: productIds[0],
      targetId: productIds[1],
    }).expect(201);
    const review = await prisma.review.findUniqueOrThrow({
      where: { id: productReviewId },
    });
    expect(review.productId).toBe(productIds[1]);
    const order = await call('get', '/orders/' + orderId, 0).expect(200);
    expect(order.body.items[0].title).toBe('Order Product 0');
    expect(order.body.items[0].productId).toBe(productIds[1]);
    expect(Number(order.body.totalAmount)).toBe(200.5);
  });
});
