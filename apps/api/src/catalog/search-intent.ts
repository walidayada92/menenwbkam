/** Known aliases only; preserve model numbers and explicit accessory words. */
export function canonicalSearchTerms(input: string) {
  return input
    .normalize('NFKC')
    .replace(
      /(^|[^\p{L}\p{N}])(?:تيليفيزيون|تيليفيزون|تليفزيون|تلفزيون|تلفاز|televisions?|tvs?)(?=$|[^\p{L}\p{N}])/giu,
      '$1tv',
    );
}

/** Conservative phrase rules: keep model, capacity, condition and accessory words. */
export function searchIntent(input: string) {
  const original = canonicalSearchTerms(input).trim().replace(/\s+/g, ' ');
  const lowest =
    /\b(lowest|cheapest|least expensive|best price)\b|أرخص|ارخص|اقل سعر|أقل سعر|السعر الأقل|السعر الاقل/.test(
      original.toLowerCase(),
    );
  if (!lowest) return { query: original, sort: null, interpreted: false };
  let query = original
    .replace(
      /\b(lowest|cheapest|least expensive|best price|prices?|cost)\b/gi,
      ' ',
    )
    .replace(
      /أرخص|ارخص|اقل سعر|أقل سعر|السعر الأقل|السعر الاقل|سعر|السعر/g,
      ' ',
    )
    .replace(/^[\s؟?!.,]+|[\s؟?!.,]+$/g, '')
    .replace(
      /^(?:(?:please|show me|find me|find|show|what is|what's|where can i find|i want|i need|the|a|an|for|of)(?:\s+|$))+/i,
      '',
    )
    .replace(
      /^(?:(?:ابحث لي عن|ابحث عن|اعرض لي|اعرض|أريد|اريد|ابي|أبي|ما هو|ماهو|وش|عن|لـ)\s*)+/g,
      '',
    )
    .trim()
    .replace(/\s+/g, ' ');
  query = query.replace(/[؟?!.]+$/, '').trim();
  return { query, sort: 'price_asc' as const, interpreted: true };
}
