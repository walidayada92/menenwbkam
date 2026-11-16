import { describe, expect, it } from 'vitest';
import { searchIntent } from './search-intent';

describe('Natural-language lowest-price search', () => {
  it.each([
    'تيليفيزون',
    'تيليفيزيون',
    'تليفزيون',
    'تلفزيون',
    'تلفاز',
    'television',
    'TV',
  ])('uses the same TV query for %s', (input) => {
    expect(searchIntent(input).query).toBe('tv');
  });
  it('preserves accessory intent and model numbers when correcting spelling', () => {
    expect(searchIntent('ريموت تيليفيزون 55').query).toBe('ريموت tv 55');
  });
  it.each([
    ['the lowest iphone 17 price', 'iphone 17'],
    [
      'What is the lowest price for an iPhone 17 Pro Max 256GB?',
      'iPhone 17 Pro Max 256GB',
    ],
    [
      'Please find me the cheapest refurbished iPhone 17',
      'refurbished iPhone 17',
    ],
    ['lowest price case for iPhone 17', 'case for iPhone 17'],
    ['أرخص آيفون 17', 'آيفون 17'],
    ['ما هو أقل سعر ايفون ١٧ برو ماكس', 'ايفون ١٧ برو ماكس'],
  ])('interprets %s without losing product details', (input, query) => {
    expect(searchIntent(input)).toEqual({
      query,
      sort: 'price_asc',
      interpreted: true,
    });
  });
  it.each([
    'iPhone 17',
    'Low profile keyboard',
    'Case for iPhone 17',
    'غسالة سامسونج',
  ])('preserves a plain product search: %s', (query) => {
    expect(searchIntent(query)).toEqual({
      query,
      sort: null,
      interpreted: false,
    });
  });
  it('does not invent a product when only price intent is supplied', () => {
    expect(searchIntent('the lowest price').query).toBe('');
    expect(searchIntent('أرخص سعر').query).toBe('');
  });
});
