import { OrderStatus, UserRole } from '@menenwbkam/database';
export const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: UserRole,
) {
  return role === 'SHOPPER'
    ? from === 'PENDING' && to === 'CANCELLED'
    : role === 'SELLER' && transitions[from].includes(to);
}
export const statusWords: Record<OrderStatus, { ar: string; en: string }> = {
  PENDING: { ar: 'طلب جديد', en: 'New order' },
  ACCEPTED: { ar: 'تم قبول الطلب', en: 'Order accepted' },
  SHIPPED: { ar: 'تم شحن الطلب', en: 'Order shipped' },
  DELIVERED: { ar: 'تم تسليم الطلب', en: 'Order delivered' },
  CANCELLED: { ar: 'تم إلغاء الطلب', en: 'Order cancelled' },
  RETURNED: { ar: 'تم إرجاع الطلب', en: 'Order returned' },
};
