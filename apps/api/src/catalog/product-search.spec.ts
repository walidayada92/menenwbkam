import { describe, expect, it } from 'vitest';
import {
  accessoryExclusion,
  tvAccessoryPattern,
  phoneAccessoryPattern,
  phoneOnlySearch,
} from './product-search';

describe('TV search relevance', () => {
  it.each([
    'tv',
    'Samsung smart TV 55 inch',
    'best price television',
    'تلفزيون سامسونج',
  ])('excludes TV accessories for %s', (query) =>
    expect(accessoryExclusion(query)).toBe(tvAccessoryPattern),
  );
  it.each(['TV remote', 'TV wall mount', 'HDMI cable for TV', 'ريموت تلفزيون'])(
    'keeps explicit accessory searches: %s',
    (query) => expect(accessoryExclusion(query)).toBeNull(),
  );
  it.each([
    'universal remote control for any tv',
    'Replacement Remote for TCL Google TV',
    'TV wall mount bracket',
    'حامل تلفزيون',
  ])('recognizes accessory %s', (title) =>
    expect(new RegExp(tvAccessoryPattern, 'i').test(title)).toBe(true),
  );
  it.each([
    'LG 55 Inch OLED Smart TV with built-in receiver',
    'Samsung 65 inch 4K UHD TV',
  ])('keeps television %s', (title) =>
    expect(new RegExp(tvAccessoryPattern, 'i').test(title)).toBe(false),
  );
});

describe('Phone search relevance', () => {
  it.each(['iPhone 17', 'lowest iPhone 17 Pro Max price', 'آيفون ١٧'])(
    'excludes accessories for %s',
    (query) => expect(phoneOnlySearch(query)).toBe(true),
  );
  it.each([
    'case for iPhone 17',
    'iPhone 17 screen protector',
    'واقي آيفون ١٧',
    'LG TV',
  ])('preserves explicit accessory and unrelated searches: %s', (query) =>
    expect(phoneOnlySearch(query)).toBe(false),
  );
  it.each([
    'Xonda Iphone 17 Screen Protector Clear',
    'Choice For iPhone 17 ProMax Phone Case',
    'iPhone 17 USB C Headphones Wired',
    'واقي شاشة آيفون 17',
  ])('identifies accessory listing %s', (title) => {
    expect(new RegExp(phoneAccessoryPattern, 'i').test(title)).toBe(true);
  });
  it('keeps real phones including titanium colors and FaceTime', () => {
    expect(
      new RegExp(phoneAccessoryPattern, 'i').test(
        'Apple iPhone 17 Pro Max 256GB Titanium With FaceTime',
      ),
    ).toBe(false);
  });
});
