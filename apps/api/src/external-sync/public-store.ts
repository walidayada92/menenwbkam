import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { setTimeout as delayFor } from 'node:timers/promises';
import {
  BackoffKind,
  cooldownDeadline,
  isAccessChallenge,
  requestSpacing,
  StoreBackoffError,
} from './crawl-policy';

export const stores = {
  AMAZON: ['amazon.sa', 'www.amazon.sa'],
  NOON: ['noon.com', 'www.noon.com'],
  ALMANEA: ['almanea.sa', 'www.almanea.sa'],
  EXTRA: ['extra.com', 'www.extra.com'],
  TRENDYOL: ['trendyol.sa', 'www.trendyol.sa'],
} as const;
export type Store = keyof typeof stores;
export type Observation = {
  localizedCheckedAt?: string;
  gtin?: string | null;
  brand?: string | null;
  mpn?: string | null;
  itemCondition?: string | null;
  titleEn?: string;
  titleAr?: string;
  urlEn?: string;
  urlAr?: string;
  url: string;
  title: string;
  externalId: string | null;
  price: string;
  currency: string;
  availability: string;
  stock: number | null;
};
export function storeUrl(value: string, store: Store) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !(stores[store] as readonly string[]).includes(url.hostname)
  )
    throw new Error('URL must use the selected store’s HTTPS domain');
  url.hash = '';
  return url.toString();
}

// Fail closed for non-public DNS answers, including IPv4-mapped IPv6 addresses.
export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  return /^2[0-9a-f]{3}:/i.test(address);
}

export function robotsAllowed(text: string, target: string) {
  const groups: {
    agents: string[];
    rules: { path: string; allow: boolean }[];
  }[] = [];
  let group: (typeof groups)[number] | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (!group || group.rules.length) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (group && (key === 'allow' || key === 'disallow') && value) {
      group.rules.push({ path: value, allow: key === 'allow' });
    }
  }
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== '*' && 'menenwbkambot'.includes(a)),
  );
  const selected = specific.length
    ? specific
    : groups.filter((g) => g.agents.includes('*'));
  const rules = selected
    .flatMap((g) => g.rules)
    .filter((r) => {
      const pattern = r.path
        .split('*')
        .map((part) => part.replace(/[.+?^{}()|[\]\\]/g, '\\$&'))
        .join('.*')
        .replace(/\$$/, '$');
      return new RegExp('^' + pattern).test(target);
    })
    .sort(
      (a, b) =>
        b.path.length - a.path.length || Number(b.allow) - Number(a.allow),
    );
  return rules[0]?.allow ?? true;
}

