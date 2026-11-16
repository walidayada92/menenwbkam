import { beforeEach, describe, expect, it, vi } from 'vitest';
const { findMany, search, host, discover } = vi.hoisted(() => ({
  host: vi.fn(),
  discover: vi.fn(),
  findMany: vi.fn(),
  search: vi.fn(),
}));
vi.mock('@menenwbkam/database', () => ({
  prisma: {
    externalListing: { findMany },
    externalHostThrottle: { findUnique: host },
  },
}));
vi.mock('./search-discovery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./search-discovery')>()),
  requestSearchDiscovery: discover,
}));
vi.mock('./search-index', () => ({ indexedPage: search }));
import {
  ExternalPricesController,
  ExternalPricesQuery,
  titleConditions,
} from './external-prices.controller';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Public external price comparison', () => {
  it('reports Noon cooldown using the same normalized host as the worker', async () => {
    discover.mockResolvedValue({ status: 'scheduled' });
    const cooldownUntil = new Date(Date.now() + 3600000);
    host.mockImplementation(async ({ where }) =>
      where.host === 'noon.com' ? { cooldownUntil } : null,
    );
    const result = await new ExternalPricesController().discover({ q: 'TV' });
    expect(result.stores).toContainEqual({
      store: 'NOON',
      status: 'cooldown',
      retryAt: cooldownUntil.toISOString(),
    });
  });
  it('reports the active store cooldown without promising immediate collection', async () => {
    discover.mockResolvedValue({ status: 'scheduled' });
    const cooldownUntil = new Date(Date.now() + 3600000);
    host.mockImplementation(async ({ where }) =>
      where.host === 'amazon.sa' ? { cooldownUntil } : null,
    );
    expect(await new ExternalPricesController().discover({ q: 'tv' })).toEqual({
      status: 'scheduled',
      stores: [
        {
          store: 'AMAZON',
          status: 'cooldown',
          retryAt: cooldownUntil.toISOString(),
        },
        { store: 'ALMANEA', status: 'scheduled' },
        { store: 'NOON', status: 'scheduled' },
        { store: 'EXTRA', status: 'scheduled' },
        { store: 'TRENDYOL', status: 'scheduled' },
      ],
    });
    expect(discover).toHaveBeenCalledWith('tv', 'AMAZON');
    expect(discover).toHaveBeenCalledWith('tv', 'ALMANEA');
    expect(discover).toHaveBeenCalledWith('tv', 'NOON');
    host.mockResolvedValue({ cooldownUntil: new Date(0) });
    expect(
      await new ExternalPricesController().discover({ q: 'tv' }),
    ).toMatchObject({
      status: 'scheduled',
    });
  });
  it('schedules Almanea and Noon even when the Amazon connector fails', async () => {
    discover.mockImplementation(async (_q, store) => {
      if (store === 'AMAZON') throw new Error('Amazon scheduling failed');
      return { status: 'queued' };
    });
    host.mockResolvedValue(null);
    const result = await new ExternalPricesController().discover({
      q: 'washer',
    });
    expect(result.stores).toContainEqual({
      store: 'AMAZON',
      status: 'unavailable',
    });
    expect(result.stores).toContainEqual({
      store: 'ALMANEA',
      status: 'queued',
    });
    expect(result.stores).toContainEqual({
      store: 'NOON',
      status: 'queued',
    });
    expect(result.status).toBe('scheduled');
  });
  beforeEach(() => {
    vi.clearAllMocks();
    search.mockResolvedValue({
      ids: ['listing'],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });
  it('matches all search terms and recognizes Arabic/English iPhone spelling', () => {
    const conditions = titleConditions('iPhone 16 128');
    expect(conditions).toHaveLength(3);
    expect(conditions[0].OR.map((entry) => entry.title.contains)).toEqual([
      'iphone',
      'ايفون',
      'آيفون',
    ]);
    expect(conditions[1].OR[0].title.contains).toBe('16');
  });
  it('rejects empty, overly long, and non-string searches', async () => {
    for (const q of ['', 'a', 'x'.repeat(101), ['iphone']]) {
      expect(
        (await validate(plainToInstance(ExternalPricesQuery, { q }))).length,
      ).toBeGreaterThan(0);
    }
  });
  it('matches English model/storage/condition terms against Arabic source titles', () => {
    const conditions = titleConditions('iPhone Pro 128GB refurbished');
    expect(conditions[1].OR.map((entry) => entry.title.contains)).toContain(
      'برو',
    );
    expect(conditions[2].OR.map((entry) => entry.title.contains)).toContain(
      '128 جيجا',
    );
    expect(conditions[3].OR.map((entry) => entry.title.contains)).toContain(
      'مجدد',
    );
  });
  it('returns real saved prices with store links and omits internal source configuration', async () => {
    findMany.mockResolvedValue([
      {
        id: 'listing',
        title: 'ايفون 16، 128 جيجا، وردي',
        titleEn: 'Apple iPhone 16, 128GB, 5G – Pink',
        titleAr: 'ايفون 16، 128 جيجا، وردي',
        price: '3549.00',
        source: { store: 'ALMANEA' },
      },
    ]);
    const result = await new ExternalPricesController().search({
      q: 'iPhone 16',
    });
    expect(result.listings[0]).toEqual({
      id: 'listing',
      price: '3549.00',
      store: 'ALMANEA',
      title: 'Apple iPhone 16, 128GB, 5G – Pink',
      titleLocalized: true,
      titleLanguage: 'en',
      url: undefined,
    });
    expect(result.stores).toHaveLength(5);
    expect(findMany.mock.calls.at(-1)?.[0].where.status).toBe('ACTIVE');
    expect(result.stores[0].searchUrl).toContain('iphone%2016');
  });
  it('returns no fabricated prices when no store matches', async () => {
    search.mockResolvedValue({
      ids: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    findMany.mockResolvedValue([]);
    const result = await new ExternalPricesController().search({ q: 'iPhone' });
    expect(result.listings).toEqual([]);
    expect(result.stores).toHaveLength(5);
  });
  it('paginates in global price order with stable ties and clamps out-of-range pages', async () => {
    search.mockResolvedValue({
      ids: ['listing'],
      total: 96,
      page: 2,
      pageSize: 20,
      totalPages: 5,
    });
    findMany.mockResolvedValue([]);
    const controller = new ExternalPricesController();
    const result = await controller.search({ q: 'iphone', page: 2 });
    expect(result).toMatchObject({
      total: 96,
      page: 2,
      pageSize: 20,
      totalPages: 5,
    });
    expect(findMany.mock.calls.at(-1)?.[0]).toMatchObject({
      take: 20,
      skip: 0,
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
      where: { id: { in: ['listing'] }, status: 'ACTIVE' },
    });
    expect(search).toHaveBeenCalledWith(
      'iphone',
      2,
      undefined,
      undefined,
      undefined,
    );
  });
  it('validates page and locale parameters', async () => {
    for (const values of [
      { page: 0 },
      { page: -2 },
      { page: 'bad' },
      { page: 1.5 },
      { locale: 'invalid' },
    ])
      expect(
        (
          await validate(
            plainToInstance(ExternalPricesQuery, { q: 'iphone', ...values }),
          )
        ).length,
      ).toBeGreaterThan(0);
  });
  it('uses the selected store language title and URL without generating a translation', async () => {
    findMany.mockResolvedValue([
      {
        title: 'ايفون وردي',
        titleAr: 'ايفون وردي',
        titleEn: 'Apple iPhone Pink',
        url: 'https://www.almanea.sa/product/phone',
        urlEn: 'https://www.almanea.sa/en/product/phone',
        source: { store: 'ALMANEA' },
      },
    ]);
    const controller = new ExternalPricesController();
    expect(
      (await controller.search({ q: 'iphone', locale: 'en' })).listings[0],
    ).toMatchObject({
      title: 'Apple iPhone Pink',
      url: 'https://www.almanea.sa/en/product/phone',
      titleLocalized: true,
    });
    expect(
      (await controller.search({ q: 'iphone', locale: 'ar' })).listings[0],
    ).toMatchObject({
      title: 'ايفون وردي',
      url: 'https://www.almanea.sa/product/phone',
      titleLocalized: true,
    });
    findMany.mockResolvedValue([
      { title: 'ايفون وردي', source: { store: 'ALMANEA' } },
    ]);
    expect(
      (await controller.search({ q: 'iphone', locale: 'en' })).listings[0],
    ).toMatchObject({
      title: 'ايفون وردي',
      titleLocalized: false,
      titleLanguage: 'ar',
    });
  });
});
