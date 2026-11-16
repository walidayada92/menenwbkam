import { beforeEach, describe, expect, it, vi } from 'vitest';
const { db } = vi.hoisted(() => ({
  db: {
    externalSource: { findUnique: vi.fn(), updateMany: vi.fn() },
    externalListing: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    externalListingChange: { create: vi.fn() },
    externalSyncRun: { updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@menenwbkam/database', () => ({
  prisma: db,
  Prisma: { JsonNull: null },
}));
vi.mock('./job-queue', () => ({ enqueue: vi.fn(async () => ({ id: 'job' })) }));
import { ExternalSyncService, changedFields } from './external-sync.service';
import { PublicStoreClient } from './public-store';
import { localizedTitles } from './localized-title';
vi.mock('./localized-title', () => ({
  localizedTitles: vi.fn(async () => ({})),
}));
const url = 'https://www.almanea.sa/product.html';
const observation = {
  url,
  title: 'Appliance',
  externalId: null,
  price: '100.00',
  currency: 'SAR',
  availability: 'InStock',
  stock: null,
};
const existing = {
  ...observation,
  id: 'listing',
  status: 'ACTIVE',
  missingCount: 0,
};
describe('External sync worker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.mocked(localizedTitles).mockResolvedValue({});
    db.externalSource.findUnique.mockResolvedValue({
      id: 'source',
      store: 'ALMANEA',
      productUrls: [url],
      sitemapUrls: [],
      intervalMinutes: 360,
    });
    db.externalSource.updateMany.mockResolvedValue({ count: 1 });
    db.externalListing.findMany.mockResolvedValue([]);
    db.externalListing.findUnique.mockResolvedValue(null);
    db.externalListing.upsert.mockResolvedValue({ id: 'listing' });
    db.externalSyncRun.create.mockResolvedValue({ id: 'run' });
    db.externalSyncRun.update.mockImplementation(async (args) => args.data);
    db.$transaction.mockImplementation(async (callback) => callback(db));
  });
  it('compares prices numerically and tracks stock/currency/restoration separately', () => {
    expect(
      changedFields({ ...existing, price: '100' } as never, observation),
    ).toEqual([]);
    expect(
      changedFields(
        { ...existing, status: 'REMOVED', stock: 2, currency: 'USD' } as never,
        observation,
      ),
    ).toEqual(['RESTORED', 'PRICE_CHANGED', 'STOCK_CHANGED']);
  });
  it('records new products and persists run statistics', async () => {
    vi.spyOn(PublicStoreClient.prototype, 'get').mockResolvedValue({
      status: 200,
      body: `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Appliance', offers: { '@type': 'Offer', price: '100', priceCurrency: 'SAR', availability: 'https://schema.org/InStock' } })}</script>`,
    });
    const result = await new ExternalSyncService().run('source');
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      checked: 1,
      changed: 1,
    });
    expect(db.externalListingChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'ADDED' }),
      }),
    );
  });
  it('preserves a successful price check when the alternate language fails', async () => {
    vi.mocked(localizedTitles).mockRejectedValue(
      new Error('Localized page unavailable'),
    );
    vi.spyOn(PublicStoreClient.prototype, 'get').mockResolvedValue({
      status: 200,
      body: `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Appliance', offers: { '@type': 'Offer', price: '100', priceCurrency: 'SAR' } })}</script>`,
    });
    const result = await new ExternalSyncService().run('source');
    expect(result.status).toBe('PARTIAL');
    expect(db.externalListing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          price: '100.00',
          titleEn: 'Appliance',
        }),
      }),
    );
  });
  it('reuses localized titles for a day unless the source title changes', async () => {
    db.externalListing.findMany.mockResolvedValue([
      { url, title: 'Appliance', localizedCheckedAt: new Date() },
    ]);
    vi.spyOn(PublicStoreClient.prototype, 'get').mockResolvedValue({
      status: 200,
      body: `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Appliance', offers: { '@type': 'Offer', price: '100', priceCurrency: 'SAR' } })}</script>`,
    });
    await new ExternalSyncService().run('source');
    expect(localizedTitles).not.toHaveBeenCalled();
    db.externalListing.findMany.mockResolvedValue([
      { url, title: 'Old appliance', localizedCheckedAt: new Date() },
    ]);
    await new ExternalSyncService().run('source');
    expect(localizedTitles).toHaveBeenCalledTimes(1);
  });
  it('requires two explicit missing responses before removal', async () => {
    vi.spyOn(PublicStoreClient.prototype, 'get').mockResolvedValue({
      status: 404,
      body: '',
    });
    db.externalListing.findUnique.mockResolvedValue(existing);
    await new ExternalSyncService().run('source');
    expect(db.externalListingChange.create).not.toHaveBeenCalled();
    db.externalListing.findUnique.mockResolvedValue({
      ...existing,
      missingCount: 1,
    });
    await new ExternalSyncService().run('source');
    expect(db.externalListingChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'REMOVED' }),
      }),
    );
  });
  it('preserves observations on parse failure instead of marking them removed', async () => {
    vi.spyOn(PublicStoreClient.prototype, 'get').mockResolvedValue({
      status: 200,
      body: 'Captcha',
    });
    const result = await new ExternalSyncService().run('source');
    expect(result.status).toBe('FAILED');
    expect(db.externalListing.update).not.toHaveBeenCalled();
    expect(db.externalListing.upsert).not.toHaveBeenCalled();
  });
  it('refuses an overlapping run', async () => {
    db.externalSource.updateMany.mockResolvedValue({ count: 0 });
    await expect(new ExternalSyncService().run('source')).rejects.toThrow(
      'already syncing',
    );
    expect(db.externalSyncRun.create).not.toHaveBeenCalled();
  });
  it('rejects a lost lease before any listing mutation', async () => {
    vi.spyOn(PublicStoreClient.prototype, 'get').mockResolvedValue({
      status: 404,
      body: '',
    });
    db.externalSource.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 });
    const result = await new ExternalSyncService().run('source');
    expect(result.status).toBe('FAILED');
    expect(db.externalListing.findUnique).not.toHaveBeenCalled();
  });
  it('discovers new sitemap products and still checks previously seen URLs', async () => {
    db.externalSource.findUnique.mockResolvedValue({
      id: 'source',
      store: 'ALMANEA',
      productUrls: [],
      sitemapUrls: ['https://www.almanea.sa/sitemap.xml'],
      intervalMinutes: 360,
    });
    db.externalListing.findMany.mockResolvedValue([{ url }]);
    vi.spyOn(PublicStoreClient.prototype, 'discover').mockResolvedValue([
      'https://www.almanea.sa/new.html',
    ]);
    const get = vi
      .spyOn(PublicStoreClient.prototype, 'get')
      .mockResolvedValue({ status: 404, body: '' });
    await new ExternalSyncService().run('source');
    expect(get).toHaveBeenCalledWith(url);
    expect(get).toHaveBeenCalledWith('https://www.almanea.sa/new.html');
  });
});
