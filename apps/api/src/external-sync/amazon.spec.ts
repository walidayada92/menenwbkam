import { describe, expect, it } from 'vitest';
import {
  isAmazonIphoneDevice,
  amazonNextSearchPage,
  amazonSearchProducts,
  parseAmazonProduct,
} from './amazon';
const url = 'https://www.amazon.sa/iphone/dp/B0DGJVQ21W';
const page = (amounts: string, availability = 'In Stock') =>
  `<span id="productTitle">Apple iPhone 16 128GB White</span><input id="ASIN" value="B0DGJVQ21W"><div id="corePrice_feature_div">${amounts}</div><div id="availability">${availability}</div>`;
const price =
  '<span class="apex-pricetopay-value"><span class="a-offscreen">SAR 3,049.00</span></span>';
describe('Amazon public product adapter', () => {
  it('filters Arabic accessories without excluding phone feature descriptions', () => {
    for (const title of [
      'غطاء حماية لجوال آيفون 18 برو',
      'حامل بطاقات لموبايل ايفون 17',
      'شاشة حماية لموبايل آيفون 17',
      'بطارية ماج سيف ايفون',
    ])
      expect(isAmazonIphoneDevice(title)).toBe(false);
    expect(
      isAmazonIphoneDevice('ابل موبايل ايفون 17 شاشة 16 سم وعمر بطارية طويل'),
    ).toBe(true);
  });
  it('follows next-page links and stops at a disabled final page', () => {
    expect(
      amazonNextSearchPage(
        '<a class="s-pagination-next" href="/s?k=iphone&amp;page=2&amp;ref=next">Next</a>',
        'https://www.amazon.sa/s?k=iphone',
      ),
    ).toBe('https://www.amazon.sa/s?k=iphone&page=2');
    expect(
      amazonNextSearchPage(
        '<span class="s-pagination-next s-pagination-disabled">Next</span>',
        'https://www.amazon.sa/s?k=iphone&page=7',
      ),
    ).toBeNull();
  });
  it('rejects looping, off-site, changed-query and challenged pagination', () => {
    for (const href of [
      '/s?k=iphone&page=1',
      'https://evil.example/s?k=iphone&page=2',
      '/s?k=ipad&page=2',
    ])
      expect(() =>
        amazonNextSearchPage(
          `<a class="s-pagination-next" href="${href}">Next</a>`,
          'https://www.amazon.sa/s?k=iphone',
        ),
      ).toThrow();
    expect(() =>
      amazonNextSearchPage(
        '<title>Robot Check</title>',
        'https://www.amazon.sa/s?k=iphone',
      ),
    ).toThrow('CAPTCHA');
  });
  it('extracts current price, not list prices or installments', () => {
    expect(
      parseAmazonProduct(
        page(price + '<span class="a-offscreen">SAR 3,799</span>') +
          '<span class="a-offscreen">SAR 500/month</span>',
        url,
      ),
    ).toMatchObject({
      price: '3049.00',
      availability: 'InStock',
      stock: null,
      externalId: 'B0DGJVQ21W',
    });
  });
  it('preserves unavailable and unknown stock rather than guessing', () => {
    expect(
      parseAmazonProduct(page(price, 'Currently unavailable'), url)
        .availability,
    ).toBe('OutOfStock');
    expect(
      parseAmazonProduct(page(price, 'Choose delivery location'), url)
        .availability,
    ).toBe('UNKNOWN');
    expect(parseAmazonProduct(page(price, 'غير متوفر'), url).availability).toBe(
      'OutOfStock',
    );
  });
  it('rejects captcha, ambiguous prices, and mismatched products', () => {
    expect(() => parseAmazonProduct('<title>Robot Check</title>', url)).toThrow(
      'CAPTCHA',
    );
    expect(() =>
      parseAmazonProduct(page(price + price.replace('3,049', '3,199')), url),
    ).toThrow('ambiguous');
    expect(() =>
      parseAmazonProduct(
        page(price).replace('value="B0DGJVQ21W"', 'value="B012345678"'),
        url,
      ),
    ).toThrow('ASIN');
  });
  it('does not truncate malformed decimals or accept another currency', () => {
    expect(() =>
      parseAmazonProduct(page(price.replace('3,049.00', '3.04900')), url),
    ).toThrow('price');
    expect(() =>
      parseAmazonProduct(page(price.replace('SAR', 'USD')), url),
    ).toThrow('price');
  });
  it('discovers unique iPhone ASINs and excludes accessories', () => {
    const card = (title: string, asin: string) =>
      `<div data-component-type="s-search-result" data-asin="${asin}"><h2>${title}</h2><a href="/iphone/dp/${asin}/ref=search?q=iphone">View</a></div>`;
    expect(
      amazonSearchProducts(
        card('Apple iPhone 16', 'B0DGJVQ21W') +
          card('Apple iPhone 16', 'B0DGJVQ21W') +
          card('iPhone 16 case', 'B012345678'),
      ),
    ).toEqual([url]);
  });
});
