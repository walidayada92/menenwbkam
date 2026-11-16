import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, TeamRole } from '@menenwbkam/database';
import { operationTransaction } from '../orders/transaction';
import { entitlements } from '../billing/entitlements';
import { hasFeature } from '../billing/policy';
export type Permission =
  | 'catalog'
  | 'writeCatalog'
  | 'orders'
  | 'writeOrders'
  | 'analytics'
  | 'branding'
  | 'owner';
export type WorkspaceRole = TeamRole | 'OWNER';
const rights: Record<WorkspaceRole, Permission[]> = {
  OWNER: [
    'catalog',
    'writeCatalog',
    'orders',
    'writeOrders',
    'analytics',
    'branding',
    'owner',
  ],
  MANAGER: [
    'catalog',
    'writeCatalog',
    'orders',
    'writeOrders',
    'analytics',
    'branding',
  ],
  CATALOG: ['catalog', 'writeCatalog'],
  ORDERS: ['catalog', 'orders', 'writeOrders'],
  ANALYST: ['catalog', 'analytics'],
};
export function permitted(role: WorkspaceRole, permission: Permission) {
  return rights[role].includes(permission);
}
export async function workspaceFor(
  userId: string,
  storeId: string | undefined,
  permission: Permission = 'catalog',
) {
  const seller = storeId
    ? await prisma.seller.findUnique({ where: { id: storeId } })
    : await prisma.seller.findUnique({ where: { userId } });
  if (!seller)
    throw new NotFoundException(
      'Create a store profile or accept a team invitation first',
    );
  let role: WorkspaceRole = 'OWNER';
  if (seller.userId !== userId) {
    const member = await prisma.teamMember.findUnique({
      where: { sellerId_userId: { sellerId: seller.id, userId } },
    });
    if (!member || member.status !== 'ACTIVE')
      throw new ForbiddenException('No access to this store');
    const access = await operationTransaction((tx) =>
      entitlements(tx, seller!.id),
    );
    if (!hasFeature(access.features, 'teamMembers'))
      throw new ForbiddenException('This store no longer has team access');
    role = member.role;
  }
  if (!permitted(role, permission))
    throw new ForbiddenException('Your team role does not allow this action');
  return { seller, role, permissions: rights[role] };
}
@Injectable()
export class OwnerWorkspaceGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ user: { sub: string; workspaceId?: string } }>();
    if (req.user.workspaceId)
      await workspaceFor(req.user.sub, req.user.workspaceId, 'owner');
    return true;
  }
}
