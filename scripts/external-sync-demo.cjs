// Run from the repository root after building the API. Uses the real sync worker.
require('reflect-metadata');
const { loadEnvFile } = require('node:process');
const { resolve } = require('node:path');
try { loadEnvFile(resolve(__dirname, '../.env')); } catch { /* Environment may already be set. */ }
const { prisma } = require('@menenwbkam/database');
const { ExternalSyncService } = require('../apps/api/dist/external-sync/external-sync.service.js');

async function main() {
  const url = 'https://www.almanea.sa/product/apple-iphone-16-128gb-5g-pink-p-170111801025069';
  let source = await prisma.externalSource.findFirst({ where: { store: 'ALMANEA', productUrls: { has: url } } });
  if (!source) source = await prisma.externalSource.create({ data: {
    name: 'Almanea — iPhone 16 128GB Pink', store: 'ALMANEA',
    productUrls: [url], sitemapUrls: [], intervalMinutes: 360, enabled: true,
  } });
  const run = await new ExternalSyncService().run(source.id);
  const listings = await prisma.externalListing.findMany({ where: { sourceId: source.id }, select: {
    title: true, price: true, currency: true, availability: true, lastSeenAt: true,
  } });
  console.log(JSON.stringify({ sourceId: source.id, run, listings }, null, 2));
  if (run.status !== 'SUCCEEDED') process.exitCode = 1;
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Demo sync failed');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
