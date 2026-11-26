import { describe, it, expect } from 'vitest';
import { normalizeProduct, validGtin } from './product-matcher';
describe('Conservative cross-store product matching', () => {
  const title = 'Apple iPhone 16 Pro 256GB Black International version';
  it('matches verified barcode identities across different titles', () => {
    expect(validGtin('4006381333931')).toBe(true);
    expect(validGtin('4006381333932')).toBe(false);
    const first = normalizeProduct({
      title,
      gtin: '4006381333931',
      itemCondition: 'NewCondition',
    });
    const second = normalizeProduct({
      title: 'عنوان مختلف',
      gtin: '4006381333931',
      itemCondition: 'https://schema.org/NewCondition',
    });
    expect(first.key).toBe(second.key);
  });
  it('never mixes new, refurbished, or box-damaged products', () => {
    const input = {
      title,
      gtin: '4006381333931',
      itemCondition: 'NewCondition',
    };
    const key = normalizeProduct(input).key;
    expect(
      normalizeProduct({ ...input, title: title + ' Refurbished' }).key,
    ).not.toBe(key);
    expect(
      normalizeProduct({ ...input, title: title + ' minor box scratches' }).key,
    ).not.toBe(key);
    expect(
      normalizeProduct({ ...input, itemCondition: undefined }).key,
    ).toBeUndefined();
  });
  it('keeps capacity, color, region, and model variants distinct', () => {
    const key = normalizeProduct({ title, itemCondition: 'NewCondition' }).key;
    expect(key).toBeTruthy();
    for (const changed of [
      title.replace('256GB', '128GB'),
      title.replace('Black', 'White'),
      title.replace('International version', 'Middle East'),
      title.replace('Pro', 'Pro Max'),
    ])
      expect(
        normalizeProduct({ title: changed, itemCondition: 'NewCondition' }).key,
      ).not.toBe(key);
    expect(
      normalizeProduct({
        title: title.replace('International version', ''),
        itemCondition: 'NewCondition',
      }).key,
    ).toBeUndefined();
  });
  it('supports exact brand/manufacturer part matching outside phones', () => {
    const input = {
      title: 'Washing machine',
      brand: 'LG',
      mpn: 'ABC-123',
      itemCondition: 'NewCondition',
    };
    expect(normalizeProduct(input).key).toBe(
      normalizeProduct({ ...input, title: 'غسالة', brand: 'lg' }).key,
    );
    expect(normalizeProduct(input).key).not.toBe(
      normalizeProduct({ ...input, mpn: 'ABC-124' }).key,
    );
  });
});
