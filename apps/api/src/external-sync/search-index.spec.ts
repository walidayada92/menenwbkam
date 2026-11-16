import { describe, it, expect } from 'vitest';
import { autocompleteTokens, normalizeSearch } from './search-index';
describe('Indexed bilingual search normalization', () => {
  it('prefix matches the last word and removes query operators', () => {
    expect(autocompleteTokens('iphone 1')).toBe('iphone & 1:*');
    expect(autocompleteTokens('tv | !:*')).toBe('tv:*');
    expect(autocompleteTokens('تيليفيزون')).toBe('tv:*');
    expect(autocompleteTokens('   ')).toBe('');
  });
  it('matches Arabic and English phone attributes without generating product titles', () => {
    expect(normalizeSearch('آيفون ١٦ برو ماكس ٢٥٦ جيجابايت مجدد')).toBe(
      normalizeSearch('iPhone 16 Pro Max 256GB refurbished'),
    );
    expect(normalizeSearch('ايفون وردي')).toBe(normalizeSearch('iPhone Pink'));
  });
  it('keeps unrecognized words searchable and removes operator punctuation', () => {
    expect(normalizeSearch('LG washing-machine "new"')).toBe(
      'lg washing machine new',
    );
  });
});
