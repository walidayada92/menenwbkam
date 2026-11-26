import { createHmac } from 'node:crypto';
export function visitorHash(visitorId: string, sellerId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required');
  return createHmac('sha256', secret)
    .update(sellerId + ':' + visitorId)
    .digest('hex');
}
export function riyadhDay(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function rangeStart(days: number, now = new Date()) {
  return new Date(
    new Date(riyadhDay(now) + 'T00:00:00+03:00').getTime() -
      (days - 1) * 86400000,
  );
}
