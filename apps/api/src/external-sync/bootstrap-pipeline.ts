import 'reflect-metadata';
import { prisma } from '@menenwbkam/database';
import { enqueue } from './job-queue';

export async function bootstrapPipeline() {
  const configs = [
    {
      name: 'Amazon iPhone discovery',
      store: 'AMAZON',
      startUrl: 'https://www.amazon.sa/s?k=iphone',
    },
    {
      name: 'Almanea iPhone discovery',
      store: 'ALMANEA',
      startUrl: 'https://www.almanea.sa/iphones-c-7651',
    },
    {
      name: 'Noon iPhone discovery',
      store: 'NOON',
      startUrl: 'https://www.noon.com/saudi-en/search/?q=iphone',
    },
  ];
  for (const config of configs)
    await prisma.externalDiscovery.upsert({
      where: {
        store_startUrl: { store: config.store, startUrl: config.startUrl },
      },
      create: { ...config, enabled: true },
      update: {},
    });
  let cursor: string | undefined,
    count = 0;
  while (true) {
    const rows = await prisma.externalListing.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    await prisma.$transaction(async (tx) => {
      for (const row of rows) await enqueue(tx, 'MATCH', { listingId: row.id });
    });
    count += rows.length;
    cursor = rows[rows.length - 1].id;
  }
  return { discoveries: configs.length, queuedForMatchingAndIndexing: count };
}
if (require.main === module)
  void bootstrapPipeline()
    .then(console.log)
    .catch((error: unknown) => {
      console.error(
        error instanceof Error ? error.message : 'Bootstrap failed',
      );
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
