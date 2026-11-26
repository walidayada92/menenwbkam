import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { prisma, Prisma, ExternalListing } from '@menenwbkam/database';
import { randomUUID } from 'node:crypto';
import { CreateExternalSourceDto } from './external-sync.dto';
import {
  Observation,
  parseProduct,
  PublicStoreClient,
  Store,
  storeUrl,
} from './public-store';
import { parseAmazonProduct } from './amazon';
import { parseNoonProduct } from './noon';
import { localizedTitles } from './localized-title';
import { enqueue } from './job-queue';
import { throttleHost, pauseHost } from './host-throttle';
import { backoffDetails, nextCrawl, StoreBackoffError } from './crawl-policy';

export function changedFields(
  before: Pick<
    ExternalListing,
    'price' | 'currency' | 'availability' | 'stock' | 'status' | 'title'
  >,
  after: Observation,
) {
  const kinds: string[] = [];
  if (before.status === 'REMOVED') kinds.push('RESTORED');
  if (
    before.price === null ||
    Number(before.price) !== Number(after.price) ||
    before.currency !== after.currency
  )
    kinds.push('PRICE_CHANGED');
  if (
    before.availability !== after.availability ||
    before.stock !== after.stock
  )
    kinds.push('STOCK_CHANGED');
  if (before.title !== after.title) kinds.push('DETAILS_CHANGED');
  return kinds;
}

