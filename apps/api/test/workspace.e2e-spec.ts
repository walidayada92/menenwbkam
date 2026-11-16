import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@menenwbkam/database';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { readSheet } from 'read-excel-file/node';
describe('Seller workspace analytics and team access', () => {
  let app: INestApplication,
    orderId = '',
    offerId = '',
    otherOfferId = '',
    catalogMember = '';
  const run = randomUUID(),
    planId = 'workspace-' + run,
    brand = 'workspace-brand-' + run,
    category = 'workspace-cat-' + run,
    visitorId = randomUUID();
  const users: {
    id: string;
    email: string;
    token: string;
    sellerId: string;
  }[] = [];
  async function account(name: string, role: 'SELLER' | 'SHOPPER' = 'SELLER') {
    const email = name + '-' + run + '@example.com',
      password = 'workspace-test-password';
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, role })
      .expect(201);
    const token = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201)
    ).body.access_token as string;
    const sellerId =
      role === 'SELLER'
        ? (
            await prisma.seller.create({
              data: {
                userId: registered.body.id,
                businessName: name,
                status: 'APPROVED',
                commercialRegNo: '1234567890',
                currentPlanId: name.startsWith('owner') ? planId : null,
              },
            })
          ).id
        : '';
    users.push({ id: registered.body.id, email, token, sellerId });
  }
  const call = (
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    user: number,
    body?: unknown,
    store?: string,
  ) => {
    const req = request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer ' + users[user].token);
    if (store) req.set('X-Store-Id', store);
    return body ? req.send(body) : req;
  };
  const offer = (price = 100, stock = 10) => ({
    title: 'Matched workspace product ' + run,
    brandId: brand,
    categoryId: category,
    price,
    stock,
    images: [],
  });
  const store = () => users[0].sellerId;
  async function invite(index: number, role: string) {
    const response = await call(
      'post',
      '/seller/workspaces/team',
      0,
      { email: users[index].email, role },
      store(),
    ).expect(201);
    await call(
      'post',
      '/seller/workspaces/invitations/' + response.body.id + '/accept',
      index,
      {},
    ).expect(201);
    return response.body.id as string;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await prisma.plan.create({
      data: {
        id: planId,
        name: 'Workspace test',
        nameAr: 'اختبار',
        monthlyPrice: 100,
        yearlyPrice: 1000,
        productLimit: 100,
        features: {
          basicAnalytics: true,
          priceHistory: true,
          teamMembers: true,
          bulkUpload: true,
        },
      },
    });
    await account('owner-a');
    await account('owner-b');
    await account('catalog');
    await account('analyst');
    await account('orders');
    await account('manager');
    await account('buyer', 'SHOPPER');
    await prisma.brand.create({
      data: { id: brand, nameAr: 'اختبار', nameEn: 'Workspace test' },
    });
    await prisma.category.create({
      data: { id: category, nameAr: 'اختبار', nameEn: 'Workspace test' },
    });
    offerId = (await call('post', '/seller/offers', 0, offer())).body.id;
    otherOfferId = (await call('post', '/seller/offers', 1, offer(110))).body
      .id;
  });
  afterAll(async () => {
    const ids = users.map((u) => u.id),
      sellerIds = users.map((u) => u.sellerId).filter(Boolean);
    const orders = await prisma.order.findMany({
        where: { shopperId: { in: ids } },
        select: { id: true },
      }),
      orderIds = orders.map((o) => o.id);
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.subscription.deleteMany({
      where: { sellerId: { in: sellerIds } },
    });
    await prisma.offer.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.product.deleteMany({ where: { brandId: brand } });
    await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.plan.deleteMany({ where: { id: planId } });
    await prisma.brand.deleteMany({ where: { id: brand } });
    await prisma.category.deleteMany({ where: { id: category } });
    await app?.close();
    await prisma.$disconnect();
  });
  it('deduplicates view/click events without storing visitor IDs', async () => {
    for (const kind of ['IMPRESSION', 'CLICK'])
      for (let i = 0; i < 2; i++)
        await request(app.getHttpServer())
          .post('/catalog/engagement')
          .send({ visitorId, kind, offerIds: [offerId] })
          .expect(201);
    const metrics = await prisma.offerMetric.findMany({ where: { offerId } });
    expect(metrics).toHaveLength(2);
    expect(metrics.every((m) => m.visitorHash !== visitorId)).toBe(true);
    await request(app.getHttpServer())
      .post('/catalog/engagement')
      .send({ visitorId: 'bad', kind: 'IMPRESSION', offerIds: [offerId] })
      .expect(400);
  });
  it('reports actual order value and attributed session conversion', async () => {
    const data = {
      checkoutKey: randomUUID(),
      visitorId,
      items: [{ offerId, quantity: 2, expectedUnitPrice: '100' }],
      recipientName: 'Workspace buyer',
      contactPhone: '+966500000001',
      shippingAddress: 'Workspace road, test district, building 10',
    };
    const placed = await call('post', '/orders', 6, data).expect(201);
    orderId = placed.body.id;
    for (const status of ['ACCEPTED', 'SHIPPED', 'DELIVERED'])
      await call('put', '/orders/' + orderId + '/status', 0, {
        status,
        ...(status === 'SHIPPED'
          ? { deliveryMethod: 'Test courier', trackingNumber: 'WORKSPACE-TEST' }
          : {}),
      }).expect(200);
    const report = await call(
      'get',
      '/seller/insights/analytics?days=30',
      0,
    ).expect(200);
    expect(report.body).toMatchObject({
      views: 1,
      clicks: 1,
      sessions: 1,
      conversionRate: 100,
      orders: 1,
      deliveredOrders: 1,
      deliveredValue: '200',
    });
    expect(report.body.topProducts[0].quantity).toBe(2);
    const other = await call(
      'get',
      '/seller/insights/analytics?days=30',
      1,
    ).expect(200);
    expect(other.body.orders).toBe(0);
    expect(other.body.views).toBe(0);
  });
  it('shows only approved in-stock competitors and records real price history', async () => {
    await call('put', '/seller/offers/' + otherOfferId, 1, offer(90)).expect(
      200,
    );
    let data = await call('get', '/seller/insights/prices', 0).expect(200);
    expect(data.body.items[0]).toMatchObject({
      position: 2,
      competitorCount: 1,
      suggestedPrice: '89.99',
      bestCompetitor: { price: '90' },
    });
    const history = await call(
      'get',
      '/seller/insights/history/' + otherOfferId,
      1,
    ).expect(200);
    expect(history.body.map((p: { price: string }) => p.price)).toEqual([
      '110',
      '90',
    ]);
    await call('get', '/seller/insights/history/' + otherOfferId, 0).expect(
      404,
    );
    const alerts = await call('get', '/seller/insights/alerts', 0).expect(200);
    expect(
      alerts.body.items.some((a: { kind: string }) => a.kind === 'PRICE_DROP'),
    ).toBe(true);
    await prisma.seller.update({
      where: { id: users[1].sellerId },
      data: { status: 'PENDING' },
    });
    data = await call('get', '/seller/insights/prices', 0).expect(200);
    expect(data.body.items[0].competitorCount).toBe(0);
    await prisma.seller.update({
      where: { id: users[1].sellerId },
      data: { status: 'APPROVED' },
    });
  });
  it('opens and resolves stock/price alerts without duplicate price points', async () => {
    await call('put', '/seller/offers/' + offerId, 0, offer(80, 2)).expect(200);
    let alerts = await call('get', '/seller/insights/alerts', 0).expect(200);
    expect(
      alerts.body.items.some((a: { kind: string }) => a.kind === 'LOW_STOCK'),
    ).toBe(true);
    expect(
      alerts.body.items.some((a: { kind: string }) => a.kind === 'PRICE_DROP'),
    ).toBe(false);
    const before = await prisma.offerPrice.count({ where: { offerId } });
    await call('put', '/seller/offers/' + offerId, 0, offer(80, 10)).expect(
      200,
    );
    expect(await prisma.offerPrice.count({ where: { offerId } })).toBe(before);
    alerts = await call('get', '/seller/insights/alerts', 0).expect(200);
    expect(
      alerts.body.items.some((a: { kind: string }) => a.kind === 'LOW_STOCK'),
    ).toBe(false);
  });
  it('requires acceptance and enforces independent catalog, analyst and order roles', async () => {
    const invitation = await call('post', '/seller/workspaces/team', 0, {
      email: users[2].email,
      role: 'CATALOG',
    }).expect(201);
    catalogMember = invitation.body.id;
    await call('post', '/seller/workspaces/select', 2, {
      sellerId: store(),
    }).expect(403);
    await call(
      'post',
      '/seller/workspaces/invitations/' + catalogMember + '/accept',
      3,
      {},
    ).expect(404);
    await call(
      'post',
      '/seller/workspaces/invitations/' + catalogMember + '/accept',
      2,
      {},
    ).expect(201);
    await invite(3, 'ANALYST');
    await invite(4, 'ORDERS');
    await invite(5, 'MANAGER');
    const catalog = await call(
      'get',
      '/seller/offers',
      2,
      undefined,
      store(),
    ).expect(200);
    expect(catalog.body[0].sellerId).toBe(store());
    await call(
      'put',
      '/seller/offers/' + offerId,
      2,
      offer(85),
      store(),
    ).expect(200);
    await call('get', '/orders', 2, undefined, store()).expect(403);
    await call(
      'get',
      '/seller/insights/analytics',
      3,
      undefined,
      store(),
    ).expect(200);
    await call('put', '/seller/offers/' + offerId, 3, offer(), store()).expect(
      403,
    );
    await call('get', '/orders/' + orderId, 4, undefined, store()).expect(200);
    await call(
      'get',
      '/seller/insights/analytics',
      4,
      undefined,
      store(),
    ).expect(403);
  });
  it('keeps ownership, verification and other tenants outside manager access', async () => {
    await call(
      'put',
      '/seller/profile',
      5,
      { businessName: 'Illegal owner change', commercialRegNo: '1234567890' },
      store(),
    ).expect(403);
    await call(
      'post',
      '/seller/workspaces/team',
      5,
      { email: users[1].email, role: 'MANAGER' },
      store(),
    ).expect(403);
    await call('get', '/seller/offers', 5, undefined, users[1].sellerId).expect(
      403,
    );
    const profile = await call(
      'get',
      '/seller/profile',
      5,
      undefined,
      store(),
    ).expect(200);
    expect(profile.body.workspaceRole).toBe('MANAGER');
    expect(profile.body).not.toHaveProperty('verificationPath');
    await call('get', '/seller/billing', 5, undefined, store()).expect(403);
  });
  it('publishes safe store branding and rejects collisions and private fields', async () => {
    const body = {
      slug: 'workspace-' + run,
      brandColor: '#123456',
      description: 'A public test store',
      lowStockThreshold: 3,
      lowStockAlerts: true,
      priceDropAlerts: true,
    };
    const saved = await call(
      'put',
      '/seller/workspaces/branding',
      5,
      body,
      store(),
    ).expect(200);
    expect(saved.body).not.toHaveProperty('verificationPath');
    expect(saved.body).not.toHaveProperty('userId');
    const publicStore = await request(app.getHttpServer())
      .get('/catalog/stores/' + body.slug)
      .expect(200);
    expect(publicStore.body.businessName).toBe('owner-a');
    expect(publicStore.body.offers[0].price).toBe('85');
    expect(publicStore.body).not.toHaveProperty('commercialRegNo');
    expect(publicStore.body).not.toHaveProperty('userId');
    await call('put', '/seller/workspaces/branding', 1, body).expect(409);
    await call('put', '/seller/workspaces/branding', 2, body, store()).expect(
      403,
    );
  });
  it('exports a real tenant-scoped workbook without shopper contact details', async () => {
    const result = await call(
      'get',
      '/seller/insights/export.xlsx?days=30',
      3,
      undefined,
      store(),
    )
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(result.headers['content-type']).toContain('spreadsheetml');
    const rows = await readSheet(result.body as Buffer, 1);
    expect(
      rows.some(
        (r) =>
          r[0] === 'Delivered order value (not collected payments)' &&
          r[1] === '200',
      ),
    ).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(users[6].email);
    await call(
      'get',
      '/seller/insights/export.xlsx',
      4,
      undefined,
      store(),
    ).expect(403);
  });
  it('applies role changes and revocation immediately', async () => {
    await call(
      'put',
      '/seller/workspaces/team/' + catalogMember,
      0,
      { role: 'ANALYST' },
      store(),
    ).expect(200);
    await call('put', '/seller/offers/' + offerId, 2, offer(), store()).expect(
      403,
    );
    await call(
      'get',
      '/seller/insights/analytics',
      2,
      undefined,
      store(),
    ).expect(200);
    await call(
      'delete',
      '/seller/workspaces/team/' + catalogMember,
      0,
      undefined,
      store(),
    ).expect(200);
    await call('get', '/seller/offers', 2, undefined, store()).expect(403);
    expect(
      (await call('get', '/seller/workspaces', 2)).body.stores.some(
        (s: { id: string }) => s.id === store(),
      ),
    ).toBe(false);
  });
  it('revokes team access when the owner subscription expires', async () => {
    await prisma.subscription.create({
      data: {
        sellerId: store(),
        planId,
        status: 'ACTIVE',
        endDate: new Date(Date.now() - 5 * 86400000),
      },
    });
    await call('get', '/seller/offers', 5, undefined, store()).expect(403);
    await call('get', '/seller/insights/analytics', 0).expect(403);
    await prisma.subscription.delete({ where: { sellerId: store() } });
    await prisma.seller.update({
      where: { id: store() },
      data: { currentPlanId: planId },
    });
  });
});
