import { beforeEach, describe, expect, it, vi } from 'vitest';
const { source, db, enqueue } = vi.hoisted(() => {
  const source = {
    id: 'source',
    store: 'ALMANEA',
    enabled: true,
    productUrls: ['https://www.almanea.sa/product/phone'],
    nextRunAt: new Date(Date.now() + 3600000),
  };
  const db = {
    externalDiscovery: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    externalSource: { findMany: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  return { source, db, enqueue: vi.fn() };
});
vi.mock('@menenwbkam/database', () => ({ prisma: db }));
vi.mock('./job-queue', () => ({ enqueue }));
import { PublicStoreClient } from './public-store';
import { runDiscovery } from './discovery';
describe('Discovery avoids redundant refreshes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    db.externalDiscovery.findUniqueOrThrow.mockResolvedValue({
      id: 'discovery',
      name: 'Phones',
      store: 'ALMANEA',
      enabled: true,
      startUrl: 'https://www.almanea.sa/phones-c-123',
    });
    db.externalSource.findMany.mockResolvedValue([{ ...source }]);
    db.$transaction.mockImplementation(async (callback) => callback(db));
    vi.spyOn(PublicStoreClient.prototype, 'get').mockResolvedValue({
      status: 200,
      body: '<a href="/product/phone">Phone</a>',
    });
  });
  it('does not scrape a known source again before its next refresh', async () => {
    expect(
      await runDiscovery('discovery', new AbortController().signal),
    ).toMatchObject({ added: 0, queuedSources: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('still queues a known source that is due', async () => {
    db.externalSource.findMany.mockResolvedValue([
      { ...source, nextRunAt: new Date(0) },
    ]);
    expect(
      await runDiscovery('discovery', new AbortController().signal),
    ).toMatchObject({ queuedSources: 1 });
    expect(enqueue).toHaveBeenCalledWith(
      db,
      'SYNC',
      { sourceId: 'source' },
      'source:source',
    );
  });
});
