import { canonicalSearchTerms } from './search-intent';
// PostgreSQL and JavaScript share this expression (no engine-specific boundaries).
export const phoneAccessoryPattern =
  '(^|[^a-z])(cases?|covers?|protectors?|screen[ -]*guards?|chargers?|cables?|earbuds?|earphones?|headphones?|wallets?|holders?|stands?|adapters?|straps?|lenses|lens)([^a-z]|$)|suitable for|compatible with|واقي|حماية الشاشة|حامي الشاشة|جراب|كفر|شاحن|سماعات|حامل|وصلة';

export function phoneOnlySearch(query: string) {
  const normalized = canonicalSearchTerms(query).toLowerCase();
  return (
    /iphone\s*\d|[اآأ]يفون\s*[0-9٠-٩]/i.test(normalized) &&
    !new RegExp(phoneAccessoryPattern, 'i').test(normalized)
  );
}

export const tvAccessoryPattern =
  '(^|[^a-z])(remotes?|remote[ -]*controls?|mounts?|brackets?|stands?|cables?|adapters?|antennas?|soundbars?|protectors?|covers?|straps?|frames?|headphones?|earbuds?)([^a-z]|$)|streaming stick|tv stick|tv box|ريموت|رموت|جهاز تحكم|حامل|قاعدة تلفزيون|كيبل|كابل|وصلة|واقي|احزمة|أحزمة|اطارات|إطارات|اطار|إطار|سماعات|مثبتات';

/** Explicit accessory queries retain their normal results. */
export function accessoryExclusion(query: string): string | null {
  if (phoneOnlySearch(query)) return phoneAccessoryPattern;
  const normalized = canonicalSearchTerms(query).toLowerCase();
  if (
    /(^|[^a-z])(tvs?|televisions?)([^a-z]|$)|تلفزيون|تلفاز/.test(normalized) &&
    !new RegExp(tvAccessoryPattern, 'i').test(normalized)
  )
    return tvAccessoryPattern;
  return null;
}
