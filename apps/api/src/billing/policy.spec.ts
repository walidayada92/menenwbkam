import { describe, it, expect } from 'vitest';
import { invoiceAmounts, lifecycle, periodEnd, hasFeature } from './policy';
describe('Subscription policy', () => {
  it('calculates discounts and VAT in integer halalas', () => {
    expect(invoiceAmounts(100, 10, 1500)).toEqual({
      subtotalHalalas: 10000,
      discountHalalas: 1000,
      vatBasisPoints: 1500,
      vatHalalas: 1350,
      totalHalalas: 10350,
    });
    expect(invoiceAmounts(1.01, 100, 1500).totalHalalas).toBe(0);
  });
  it('clamps monthly and yearly periods at month ends', () => {
    expect(
      periodEnd(new Date('2026-01-31T12:00:00Z'), 'MONTHLY').toISOString(),
    ).toBe('2026-02-28T12:00:00.000Z');
    expect(
      periodEnd(new Date('2024-02-29T12:00:00Z'), 'YEARLY').toISOString(),
    ).toBe('2025-02-28T12:00:00.000Z');
  });
  it('handles trials, grace, cancellation and expiry without a scheduler', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    const sub = {
      status: 'ACTIVE' as const,
      endDate: new Date('2026-11-09T00:00:00Z'),
      cancelAtPeriodEnd: false,
      graceEnd: null,
      plan: { graceDays: 3 },
    };
    expect(lifecycle(sub, now)).toBe('GRACE_PERIOD');
    expect(lifecycle({ ...sub, status: 'TRIALING' }, now)).toBe('EXPIRED');
    expect(lifecycle({ ...sub, cancelAtPeriodEnd: true }, now)).toBe(
      'CANCELLED',
    );
    expect(lifecycle(sub, new Date('2026-11-12T00:00:00Z'))).toBe('EXPIRED');
  });
  it('requires actual boolean entitlements', () => {
    expect(hasFeature({ bulkUpload: true }, 'bulkUpload')).toBe(true);
    expect(hasFeature({ bulkUpload: 'true' }, 'bulkUpload')).toBe(false);
    expect(hasFeature(null, 'bulkUpload')).toBe(false);
  });
});
