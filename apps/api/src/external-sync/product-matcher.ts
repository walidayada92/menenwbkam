import { createHash } from 'node:crypto';
import { prisma, Prisma } from '@menenwbkam/database';
import { enqueue } from './job-queue';

export type MatchInput = {
  title: string | null;
  titleEn?: string | null;
  gtin?: string | null;
  brand?: string | null;
  mpn?: string | null;
  itemCondition?: string | null;
};
export function validGtin(value: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const check = digits.pop();
  const sum = digits
    .reverse()
    .reduce((total, n, i) => total + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
export function normalizeProduct(input: MatchInput) {
  const title = `${input.titleEn || ''} ${input.title || ''}`
    .normalize('NFKC')
    .toLowerCase();
  const explicit = (input.itemCondition || '')
    .split(/[/#]/)
    .pop()
    ?.toLowerCase();
  const condition =
    /refurbished|renewed|مجدد|معاد تصنيعه/.test(title) ||
    explicit === 'refurbishedcondition'
      ? 'REFURBISHED'
      : /box scratches|خدوش.*العلبة|open.box|علبة مفتوحة/.test(title)
        ? 'OPEN_BOX'
        : explicit === 'newcondition'
          ? 'NEW'
          : explicit === 'usedcondition'
            ? 'USED'
            : null;
  if (!condition)
    return { reason: 'Condition is not explicit; review required' };
  // Same barcode can represent new, used and refurbished offers; condition is always part of identity.
  if (input.gtin && validGtin(input.gtin)) {
    const attributes = { gtin: input.gtin.padStart(14, '0'), condition };
    return {
      key: 'gtin:' + attributes.gtin + ':' + condition,
      attributes,
      title: input.titleEn || input.title || input.gtin,
    };
  }
  if (input.brand?.trim() && input.mpn?.trim()) {
    const attributes = {
      brand: input.brand.trim().toLowerCase(),
      mpn: input.mpn.trim().toUpperCase(),
      condition,
    };
    return {
      key:
        'mpn:' +
        createHash('sha256').update(JSON.stringify(attributes)).digest('hex'),
      attributes,
      title: input.titleEn || input.title || input.mpn,
    };
  }
  const model = title.match(
    /(?:iphone|[اآأ]يفون)\s*(\d{1,2}e?|xr|xs|se|air|اير|اكس(?:\s*ار)?)(?:\s*(pro\s*max|pro|plus|mini|برو\s*ماكس|برو|بلس|ميني))?/i,
  );
  const storage = [
    ...title.matchAll(/(\d+)\s*(gb|tb|جيجابايت|جيجا|تيرابايت|تيرا)/g),
  ].find((m) => /tb|تيرا/.test(m[2]) || Number(m[1]) >= 32);
  const region = /international|النسخة الدولية/.test(title)
    ? 'INTERNATIONAL'
    : /middle east|الشرق الأوسط/.test(title)
      ? 'MIDDLE_EAST'
      : /saudi|ksa|السعودية/.test(title)
        ? 'SAUDI'
        : null;
  const colors: [RegExp, string][] = [
    [/natural titanium|تيتانيوم طبيعي|ناتشورال تيتانيوم/, 'natural-titanium'],
    [/desert titanium|ديزرت تيتانيوم/, 'desert-titanium'],
    [/white titanium|ابيض تيتانيوم|أبيض تيتانيوم/, 'white-titanium'],
    [/black titanium|اسود تيتانيوم|أسود تيتانيوم/, 'black-titanium'],
    [/deep blue|أزرق داكن|ازرق داكن/, 'deep-blue'],
    [/ultramarine|ازرق بحري|أزرق بحري/, 'ultramarine'],
    [/cosmic orange|كوزميك أورانج/, 'cosmic-orange'],
    [/midnight|ميدنايت/, 'midnight'],
    [/graphite|جرافيت/, 'graphite'],
    [/\bblack\b|أسود|اسود/, 'black'],
    [/\bwhite\b|أبيض|ابيض/, 'white'],
    [/\bpink\b|وردي|بينك/, 'pink'],
    [/\bblue\b|أزرق|ازرق/, 'blue'],
    [/\bgreen\b|أخضر|اخضر/, 'green'],
    [/\bsilver\b|فضي/, 'silver'],
    [/\bgold\b|ذهبي/, 'gold'],
  ];
  const color = colors.find(([pattern]) => pattern.test(title))?.[1];
  const translate: Record<string, string> = {
    برو: 'pro',
    'برو ماكس': 'pro max',
    بلس: 'plus',
    ميني: 'mini',
    اير: 'air',
    اكس: 'x',
    'اكس ار': 'xr',
  };
  if (!model || !storage || !region || !color)
    return {
      reason: 'Missing exact model, capacity, color or region; review required',
    };
  const attributes = {
    brand: 'apple',
    model: translate[model[1]] || model[1],
    variant: translate[model[2]] || model[2] || 'standard',
    storageGb: Number(storage[1]) * (/tb|تيرا/.test(storage[2]) ? 1024 : 1),
    color,
    region,
    condition,
  };
  return {
    key:
      'attributes:' +
      createHash('sha256').update(JSON.stringify(attributes)).digest('hex'),
    attributes,
    title: input.titleEn || input.title || 'Apple iPhone',
  };
}

export async function matchListing(listingId: string) {
  return prisma.$transaction(async (tx) => {
    // Serialize matching and indexing of a listing across worker processes.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${listingId}, 0))`;
    const listing = await tx.externalListing.findUnique({
      where: { id: listingId },
    });
    if (!listing) return { skipped: true };
    if (listing.matchStatus === 'MANUAL' && listing.comparisonProductId) {
      await enqueue(tx, 'INDEX', { listingId });
      return { status: 'MANUAL' };
    }
    const match = normalizeProduct(listing);
    if (match.key)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${match.key}`}, 0))`;
    const product = match.key
      ? await tx.comparisonProduct.upsert({
          where: { identityKey: match.key },
          create: {
            identityKey: match.key,
            title: match.title!,
            attributes: match.attributes as Prisma.InputJsonValue,
          },
          update: {},
        })
      : null;
    await tx.externalListing.update({
      where: { id: listingId },
      data: {
        comparisonProductId: product?.id || null,
        matchStatus: product ? 'MATCHED' : 'NEEDS_REVIEW',
        matchReason: match.reason || 'Exact identity attributes',
      },
    });
    await enqueue(tx, 'INDEX', { listingId });
    return {
      status: product ? 'MATCHED' : 'NEEDS_REVIEW',
      productId: product?.id || null,
    };
  });
}
