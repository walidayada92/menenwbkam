import { ConflictException, ForbiddenException } from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';
import { hasFeature, lifecycle } from './policy';
export async function entitlements(
  tx: Prisma.TransactionClient,
  sellerId: string,
  now = new Date(),
) {
  const seller = await tx.seller.findUniqueOrThrow({
    where: { id: sellerId },
    include: { plan: true },
  });
  const sub = await tx.subscription.findUnique({
    where: { sellerId },
    include: { plan: true },
  });
  const free = await tx.plan.findUnique({ where: { id: 'free' } });
  const status = sub ? lifecycle(sub, now) : 'FREE';
  const entitled =
    sub && ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'].includes(status);
  const plan = entitled ? sub.plan : sub ? free : seller.plan || free;
  // Legacy sellers with no subscription retain their assigned plan. Expired subscriptions never do.
  if (sub && status !== sub.status) {
    await tx.subscription.update({
      where: { id: sub.id },
      data: { status: status as Exclude<typeof status, 'FREE'> },
    });
    await tx.seller.update({
      where: { id: sellerId },
      data: { currentPlanId: plan?.id || null },
    });
  }
  return {
    plan,
    status,
    subscription: sub,
    productLimit: plan?.productLimit ?? 10,
    features: plan?.features || {},
  };
}
export async function requireFeature(
  tx: Prisma.TransactionClient,
  sellerId: string,
  key: string,
) {
  const access = await entitlements(tx, sellerId);
  if (!hasFeature(access.features, key))
    throw new ForbiddenException('Your subscription does not include ' + key);
  return access;
}
export async function billingTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      });
    } catch (error) {
      if (isTransactionConflict(error)) {
        if (attempt < 2) continue;
        throw new ConflictException(
          'Concurrent subscription change; please retry',
        );
      }
      throw error;
    }
  }
  throw new Error('Transaction retry exhausted');
}
export function isTransactionConflict(error: unknown): boolean {
  const detail = error as {
    code?: string;
    meta?: {
      code?: string;
      driverAdapterError?: { cause?: { originalCode?: string } };
    };
  };
  const sqlState =
    detail?.meta?.driverAdapterError?.cause?.originalCode || detail?.meta?.code;
  return (
    detail?.code === 'P2034' ||
    (detail?.code === 'P2010' && ['40001', '40P01'].includes(sqlState || ''))
  );
}
