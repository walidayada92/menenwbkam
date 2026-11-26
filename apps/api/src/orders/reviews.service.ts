import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';
import { AuthRequest } from '../auth/roles.guard';
import { ModerateReviewDto, PageDto, ReviewDto } from './orders.dto';
import { operationTransaction } from './transaction';
import { notify } from './notifications';
export const publicReview = {
  id: true,
  target: true,
  rating: true,
  comment: true,
  createdAt: true,
  productId: true,
  seller: { select: { businessName: true } },
} as const;
@Injectable()
export class ReviewsService {
  async refreshRating(tx: Prisma.TransactionClient, sellerId: string) {
    await tx.$queryRaw`SELECT id FROM "Seller" WHERE id=${sellerId} FOR UPDATE`;
    const average = await tx.review.aggregate({
      where: { sellerId, target: 'SELLER', isHidden: false },
      _avg: { rating: true },
    });
    await tx.seller.update({
      where: { id: sellerId },
      data: {
        rating: new Prisma.Decimal(average._avg.rating || 0).toDecimalPlaces(1),
      },
    });
  }
  async create(user: AuthRequest['user'], orderId: string, body: ReviewDto) {
    if (user.role !== 'SHOPPER')
      throw new ForbiddenException('Shopper account required');
    if (body.comment.trim().length < 5)
      throw new BadRequestException('Review text is too short');
    return operationTransaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, shopperId: user.sub },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (!['DELIVERED', 'RETURNED'].includes(order.status))
        throw new ConflictException('Reviews require a delivered order');
      const productId = body.target === 'PRODUCT' ? body.productId : null;
      if (
        body.target === 'PRODUCT' &&
        (!productId || !order.items.some((i) => i.productId === productId))
      )
        throw new BadRequestException('Product is not in this order');
      if (body.target === 'SELLER' && body.productId)
        throw new BadRequestException('Seller reviews cannot target a product');
      const review = await tx.review.create({
        data: {
          orderId,
          authorId: user.sub,
          sellerId: order.sellerId,
          productId,
          target: body.target,
          targetKey:
            body.target === 'SELLER' ? 'SELLER' : 'PRODUCT:' + productId,
          rating: body.rating,
          comment: body.comment.trim(),
        },
        select: publicReview,
      });
      if (body.target === 'SELLER')
        await this.refreshRating(tx, order.sellerId);
      return review;
    });
  }
  async list(target: 'PRODUCT' | 'SELLER', id: string, query: PageDto) {
    const where: Prisma.ReviewWhereInput = {
      isHidden: false,
      target,
      ...(target === 'PRODUCT' ? { productId: id } : { sellerId: id }),
    };
    const [items, total, average] = await Promise.all([
      prisma.review.findMany({
        where,
        select: publicReview,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        skip: (query.page - 1) * 20,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({ where, _avg: { rating: true } }),
    ]);
    return {
      items,
      total,
      rating: average._avg.rating || 0,
      page: query.page,
      pageSize: 20,
    };
  }
  async report(userId: string, id: string, reason: string) {
    if (reason.trim().length < 10)
      throw new BadRequestException('Report reason is too short');
    return operationTransaction(async (tx) => {
      const review = await tx.review.findUnique({ where: { id } });
      if (!review || review.isHidden) throw new NotFoundException();
      if (review.authorId === userId)
        throw new ForbiddenException('Cannot report your own review');
      await tx.reviewReport.create({
        data: { reviewId: id, reporterId: userId, reason: reason.trim() },
      });
      const admins = await tx.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      await notify(
        tx,
        admins.map((a) => a.id),
        {
          titleAr: 'بلاغ عن تقييم',
          titleEn: 'Review reported',
          bodyAr: 'بلاغ جديد ينتظر المراجعة',
          bodyEn: 'A new report needs moderation',
          href: '/admin/operations?review=' + id,
        },
      );
      return { reported: true };
    });
  }
  async reports(query: PageDto) {
    const [items, total] = await Promise.all([
      prisma.reviewReport.findMany({
        include: {
          review: { include: { seller: { select: { businessName: true } } } },
          reporter: { select: { email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        skip: (query.page - 1) * 20,
      }),
      prisma.reviewReport.count(),
    ]);
    return { items, total, page: query.page, pageSize: 20 };
  }
  async moderate(id: string, body: ModerateReviewDto) {
    if (body.reason.trim().length < 5)
      throw new BadRequestException('Moderation reason is too short');
    return operationTransaction(async (tx) => {
      const review = await tx.review.findUnique({ where: { id } });
      if (!review) throw new NotFoundException();
      const updated = await tx.review.update({
        where: { id },
        data: { isHidden: body.isHidden, moderationReason: body.reason.trim() },
      });
      await tx.reviewReport.updateMany({
        where: { reviewId: id, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
      if (review.target === 'SELLER')
        await this.refreshRating(tx, review.sellerId);
      await notify(tx, [review.authorId], {
        titleAr: 'تمت مراجعة تقييمك',
        titleEn: 'Review moderation update',
        bodyAr: body.reason.trim(),
        bodyEn: body.reason.trim(),
        href: '/orders/' + review.orderId,
      });
      return updated;
    });
  }
}
