import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
const { database } = vi.hoisted(() => ({
  database: { $queryRaw: vi.fn().mockResolvedValue([]), $disconnect: vi.fn() },
}));
vi.mock('@menenwbkam/database', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prisma: database,
}));
import { AppModule } from '../app.module';
import { configureApp } from '../setup';

describe('Comparison-only API surface', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('serves liveness, readiness, normalized searches and indexed autocomplete', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
    const intent = await request(app.getHttpServer())
      .get('/catalog/search-intent')
      .query({ q: 'تيليفيزون' })
      .expect(200);
    expect(intent.body.query).toBe('tv');
    database.$queryRaw.mockResolvedValueOnce([
      { id: 'listing', title: 'LG Smart TV' },
    ]);
    const suggestions = await request(app.getHttpServer())
      .get('/catalog/autocomplete?q=tv')
      .expect(200);
    expect(suggestions.body).toEqual([
      { id: 'listing', title: 'LG Smart TV', query: 'LG Smart TV' },
    ]);
  });
  it.each([
    '/auth/login',
    '/auth/register',
    '/seller/products',
    '/orders',
    '/shopper/cart',
    '/admin/external-pipeline/status',
    '/catalog/products',
  ])('does not expose marketplace endpoint %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(404);
    await request(app.getHttpServer()).post(path).send({}).expect(404);
  });
  it('rejects oversized queries', async () => {
    await request(app.getHttpServer())
      .get('/catalog/autocomplete')
      .query({ q: 'a'.repeat(101) })
      .expect(400);
  });
  it('requires the configured server-to-server credential', async () => {
    vi.stubEnv('API_PROXY_SECRET', 'test-only-secret-at-least-32-characters');
    try {
      await request(app.getHttpServer())
        .get('/catalog/autocomplete?q=tv')
        .expect(401);
      await request(app.getHttpServer())
        .get('/catalog/autocomplete?q=tv')
        .set('x-api-key', process.env.API_PROXY_SECRET!)
        .expect(200);
      await request(app.getHttpServer()).get('/health/live').expect(200);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('leaves production crawling disabled by default', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_PROXY_SECRET', 'test-only-secret-at-least-32-characters');
    try {
      const result = await request(app.getHttpServer())
        .post('/catalog/external-prices/discover')
        .set('x-api-key', process.env.API_PROXY_SECRET!)
        .send({ q: 'tv' })
        .expect(201);
      expect(result.body.status).toBe('unsupported');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
