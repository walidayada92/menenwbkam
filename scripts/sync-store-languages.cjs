require("reflect-metadata");
try {
  require("node:process").loadEnvFile(
    require("node:path").resolve(__dirname, "../.env"),
  );
} catch {
  /* Environment can be provided externally. */
}
const { prisma } = require("@menenwbkam/database");
const {
  throttleHost,
  pauseHost,
} = require("../apps/api/dist/external-sync/host-throttle.js");
const { enqueue } = require("../apps/api/dist/external-sync/job-queue.js");
const {
  PublicStoreClient,
} = require("../apps/api/dist/external-sync/public-store.js");
const {
  localizedTitles,
} = require("../apps/api/dist/external-sync/localized-title.js");
async function main() {
  const listings = await prisma.externalListing.findMany({
    where: {
      status: "ACTIVE",
      titleEn: null,
      source: { store: { in: ["AMAZON", "ALMANEA"] } },
    },
    include: { source: true },
    orderBy: [{ sourceId: "asc" }, { id: "asc" }],
  });
  const clients = new Map();
  const errors = [];
  let updated = 0;
  for (const listing of listings) {
    const store = listing.source.store;
    if (!clients.has(store))
      clients.set(
        store,
        new PublicStoreClient(
          store,
          AbortSignal.timeout(1800000),
          throttleHost,
          pauseHost,
        ),
      );
    try {
      const values = await localizedTitles(clients.get(store), store, {
        url: listing.url,
        title: listing.title || "",
        externalId: listing.externalId,
        price: String(listing.price),
        currency: listing.currency,
        availability: listing.availability,
        stock: listing.stock,
      });
      await prisma.$transaction(async (tx) => {
        await tx.externalListing.update({
          where: { id: listing.id },
          data: { ...values, localizedCheckedAt: new Date() },
        });
        await enqueue(tx, "MATCH", { listingId: listing.id });
      });
      updated++;
      if (updated % 10 === 0)
        console.log(
          JSON.stringify({
            updated,
            attempted: updated + errors.length,
            total: listings.length,
          }),
        );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Language check failed";
      errors.push({ id: listing.id, store, message });
      console.log(JSON.stringify({ failed: listing.id, store, message }));
      if (/blocked\/rate limited/.test(message)) break;
    }
  }
  console.log(
    JSON.stringify({ updated, total: listings.length, errors }, null, 2),
  );
  if (errors.length) process.exitCode = 1;
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
