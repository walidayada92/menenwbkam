import { describe, it, expect } from 'vitest';
import { localizedProductUrl, sourceTitle } from './localized-title';
describe('Store-provided localized titles', () => {
  it('switches eXtra product language routes', () => {
    expect(
      localizedProductUrl(
        'https://www.extra.com/en-sa/phone/p/123',
        'EXTRA',
        'ar',
      ),
    ).toBe('https://www.extra.com/ar-sa/phone/p/123');
  });
  it('reads Noon localized titles using its product adapter', () => {
    const url = 'https://www.noon.com/saudi-ar/phone/N12345678/p/';
    const html = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { product: { name: 'هاتف آيفون', price: 100, currency: 'SAR' } } } })}</script>`;
    expect(sourceTitle(html, url, 'NOON', 'N12345678', 'ar')).toBe(
      'هاتف آيفون',
    );
    expect(() => sourceTitle(html, url, 'NOON', 'N00000000', 'ar')).toThrow(
      'identity',
    );
  });
  it('uses official store language routes', () => {
    expect(
      localizedProductUrl(
        'https://www.almanea.sa/product/phone',
        'ALMANEA',
        'en',
      ),
    ).toBe('https://www.almanea.sa/en/product/phone');
    expect(
      localizedProductUrl(
        'https://www.almanea.sa/en/product/phone',
        'ALMANEA',
        'ar',
      ),
    ).toBe('https://www.almanea.sa/product/phone');
    expect(
      localizedProductUrl(
        'https://www.amazon.sa/dp/B0DGJVQ21W',
        'AMAZON',
        'en',
      ),
    ).toContain('language=en_AE');
  });
  it('preserves the exact store title and checks product identity and language', () => {
    const html =
      '<html lang="en"><input id="ASIN" value="B0DGJVQ21W"><span id="productTitle">Apple iPhone 16 (128 GB) - White</span></html>';
    expect(
      sourceTitle(
        html,
        'https://www.amazon.sa/dp/B0DGJVQ21W',
        'AMAZON',
        'B0DGJVQ21W',
        'en',
      ),
    ).toBe('Apple iPhone 16 (128 GB) - White');
    expect(() =>
      sourceTitle(
        html,
        'https://www.amazon.sa/dp/B0DGJVQ21W',
        'AMAZON',
        'different',
        'en',
      ),
    ).toThrow('identity');
    expect(() =>
      sourceTitle(
        html,
        'https://www.amazon.sa/dp/B0DGJVQ21W',
        'AMAZON',
        'B0DGJVQ21W',
        'ar',
      ),
    ).toThrow('language');
  });
});
