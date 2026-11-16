import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { prisma } from '@menenwbkam/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

describe('Shopping lists', () => {
  let app: INestApplication,
    productId = '',
    offerId = '';
  const suffix = randomUUID(),
    users: { id: string; token: string }[] = [];
  const auth = (index: number) => ({
    Authorization: `Bearer ${users[index].token}`,
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    for (const name of ['one', 'two']) {
      const email = `${name}-shopping-${suffix}@example.com`,
        password = 'a-safe-test-password';
      const registered = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name,
          email,
          phone: '+9665' + String(users.length + 1).padStart(8, '0'),
          password,
          role: 'SHOPPER',
        })
        .expect(201);
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      users.push({ id: registered.body.id, token: login.body.access_token });
    }
    const brand = await prisma.brand.create({
      data: { id: `brand-${suffix}`, nameAr: 'اختبار', nameEn: 'Test' },
    });
    const category = await prisma.category.create({
      data: { id: `category-${suffix}`, nameAr: 'اختبار', nameEn: 'Test' },
    });
    const sellerUser = await prisma.user.create({
      data: {
        email: `seller-shopping-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: 'SELLER',
      },
    });
    const seller = await prisma.seller.create({
      data: {
        userId: sellerUser.id,
        businessName: 'Test seller',
        status: 'APPROVED',
      },
    });
    const product = await prisma.product.create({
      data: {
        brandId: brand.id,
        categoryId: category.id,
        modelName: 'Saved product',
        matchKey: `saved-${suffix}`,
        images: [],
      },
    });
    productId = product.id;
    offerId = (
      await prisma.offer.create({
        data: {
          sellerId: seller.id,
          productId,
          title: 'Saved offer',
          price: 12.5,
          stock: 3,
        },
      })
    ).id;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: users.map((u) => u.id) } },
    });
    await prisma.offer.deleteMany({ where: { id: offerId } });
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (product) {
      await prisma.product.delete({ where: { id: productId } });
      await prisma.brand.deleteMany({ where: { id: product.brandId } });
      await prisma.category.deleteMany({ where: { id: product.categoryId } });
    }
    const sellerUser = await prisma.user.findUnique({
      where: { email: `seller-shopping-${suffix}@example.com` },
      include: { seller: true },
    });
    if (sellerUser?.seller)
      await prisma.seller.delete({ where: { id: sellerUser.seller.id } });
    await prisma.user.deleteMany({
      where: { email: `seller-shopping-${suffix}@example.com` },
    });
    await app.close();
  });
  it('keeps saved products private and returns live list totals through a share token', async () => {
    await request(app.getHttpServer())
      .post('/shopper/wishlist')
      .set(auth(0))
      .send({ productId })
      .expect(201);
    await request(app.getHttpServer())
      .post('/shopper/price-alerts')
      .set(auth(0))
      .send({ productId, targetPrice: '11.00' })
      .expect(201);
    const list = await request(app.getHttpServer())
      .post('/shopper/lists')
      .set(auth(0))
      .send({ name: 'Home essentials' })
      .expect(201);
    const updated = await request(app.getHttpServer())
      .post(`/shopper/lists/${list.body.id}/items`)
      .set(auth(0))
      .send({ offerId, quantity: 2 })
      .expect(201);
    expect(updated.body.total).toBe('25');
    const cart = await request(app.getHttpServer())
      .post('/shopper/cart/items')
      .set(auth(0))
      .send({ offerId, quantity: 2 })
      .expect(201);
    expect(cart.body.total).toBe('25');
    await request(app.getHttpServer())
      .get('/shopper/cart')
      .set(auth(1))
      .expect(200)
      .expect((res) => expect(res.body.items).toHaveLength(0));
    await request(app.getHttpServer())
      .get('/shopper/saved')
      .set(auth(1))
      .expect(200)
      .expect((res) => expect(res.body.wishlist).toHaveLength(0));
    await request(app.getHttpServer())
      .get('/shopper/saved')
      .set(auth(0))
      .expect(200)
      .expect((res) => expect(res.body.alerts[0].targetPrice).toBe('11'));
    await request(app.getHttpServer())
      .put(`/shopper/lists/${list.body.id}/items/${updated.body.items[0].id}`)
      .set(auth(1))
      .send({ quantity: 3 })
      .expect(404);
    const shared = await request(app.getHttpServer())
      .get(`/catalog/shared-lists/${list.body.shareToken}`)
      .expect(200);
    expect(shared.body.items[0].quantity).toBe(2);
    await prisma.offer.update({ where: { id: offerId }, data: { stock: 0 } });
    const unavailable = await request(app.getHttpServer())
      .get(`/catalog/shared-lists/${list.body.shareToken}`)
      .expect(200);
    expect(unavailable.body.total).toBe('0');
    expect(unavailable.body.items[0].available).toBe(false);
  });
});
