import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@menenwbkam/database';
import { AuthRequest } from '../auth/roles.guard';
import { OrdersService } from './orders.service';
import { DisputeStatusDto, PageDto } from './orders.dto';
import { operationTransaction } from './transaction';
import { notify } from './notifications';
@Injectable()
export class DisputesService {
  constructor(private orders: OrdersService) {}
  async create(user: AuthRequest['user'], orderId: string, reason: string) {
    if (reason.trim().length < 10)
      throw new BadRequestException('Dispute reason is too short');
    return operationTransaction(async (tx) => {
      const order = await this.orders.participant(tx, orderId, user);
      if (user.role === 'ADMIN')
        throw new BadRequestException(
          'Only order participants can open disputes',
        );
      const dispute = await tx.dispute.create({
        data: { orderId, openedById: user.sub, reason: reason.trim() },
      });
      const admins = await tx.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      await notify(
        tx,
        [order.shopperId, order.seller.userId, ...admins.map((a) => a.id)],
        {
          titleAr: 'نزاع جديد على طلب',
          titleEn: 'Order dispute opened',
          bodyAr: order.number,
          bodyEn: order.number,
          href: '/orders/' + order.id,
        },
      );
      return dispute;
    });
  }
  async message(user: AuthRequest['user'], id: string, body: string) {
    if (!body.trim()) throw new BadRequestException('Message is empty');
    return operationTransaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({ where: { id } });
      if (!dispute) throw new NotFoundException();
      const order = await this.orders.participant(tx, dispute.orderId, user);
      await tx.$queryRaw`SELECT id FROM "Dispute" WHERE id=${id} FOR UPDATE`;
      const current = await tx.dispute.findUniqueOrThrow({ where: { id } });
      if (current.status === 'RESOLVED')
        throw new ConflictException('This dispute is resolved');
      const message = await tx.disputeMessage.create({
        data: { disputeId: id, authorId: user.sub, body: body.trim() },
        include: { author: { select: { role: true } } },
      });
      const admins = await tx.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      await notify(
        tx,
        [
          order.shopperId,
          order.seller.userId,
          ...admins.map((a) => a.id),
        ].filter((uid) => uid !== user.sub),
        {
          titleAr: 'رد جديد في النزاع',
          titleEn: 'New dispute message',
          bodyAr: order.number,
          bodyEn: order.number,
          href: '/orders/' + order.id,
        },
      );
      return message;
    });
  }
  async list(query: PageDto) {
    const [items, total] = await Promise.all([
      prisma.dispute.findMany({
        include: {
          order: {
            select: {
              number: true,
              status: true,
              seller: { select: { businessName: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        skip: (query.page - 1) * 20,
      }),
      prisma.dispute.count(),
    ]);
    return { items, total, page: query.page, pageSize: 20 };
  }
  async update(id: string, body: DisputeStatusDto) {
    if (
      body.status === 'RESOLVED' &&
      (!body.resolution || body.resolution.trim().length < 10)
    )
      throw new BadRequestException(
        'A resolution of at least 10 characters is required',
      );
    return operationTransaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Dispute" WHERE id=${id} FOR UPDATE`;
      const dispute = await tx.dispute.findUnique({
        where: { id },
        include: { order: { include: { seller: true } } },
      });
      if (!dispute) throw new NotFoundException();
      if (dispute.status === 'RESOLVED')
        throw new ConflictException('This dispute is already resolved');
      const updated = await tx.dispute.update({
        where: { id },
        data: {
          status: body.status,
          ...(body.status === 'RESOLVED'
            ? { resolution: body.resolution!.trim(), resolvedAt: new Date() }
            : {}),
        },
      });
      await notify(tx, [dispute.order.shopperId, dispute.order.seller.userId], {
        titleAr:
          body.status === 'RESOLVED' ? 'تم حل النزاع' : 'النزاع قيد المراجعة',
        titleEn:
          body.status === 'RESOLVED'
            ? 'Dispute resolved'
            : 'Dispute under review',
        bodyAr: dispute.order.number,
        bodyEn: dispute.order.number,
        href: '/orders/' + dispute.order.id,
      });
      return updated;
    });
  }
}
