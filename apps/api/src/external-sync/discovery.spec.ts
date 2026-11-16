import { describe, it, expect, vi } from 'vitest';
import {
  discoverProducts,
  discoveryUrl,
  almaneaPage,
  almaneaSearchPage,
} from './discovery';
import { PublicStoreClient } from './public-store';
import { noonSearchPage } from './noon';
const card = (asin: string) =>
  `<div data-component-type="s-search-result" data-asin="${asin}"><h2>Apple iPhone 16</h2><a href="/iphone/dp/${asin}">View</a></div>`;
describe('Scheduled discovery', () => {
  const searchPage = (products: unknown[], numberOfHits = products.length) =>
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { searchResults: { products, numberOfHits, numberOfPages: 5 } } } })}</script>`;
  it('discovers arbitrary Almanea searches from the embedded result batch', async () => {
    const start = 'https://www.almanea.sa/en/search?q=washer';
    expect(discoveryUrl(start, 'ALMANEA')).toBe(start);
    const get = vi.fn().mockResolvedValue({
      status: 200,
      body:
        searchPage([
          { rewrite_url: 'samsung-washer-p-123' },
          { rewrite_url: 'samsung-washer-p-123' },
        ]) + '<a href="/en/product/unrelated">Recommendation</a>',
    });
    const result = await discoverProducts(
      'ALMANEA',
      start,
      { get } as unknown as PublicStoreClient,
      new AbortController().signal,
    );
    expect(result).toEqual({
      urls: ['https://www.almanea.sa/en/product/samsung-washer-p-123'],
      pages: 1,
    });
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('accepts verified empty searches and rejects malformed results and unsafe slugs', () => {
    expect(almaneaSearchPage(searchPage([]))).toEqual({
      products: [],
      pages: [],
    });
    expect(() => almaneaSearchPage('<html>Challenge</html>')).toThrow();
    expect(() => almaneaSearchPage(searchPage([], 12))).toThrow('missing');
    expect(() =>
      almaneaSearchPage(searchPage([{ rewrite_url: '//evil.example' }])),
    ).toThrow();
    expect(() =>
      discoveryUrl('https://www.almanea.sa/en/search?q=', 'ALMANEA'),
    ).toThrow();
  });
  it('collects non-iPhone search results and follows their pagination', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        body:
          card('B012345678').replace('Apple iPhone 16', 'Samsung television') +
          '<a class="s-pagination-next" href="/s?k=samsung&amp;page=2">Next</a>',
      })
      .mockResolvedValueOnce({
        status: 200,
        body: card('B012345679').replace(
          'Apple iPhone 16',
          'Samsung washing machine',
        ),
      });
    const result = await discoverProducts(
      'AMAZON',
      'https://www.amazon.sa/s?k=samsung',
      { get } as unknown as PublicStoreClient,
      new AbortController().signal,
    );
    expect(result.pages).toBe(2);
    expect(result.urls).toHaveLength(2);
  });
  it('follows all seven pages and deduplicates ASINs', async () => {
    let page = 0;
    const get = vi.fn(async () => {
      page++;
      return {
        status: 200,
        body:
          card('B012345678') +
          card('B00000000' + page) +
          (page < 7
            ? `<a class="s-pagination-next" href="/s?k=iphone&amp;page=${page + 1}">Next</a>`
            : '<span class="s-pagination-next s-pagination-disabled">Next</span>'),
      };
    });
    const result = await discoverProducts(
      'AMAZON',
      'https://www.amazon.sa/s?k=iphone',
      { get } as unknown as PublicStoreClient,
      new AbortController().signal,
    );
    expect(result.pages).toBe(7);
    expect(result.urls).toHaveLength(8);
    expect(get).toHaveBeenCalledTimes(7);
  });
  it('fails visibly on incomplete pages and invalid store boundaries', async () => {
    expect(() =>
      discoveryUrl('https://evil.example/s?k=iphone', 'AMAZON'),
    ).toThrow();
    expect(() =>
      discoveryUrl('https://www.noon.com/saudi-en/search/?q=iphone', 'NOON'),
    ).not.toThrow();
    expect(() =>
      discoveryUrl('https://www.noon.com/saudi-en/p/N12345', 'NOON'),
    ).toThrow('requires a search URL');
    await expect(
      discoverProducts(
        'AMAZON',
        'https://www.amazon.sa/s?k=iphone',
        {
          get: async () => ({ status: 200, body: 'Captcha' }),
        } as unknown as PublicStoreClient,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  });
  it('discovers category products and pagination without crawling unrelated hosts', () => {
    expect(
      almaneaPage(
        '<a href="/product/washer">Product</a><a href="/appliances-c-123?page=2">Next</a><a href="https://evil.example/product/p">No</a>',
        'https://www.almanea.sa/appliances-c-123',
        'https://www.almanea.sa/appliances-c-123',
      ),
    ).toEqual({
      products: ['https://www.almanea.sa/product/washer'],
      pages: ['https://www.almanea.sa/appliances-c-123?page=2'],
    });
  });
  it('discovers Noon search products from __NEXT_DATA__ and accepts empty results', async () => {
    const nextData = (hits: unknown[]) =>
      `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: { pageProps: { catalog: { hits } } },
      })}</script>`;
    expect(
      noonSearchPage(
        nextData([
          { sku: 'N12345678', slug: 'apple-iphone-16' },
          { sku: 'N12345678', slug: 'apple-iphone-16' },
        ]),
      ),
    ).toEqual({
      products: ['https://www.noon.com/saudi-en/apple-iphone-16/N12345678/p/'],
      pages: [],
    });
    expect(noonSearchPage(nextData([]))).toEqual({ products: [], pages: [] });
    expect(() => noonSearchPage('<html>No next data</html>')).toThrow(
      '__NEXT_DATA__',
    );
  });
  it('discovers Noon products end-to-end via discoverProducts', async () => {
    const start = 'https://www.noon.com/saudi-en/search/?q=iphone';
    expect(discoveryUrl(start, 'NOON')).toBe(start);
    const nextData = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
      {
        props: {
          pageProps: {
            catalog: { hits: [{ sku: 'N12345678', slug: 'apple-iphone-16' }] },
          },
        },
      },
    )}</script>`;
    const get = vi.fn().mockResolvedValue({ status: 200, body: nextData });
    const result = await discoverProducts(
      'NOON',
      start,
      { get } as unknown as PublicStoreClient,
      new AbortController().signal,
    );
    expect(result.urls).toEqual([
      'https://www.noon.com/saudi-en/apple-iphone-16/N12345678/p/',
    ]);
    expect(result.pages).toBe(1);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
