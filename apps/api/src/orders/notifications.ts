import { Prisma } from '@menenwbkam/database';
export async function notify(
  tx: Prisma.TransactionClient,
  userIds: string[],
  event: {
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    href: string;
  },
) {
  for (const userId of new Set(userIds))
    await tx.notification.create({
      data: {
        userId,
        ...event,
        deliveries: {
          create: [
            { channel: 'EMAIL', status: 'PREVIEW' },
            { channel: 'WHATSAPP', status: 'PREVIEW' },
            { channel: 'PUSH', status: 'PREVIEW' },
          ],
        },
      },
    });
}
