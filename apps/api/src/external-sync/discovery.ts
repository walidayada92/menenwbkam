import { load } from 'cheerio';
import { prisma } from '@menenwbkam/database';
import { PublicStoreClient, Store, storeUrl } from './public-store';
import { amazonNextSearchPage, amazonSearchProducts } from './amazon';
import { noonSearchPage, noonProductSku } from './noon';
import { enqueue } from './job-queue';
import { throttleHost, pauseHost } from './host-throttle';

export function discoveryUrl(value: string, store: Store) {
  const url = new URL(storeUrl(value, store));
  if (
    store === 'TRENDYOL' &&
    !(url.pathname === '/en/sr' && url.searchParams.get('q')?.trim())
  )
    throw new Error('Trendyol discovery requires /en/sr?q=term');
  if (
    store === 'EXTRA' &&
    !(url.pathname === '/en-sa/search/' && url.searchParams.get('text')?.trim())
  )
    throw new Error(
      'eXtra automatic discovery is unavailable; configure permitted product URLs or a leaf sitemap',
    );
  if (
    store === 'AMAZON' &&
    (url.pathname !== '/s' || !url.searchParams.get('k'))
  )
    throw new Error('Amazon discovery requires /s?k=search-term');
  if (
    store === 'ALMANEA' &&
    !/-c-\d+$/.test(url.pathname) &&
    !(
      /^\/(en\/|ar\/)?search$/.test(url.pathname) &&
      url.searchParams.get('q')?.trim()
    )
  )
    throw new Error('Almanea discovery requires a category or search URL');
  if (
    store === 'NOON' &&
    !(
      /^\/saudi-en\/search\/$/.test(url.pathname) &&
      url.searchParams.get('q')?.trim()
    )
  )
    throw new Error(
      'Noon discovery requires a search URL: /saudi-en/search/?q=term',
    );
  url.hash = '';
  return url.toString();
}
export function productIdentity(url: string, store: Store) {
  if (store === 'AMAZON')
    return new URL(url).pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1] || url;
  if (store === 'NOON') return noonProductSku(url) || url;
  if (store === 'TRENDYOL') {
    const parsed = new URL(url);
    const id = parsed.pathname.match(/-p-(\d+)$/)?.[1];
    return id
      ? `${id}:${parsed.searchParams.get('merchantId') || 'default'}`
      : url;
  }
  return url;
}
export function renderedSearchProducts(
  html: string,
  start: string,
  store: Store,
) {
  const $ = load(html);
  const products = new Set<string>();
  const links =
    store === 'TRENDYOL'
      ? $('.search-result-content a.product-card[href]')
      : store === 'EXTRA'
        ? $('#product-lising-search-page a[href]')
        : $('main a[href]');
  links.each((_, element) => {
    try {
      const url = new URL($(element).attr('href')!, start);
      storeUrl(url.toString(), store);
      const matches =
        store === 'TRENDYOL'
          ? /^\/(en|ar)\/.+-p-\d+$/.test(url.pathname)
          : store === 'NOON'
            ? /^\/saudi-(en|ar)\/.+\/[A-Za-z0-9_-]+\/p\/?$/.test(url.pathname)
            : /^\/(en|ar)-sa\/.+\/p\/\d+\/?$/.test(url.pathname);
      if (matches) {
        if (store === 'TRENDYOL') {
          // Retain the seller selection; another seller may quote another price.
          for (const key of [...url.searchParams.keys()])
            if (key !== 'merchantId') url.searchParams.delete(key);
        } else url.search = '';
        url.hash = '';
        products.add(url.toString());
      }
    } catch {
      /* Non-product or external links. */
    }
  });
  if (!products.size)
    throw new Error(
      'No recognizable products in rendered store search; results may be empty or blocked',
    );
  return { products: [...products].slice(0, 40), pages: [] as string[] };
}

export function almaneaPage(html: string, current: string, start: string) {
  const $ = load(html),
    products = new Set<string>(),
    pages = new Set<string>();
  $('a[href]').each((_, element) => {
    const url = new URL($(element).attr('href')!, current);
    if (url.origin !== new URL(start).origin) return;
    if (/^\/(en\/|ar\/)?product\//.test(url.pathname)) {
      url.search = '';
      url.hash = '';
      products.add(storeUrl(url.toString(), 'ALMANEA'));
    }
    if (
      url.pathname === new URL(start).pathname &&
      (url.searchParams.has('page') || url.searchParams.has('p'))
    ) {
      url.hash = '';
      pages.add(url.toString());
    }
  });
  return { products: [...products], pages: [...pages] };
}

