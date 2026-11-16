import { load } from 'cheerio';
import { Observation, parseProduct, storeUrl } from './public-store';
import { isAccessChallenge } from './crawl-policy';

// ---------------------------------------------------------------------------
// Noon product URLs follow the pattern:
//   https://www.noon.com/saudi-en/<slug>/<sku>/p/
//   https://www.noon.com/saudi-ar/<slug>/<sku>/p/
// The locale segment is `saudi-en` (English) or `saudi-ar` (Arabic).
// ---------------------------------------------------------------------------

export function noonLocaleUrl(value: string, locale: 'en' | 'ar'): string {
  const url = new URL(storeUrl(value, 'NOON'));
  url.pathname = url.pathname.replace(
    /^\/(saudi-en|saudi-ar)(\/|$)/,
    locale === 'en' ? '/saudi-en$2' : '/saudi-ar$2',
  );
  return url.toString();
}

export function noonProductSku(url: string): string | null {
  const path = new URL(storeUrl(url, 'NOON')).pathname;
  return path.match(/\/([A-Za-z0-9_-]+)\/p\/?$/)?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Search page discovery
// Legacy embedded search data is supported for saved fixtures. Live browser
// discovery uses rendered result links; this structure is not live-verified.
// ---------------------------------------------------------------------------

export function noonSearchPage(html: string): {
  products: string[];
  pages: string[];
} {
  if (isAccessChallenge(html))
    throw new Error('Noon search returned an access challenge');

  const $ = load(html);
  const raw = $('#__NEXT_DATA__').text();
  if (!raw) throw new Error('Noon search page has no __NEXT_DATA__');

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Noon __NEXT_DATA__ is malformed JSON');
  }

  const d = data as Record<string, unknown>;
  const pageProps = (d?.props as Record<string, unknown>)?.pageProps as
    Record<string, unknown> | undefined;
  const hits: unknown[] =
    ((pageProps?.catalog as Record<string, unknown>)?.hits as unknown[]) ??
    (pageProps?.hits as unknown[]);

  if (!Array.isArray(hits))
    throw new Error('Unrecognized Noon search result structure');

  const products = new Set<string>();
  for (const hit of hits) {
    if (!hit || typeof hit !== 'object') continue;
    const h = hit as Record<string, unknown>;
    const sku = typeof h.sku === 'string' ? h.sku : null;
    const slug = typeof h.slug === 'string' ? h.slug : sku;
    if (!sku || !slug || !/^[A-Za-z0-9_-]+$/.test(sku)) continue;
    products.add(
      storeUrl(
        `https://www.noon.com/saudi-en/${encodeURIComponent(slug)}/${encodeURIComponent(sku)}/p/`,
        'NOON',
      ),
    );
  }

  if (hits.length && !products.size)
    throw new Error('No recognizable Noon search products');

  return { products: [...products], pages: [] };
}

// ---------------------------------------------------------------------------
// Product page parsing
// Noon product pages may embed Product JSON-LD or embed data in __NEXT_DATA__.
// ---------------------------------------------------------------------------

function flattenGraph(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenGraph);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [record, ...flattenGraph(record['@graph'])];
}

export function parseNoonProduct(html: string, url: string): Observation {
  storeUrl(url, 'NOON');
  if (isAccessChallenge(html))
    throw new Error('Noon returned an access challenge; price was not checked');

  const nodes: Record<string, unknown>[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    try {
      nodes.push(...flattenGraph(JSON.parse(match[1])));
    } catch {
      /* Ignore unrelated malformed scripts. */
    }
  }
  const products = nodes.filter((node) =>
    [node['@type']].flat().includes('Product'),
  );
  if (products.length > 1)
    throw new Error('Noon product page has ambiguous Product JSON-LD records');
  if (products.length === 1) {
    const observation = parseProduct(html, url);
    const sku = noonProductSku(url);
    if (!observation.title.trim())
      throw new Error('Noon product title is missing');
    if (sku && observation.externalId && sku !== observation.externalId)
      throw new Error('Noon product identity mismatch');
    return { ...observation, externalId: sku || observation.externalId };
  }

  const $ = load(html);
  const raw = $('#__NEXT_DATA__').text();
  if (raw) {
    try {
      return parseNoonNextData(JSON.parse(raw), url);
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error('Noon product page parse failed');
    }
  }

  throw new Error(
    'Noon product page has no Product JSON-LD and no __NEXT_DATA__',
  );
}

function validPrice(value: unknown): string | null {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    !/^\d{1,10}(\.\d{1,2})?$/.test(String(value)) ||
    Number(value) <= 0
  )
    return null;
  return String(value);
}

function resolveNoonPrice(product: Record<string, unknown>): string | null {
  const offers = Array.isArray(product.offers) ? product.offers : [];
  if (offers.length > 1) throw new Error('Noon product has ambiguous offers');
  const direct = validPrice(product.salePrice) || validPrice(product.price);
  if (direct) return direct;
  const offer = offers[0];
  if (!offer || typeof offer !== 'object') return null;
  return validPrice(offer.salePrice) || validPrice(offer.price);
}

function parseNoonNextData(data: unknown, url: string): Observation {
  const d = data as Record<string, unknown>;
  const pageProps = (d?.props as Record<string, unknown>)?.pageProps as
    Record<string, unknown> | undefined;

  const product: Record<string, unknown> =
    (pageProps?.product as Record<string, unknown>) ??
    (pageProps?.catalogItem as Record<string, unknown>) ??
    {};

  const name =
    typeof product.name === 'string'
      ? product.name
      : (product.title as string | undefined);
  if (typeof name !== 'string' || !name.trim())
    throw new Error('Noon __NEXT_DATA__ product name is missing');

  const rawPrice = resolveNoonPrice(product);
  if (!rawPrice)
    throw new Error('Noon __NEXT_DATA__ product price is missing or zero');

  const currency =
    typeof product.currency === 'string' ? product.currency.toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency))
    throw new Error('Noon __NEXT_DATA__ currency is unrecognized');

  const inStock = (product as Record<string, unknown>).inStock;
  const availabilityRaw =
    typeof product.availability === 'string'
      ? product.availability
      : typeof inStock === 'boolean'
        ? inStock
          ? 'InStock'
          : 'OutOfStock'
        : 'UNKNOWN';
  const availability = availabilityRaw.split(/[/#]/).pop() || 'UNKNOWN';

  const sku = noonProductSku(url);
  if (typeof product.sku === 'string' && sku && product.sku !== sku)
    throw new Error('Noon product identity mismatch');

  return {
    url,
    gtin: null,
    brand:
      typeof product.brand === 'string'
        ? product.brand
        : typeof (product.brand as { name?: unknown })?.name === 'string'
          ? (product.brand as { name: string }).name
          : null,
    mpn: null,
    itemCondition: null,
    title: name.slice(0, 1000),
    externalId: sku,
    price: Number(rawPrice).toFixed(2),
    currency,
    availability,
    stock: null,
  };
}
