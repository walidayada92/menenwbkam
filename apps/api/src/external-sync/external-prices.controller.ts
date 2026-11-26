import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { prisma } from '@menenwbkam/database';
import { indexedPage } from './search-index';
import {
  requestSearchDiscovery,
  SearchStore,
  searchDiscoveryUrl,
} from './search-discovery';

export class ExternalPricesQuery {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  @IsOptional() @IsIn(['en', 'ar']) locale?: string;
  @IsOptional() @IsString() @MaxLength(100) productId?: string;
  @IsOptional() @IsIn(['price_asc', 'price_desc', 'available']) sort?: string;
  @IsOptional()
  @IsIn(['AMAZON', 'ALMANEA', 'NOON', 'EXTRA', 'TRENDYOL'])
  store?: string;
}

export function titleConditions(query: string) {
  return query
    .split(/\s+/)
    .slice(0, 12)
    .map((token) => {
      const terms: Record<string, string[]> = {
        apple: ['apple', 'ابل', 'آبل', 'أبل'],
        pro: ['pro', 'برو'],
        max: ['max', 'ماكس'],
        plus: ['plus', 'بلس'],
        mini: ['mini', 'ميني'],
        air: ['air', 'اير'],
        pink: ['pink', 'وردي', 'بينك'],
        black: ['black', 'أسود', 'اسود'],
        white: ['white', 'أبيض', 'ابيض'],
        blue: ['blue', 'أزرق', 'ازرق'],
        green: ['green', 'أخضر', 'اخضر'],
        silver: ['silver', 'فضي'],
        gold: ['gold', 'ذهبي'],
        refurbished: ['refurbished', 'renewed', 'مجدد', 'معاد تصنيعه'],
      };
      const capacity = token.match(/^(\d+)(GB|TB)$/i);
      const alternatives = /^(iphone|ايفون|آيفون)$/i.test(token)
        ? ['iphone', 'ايفون', 'آيفون']
        : capacity
          ? [
              token,
              `${capacity[1]} ${capacity[2].toUpperCase() === 'TB' ? 'تيرا' : 'جيجا'}`,
            ]
          : terms[token.toLowerCase()] || [token];
      return {
        OR: alternatives.map((word) => ({
          title: { contains: word, mode: 'insensitive' as const },
        })),
      };
    });
}

@Controller('catalog/external-prices')
export class ExternalPricesController {
  @Post('discover') async discover(@Body() query: ExternalPricesQuery) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.PUBLIC_DISCOVERY_ENABLED !== 'true'
    )
      return {
        status: 'unsupported',
        stores: ['AMAZON', 'ALMANEA', 'NOON', 'EXTRA', 'TRENDYOL'].map(
          (store) => ({ store, status: 'unsupported' }),
        ),
      };
    const stores = await Promise.all(
      (['AMAZON', 'ALMANEA', 'NOON', 'EXTRA', 'TRENDYOL'] as SearchStore[]).map(
        async (store) => {
          try {
            const result = await requestSearchDiscovery(query.q, store);
            if (result.status === 'queued' || result.status === 'scheduled') {
              const hostKey =
                store === 'AMAZON'
                  ? 'amazon.sa'
                  : store === 'NOON'
                    ? 'noon.com'
                    : store === 'EXTRA'
                      ? 'extra.com'
                      : store === 'TRENDYOL'
                        ? 'trendyol.sa'
                        : 'almanea.sa';
              const host = await prisma.externalHostThrottle.findUnique({
                where: { host: hostKey },
                select: { cooldownUntil: true },
              });
              if (host?.cooldownUntil && host.cooldownUntil > new Date())
                return {
                  store,
                  status: 'cooldown',
                  retryAt: host.cooldownUntil.toISOString(),
                };
            }
            return { store, ...result };
          } catch {
            // One connector must not prevent another store from being scheduled.
            return { store, status: 'unavailable' };
          }
        },
      ),
    );
    return {
      status: stores.some(
        (entry) => entry.status === 'queued' || entry.status === 'scheduled',
      )
        ? 'scheduled'
        : stores[0].status,
      stores,
    };
  }

  @Get() async search(@Query() query: ExternalPricesQuery) {
    const { ids, total, pageSize, totalPages, page } = await indexedPage(
      query.q,
      query.page || 1,
      query.productId,
      query.sort,
      query.store,
    );
    const listings = await prisma.externalListing.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        titleEn: true,
        titleAr: true,
        urlEn: true,
        urlAr: true,
        url: true,
        price: true,
        currency: true,
        availability: true,
        stock: true,
        lastSeenAt: true,
        lastCheckedAt: true,
        matchStatus: true,
        comparisonProductId: true,
        source: { select: { store: true } },
      },
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
      take: pageSize,
      skip: 0,
    });
    return {
      query: query.q,
      page,
      pageSize,
      total,
      totalPages,
      listings: [...listings]
        .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
        .map(({ source, titleEn, titleAr, urlEn, urlAr, ...listing }) => ({
          ...listing,
          title:
            query.locale === 'ar'
              ? titleAr || listing.title
              : titleEn || listing.title,
          titleLocalized: Boolean(query.locale === 'ar' ? titleAr : titleEn),
          titleLanguage: /[\u0600-\u06ff]/.test(
            (query.locale === 'ar' ? titleAr : titleEn) || listing.title || '',
          )
            ? 'ar'
            : 'en',
          url:
            query.locale === 'ar' ? urlAr || listing.url : urlEn || listing.url,
          store: source.store,
        })),
      stores: [
        {
          store: 'AMAZON',
          name: 'Amazon',
          searchUrl: searchDiscoveryUrl(query.q, 'AMAZON'),
        },
        {
          store: 'NOON',
          name: 'Noon',
          searchUrl: searchDiscoveryUrl(query.q, 'NOON'),
        },
        {
          store: 'ALMANEA',
          name: 'Almanea',
          searchUrl: searchDiscoveryUrl(query.q, 'ALMANEA'),
        },
        {
          store: 'EXTRA',
          name: 'eXtra',
          searchUrl: searchDiscoveryUrl(query.q, 'EXTRA'),
        },
        {
          store: 'TRENDYOL',
          name: 'Trendyol',
          searchUrl: searchDiscoveryUrl(query.q, 'TRENDYOL'),
        },
      ],
    };
  }
}
