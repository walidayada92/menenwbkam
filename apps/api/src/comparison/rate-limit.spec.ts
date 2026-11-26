import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { comparisonRateLimit } from './rate-limit';
describe('Comparison request limits', () => {
  it('limits bursts and reports a retry time while preserving health checks', async () => {
    const app = express();
    app.use(comparisonRateLimit(2));
    app.get(/.*/, (_req, res) => {
      res.json({ ok: true });
    });
    await request(app).get('/catalog/autocomplete?q=tv').expect(200);
    await request(app).get('/catalog/autocomplete?q=tv').expect(200);
    const limited = await request(app)
      .get('/catalog/autocomplete?q=tv')
      .expect(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    await request(app).get('/health/live').expect(200);
  });
});
