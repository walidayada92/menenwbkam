import { describe, it, expect } from 'vitest';
import { permitted } from './access';
import { rangeStart, riyadhDay, visitorHash } from './metrics';
import { createWorkbook } from './xlsx';
import { readSheet } from 'read-excel-file/node';
describe('Seller workspace policy', () => {
  it('separates team permissions from ownership', () => {
    expect(permitted('OWNER', 'owner')).toBe(true);
    expect(permitted('MANAGER', 'owner')).toBe(false);
    expect(permitted('MANAGER', 'writeOrders')).toBe(true);
    expect(permitted('CATALOG', 'writeCatalog')).toBe(true);
    expect(permitted('CATALOG', 'orders')).toBe(false);
    expect(permitted('ORDERS', 'writeOrders')).toBe(true);
    expect(permitted('ORDERS', 'analytics')).toBe(false);
    expect(permitted('ANALYST', 'analytics')).toBe(true);
    expect(permitted('ANALYST', 'writeCatalog')).toBe(false);
  });
  it('uses Riyadh calendar days for report boundaries', () => {
    const now = new Date('2026-11-01T21:30:00Z');
    expect(riyadhDay(now)).toBe('2026-11-02');
    expect(rangeStart(1, now).toISOString()).toBe('2026-11-01T21:00:00.000Z');
    expect(rangeStart(7, now).toISOString()).toBe('2026-10-26T21:00:00.000Z');
  });
  it('pseudonymizes browsing sessions separately for each store', () => {
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'workspace-unit-secret';
    try {
      expect(visitorHash('visitor', 'one')).not.toContain('visitor');
      expect(visitorHash('visitor', 'one')).not.toBe(
        visitorHash('visitor', 'two'),
      );
    } finally {
      if (previous === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previous;
    }
  });
  it('writes real XLSX with Arabic text, exact values and non-formula cells', async () => {
    const rows = await readSheet(
      createWorkbook([
        ['Title', 'Amount'],
        ['منتج تجريبي', '123.45'],
        ['=HYPERLINK("test")', 2],
        ['bad' + String.fromCharCode(0) + 'cell', 0],
      ]),
      1,
    );
    expect(rows[1]).toEqual(['منتج تجريبي', '123.45']);
    expect(rows[2][0]).toBe('=HYPERLINK("test")');
    expect(rows[3][0]).toBe('badcell');
  });
});
