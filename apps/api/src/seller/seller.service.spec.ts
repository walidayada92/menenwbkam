import { describe, it, expect } from 'vitest';
import { matchKey } from './seller.service';
describe('Product model normalization', () => {
  it('matches case, Unicode width and whitespace differences within one brand', () => {
    expect(matchKey('apple', '  ＩＰＨＯＮＥ   16 ')).toBe(
      matchKey('apple', 'iphone 16'),
    );
    expect(matchKey('apple', 'Phone')).not.toBe(matchKey('samsung', 'Phone'));
  });
});
