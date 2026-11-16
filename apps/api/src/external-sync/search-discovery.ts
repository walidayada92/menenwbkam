import { prisma } from '@menenwbkam/database';
import { enqueue } from './job-queue';
import { searchIntent } from '../catalog/search-intent';

export type SearchStore = 'AMAZON' | 'ALMANEA' | 'NOON' | 'EXTRA' | 'TRENDYOL';

export function searchDiscoveryUrl(
  query: string,
  store: SearchStore = 'AMAZON',
) {
  const term = searchIntent(query)
    .query.normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (store === 'ALMANEA')
    return `https://www.almanea.sa/en/search?q=${encodeURIComponent(term)}`;
  if (store === 'NOON')
    return `https://www.noon.com/saudi-en/search/?q=${encodeURIComponent(term)}`;
  if (store === 'EXTRA')
    return `https://www.extra.com/en-sa/search/?text=${encodeURIComponent(term)}`;
  if (store === 'TRENDYOL')
    return `https://www.trendyol.sa/en/sr?q=${encodeURIComponent(term)}`;
  return `https://www.amazon.sa/s?k=${encodeURIComponent(term)}`;
}

// Each store has a bounded public admission pool. Workers still enforce host
// budgets, robots rules, cooldowns, pagination and source refresh intervals.
export async function requestSearchDiscovery(
  query: string,
  store: SearchStore = 'AMAZON',
) {
  query = searchIntent(query).query;
  if (query.length < 2) return { status: 'invalid_query' };
  // HTTP collection honors the search restriction. Explicit browser mode
  // enables the direct store-search workflow selected by the operator.
  if (
    (store === 'NOON' || store === 'EXTRA' || store === 'TRENDYOL') &&
    process.env.EXTERNAL_BROWSER_ENABLED !== 'true'
  )
    return { status: 'robots_disallowed' };
  const startUrl = searchDiscoveryUrl(query, store);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('public-search-discovery', 0))`;
    const existing = await tx.externalDiscovery.findUnique({
      where: { store_startUrl: { store, startUrl } },
    });
    if (existing)
      return { status: existing.enabled ? 'scheduled' : 'disabled' };
    const count = await tx.externalDiscovery.count({
      where: { store, name: { startsWith: 'Search: ' } },
    });
    const today = await tx.externalDiscovery.count({
      where: {
        store,
        name: { startsWith: 'Search: ' },
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    });
    if (count >= 100 || today >= 10) return { status: 'capacity' };
    const config = await tx.externalDiscovery.create({
      data: {
        name: `Search: ${query.trim()}`,
        store,
        startUrl,
        enabled: true,
        intervalMinutes: 1440,
        nextRunAt: new Date(Date.now() + 86400000),
      },
    });
    await enqueue(
      tx,
      'DISCOVER',
      { discoveryId: config.id },
      `discovery:${config.id}`,
    );
    return { status: 'queued' };
  });
}