// Public search pages embed the first result batch in Next.js page data.
// Later pages are client-side only; do not invent pagination URLs or crawl
// unrelated recommendations. Product pages remain the authority for prices.
export function almaneaSearchPage(html: string) {
  const $ = load(html);
  const data = JSON.parse($('#__NEXT_DATA__').text());
  const results = data?.props?.pageProps?.searchResults;
  if (
    !Array.isArray(results?.products) ||
    !Number.isInteger(results.numberOfHits)
  )
    throw new Error('Unrecognized Almanea search results');
  const products = results.products.map(
    (product: { rewrite_url?: unknown }) => {
      if (
        typeof product?.rewrite_url !== 'string' ||
        !product.rewrite_url ||
        /[/?#\\]/.test(product.rewrite_url)
      )
        throw new Error('Invalid Almanea search product URL');
      return storeUrl(
        `https://www.almanea.sa/en/product/${encodeURIComponent(product.rewrite_url)}`,
        'ALMANEA',
      );
    },
  );
  if (!products.length && results.numberOfHits !== 0)
    throw new Error('Almanea search products are missing');
  return { products: [...new Set<string>(products)], pages: [] as string[] };
}
export async function discoverProducts(
  store: Store,
  start: string,
  client: PublicStoreClient,
  signal: AbortSignal,
) {
  const pending = [discoveryUrl(start, store)],
    visited = new Set<string>(),
    urls = new Map<string, string>();
  while (pending.length) {
    signal.throwIfAborted();
    const url = pending.shift()!;
    if (visited.has(url)) continue;
    if (visited.size >= 100)
      throw new Error('Discovery exceeded 100 pages; coverage is incomplete');
    const page = await client.get(url);
    if (page.status !== 200)
      throw new Error(`Discovery returned HTTP ${page.status}`);
    let products: string[], pages: string[];
    if (store === 'AMAZON') {
      products = amazonSearchProducts(page.body, {
        iphoneOnly: /iphone|[اآأ]يفون/i.test(
          new URL(start).searchParams.get('k') || '',
        ),
      });
      const next = amazonNextSearchPage(page.body, url);
      if (next && visited.has(next))
        throw new Error('Discovery pagination loop');
      pages = next ? [next] : [];
    } else if (
      (store === 'NOON' || store === 'EXTRA' || store === 'TRENDYOL') &&
      process.env.EXTERNAL_BROWSER_ENABLED === 'true'
    ) {
      ({ products, pages } = renderedSearchProducts(page.body, start, store));
    } else if (store === 'NOON') {
      ({ products, pages } = noonSearchPage(page.body));
    } else if (/^\/(en\/|ar\/)?search$/.test(new URL(start).pathname)) {
      ({ products, pages } = almaneaSearchPage(page.body));
    } else ({ products, pages } = almaneaPage(page.body, url, start));
    if (
      !products.length &&
      !(
        (store === 'ALMANEA' &&
          /^\/(en\/|ar\/)?search$/.test(new URL(start).pathname)) ||
        store === 'NOON'
      )
    )
      throw new Error(
        'No recognizable products on discovery page; refusing incomplete coverage',
      );
    for (const product of products)
      urls.set(productIdentity(product, store), product);
    visited.add(url);
    for (const next of pages) if (!visited.has(next)) pending.push(next);
  }
  return { urls: [...urls.values()], pages: visited.size };
}
export async function runDiscovery(
  discoveryId: string,
  signal: AbortSignal,
  manual = false,
) {
  const config = await prisma.externalDiscovery.findUniqueOrThrow({
    where: { id: discoveryId },
  });
  if (!config.enabled && !manual) return { skipped: true };
  const store = config.store as Store;
  try {
    const result = await discoverProducts(
      store,
      config.startUrl,
      new PublicStoreClient(store, signal, throttleHost, pauseHost),
      signal,
    );
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`discovery:${store}`}, 0))`;
        const sources = await tx.externalSource.findMany({ where: { store } });
        const covered = new Map(
          sources.flatMap((s) =>
            s.productUrls.map(
              (url) => [productIdentity(url, store), s] as const,
            ),
          ),
        );
        const newUrls = result.urls.filter(
          (url) => !covered.has(productIdentity(url, store)),
        );
        const due = new Set(
          result.urls
            .map((url) => covered.get(productIdentity(url, store))?.id)
            .filter((id): id is string => Boolean(id)),
        );
        for (let i = 0; i < newUrls.length; i += 25) {
          const source = await tx.externalSource.create({
            data: {
              name: `${config.name} — batch ${Math.floor(i / 25) + 1}`,
              store,
              productUrls: newUrls.slice(i, i + 25),
              sitemapUrls: [],
              enabled: true,
              discoveryId,
            },
          });
          due.add(source.id);
        }
        let queuedSources = 0;
        for (const sourceId of due) {
          // Do not reactivate a source the administrator deliberately disabled.
          const source = sources.find((s) => s.id === sourceId);
          if (
            source &&
            (!source.enabled || source.nextRunAt.getTime() > Date.now())
          )
            continue;
          await enqueue(tx, 'SYNC', { sourceId }, `source:${sourceId}`);
          queuedSources++;
        }
        await tx.externalDiscovery.update({
          where: { id: discoveryId },
          data: {
            lastCompletedAt: new Date(),
            lastError: null,
            lastPages: result.pages,
            lastProducts: result.urls.length,
          },
        });
        return {
          pages: result.pages,
          discovered: result.urls.length,
          added: newUrls.length,
          queuedSources,
        };
      },
      { timeout: 30000 },
    );
  } catch (error) {
    await prisma.externalDiscovery.update({
      where: { id: discoveryId },
      data: {
        lastError: (error instanceof Error
          ? error.message
          : 'Discovery failed'
        ).slice(0, 1000),
      },
    });
    throw error;
  }
}
