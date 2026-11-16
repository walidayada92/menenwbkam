import { Prisma } from '@menenwbkam/database';
import { notify } from '../orders/notifications';
async function alert(
  tx: Prisma.TransactionClient,
  offer: { id: string; sellerId: string; title: string },
  kind: 'LOW_STOCK' | 'PRICE_DROP',
  data: Prisma.InputJsonValue,
) {
  const previous = await tx.sellerAlert.findUnique({
    where: { offerId_kind: { offerId: offer.id, kind } },
  });
  await tx.sellerAlert.upsert({
    where: { offerId_kind: { offerId: offer.id, kind } },
    create: { offerId: offer.id, sellerId: offer.sellerId, kind, data },
    update: { data, resolvedAt: null },
  });
  if (!previous || previous.resolvedAt) {
    const seller = await tx.seller.findUniqueOrThrow({
      where: { id: offer.sellerId },
    });
    await notify(tx, [seller.userId], {
      titleAr: kind === 'LOW_STOCK' ? 'تنبيه مخزون' : 'انخفاض سعر منافس',
      titleEn: kind === 'LOW_STOCK' ? 'Stock alert' : 'Competitor price drop',
      bodyAr: offer.title,
      bodyEn: offer.title,
      href: '/seller/insights?store=' + offer.sellerId,
    });
  }
}
export async function refreshStockAlert(
  tx: Prisma.TransactionClient,
  offerId: string,
) {
  const offer = await tx.offer.findUnique({
    where: { id: offerId },
    include: { seller: true },
  });
  if (!offer) return;
  if (
    offer.seller.lowStockAlerts &&
    offer.stock <= offer.seller.lowStockThreshold
  )
    await alert(tx, offer, 'LOW_STOCK', {
      stock: offer.stock,
      threshold: offer.seller.lowStockThreshold,
    });
  else
    await tx.sellerAlert.updateMany({
      where: { offerId, kind: 'LOW_STOCK', resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
}
export async function recordOfferChange(
  tx: Prisma.TransactionClient,
  offerId: string,
  previous: Prisma.Decimal | null,
) {
  const offer = await tx.offer.findUniqueOrThrow({
    where: { id: offerId },
    include: { seller: true },
  });
  if (!previous || !offer.price.equals(previous))
    await tx.offerPrice.create({ data: { offerId, price: offer.price } });
  await refreshStockAlert(tx, offerId);
  if (
    previous &&
    offer.price.lt(previous) &&
    offer.stock > 0 &&
    offer.seller.status === 'APPROVED'
  ) {
    const bestNow = await tx.offer.findFirst({
      where: {
        productId: offer.productId,
        stock: { gt: 0 },
        seller: { status: 'APPROVED' },
      },
      orderBy: { price: 'asc' },
      select: { price: true },
    });
    if (bestNow) {
      const watchers = await tx.priceAlert.findMany({
        where: {
          productId: offer.productId,
          active: true,
          targetPrice: { gte: bestNow.price },
          OR: [
            { lastNotifiedBestPrice: null },
            { lastNotifiedBestPrice: { gt: bestNow.price } },
          ],
        },
      });
      for (const watcher of watchers) {
        await notify(tx, [watcher.userId], {
          titleAr: 'وصل المنتج إلى السعر المطلوب',
          titleEn: 'Your target price was reached',
          bodyAr: `${offer.title}: ${bestNow.price.toFixed(2)} ر.س`,
          bodyEn: `${offer.title}: SAR ${bestNow.price.toFixed(2)}`,
          href: '/products/' + offer.productId,
        });
        await tx.priceAlert.update({
          where: { id: watcher.id },
          data: { lastNotifiedBestPrice: bestNow.price },
        });
      }
    }
    const others = await tx.offer.findMany({
      where: {
        productId: offer.productId,
        sellerId: { not: offer.sellerId },
        stock: { gt: 0 },
        price: { gt: offer.price },
        seller: { status: 'APPROVED', priceDropAlerts: true },
      },
    });
    for (const other of others)
      await alert(tx, other, 'PRICE_DROP', {
        competitorPrice: offer.price.toString(),
        ownPrice: other.price.toString(),
        suggestedPrice: Prisma.Decimal.max(
          '0.01',
          offer.price.minus('0.01'),
        ).toFixed(2),
      });
  }
  const best = await tx.offer.findFirst({
    where: {
      productId: offer.productId,
      sellerId: { not: offer.sellerId },
      stock: { gt: 0 },
      seller: { status: 'APPROVED' },
    },
    orderBy: { price: 'asc' },
    select: { price: true },
  });
  if (!best || offer.stock === 0 || offer.price.lte(best.price))
    await tx.sellerAlert.updateMany({
      where: { offerId, kind: 'PRICE_DROP', resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
}
