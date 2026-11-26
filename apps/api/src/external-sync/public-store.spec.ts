import { afterEach, describe, expect, it, vi } from 'vitest';
const { dns } = vi.hoisted(() => ({ dns: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: dns }));
import {
  parseProduct,
  PublicStoreClient,
  robotsAllowed,
  storeUrl,
} from './public-store';
const url = 'https://www.almanea.sa/product.html';
const html = (product: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(product)}</script>`;
const product = {
  '@type': 'Product',
  name: 'Test appliance',
  sku: 'ABC',
  offers: {
    '@type': 'Offer',
    price: '1299.00',
    priceCurrency: 'SAR',
    availability: 'https://schema.org/InStock',
  },
};
describe('Public store extraction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('extracts price and availability without inventing stock quantity', () => {
    expect(parseProduct(html({ '@graph': [product] }), url)).toMatchObject({
      price: '1299.00',
      currency: 'SAR',
      availability: 'InStock',
      stock: null,
    });
  });
  it('extracts explicit inventory only', () => {
    expect(
      parseProduct(
        html({
          ...product,
          offers: { ...product.offers, inventoryLevel: { value: 7 } },
        }),
        url,
      ).stock,
    ).toBe(7);
  });
  it('rejects captcha/login pages, malformed prices, and ambiguous variants', () => {
    expect(() =>
      parseProduct('<html>Verify you are human</html>', url),
    ).toThrow();
    expect(() =>
      parseProduct(
        html({ ...product, offers: { ...product.offers, price: 'SAR 1,299' } }),
        url,
      ),
    ).toThrow();
    expect(() => parseProduct(html([product, product]), url)).toThrow();
    expect(() =>
      parseProduct(
        html({
          ...product,
          offers: { '@type': 'AggregateOffer', lowPrice: '12' },
        }),
        url,
      ),
    ).toThrow();
  });
  it('keeps domain boundaries and rejects internal URLs, credentials, and non-HTTPS', () => {
    for (const value of [
      'http://www.almanea.sa/p',
      'https://www.almanea.sa.evil.com/p',
      'https://127.0.0.1/',
      'https://user:pass@www.almanea.sa/p',
      'https://www.almanea.sa:8443/p',
    ])
      expect(() => storeUrl(value, 'ALMANEA')).toThrow();
    expect(storeUrl(url + '#fragment', 'ALMANEA')).toBe(url);
  });
  it('honors longest allow/disallow rules and bot-specific groups', () => {
    const robots =
      'User-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*?secret=*\n';
    expect(robotsAllowed(robots, '/private/item')).toBe(false);
    expect(robotsAllowed(robots, '/private/public/item')).toBe(true);
    expect(robotsAllowed(robots, '/p?secret=1')).toBe(false);
    expect(
      robotsAllowed(
        'User-agent: *\nAllow: /\nUser-agent: MenenwbkamBot\nDisallow: /',
        '/p',
      ),
    ).toBe(false);
  });
  it('does not request a product disallowed by robots.txt', async () => {
    dns.mockResolvedValue([{ address: '8.8.8.8' }]);
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('User-agent: *\nDisallow: /', { status: 200 }),
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      new PublicStoreClient('ALMANEA', new AbortController().signal).get(url),
    ).rejects.toThrow('disallowed');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects private DNS before making a network request', async () => {
    dns.mockResolvedValue([{ address: '127.0.0.1' }]);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      new PublicStoreClient('ALMANEA', new AbortController().signal).get(url),
    ).rejects.toThrow('Non-public');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reports a shared cooldown and honors Retry-After on rate limits', async () => {
    dns.mockResolvedValue([{ address: '8.8.8.8' }]);
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('', { status: 429, headers: { 'retry-after': '7200' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    const until = new Date(Date.now() + 7200000);
    const report = vi.fn(async () => until);
    await expect(
      new PublicStoreClient(
        'ALMANEA',
        new AbortController().signal,
        undefined,
        report,
      ).get(url),
    ).rejects.toMatchObject({ retryAt: until, kind: 'RATE_LIMITED' });
    expect(report).toHaveBeenCalledWith(
      'www.almanea.sa',
      'RATE_LIMITED',
      '7200',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('pauses on HTTP-200 CAPTCHA pages without retrying or inventing a product', async () => {
    dns.mockResolvedValue([{ address: '8.8.8.8' }]);
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('<title>Robot Check</title>', { status: 200 }),
      );
    vi.stubGlobal('fetch', fetcher);
    const report = vi.fn(async () => new Date(Date.now() + 86400000));
    await expect(
      new PublicStoreClient(
        'ALMANEA',
        new AbortController().signal,
        undefined,
        report,
      ).get(url),
    ).rejects.toMatchObject({ kind: 'CHALLENGE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('stops on rate limiting without following redirects or retrying', async () => {
    dns.mockResolvedValue([{ address: '8.8.8.8' }]);
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 429 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      new PublicStoreClient('ALMANEA', new AbortController().signal).get(url),
    ).rejects.toThrow('rate limited');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
  });
  it('uses the store language preference and follows only allowed store redirects', async () => {
    dns.mockResolvedValue([{ address: '8.8.8.8' }]);
    let clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => (clock += 10000));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('User-agent: *\nAllow: /', { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response('', {
          status: 301,
          headers: { location: '/-/en/product/dp/B0DGJVQ21W' },
        }),
      )
      .mockResolvedValueOnce(new Response('English page', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await new PublicStoreClient(
      'AMAZON',
      new AbortController().signal,
    ).get('https://www.amazon.sa/dp/B0DGJVQ21W', 0, 'en');
    expect(result.resolvedUrl).toBe(
      'https://www.amazon.sa/-/en/product/dp/B0DGJVQ21W',
    );
    expect(fetcher.mock.calls[2][1].headers.cookie).toBe('lc-acbsa=en_AE');
  });
  it('rejects off-domain redirects and robots-disallowed redirect targets', async () => {
    dns.mockResolvedValue([{ address: '8.8.8.8' }]);
    let clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => (clock += 10000));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('User-agent: *\nDisallow: /private', { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response('', {
          status: 301,
          headers: { location: '/private/page' },
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      new PublicStoreClient('AMAZON', new AbortController().signal).get(
        'https://www.amazon.sa/dp/B0DGJVQ21W',
      ),
    ).rejects.toThrow('disallowed');
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher
      .mockReset()
      .mockResolvedValueOnce(
        new Response('User-agent: *\nAllow: /', { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response('', {
          status: 301,
          headers: { location: 'https://evil.example/page' },
        }),
      );
    await expect(
      new PublicStoreClient('AMAZON', new AbortController().signal).get(
        'https://www.amazon.sa/dp/B0DGJVQ21W',
      ),
    ).rejects.toThrow('HTTPS domain');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
