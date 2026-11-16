import { beforeEach, describe, expect, it, vi } from 'vitest';
const { tx, enqueue } = vi.hoisted(() => ({
  tx: {
    $executeRaw: vi.fn(),
    externalDiscovery: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
  enqueue: vi.fn(),
}));
vi.mock('@menenwbkam/database', () => ({
  prisma: {
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  },
}));
vi.mock('./job-queue', () => ({ enqueue }));
import { requestSearchDiscovery, searchDiscoveryUrl } from './search-discovery';

describe('Generic search discovery', () => {
  it('reuses the existing TV schedule for alternate Arabic spellings', async () => {
    tx.externalDiscovery.findUnique.mockResolvedValue({ enabled: true });
    expect(await requestSearchDiscovery('تيليفيزون')).toEqual({
      status: 'scheduled',
    });
    expect(tx.externalDiscovery.findUnique).toHaveBeenCalledWith({
      where: {
        store_startUrl: { store: 'AMAZON', startUrl: searchDiscoveryUrl('tv') },
      },
    });
    expect(tx.externalDiscovery.create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('uses the product name rather than price-intent words in discovery URLs', () => {
    expect(searchDiscoveryUrl('the lowest iphone 17 price')).toBe(
      searchDiscoveryUrl('iphone 17'),
    );
    expect(
      searchDiscoveryUrl('cheapest iPhone 17 Pro Max 256GB', 'TRENDYOL'),
    ).toBe(searchDiscoveryUrl('iPhone 17 Pro Max 256GB', 'TRENDYOL'));
  });
  it('provides a Saudi Trendyol search link', () => {
    expect(searchDiscoveryUrl('  headphones & speakers ', 'TRENDYOL')).toBe(
      'https://www.trendyol.sa/en/sr?q=headphones%20%26%20speakers',
    );
  });
  it('provides a safe eXtra store search link without queueing prohibited searches', async () => {
    expect(searchDiscoveryUrl('  Samsung TV & soundbar ', 'EXTRA')).toBe(
      'https://www.extra.com/en-sa/search/?text=samsung%20tv%20%26%20soundbar',
    );
    expect(await requestSearchDiscovery('Samsung TV', 'EXTRA')).toEqual({
      status: 'robots_disallowed',
    });
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('does not schedule Noon search URLs prohibited by its robots policy', async () => {
    expect(await requestSearchDiscovery('tv', 'NOON')).toEqual({
      status: 'robots_disallowed',
    });
    expect(tx.externalDiscovery.create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    tx.externalDiscovery.findUnique.mockResolvedValue(null);
    tx.externalDiscovery.count.mockResolvedValue(0);
    tx.externalDiscovery.create.mockResolvedValue({ id: 'new-search' });
  });
  it('canonicalizes arbitrary searches and safely encodes URL parameters', () => {
    expect(searchDiscoveryUrl('  Samsung   TV & soundbar ')).toBe(
      'https://www.amazon.sa/s?k=samsung%20tv%20%26%20soundbar',
    );
    expect(searchDiscoveryUrl('غسالة')).toContain(encodeURIComponent('غسالة'));
  });
  it('creates a daily schedule and one deduplicated worker job', async () => {
    expect(await requestSearchDiscovery('Samsung TV')).toEqual({
      status: 'queued',
    });
    expect(tx.externalDiscovery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        enabled: true,
        intervalMinutes: 1440,
        startUrl: 'https://www.amazon.sa/s?k=samsung%20tv',
      }),
    });
    expect(enqueue).toHaveBeenCalledWith(
      tx,
      'DISCOVER',
      { discoveryId: 'new-search' },
      'discovery:new-search',
    );
  });
  it('schedules arbitrary Almanea searches with independent admission limits', async () => {
    expect(searchDiscoveryUrl('  Samsung   TV & soundbar ', 'ALMANEA')).toBe(
      'https://www.almanea.sa/en/search?q=samsung%20tv%20%26%20soundbar',
    );
    expect(await requestSearchDiscovery('غسالة', 'ALMANEA')).toEqual({
      status: 'queued',
    });
    expect(tx.externalDiscovery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        store: 'ALMANEA',
        startUrl: searchDiscoveryUrl('غسالة', 'ALMANEA'),
      }),
    });
    expect(tx.externalDiscovery.count).toHaveBeenCalledWith({
      where: { store: 'ALMANEA', name: { startsWith: 'Search: ' } },
    });
  });
  it('does not requeue or reactivate an existing search', async () => {
    for (const enabled of [true, false]) {
      tx.externalDiscovery.findUnique.mockResolvedValue({ enabled });
      expect(await requestSearchDiscovery('Samsung')).toEqual({
        status: enabled ? 'scheduled' : 'disabled',
      });
    }
    expect(enqueue).not.toHaveBeenCalled();
    expect(tx.externalDiscovery.create).not.toHaveBeenCalled();
  });
  it('rejects new discovery when daily or total admission capacity is reached', async () => {
    tx.externalDiscovery.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(0);
    expect(await requestSearchDiscovery('TV')).toEqual({ status: 'capacity' });
    tx.externalDiscovery.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(10);
    expect(await requestSearchDiscovery('Washer')).toEqual({
      status: 'capacity',
    });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
