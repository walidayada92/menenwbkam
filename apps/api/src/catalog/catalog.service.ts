import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';
import { SearchDto } from '../seller/seller.dto';
import { billingTransaction, entitlements } from '../billing/entitlements';
import { hasFeature } from '../billing/policy';
import { searchIntent } from './search-intent';
import { accessoryExclusion } from './product-search';
@Injectable()
export class CatalogService {
  async taxonomy() {
    const [brands, categories] = await Promise.all([
      prisma.brand.findMany({ orderBy: { nameEn: 'asc' } }),
      prisma.category.findMany({ orderBy: { nameEn: 'asc' } }),
    ]);
    return { brands, categories };
  }
  async search(query: SearchDto) {
    const intent = searchIntent(query.q || '');
    if (intent.interpreted && !intent.query)
      return { items: [], total: 0, page: 1, pageSize: 24 };
    query = {
      ...query,
      q: intent.query,
      sort: query.sort || intent.sort || undefined,
    };
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException('Minimum price exceeds maximum');
    const conditions: Prisma.Sql[] = [
      Prisma.sql`s.status = 'APPROVED'`,
      Prisma.sql`o.stock > 0`,
    ];
    if (query.q?.trim()) {
      // Escape LIKE metacharacters; parameters never become SQL syntax.
      const term = '%' + query.q.trim().replace(/[\\%_]/g, '\\$&') + '%';
      conditions.push(
        Prisma.sql`(p."modelName" ILIKE ${term} OR p."descriptionAr" ILIKE ${term} OR p."descriptionEn" ILIKE ${term} OR p.barcode ILIKE ${term} OR b."nameAr" ILIKE ${term} OR b."nameEn" ILIKE ${term})`,
      );
    }
    const accessoryPattern = accessoryExclusion(query.q || '');
    if (accessoryPattern)
      conditions.push(
        Prisma.sql`concat_ws(' ', p."modelName", o.title) !~* ${accessoryPattern}`,
      );
    if (query.brandId)
      conditions.push(Prisma.sql`p."brandId" = ${query.brandId}`);
    if (query.categoryId)
      conditions.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
    if (query.minRating !== undefined)
      conditions.push(Prisma.sql`s.rating >= ${query.minRating}`);
    const price: Prisma.Sql[] = [];
    if (query.minPrice !== undefined)
      price.push(Prisma.sql`MIN(o.price) >= ${query.minPrice}`);
    if (query.maxPrice !== undefined)
      price.push(Prisma.sql`MIN(o.price) <= ${query.maxPrice}`);
    const base = Prisma.sql`FROM "Product" p JOIN "Brand" b ON b.id=p."brandId" JOIN "Offer" o ON o."productId"=p.id JOIN "Seller" s ON s.id=o."sellerId" WHERE ${Prisma.join(conditions, ' AND ')} GROUP BY p.id ${price.length ? Prisma.sql`HAVING ${Prisma.join(price, ' AND ')}` : Prisma.empty}`;
    const sort =
      query.sort === 'price_desc'
        ? Prisma.sql`"bestPrice" DESC`
        : query.sort === 'newest'
          ? Prisma.sql`p."createdAt" DESC`
          : Prisma.sql`"bestPrice" ASC`;
    const [ids, total] = await Promise.all([
      prisma.$queryRaw<
        {
          id: string;
          bestPrice: Prisma.Decimal;
          bestOfferId: string;
          offerCount: bigint;
        }[]
      >(
        Prisma.sql`SELECT p.id, MIN(o.price) AS "bestPrice", (ARRAY_AGG(o.id ORDER BY o.price,o.id))[1] AS "bestOfferId", COUNT(o.id) AS "offerCount" ${base} ORDER BY ${sort},p.id LIMIT 24 OFFSET ${((query.page || 1) - 1) * 24}`,
      ),
      prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS count FROM (SELECT p.id ${base}) matched`,
      ),
    ]);
    const products = await prisma.product.findMany({
      where: { id: { in: ids.map((row) => row.id) } },
      include: { brand: true, category: true },
    });
    return {
      items: ids.map((row) => ({
        ...products.find((p) => p.id === row.id),
        bestPrice: row.bestPrice,
        bestOfferId: row.bestOfferId,
        offerCount: Number(row.offerCount),
      })),
      total: Number(total[0].count),
      page: query.page || 1,
      pageSize: 24,
    };
  }
  async detail(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        offers: {
          where: { seller: { status: 'APPROVED' }, stock: { gt: 0 } },
          select: {
            id: true,
            isFeatured: true,
            price: true,
            stock: true,
            productUrl: true,
            title: true,
            descriptionAr: true,
            descriptionEn: true,
            images: true,
            seller: {
              select: {
                id: true,
                businessName: true,
                slug: true,
                rating: true,
                status: true,
              },
            },
          },
          orderBy: [{ price: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!product || !product.offers.length)
      throw new NotFoundException('Product not found');
    const offers = await Promise.all(
      product.offers.map(async (offer) => ({
        ...offer,
        isFeatured:
          offer.isFeatured &&
          hasFeature(
            (
              await billingTransaction((tx) =>
                entitlements(tx, offer.seller.id),
              )
            ).features,
            'featuredBadge',
          ),
      })),
    );
    return { ...product, offers };
  }
  async priceHistory(id: string, days = 90) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    const start = new Date(
      Date.now() - Math.min(Math.max(days, 1), 365) * 86400000,
    );
    const points = await prisma.offerPrice.findMany({
      where: {
        createdAt: { gte: start },
        offer: { productId: id, seller: { status: 'APPROVED' } },
      },
      select: { price: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const byDay = new Map<string, string>();
    for (const point of points) {
      const day = point.createdAt.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Riyadh',
      });
      const before = byDay.get(day);
      if (!before || point.price.lt(before))
        byDay.set(day, point.price.toFixed(2));
    }
    return Array.from(byDay, ([day, price]) => ({ day, price }));
  }
}
