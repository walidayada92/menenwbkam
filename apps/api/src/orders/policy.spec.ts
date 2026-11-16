import { describe, it, expect } from 'vitest';
import { canTransition } from './policy';
describe('Order transitions', () => {
  it('restricts shoppers to cancelling new orders', () => {
    expect(canTransition('PENDING', 'CANCELLED', 'SHOPPER')).toBe(true);
    expect(canTransition('ACCEPTED', 'CANCELLED', 'SHOPPER')).toBe(false);
    expect(canTransition('PENDING', 'SHIPPED', 'SHOPPER')).toBe(false);
  });
  it('requires acceptance and shipment before delivery', () => {
    expect(canTransition('PENDING', 'ACCEPTED', 'SELLER')).toBe(true);
    expect(canTransition('PENDING', 'DELIVERED', 'SELLER')).toBe(false);
    expect(canTransition('ACCEPTED', 'SHIPPED', 'SELLER')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED', 'SELLER')).toBe(true);
    expect(canTransition('DELIVERED', 'RETURNED', 'SELLER')).toBe(true);
  });
  it('keeps cancellation and returns terminal and admin mediation separate', () => {
    expect(canTransition('CANCELLED', 'ACCEPTED', 'SELLER')).toBe(false);
    expect(canTransition('RETURNED', 'RETURNED', 'SELLER')).toBe(false);
    expect(canTransition('DELIVERED', 'RETURNED', 'ADMIN')).toBe(false);
  });
});
