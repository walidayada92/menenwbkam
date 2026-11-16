import {
  BillingInterval,
  Prisma,
  SubscriptionStatus,
} from '@menenwbkam/database';
export const featureKeys = [
  'bulkUpload',
  'basicAnalytics',
  'priceHistory',
  'featuredBadge',
  'apiAccess',
  'priorityPlacement',
  'teamMembers',
] as const;
export function hasFeature(
  features: Prisma.JsonValue | null | undefined,
  key: string,
): boolean {
  return (
    !!features &&
    typeof features === 'object' &&
    !Array.isArray(features) &&
    features[key] === true
  );
}
export function periodEnd(start: Date, interval: BillingInterval): Date {
  const result = new Date(start);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + (interval === 'YEARLY' ? 12 : 1));
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
export function lifecycle(
  sub: {
    status: SubscriptionStatus;
    endDate: Date;
    cancelAtPeriodEnd: boolean;
    graceEnd: Date | null;
    plan: { graceDays: number };
  },
  now: Date,
): SubscriptionStatus {
  if (['PENDING', 'EXPIRED', 'CANCELLED'].includes(sub.status))
    return sub.status;
  if (sub.endDate > now)
    return sub.status === 'GRACE_PERIOD' ? 'ACTIVE' : sub.status;
  if (sub.cancelAtPeriodEnd) return 'CANCELLED';
  if (sub.status === 'TRIALING') return 'EXPIRED';
  const grace =
    sub.graceEnd ||
    new Date(sub.endDate.getTime() + sub.plan.graceDays * 86400000);
  return grace > now ? 'GRACE_PERIOD' : 'EXPIRED';
}
export function invoiceAmounts(
  price: Prisma.Decimal | number,
  discountPercent: number,
  vatBasisPoints: number,
) {
  const subtotalHalalas = new Prisma.Decimal(price)
    .times(100)
    .toDecimalPlaces(0)
    .toNumber();
  const discountHalalas = Math.round((subtotalHalalas * discountPercent) / 100);
  const vatHalalas = Math.round(
    ((subtotalHalalas - discountHalalas) * vatBasisPoints) / 10000,
  );
  return {
    subtotalHalalas,
    discountHalalas,
    vatBasisPoints,
    vatHalalas,
    totalHalalas: subtotalHalalas - discountHalalas + vatHalalas,
  };
}
