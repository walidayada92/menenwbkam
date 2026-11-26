import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, TeamRole } from '@menenwbkam/database';
import { operationTransaction } from '../orders/transaction';
import { entitlements, requireFeature } from '../billing/entitlements';
import { hasFeature } from '../billing/policy';
import { notify } from '../orders/notifications';
import { workspaceFor } from './access';
import { refreshStockAlert } from './alerts';
import { BrandingDto, InviteDto } from './workspace.dto';
@Injectable()
export class WorkspaceService {
  async list(userId: string, selected?: string) {
    const own = await prisma.seller.findUnique({
      where: { userId },
      select: { id: true, businessName: true, logo: true, slug: true },
    });
    const memberships = await prisma.teamMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        seller: {
          select: { id: true, businessName: true, logo: true, slug: true },
        },
      },
    });
    const active = [];
    for (const membership of memberships) {
      const access = await operationTransaction((tx) =>
        entitlements(tx, membership.sellerId),
      );
      if (hasFeature(access.features, 'teamMembers')) active.push(membership);
    }
    const stores = [
      ...(own ? [{ ...own, role: 'OWNER' }] : []),
      ...active
        .filter((m) => m.sellerId !== own?.id)
        .map((m) => ({ ...m.seller, role: m.role })),
    ];
    const current = stores.find((s) => s.id === selected) || stores[0] || null;
    const invitations = await prisma.teamMember.findMany({
      where: { userId, status: 'INVITED' },
      include: { seller: { select: { businessName: true } } },
    });
    return { stores, selectedId: current?.id || null, invitations };
  }
  async select(userId: string, sellerId: string) {
    const scope = await workspaceFor(userId, sellerId);
    return { sellerId: scope.seller.id, role: scope.role };
  }
  async team(userId: string, storeId?: string) {
    const { seller } = await workspaceFor(userId, storeId, 'owner');
    return prisma.teamMember.findMany({
      where: { sellerId: seller.id },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
  async invite(userId: string, storeId: string | undefined, body: InviteDto) {
    const { seller } = await workspaceFor(userId, storeId, 'owner');
    return operationTransaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Seller" WHERE id=${seller.id} FOR UPDATE`;
      await requireFeature(tx, seller.id, 'teamMembers');
      const user = await tx.user.findUnique({
        where: { email: body.email.toLowerCase().trim() },
      });
      if (!user || user.role !== 'SELLER')
        throw new BadRequestException('Invite an existing seller account');
      if (user.id === userId)
        throw new BadRequestException('The owner already has full access');
      if ((await tx.teamMember.count({ where: { sellerId: seller.id } })) >= 25)
        throw new BadRequestException('Maximum 25 team members');
      const member = await tx.teamMember.create({
        data: { sellerId: seller.id, userId: user.id, role: body.role },
      });
      await notify(tx, [user.id], {
        titleAr: 'دعوة لفريق متجر',
        titleEn: 'Store team invitation',
        bodyAr: seller.businessName,
        bodyEn: seller.businessName,
        href: '/seller/team',
      });
      return member;
    }).catch((error) => {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('This user is already invited');
      throw error;
    });
  }
  async accept(userId: string, id: string) {
    return operationTransaction(async (tx) => {
      const member = await tx.teamMember.findFirst({
        where: { id, userId },
        include: { seller: true },
      });
      if (!member) throw new NotFoundException();
      await requireFeature(tx, member.sellerId, 'teamMembers');
      return tx.teamMember.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });
    });
  }
  async change(
    userId: string,
    storeId: string | undefined,
    id: string,
    role?: TeamRole,
  ) {
    const { seller } = await workspaceFor(userId, storeId, 'owner');
    const member = await prisma.teamMember.findFirst({
      where: { id, sellerId: seller.id },
    });
    if (!member) throw new NotFoundException();
    return role
      ? prisma.teamMember.update({ where: { id }, data: { role } })
      : prisma.teamMember.delete({ where: { id } });
  }
  async branding(
    userId: string,
    storeId: string | undefined,
    body: BrandingDto,
  ) {
    const { seller } = await workspaceFor(userId, storeId, 'branding');
    try {
      return await operationTransaction(async (tx) => {
        const result = await tx.seller.update({
          where: { id: seller.id },
          data: {
            slug: body.slug,
            logo: body.logo || null,
            bannerUrl: body.bannerUrl || null,
            brandColor: body.brandColor,
            description: body.description?.trim() || null,
            lowStockThreshold: body.lowStockThreshold,
            lowStockAlerts: body.lowStockAlerts,
            priceDropAlerts: body.priceDropAlerts,
          },
          select: {
            id: true,
            slug: true,
            logo: true,
            bannerUrl: true,
            brandColor: true,
            description: true,
            lowStockThreshold: true,
            lowStockAlerts: true,
            priceDropAlerts: true,
          },
        });
        const offers = await tx.offer.findMany({
          where: { sellerId: seller.id },
          select: { id: true },
        });
        for (const offer of offers) await refreshStockAlert(tx, offer.id);
        if (!body.priceDropAlerts)
          await tx.sellerAlert.updateMany({
            where: {
              sellerId: seller.id,
              kind: 'PRICE_DROP',
              resolvedAt: null,
            },
            data: { resolvedAt: new Date() },
          });
        return result;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('Store address is already in use');
      throw error;
    }
  }
}
