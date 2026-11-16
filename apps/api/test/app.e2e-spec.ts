import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prisma } from '@menenwbkam/database';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
describe('Marketplace workflows with PostgreSQL', () => {
  let app: INestApplication;
  const run = randomUUID();
  const email = (name: string) => name + '-' + run + '@example.com';
  const password = 'test-password-12345';
  let adminToken = '',
    aToken = '',
    bToken = '',
    aId = '',
    bId = '',
    offerId = '',
    productId = '';
  const brandId = 'brand-' + run,
    categoryId = 'category-' + run;
  const auth = (token: string) => 'Bearer ' + token;
  const offer = (title = 'Test Phone', price = 200) => ({
    title,
    brandId,
    categoryId,
    images: ['https://example.com/phone.jpg'],
    price,
    stock: 5,
    productUrl: 'https://example.com/buy',
    descriptionAr: 'هاتف للمقارنة',
    descriptionEn: 'A comparison phone',
  });
  async function signup(name: string, role = 'SELLER') {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: email(name), password, role })
      .expect(201);
    const logged = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email(name), password })
      .expect(201);
    return { id: registered.body.id, token: logged.body.access_token };
  }
  async function profile(token: string, name: string) {
    return (
      await request(app.getHttpServer())
        .put('/seller/profile')
        .set('Authorization', auth(token))
        .send({ businessName: name, commercialRegNo: '1234567890' })
        .expect(200)
    ).body.id;
  }
  async function verify(token: string) {
    return request(app.getHttpServer())
      .post('/seller/verification')
      .set('Authorization', auth(token))
      .attach('file', Buffer.from('%PDF-1.4\nverification document'), {
        filename: 'registration.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await prisma.brand.create({
      data: {
        id: brandId,
        nameAr: 'علامة اختبار',
        nameEn: 'Test Brand ' + run,
      },
    });
    await prisma.category.create({
      data: {
        id: categoryId,
        nameAr: 'اختبار',
        nameEn: 'Test Category ' + run,
      },
    });
    const admin = await signup('admin', 'SHOPPER');
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'ADMIN' },
    });
    adminToken = admin.token;
    aToken = (await signup('seller-a')).token;
    bToken = (await signup('seller-b')).token;
    await prisma.plan.create({
      data: {
        id: 'import-' + run,
        name: 'Import fixture',
        monthlyPrice: 0,
        yearlyPrice: 0,
        productLimit: 10,
        features: { bulkUpload: true },
      },
    });
  });
  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: run + '@example.com' } },
      select: { id: true },
    });
    const sellers = await prisma.seller.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
    });
    await prisma.offer.deleteMany({
      where: { sellerId: { in: sellers.map((s) => s.id) } },
    });
    await prisma.product.deleteMany({ where: { brandId } });
    await prisma.seller.deleteMany({
      where: { id: { in: sellers.map((s) => s.id) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: users.map((u) => u.id) } },
    });
    await prisma.brand.delete({ where: { id: brandId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.plan.deleteMany({
      where: { id: { in: ['limited-' + run, 'import-' + run] } },
    });
    for (const seller of sellers)
      if (seller.verificationPath)
        await unlink(
          resolve(process.env.UPLOAD_DIR!, seller.verificationPath),
        ).catch(() => {});
    await app?.close();
    await prisma.$disconnect();
  });
  it('rejects admin registration, weak input and unknown properties', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: email('bad'), password, role: 'ADMIN' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'bad', password: '123' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: email('bad'), password, role: 'SELLER', isVerified: true })
      .expect(400);
  });
  it('never exposes password hashes and rejects duplicate emails', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', auth(aToken))
      .expect(200);
    expect(body).not.toHaveProperty('passwordHash');
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: email('seller-a'), password, role: 'SELLER' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('seller-a'), password: 'wrong' })
      .expect(401);
  });
  it('enforces current database roles, bearer validation and tenant boundaries', async () => {
    await request(app.getHttpServer()).get('/admin/sellers').expect(401);
    await request(app.getHttpServer())
      .get('/admin/sellers')
      .set('Authorization', auth('bad'))
      .expect(401);
    await request(app.getHttpServer())
      .get('/admin/sellers')
      .set('Authorization', auth(aToken))
      .expect(403);
    const shopper = await signup('shopper', 'SHOPPER');
    await request(app.getHttpServer())
      .get('/seller/profile')
      .set('Authorization', auth(shopper.token))
      .expect(403);
    aId = await profile(aToken, 'Seller A');
    bId = await profile(bToken, 'Seller B');
    const result = await request(app.getHttpServer())
      .get('/seller/profile')
      .set('Authorization', auth(aToken))
      .expect(200);
    expect(result.body.id).toBe(aId);
    expect(result.body).not.toHaveProperty('verificationPath');
  });
  it('blocks listings until verification and admin approval', async () => {
    await request(app.getHttpServer())
      .post('/seller/offers')
      .set('Authorization', auth(aToken))
      .send(offer())
      .expect(403);
    await request(app.getHttpServer())
      .put('/admin/sellers/' + aId + '/review')
      .set('Authorization', auth(adminToken))
      .send({ status: 'APPROVED' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/seller/verification')
      .set('Authorization', auth(aToken))
      .attach('file', Buffer.from('not a document'), 'fake.pdf')
      .expect(400);
    await verify(aToken);
    await verify(bToken);
    for (const id of [aId, bId])
      await request(app.getHttpServer())
        .put('/admin/sellers/' + id + '/review')
        .set('Authorization', auth(adminToken))
        .send({ status: 'APPROVED' })
        .expect(200);
  });
  it('keeps documents private and allows authenticated admin downloads', async () => {
    await request(app.getHttpServer())
      .get('/admin/sellers/' + aId + '/verification')
      .set('Authorization', auth(bToken))
      .expect(403);
    const res = await request(app.getHttpServer())
      .get('/admin/sellers/' + aId + '/verification')
      .set('Authorization', auth(adminToken))
      .expect(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it('matches seller offers by barcode and model and compares the cheapest first', async () => {
    const a = await request(app.getHttpServer())
      .post('/seller/offers')
      .set('Authorization', auth(aToken))
      .send({ ...offer(), barcode: '1234567890123' })
      .expect(201);
    offerId = a.body.id;
    productId = a.body.productId;
    const b = await request(app.getHttpServer())
      .post('/seller/offers')
      .set('Authorization', auth(bToken))
      .send({
        ...offer('Different localized title', 150),
        barcode: '1234567890123',
      })
      .expect(201);
    expect(b.body.productId).toBe(productId);
    const detail = await request(app.getHttpServer())
      .get('/catalog/products/' + productId)
      .expect(200);
    expect(
      detail.body.offers.map((o: { price: string }) => Number(o.price)),
    ).toEqual([150, 200]);
    expect(JSON.stringify(detail.body)).not.toContain('passwordHash');
    await request(app.getHttpServer())
      .post('/seller/offers')
      .set('Authorization', auth(aToken))
      .send(offer('  TEST   PHONE  '))
      .expect(409);
  });
  it('supports search, price/brand/category/rating filters and autocomplete', async () => {
    await prisma.seller.update({ where: { id: bId }, data: { rating: 4.5 } });
    const result = await request(app.getHttpServer())
      .get('/catalog/products')
      .query({
        q: 'هاتف',
        brandId,
        categoryId,
        minPrice: 100,
        maxPrice: 180,
        minRating: 4,
        sort: 'price_asc',
      })
      .expect(200);
    expect(result.body.items.map((p: { id: string }) => p.id)).toContain(
      productId,
    );
    expect(
      Number(
        result.body.items.find((p: { id: string }) => p.id === productId)
          .bestPrice,
      ),
    ).toBe(150);
    const ac = await request(app.getHttpServer())
      .get('/catalog/autocomplete')
      .query({ q: 'Test Phone' })
      .expect(200);
    expect(ac.body.some((p: { id: string }) => p.id === productId)).toBe(true);
    await request(app.getHttpServer())
      .get('/catalog/products')
      .query({ minPrice: 300, maxPrice: 100 })
      .expect(400);
  });
  it('rejects cross-seller updates and deletes without changing data', async () => {
    await request(app.getHttpServer())
      .put('/seller/offers/' + offerId)
      .set('Authorization', auth(bToken))
      .send(offer('Test Phone', 1))
      .expect(404);
    await request(app.getHttpServer())
      .delete('/seller/offers/' + offerId)
      .set('Authorization', auth(bToken))
      .expect(404);
    expect(
      Number(
        (await prisma.offer.findUniqueOrThrow({ where: { id: offerId } }))
          .price,
      ),
    ).toBe(200);
  });
  it('updates seller listing content and hides out-of-stock and unapproved offers', async () => {
    await request(app.getHttpServer())
      .put('/seller/offers/' + offerId)
      .set('Authorization', auth(aToken))
      .send({
        ...offer('Test Phone', 190),
        stock: 0,
        descriptionEn: 'Updated description',
      })
      .expect(200);
    const row = await prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
    });
    expect(row.descriptionEn).toBe('Updated description');
    const detail = await request(app.getHttpServer())
      .get('/catalog/products/' + productId)
      .expect(200);
    expect(detail.body.offers).toHaveLength(1);
    await request(app.getHttpServer())
      .put('/admin/sellers/' + bId + '/review')
      .set('Authorization', auth(adminToken))
      .send({ status: 'REJECTED' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/catalog/products/' + productId)
      .expect(404);
    await request(app.getHttpServer())
      .put('/admin/sellers/' + bId + '/review')
      .set('Authorization', auth(adminToken))
      .send({ status: 'APPROVED' })
      .expect(200);
  });
  it('imports CSV atomically and rejects invalid rows', async () => {
    await prisma.seller.update({
      where: { id: aId },
      data: { currentPlanId: 'import-' + run },
    });
    const csv =
      'title,brandId,categoryId,images,price,stock\nImport A,' +
      brandId +
      ',' +
      categoryId +
      ',https://example.com/a.jpg,50,2\nImport B,' +
      brandId +
      ',' +
      categoryId +
      ',https://example.com/b.jpg,60,2';
    const res = await request(app.getHttpServer())
      .post('/seller/import')
      .set('Authorization', auth(aToken))
      .attach('file', Buffer.from(csv), 'products.csv')
      .expect(201);
    expect(res.body.imported).toBe(2);
    const count = await prisma.offer.count({ where: { sellerId: aId } });
    await request(app.getHttpServer())
      .post('/seller/import')
      .set('Authorization', auth(aToken))
      .attach('file', Buffer.from(csv.replace('50,2', '-1,2')), 'products.csv')
      .expect(400);
    expect(await prisma.offer.count({ where: { sellerId: aId } })).toBe(count);
    const duplicate = csv
      .replace('Import A', 'Rollback First')
      .replace('Import B', 'Test Phone');
    await request(app.getHttpServer())
      .post('/seller/import')
      .set('Authorization', auth(aToken))
      .attach('file', Buffer.from(duplicate), 'products.csv')
      .expect(409);
    expect(
      await prisma.product.count({
        where: { brandId, modelName: 'Rollback First' },
      }),
    ).toBe(0);
  });
  it('enforces free limits under concurrent writes and rolls back oversized imports', async () => {
    const c = await signup('limited');
    const id = await profile(c.token, 'Limited Seller');
    await verify(c.token);
    await prisma.plan.create({
      data: {
        id: 'limited-' + run,
        name: 'Test limit',
        monthlyPrice: 0,
        yearlyPrice: 0,
        productLimit: 1,
        features: { bulkUpload: true },
      },
    });
    await prisma.seller.update({
      where: { id },
      data: { status: 'APPROVED', currentPlanId: 'limited-' + run },
    });
    const replies = await Promise.all(
      ['Concurrent A', 'Concurrent B'].map((title) =>
        request(app.getHttpServer())
          .post('/seller/offers')
          .set('Authorization', auth(c.token))
          .send(offer(title)),
      ),
    );
    expect(replies.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 403,
    ]);
    expect(await prisma.offer.count({ where: { sellerId: id } })).toBe(1);
    const created = replies.find((r) => r.status === 201)!;
    await request(app.getHttpServer())
      .delete('/seller/offers/' + created.body.id)
      .set('Authorization', auth(c.token))
      .expect(200);
    const csv =
      'title,brandId,categoryId,images,price,stock\nLimit A,' +
      brandId +
      ',' +
      categoryId +
      ',,10,2\nLimit B,' +
      brandId +
      ',' +
      categoryId +
      ',,20,2';
    await request(app.getHttpServer())
      .post('/seller/import')
      .set('Authorization', auth(c.token))
      .attach('file', Buffer.from(csv), 'products.csv')
      .expect(403);
    expect(await prisma.offer.count({ where: { sellerId: id } })).toBe(0);
    expect(
      await prisma.product.count({ where: { brandId, modelName: 'Limit A' } }),
    ).toBe(0);
  });
  it('merges products and refuses destructive overlap', async () => {
    const a = await request(app.getHttpServer())
      .post('/seller/offers')
      .set('Authorization', auth(aToken))
      .send(offer('Merge Source'))
      .expect(201);
    const b = await request(app.getHttpServer())
      .post('/seller/offers')
      .set('Authorization', auth(bToken))
      .send(offer('Merge Target'))
      .expect(201);
    await request(app.getHttpServer())
      .post('/admin/products/merge')
      .set('Authorization', auth(aToken))
      .send({ sourceId: a.body.productId, targetId: b.body.productId })
      .expect(403);
    await request(app.getHttpServer())
      .post('/admin/products/merge')
      .set('Authorization', auth(adminToken))
      .send({ sourceId: a.body.productId, targetId: b.body.productId })
      .expect(201);
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: a.body.id } }))
        .productId,
    ).toBe(b.body.productId);
    expect(
      await prisma.product.findUnique({ where: { id: a.body.productId } }),
    ).toBeNull();
    await request(app.getHttpServer())
      .post('/admin/products/merge')
      .set('Authorization', auth(adminToken))
      .send({ sourceId: b.body.productId, targetId: productId })
      .expect(409);
    expect(
      await prisma.product.findUnique({ where: { id: b.body.productId } }),
    ).not.toBeNull();
  });
});
