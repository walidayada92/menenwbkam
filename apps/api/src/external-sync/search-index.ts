import { prisma, Prisma } from '@menenwbkam/database';
import { searchIntent } from '../catalog/search-intent';
import { accessoryExclusion } from '../catalog/product-search';

export function normalizeSearch(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[اآأ]يفون/g, ' iphone ')
    .replace(/آبل|أبل|ابل/g, ' apple ')
    .replace(/برو/g, ' pro ')
    .replace(/ماكس/g, ' max ')
    .replace(/بلس/g, ' plus ')
    .replace(/ميني/g, ' mini ')
    .replace(/(\d+)\s*(جيجابايت|جيجا\s*بايت|جيجا|gb)/g, ' $1gb ')
    .replace(/(\d+)\s*(تيرابايت|تيرا|tb)/g, ' $1tb ')
    .replace(/مجدد|معاد تصنيعه|renewed/g, ' refurbished ')
    .replace(/أزرق|ازرق/g, ' blue ')
    .replace(/أسود|اسود/g, ' black ')
    .replace(/أبيض|ابيض/g, ' white ')
    .replace(/وردي|بينك/g, ' pink ')
    .replace(/أخضر|اخضر/g, ' green ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
export function autocompleteTokens(query: string) {
  const tokens = normalizeSearch(searchIntent(query).query)
    .split(' ')
    .filter(Boolean)
    .slice(0, 12);
  return tokens
    .map((token, i) => token + (i === tokens.length - 1 ? ':*' : ''))
    .join(' & ');
}

export async function externalSuggestions(query: string) {
  if (query.trim().length < 2) return [];
  const tokens = autocompleteTokens(query);
  if (!tokens) return [];
  const exclusion = accessoryExclusion(query);
  const rows = await prisma.$queryRaw<
    { id: string; title: string }[]
  >(Prisma.sql`
    SELECT DISTINCT ON (l.title) l.id, l.title
    FROM "ExternalSearchDocument" d JOIN "ExternalListing" l ON l.id=d."listingId"
    WHERE d.tokens @@ to_tsquery('simple', ${tokens}) AND l.status='ACTIVE'
      AND l.price IS NOT NULL AND l.currency='SAR' AND l.title IS NOT NULL
      ${exclusion ? Prisma.sql`AND concat_ws(' ', l.title, l."titleEn", l."titleAr") !~* ${exclusion}` : Prisma.empty}
    ORDER BY l.title, l.id LIMIT 8`);
  return rows.map((row) => ({ ...row, query: row.title }));
}

export async function indexListing(listingId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${listingId}, 0))`;
    const listing = await tx.externalListing.findUnique({
      where: { id: listingId },
      include: { comparisonProduct: true },
    });
    if (!listing || listing.status !== 'ACTIVE') {
      await tx.externalSearchDocument.deleteMany({ where: { listingId } });
      return { deleted: true };
    }
    const text = normalizeSearch(
      [
        listing.title,
        listing.titleEn,
        listing.titleAr,
        listing.brand,
        listing.mpn,
        listing.gtin,
        listing.comparisonProduct?.title,
      ]
        .filter(Boolean)
        .join(' '),
    );
    await tx.$executeRaw`INSERT INTO "ExternalSearchDocument" ("listingId", text, tokens, "indexedAt")
      VALUES (${listingId}, ${text}, to_tsvector('simple', ${text}), NOW())
      ON CONFLICT ("listingId") DO UPDATE SET text=EXCLUDED.text, tokens=EXCLUDED.tokens, "indexedAt"=NOW()`;
    return { indexed: true };
  });
}
export async function indexedMatches(query: string) {
  const text = normalizeSearch(searchIntent(query).query);
  if (!text) return [];
  const accessoryPattern = accessoryExclusion(query);
  const exclusion = accessoryPattern
    ? Prisma.sql`AND text !~* ${accessoryPattern}`
    : Prisma.empty;
  return prisma.$queryRaw<
    { listingId: string }[]
  >(Prisma.sql`SELECT "listingId" FROM "ExternalSearchDocument"
    WHERE tokens @@ plainto_tsquery('simple', ${text}) ${exclusion}`);
}

export async function indexedPage(
  query: string,
  requestedPage = 1,
  productId?: string,
  sort = 'price_asc',
  store?: string,
) {
  const text = normalizeSearch(searchIntent(query).query),
    pageSize = 20;
  const accessoryPattern = accessoryExclusion(query);
  if (!text && !productId)
    return { ids: [] as string[], total: 0, page: 1, totalPages: 1, pageSize };
  return prisma.$transaction(
    async (tx) => {
      const criterion = productId
        ? Prisma.sql`l."comparisonProductId"=${productId}`
        : Prisma.sql`d.tokens @@ plainto_tsquery('simple', ${text})`;
      const from = Prisma.sql`FROM "ExternalSearchDocument" d JOIN "ExternalListing" l ON l.id=d."listingId"
      WHERE ${criterion} AND l.status='ACTIVE' AND l.currency='SAR' AND l.price IS NOT NULL
      ${store ? Prisma.sql`AND EXISTS (SELECT 1 FROM "ExternalSource" s WHERE s.id=l."sourceId" AND s.store=${store})` : Prisma.empty}
      ${!productId && accessoryPattern ? Prisma.sql`AND concat_ws(' ', l.title, l."titleEn", l."titleAr") !~* ${accessoryPattern}` : Prisma.empty}`;
      const count = await tx.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS count ${from}`,
      );
      const total = Number(count[0].count),
        totalPages = Math.max(1, Math.ceil(total / pageSize)),
        page = Math.min(requestedPage, totalPages);
      const ordering =
        sort === 'price_desc'
          ? Prisma.sql`l.price DESC, l.id ASC`
          : sort === 'available'
            ? Prisma.sql`CASE WHEN l.availability IN ('InStock', 'LimitedAvailability') THEN 0 WHEN l.availability IN ('OutOfStock', 'SoldOut', 'Discontinued') THEN 2 ELSE 1 END, l.price ASC, l.id ASC`
            : Prisma.sql`l.price ASC, l.id ASC`;
      const ids = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT l.id ${from} ORDER BY ${ordering} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      );
      return {
        ids: ids.map((row) => row.id),
        total,
        page,
        totalPages,
        pageSize,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