@Injectable()
export class ExternalSyncService implements OnModuleDestroy {
  private stopping = false;
  private controllers = new Set<AbortController>();
  onModuleDestroy() {
    this.stopping = true;
    for (const controller of this.controllers) controller.abort();
  }
  async create(dto: CreateExternalSourceDto) {
    if (!dto.productUrls.length && !dto.sitemapUrls.length)
      throw new BadRequestException(
        'Add at least one product or leaf sitemap URL',
      );
    try {
      return await prisma.externalSource.create({
        data: {
          name: dto.name,
          store: dto.store,
          intervalMinutes: dto.intervalMinutes ?? 360,
          productUrls: [
            ...new Set(dto.productUrls.map((url) => storeUrl(url, dto.store))),
          ],
          sitemapUrls: [
            ...new Set(dto.sitemapUrls.map((url) => storeUrl(url, dto.store))),
          ],
        },
      });
    } catch (error) {
      if (
        error instanceof TypeError ||
        (error instanceof Error && error.message.includes('HTTPS domain'))
      )
        throw new BadRequestException('Invalid store URL');
      throw error;
    }
  }
  async run(sourceId: string) {
    if (this.stopping) throw new ConflictException('Worker is stopping');
    const source = await prisma.externalSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Source not found');
    const owner = randomUUID(),
      now = new Date();
    const claimed = await prisma.externalSource.updateMany({
      where: {
        id: sourceId,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: { leaseOwner: owner, leaseUntil: new Date(now.getTime() + 900000) },
    });
    if (!claimed.count)
      throw new ConflictException('Source is already syncing');
    const controller = new AbortController();
    this.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 600000);
    let runId: string | undefined;
    let checked = 0,
      changed = 0;
    const errors: ({ url: string; message: string } & ReturnType<
      typeof backoffDetails
    >)[] = [];
    try {
      // A previous process may have died after recording a run.
      await prisma.externalSyncRun.updateMany({
        where: { sourceId, status: 'RUNNING' },
        data: { status: 'INTERRUPTED', finishedAt: now },
      });
      const run = await prisma.externalSyncRun.create({ data: { sourceId } });
      runId = run.id;
      const client = new PublicStoreClient(
        source.store as Store,
        controller.signal,
        throttleHost,
        pauseHost,
      );
      const urls = new Set(source.productUrls);
      for (const sitemap of source.sitemapUrls)
        for (const url of await client.discover(sitemap)) urls.add(url);
      // Previously discovered URLs are checked even when they disappear from a sitemap.
      const previous = await prisma.externalListing.findMany({
        where: { sourceId, status: { not: 'EXCLUDED' } },
        select: { url: true, title: true, localizedCheckedAt: true },
        take: 26,
      });
      for (const listing of previous) urls.add(listing.url);
      const previousByUrl = new Map(
        previous.map((listing) => [listing.url, listing]),
      );
      if (urls.size > 25)
        throw new Error(
          'Pilot limit: 25 products per source. Split into smaller leaf sitemaps/sources; no data was changed.',
        );
      for (const url of urls) {
        if (controller.signal.aborted)
          throw new Error('Run timed out or worker stopped');
        try {
          const response = await client.get(url);
          const missing = response.status === 404 || response.status === 410;
          const observation = missing
            ? null
            : source.store === 'AMAZON'
              ? parseAmazonProduct(response.body, url)
              : source.store === 'NOON'
                ? parseNoonProduct(response.body, url)
                : parseProduct(response.body, url);
          if (
            observation &&
            ['AMAZON', 'ALMANEA', 'NOON', 'EXTRA', 'TRENDYOL'].includes(
              source.store,
            )
          ) {
            const ar = /[\u0600-\u06ff]/.test(observation.title);
            Object.assign(
              observation,
              ar
                ? { titleAr: observation.title, urlAr: url }
                : { titleEn: observation.title, urlEn: url },
            );
            const prior = previousByUrl.get(url);
            const checkLanguage =
              !prior ||
              prior.title !== observation.title ||
              !prior.localizedCheckedAt ||
              Date.now() - prior.localizedCheckedAt.getTime() >= 86400000;
            if (checkLanguage) {
              observation.localizedCheckedAt = new Date().toISOString();
              try {
                Object.assign(
                  observation,
                  await localizedTitles(
                    client,
                    source.store as Store,
                    observation,
                  ),
                );
              } catch (error) {
                errors.push({
                  url,
                  message: `Localized title: ${error instanceof Error ? error.message : 'check failed'}`,
                  ...backoffDetails(error),
                });
                if (
                  error instanceof StoreBackoffError ||
                  (error instanceof Error &&
                    /blocked\/rate limited/.test(error.message))
                ) {
                  changed += await this.record(
                    sourceId,
                    owner,
                    url,
                    observation,
                  );
                  checked++;
                  throw error;
                }
              }
            }
          }
          changed += await this.record(sourceId, owner, url, observation);
          checked++;
        } catch (error) {
          errors.push({
            url,
            message: error instanceof Error ? error.message : 'Check failed',
            ...backoffDetails(error),
          });
          if (
            error instanceof StoreBackoffError ||
            (error instanceof Error &&
              /blocked\/rate limited/.test(error.message))
          )
            throw error;
        }
      }
      const status = errors.length
        ? checked
          ? 'PARTIAL'
          : 'FAILED'
        : 'SUCCEEDED';
      return await prisma.externalSyncRun.update({
        where: { id: runId },
        data: { status, checked, changed, errors, finishedAt: new Date() },
      });
    } catch (error) {
      errors.push({
        url: '',
        message: error instanceof Error ? error.message : 'Sync failed',
        ...backoffDetails(error),
      });
      if (runId)
        return await prisma.externalSyncRun.update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            checked,
            changed,
            errors,
            finishedAt: new Date(),
          },
        });
      throw error;
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(controller);
      await prisma.externalSource.updateMany({
        where: { id: sourceId, leaseOwner: owner },
        data: {
          leaseOwner: null,
          leaseUntil: null,
          nextRunAt: new Date(
            Math.max(
              nextCrawl(source.intervalMinutes).getTime(),
              ...errors.map((error) =>
                error.retryAt ? Date.parse(error.retryAt) : 0,
              ),
            ),
          ),
          lastError: errors.length ? errors[0].message.slice(0, 1000) : null,
        },
      });
    }
  }
  private async record(
    sourceId: string,
    owner: string,
    url: string,
    observation: Observation | null,
  ) {
    return prisma.$transaction(async (tx) => {
      // Row lock + owner fence prevents an expired worker from writing over a new run.
      const lease = await tx.externalSource.updateMany({
        where: {
          id: sourceId,
          leaseOwner: owner,
          leaseUntil: { gt: new Date() },
        },
        data: { leaseOwner: owner },
      });
      if (!lease.count) throw new Error('Sync lease expired');
      const existing = await tx.externalListing.findUnique({
        where: { sourceId_url: { sourceId, url } },
      });
      if (!observation) {
        if (!existing) return 0;
        const missingCount = existing.missingCount + 1;
        const removed = missingCount >= 2;
        await tx.externalListing.update({
          where: { id: existing.id },
          data: {
            missingCount,
            lastCheckedAt: new Date(),
            ...(removed ? { status: 'REMOVED' } : {}),
          },
        });
        await enqueue(tx, 'MATCH', { listingId: existing.id });
        if (removed && existing.status !== 'REMOVED') {
          await tx.externalListingChange.create({
            data: {
              listingId: existing.id,
              kind: 'REMOVED',
              before: { status: existing.status },
              after: { status: 'REMOVED' },
            },
          });
          return 1;
        }
        return 0;
      }
      const kinds = existing ? changedFields(existing, observation) : ['ADDED'];
      const listing = await tx.externalListing.upsert({
        where: { sourceId_url: { sourceId, url } },
        create: { sourceId, ...observation, lastSeenAt: new Date() },
        update: {
          ...observation,
          status: 'ACTIVE',
          missingCount: 0,
          lastSeenAt: new Date(),
          lastCheckedAt: new Date(),
        },
      });
      await enqueue(tx, 'MATCH', { listingId: listing.id });
      for (const kind of kinds)
        await tx.externalListingChange.create({
          data: {
            listingId: listing.id,
            kind,
            before: existing
              ? {
                  price: String(existing.price),
                  currency: existing.currency,
                  availability: existing.availability,
                  stock: existing.stock,
                  title: existing.title,
                  status: existing.status,
                }
              : Prisma.JsonNull,
            after: { ...observation, status: 'ACTIVE' },
          },
        });
      return kinds.length;
    });
  }
}
