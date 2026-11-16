import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';
import { OfferDto, SellerProfileDto } from './seller.dto';
import {
  entitlements,
  requireFeature,
  isTransactionConflict,
} from '../billing/entitlements';
import { hasFeature } from '../billing/policy';
import { recordOfferChange } from '../workspace/alerts';
export function matchKey(brandId: string, title: string) {
  return (
    brandId +
    ':' +
    title.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ')
  );
}
export const publicSeller = {
  id: true,
  businessName: true,
  commercialRegNo: true,
  description: true,
  status: true,
  currentPlanId: true,
  rating: true,
  verificationName: true,
  createdAt: true,
} as const;
@Injectable()
export class SellerService {
  async profile(userId: string) {
    const seller = await prisma.seller.findUnique({
      where: { userId },
      select: {
        ...publicSeller,
        plan: true,
        _count: { select: { offers: true } },
      },
    });
    if (!seller) return null;
    const access = await this.serialized((tx) => entitlements(tx, seller.id));
    return {
      ...seller,
      plan: access.plan,
      features: access.features,
      subscriptionStatus: access.status,
    };
  }
  async register(userId: string, data: SellerProfileDto) {
    const fields = {
      businessName: data.businessName,
      commercialRegNo: data.commercialRegNo,
      description: data.description,
    };
    return prisma.seller.upsert({
      where: { userId },
      create: { ...fields, userId },
      update: { ...fields, status: 'PENDING' },
      select: publicSeller,
    });
  }
  async seller(
    userId: string,
    approved = false,
    tx: Prisma.TransactionClient = prisma,
  ) {
    const seller = await tx.seller.findUnique({
      where: { userId },
      include: { plan: true },
    });
    if (!seller)
      throw new NotFoundException('Create your seller profile first');
    if (approved && seller.status !== 'APPROVED')
      throw new ForbiddenException('Seller approval required');
    return seller;
  }
  async offers(userId: string) {
    const seller = await this.seller(userId);
    return prisma.offer.findMany({
      where: { sellerId: seller.id },
      include: { product: { include: { brand: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  async save(userId: string, data: OfferDto, id?: string) {
    return this.serialized(async (tx) => {
      const seller = await this.seller(userId, true, tx);
      // Lock a seller row so concurrent create/import requests cannot bypass plan limits.
      await tx.$queryRaw`SELECT id FROM "Seller" WHERE id = ${seller.id} FOR UPDATE`;
      if (
        id &&
        !(await tx.offer.findFirst({ where: { id, sellerId: seller.id } }))
      )
        throw new NotFoundException('Offer not found');
      return this.write(tx, seller, data, id);
    });
  }
  async write(
    tx: Prisma.TransactionClient,
    seller: { id: string; plan: { productLimit: number } | null },
    data: OfferDto,
    id?: string,
  ) {
    const access = await entitlements(tx, seller.id);
    if (data.isFeatured && !hasFeature(access.features, 'featuredBadge'))
      throw new ForbiddenException('Featured badges require an eligible plan');
    if (!id) {
      const limit = access.productLimit;
      if (
        limit >= 0 &&
        (await tx.offer.count({ where: { sellerId: seller.id } })) >= limit
      )
        throw new ForbiddenException('Product limit reached');
    }
    if (
      !(await tx.brand.findUnique({ where: { id: data.brandId } })) ||
      !(await tx.category.findUnique({ where: { id: data.categoryId } }))
    )
      throw new BadRequestException('Unknown brand or category');
    const key = matchKey(data.brandId, data.title);
    let product = data.barcode
      ? await tx.product.findUnique({ where: { barcode: data.barcode } })
      : null;
    if (product && product.brandId !== data.brandId)
      throw new ConflictException('Barcode belongs to a different brand');
    if (!product)
      product = await tx.product.findUnique({ where: { matchKey: key } });
    if (
      product &&
      data.barcode &&
      product.barcode &&
      product.barcode !== data.barcode
    )
      throw new ConflictException(
        'Model has a different barcode; an admin must review it',
      );
    if (!product)
      product = await tx.product.create({
        data: {
          matchKey: key,
          modelName: data.title.trim(),
          brandId: data.brandId,
          categoryId: data.categoryId,
          barcode: data.barcode || null,
          descriptionAr: data.descriptionAr,
          descriptionEn: data.descriptionEn,
          images: data.images,
        },
      });
    else if (data.barcode && !product.barcode)
      product = await tx.product.update({
        where: { id: product.id },
        data: { barcode: data.barcode },
      });
    const fields = {
      isFeatured: data.isFeatured ?? false,
      productId: product.id,
      title: data.title.trim(),
      descriptionAr: data.descriptionAr || null,
      descriptionEn: data.descriptionEn || null,
      images: data.images,
      price: data.price,
      stock: data.stock,
      sku: data.sku || null,
      productUrl: data.productUrl || null,
    };
    const previous = id
      ? await tx.offer.findUnique({ where: { id }, select: { price: true } })
      : null;
    const offer = await (id
      ? tx.offer.update({ where: { id }, data: fields })
      : tx.offer.create({ data: { ...fields, sellerId: seller.id } }));
    await recordOfferChange(tx, offer.id, previous?.price || null);
    return offer;
  }
  async remove(userId: string, id: string) {
    const seller = await this.seller(userId);
    if (!(await prisma.offer.findFirst({ where: { id, sellerId: seller.id } })))
      throw new NotFoundException('Offer not found');
    if (await prisma.orderItem.count({ where: { offerId: id } }))
      throw new ConflictException(
        'An offer referenced by an order cannot be deleted',
      );
    const result = await prisma.offer.deleteMany({
      where: { id, sellerId: seller.id },
    });
    if (!result.count) throw new NotFoundException('Offer not found');
    return { deleted: true };
  }
  async import(userId: string, rows: OfferDto[]) {
    return this.serialized(async (tx) => {
      const seller = await this.seller(userId, true, tx);
      await tx.$queryRaw`SELECT id FROM "Seller" WHERE id = ${seller.id} FOR UPDATE`;
      await requireFeature(tx, seller.id, 'bulkUpload');
      for (let index = 0; index < rows.length; index++) {
        try {
          await this.write(tx, seller, rows[index]);
        } catch (error) {
          if (error instanceof ForbiddenException) throw error;
          if ((error as { code?: string }).code === 'P2002')
            throw new ConflictException(
              'Duplicate product in import row ' + (index + 2),
            );
          throw new BadRequestException(
            'Import row ' +
              (index + 2) +
              ': ' +
              (error instanceof Error ? error.message : 'Invalid row'),
          );
        }
      }
      return { imported: rows.length };
    });
  }
  async serialized<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30000,
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (isTransactionConflict(error)) {
          if (attempt < 2) continue;
          throw new ConflictException(
            'Concurrent listing change; please retry',
          );
        }
        if (code === 'P2002')
          throw new ConflictException(
            'This seller already lists the product, or product matching needs review',
          );
        throw error;
      }
    }
    throw new ConflictException('Please retry the request');
  }
}
