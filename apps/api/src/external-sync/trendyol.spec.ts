import { describe, expect, it } from 'vitest';
import {
  discoveryUrl,
  productIdentity,
  renderedSearchProducts,
} from './discovery';
import { parseProduct } from './public-store';
import { localizedProductUrl } from './localized-title';

describe('Trendyol Saudi connector', () => {
  it('extracts result cards only and preserves seller choice', () => {
    const start = 'https://www.trendyol.sa/en/sr?q=headphones';
    expect(discoveryUrl(start, 'TRENDYOL')).toBe(start);
    const result = renderedSearchProducts(
      '<aside><a href="/en/gift-p-1">Menu</a></aside><div class="search-result-content"><a class="product-card" href="/en/jbl/headphones-p-123?merchantId=99&amp;boutiqueId=61">Headphones</a><a class="product-card" href="https://evil.example/en/phone-p-2">Other</a></div>',
      start,
      'TRENDYOL',
    );
    expect(result.products).toEqual([
      'https://www.trendyol.sa/en/jbl/headphones-p-123?merchantId=99',
    ]);
    expect(productIdentity(result.products[0], 'TRENDYOL')).not.toBe(
      productIdentity(result.products[0].replace('=99', '=98'), 'TRENDYOL'),
    );
  });
  it('parses the Product/Offer structure returned by Saudi product pages', () => {
    const url = 'https://www.trendyol.sa/en/jbl/headphones-p-123?merchantId=99';
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'JBL Headphones', sku: '123', brand: { name: 'JBL' }, offers: { '@type': 'Offer', price: '110.00', priceCurrency: 'SAR', availability: 'https://schema.org/InStock' } })}</script>`;
    expect(parseProduct(html, url)).toMatchObject({
      price: '110.00',
      currency: 'SAR',
      externalId: '123',
      availability: 'InStock',
    });
    expect(localizedProductUrl(url, 'TRENDYOL', 'ar')).toBe(
      'https://www.trendyol.sa/ar/jbl/headphones-p-123?merchantId=99',
    );
  });
});
