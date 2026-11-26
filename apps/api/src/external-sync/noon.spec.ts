import { describe, it, expect } from 'vitest';
import {
  parseNoonProduct,
  noonSearchPage,
  noonLocaleUrl,
  noonProductSku,
} from './noon';

const noonProductUrl =
  'https://www.noon.com/saudi-en/apple-iphone-16/N12345678/p/';

describe('Noon adapter', () => {
  const next = (pageProps: unknown) =>
    `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps } })}</script>`;
  it('requires an explicit currency and rejects speculative base-price fields', () => {
    expect(() =>
      parseNoonProduct(
        next({ product: { name: 'TV', price: 100 } }),
        noonProductUrl,
      ),
    ).toThrow('currency');
    expect(() =>
      parseNoonProduct(
        next({ product: { name: 'TV', basePrice: 100, currency: 'SAR' } }),
        noonProductUrl,
      ),
    ).toThrow('price');
  });
  it('rejects embedded data for a different product and blank titles', () => {
    expect(() =>
      parseNoonProduct(
        next({
          product: {
            name: 'TV',
            sku: 'DIFFERENT',
            price: 100,
            currency: 'SAR',
          },
        }),
        noonProductUrl,
      ),
    ).toThrow('identity');
    const product = {
      '@type': 'Product',
      name: ' ',
      sku: 'N12345678',
      offers: { '@type': 'Offer', price: 100, priceCurrency: 'SAR' },
    };
    const html = `<script type="application/ld+json">${JSON.stringify(product)}</script>`;
    expect(() => parseNoonProduct(html, noonProductUrl)).toThrow('title');
    expect(() =>
      parseNoonProduct(
        html
          .replace('N12345678', 'DIFFERENT')
          .replace('"name":" "', '"name":"TV"'),
        noonProductUrl,
      ),
    ).toThrow('identity');
  });
  it('rejects unrecognized search structures instead of claiming zero results', () => {
    expect(() => noonSearchPage(next({}))).toThrow('Unrecognized');
    expect(() =>
      noonSearchPage(next({ catalog: { hits: [null, { sku: 'invalid!' }] } })),
    ).toThrow('No recognizable');
    expect(noonSearchPage(next({ catalog: { hits: [] } }))).toEqual({
      products: [],
      pages: [],
    });
  });
  it('rejects invalid numeric prices and ambiguous offers', () => {
    for (const price of [Infinity, 1e20, 12.345, -1]) {
      expect(() =>
        parseNoonProduct(
          next({ product: { name: 'TV', price } }),
          noonProductUrl,
        ),
      ).toThrow();
    }
    expect(() =>
      parseNoonProduct(
        next({
          product: { name: 'TV', offers: [{ price: 12 }, { price: 14 }] },
        }),
        noonProductUrl,
      ),
    ).toThrow('ambiguous');
  });
  it('extracts SKU from a Noon product URL', () => {
    expect(noonProductSku(noonProductUrl)).toBe('N12345678');
    expect(
      noonProductSku('https://www.noon.com/saudi-en/search/?q=iphone'),
    ).toBeNull();
  });

  it('switches locale between saudi-en and saudi-ar', () => {
    expect(noonLocaleUrl(noonProductUrl, 'ar')).toBe(
      'https://www.noon.com/saudi-ar/apple-iphone-16/N12345678/p/',
    );
    expect(
      noonLocaleUrl(
        'https://www.noon.com/saudi-ar/apple-iphone-16/N12345678/p/',
        'en',
      ),
    ).toBe(noonProductUrl);
  });

  it('parses a Noon product page with JSON-LD', () => {
    const ld = JSON.stringify({
      '@type': 'Product',
      name: 'Apple iPhone 16 128GB',
      sku: 'N12345678',
      offers: {
        '@type': 'Offer',
        price: '3549',
        priceCurrency: 'SAR',
        availability: 'https://schema.org/InStock',
      },
    });
    const html = `<html><head><script type="application/ld+json">${ld}</script></head></html>`;
    const obs = parseNoonProduct(html, noonProductUrl);
    expect(obs.title).toBe('Apple iPhone 16 128GB');
    expect(obs.price).toBe('3549.00');
    expect(obs.currency).toBe('SAR');
    expect(obs.availability).toBe('InStock');
    expect(obs.externalId).toBe('N12345678');
  });

  it('falls back to __NEXT_DATA__ when no JSON-LD present', () => {
    const nextData = JSON.stringify({
      props: {
        pageProps: {
          product: {
            name: 'Apple iPhone 16',
            salePrice: 3549,
            currency: 'SAR',
            inStock: true,
          },
        },
      },
    });
    const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${nextData}</script></body></html>`;
    const obs = parseNoonProduct(html, noonProductUrl);
    expect(obs.title).toBe('Apple iPhone 16');
    expect(obs.price).toBe('3549.00');
    expect(obs.availability).toBe('InStock');
    expect(obs.externalId).toBe('N12345678');
  });

  it('throws on challenge pages', () => {
    expect(() =>
      parseNoonProduct('<title>Robot Check</title>', noonProductUrl),
    ).toThrow('access challenge');
    expect(() =>
      parseNoonProduct('<html>No data here</html>', noonProductUrl),
    ).toThrow('no Product JSON-LD');
  });

  it('extracts Noon search hits from __NEXT_DATA__', () => {
    const nextData = JSON.stringify({
      props: {
        pageProps: {
          catalog: {
            hits: [
              { sku: 'N12345678', slug: 'apple-iphone-16' },
              { sku: 'N87654321', slug: 'apple-iphone-16-pro' },
              { sku: 'bad sku!', slug: 'invalid' }, // should be skipped
            ],
          },
        },
      },
    });
    const html = `<script id="__NEXT_DATA__" type="application/json">${nextData}</script>`;
    const result = noonSearchPage(html);
    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toBe(
      'https://www.noon.com/saudi-en/apple-iphone-16/N12345678/p/',
    );
    expect(result.pages).toEqual([]);
  });

  it('also reads hits from props.pageProps.hits fallback path', () => {
    const nextData = JSON.stringify({
      props: {
        pageProps: {
          hits: [{ sku: 'N11111111', slug: 'samsung-tv' }],
        },
      },
    });
    const html = `<script id="__NEXT_DATA__" type="application/json">${nextData}</script>`;
    expect(noonSearchPage(html).products).toEqual([
      'https://www.noon.com/saudi-en/samsung-tv/N11111111/p/',
    ]);
  });
});