function records(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(records);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [record, ...records(record['@graph'])];
}
export function parseProduct(html: string, url: string): Observation {
  const nodes: Record<string, unknown>[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    try {
      nodes.push(...records(JSON.parse(match[1])));
    } catch {
      /* Other scripts may be malformed. */
    }
  }
  const products = nodes.filter((node) =>
    [node['@type']].flat().includes('Product'),
  );
  if (products.length !== 1)
    throw new Error('Expected one unambiguous Product JSON-LD record');
  const product = products[0];
  const offers = records(product.offers).filter((node) =>
    [node['@type']].flat().includes('Offer'),
  );
  if (offers.length !== 1)
    throw new Error(
      'Expected one unambiguous Offer; aggregate prices are not stock',
    );
  const offer = offers[0];
  const price =
    typeof offer.price === 'string' || typeof offer.price === 'number'
      ? String(offer.price)
      : '';
  const currency =
    typeof offer.priceCurrency === 'string'
      ? offer.priceCurrency.toUpperCase()
      : '';
  if (
    !/^\d{1,10}(\.\d{1,2})?$/.test(price) ||
    Number(price) <= 0 ||
    !/^[A-Z]{3}$/.test(currency) ||
    typeof product.name !== 'string'
  )
    throw new Error('Product price, currency, or name is missing/invalid');
  const availability =
    (typeof offer.availability === 'string' ? offer.availability : '')
      .split(/[/#]/)
      .pop() || 'UNKNOWN';
  const inventory = offer.inventoryLevel as { value?: unknown } | undefined;
  const stock =
    typeof inventory?.value === 'number' &&
    Number.isInteger(inventory.value) &&
    inventory.value >= 0 &&
    inventory.value <= 2147483647
      ? inventory.value
      : null;
  return {
    url,
    gtin:
      typeof (
        product.gtin13 ||
        product.gtin14 ||
        product.gtin12 ||
        product.gtin
      ) === 'string'
        ? String(
            product.gtin13 || product.gtin14 || product.gtin12 || product.gtin,
          )
        : null,
    brand:
      typeof product.brand === 'string'
        ? product.brand
        : typeof (product.brand as { name?: unknown })?.name === 'string'
          ? (product.brand as { name: string }).name
          : null,
    mpn: typeof product.mpn === 'string' ? product.mpn : null,
    itemCondition:
      typeof offer.itemCondition === 'string' ? offer.itemCondition : null,
    title: product.name.slice(0, 1000),
    externalId:
      typeof product.sku === 'string' ? product.sku.slice(0, 200) : null,
    price: Number(price).toFixed(2),
    currency,
    availability,
    stock,
  };
}

export class PublicStoreClient {
  private robots = new Map<string, string>();
  private lastRequest = 0;
  private requestDelay = 2000;
  constructor(
    private store: Store,
    private signal: AbortSignal,
    private throttle?: (
      host: string,
      delayMs: number,
      signal: AbortSignal,
    ) => Promise<void>,
    private reportBackoff?: (
      host: string,
      kind: BackoffKind,
      retryAfter: string | null,
    ) => Promise<Date>,
  ) {}
  private async request(
    value: string,
    locale?: 'en' | 'ar',
  ): Promise<{ status: number; body: string; location?: string }> {
    const url = storeUrl(value, this.store);
    const addresses = await lookup(new URL(url).hostname, { all: true });
    if (
      !addresses.length ||
      addresses.some((entry) => !publicAddress(entry.address))
    )
      throw new Error('Non-public store address');
    const spacing = requestSpacing(this.requestDelay);
    const delay = Math.max(0, spacing - (Date.now() - this.lastRequest));
    if (delay) await delayFor(delay, undefined, { signal: this.signal });
    if (this.throttle)
      await this.throttle(new URL(url).hostname, spacing, this.signal);
    this.lastRequest = Date.now();
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.any([this.signal, AbortSignal.timeout(15000)]),
      headers: {
        'user-agent': 'MenenwbkamBot/1.0',
        accept: 'text/html, application/xml, text/plain',
        ...(locale
          ? {
              'accept-language':
                locale === 'en' ? 'en-AE,en;q=0.9' : 'ar-AE,ar;q=0.9',
            }
          : {}),
        ...(locale && this.store === 'AMAZON'
          ? { cookie: `lc-acbsa=${locale === 'en' ? 'en_AE' : 'ar_AE'}` }
          : {}),
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Store redirect has no destination');
      return {
        status: response.status,
        body: '',
        location: storeUrl(new URL(location, url).toString(), this.store),
      };
    }
    if (
      response.status === 429 ||
      response.status === 403 ||
      response.status >= 500
    ) {
      const kind =
        response.status === 429
          ? 'RATE_LIMITED'
          : response.status === 403
            ? 'BLOCKED'
            : 'UNAVAILABLE';
      await response.body?.cancel();
      const until = this.reportBackoff
        ? await this.reportBackoff(
            new URL(url).hostname,
            kind,
            response.headers.get('retry-after'),
          )
        : cooldownDeadline(kind, 1, response.headers.get('retry-after'));
      throw new StoreBackoffError(
        `Store blocked/rate limited request (${response.status})`,
        until,
        kind,
      );
    }
    if (response.status !== 404 && response.status !== 410 && !response.ok)
      throw new Error(`Store returned HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty response');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 4 * 1024 * 1024)
          throw new Error('Store response exceeds 4 MB');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const body = Buffer.concat(chunks).toString('utf8');
    if (isAccessChallenge(body)) {
      const until = this.reportBackoff
        ? await this.reportBackoff(new URL(url).hostname, 'CHALLENGE', null)
        : cooldownDeadline('CHALLENGE');
      throw new StoreBackoffError(
        'Store returned an access challenge; crawling paused',
        until,
        'CHALLENGE',
      );
    }
    return {
      status: response.status,
      body,
    };
  }
  async get(
    value: string,
    redirects = 0,
    locale?: 'en' | 'ar',
  ): Promise<{ status: number; body: string; resolvedUrl?: string }> {
    if (redirects > 3) throw new Error('Too many store redirects');
    const url = new URL(storeUrl(value, this.store));
    if (
      process.env.EXTERNAL_BROWSER_ENABLED === 'true' &&
      (this.store === 'NOON' ||
        this.store === 'EXTRA' ||
        this.store === 'TRENDYOL')
    ) {
      const { renderStorePage } = await import('./browser-store');
      return renderStorePage(
        url.toString(),
        this.store,
        this.signal,
        this.throttle,
        this.reportBackoff,
      );
    }
    if (!this.robots.has(url.origin)) {
      const result = await this.request(url.origin + '/robots.txt');
      if (result.status !== 200) throw new Error('Cannot verify robots.txt');
      if (/<(?:html|script|!doctype)\b/i.test(result.body)) {
        const until = this.reportBackoff
          ? await this.reportBackoff(url.hostname, 'CHALLENGE', null)
          : cooldownDeadline('CHALLENGE');
        throw new StoreBackoffError(
          'robots.txt returned an HTML challenge instead of a policy',
          until,
          'CHALLENGE',
        );
      }
      // Conservatively honor the longest advertised delay, even for other agents.
      const delays = [
        ...result.body.matchAll(/^\s*crawl-delay\s*:\s*(\d+(?:\.\d+)?)/gim),
      ].map((m) => Number(m[1]) * 1000);
      this.requestDelay = Math.max(this.requestDelay, ...delays);
      if (this.requestDelay > 60000)
        throw new Error(
          'Advertised crawl delay exceeds this worker’s run budget',
        );
      this.robots.set(url.origin, result.body);
    }
    if (!robotsAllowed(this.robots.get(url.origin)!, url.pathname + url.search))
      throw new Error('URL disallowed by robots.txt');
    const response = await this.request(url.toString(), locale);
    if (response.location)
      return this.get(response.location, redirects + 1, locale);
    return { ...response, resolvedUrl: url.toString() };
  }
  async discover(sitemapUrl: string): Promise<string[]> {
    const result = await this.get(sitemapUrl);
    if (result.status !== 200 || !/<urlset[\s>]/i.test(result.body))
      throw new Error(
        'Configure a leaf product sitemap (urlset), not a sitemap index',
      );
    const urls = [...result.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(
      (m) => storeUrl(m[1].trim().replace(/&amp;/g, '&'), this.store),
    );
    return [...new Set(urls)];
  }
}
