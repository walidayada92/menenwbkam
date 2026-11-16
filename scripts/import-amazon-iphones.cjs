// Follow Amazon Saudi Arabia's iPhone search pagination and sync unique devices.
require("reflect-metadata");
const { loadEnvFile } = require("node:process");
const { resolve } = require("node:path");
try {
  loadEnvFile(resolve(__dirname, "../.env"));
} catch {
  /* Environment may already be set. */
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
  amazonSearchProducts,
  amazonNextSearchPage,
  isAmazonIphoneDevice,
} = require("../apps/api/dist/external-sync/amazon.js");
const {
  ExternalSyncService,
} = require("../apps/api/dist/external-sync/external-sync.service.js");

async function excludeAccessories() {
  const accessories = await prisma.externalListing.findMany({
    where: {
      source: {
        store: "AMAZON",
        name: { startsWith: "Amazon iPhones - batch " },
      },
      status: "ACTIVE",
    },
    select: { id: true, sourceId: true, url: true, title: true },
  });
  const rejected = accessories.filter(
    (listing) => !isAmazonIphoneDevice(listing.title || ""),
  );
  for (const listing of rejected)
    await prisma.$transaction(async (tx) => {
      await tx.externalListing.update({
        where: { id: listing.id },
        data: { status: "EXCLUDED" },
      });
      await enqueue(tx, "INDEX", { listingId: listing.id });
      await tx.externalListingChange.create({
        data: {
          listingId: listing.id,
          kind: "EXCLUDED",
          before: { status: "ACTIVE" },
          after: {
            status: "EXCLUDED",
            reason: "Accessory, not an iPhone device",
          },
        },
      });
      const source = await tx.externalSource.findUniqueOrThrow({
        where: { id: listing.sourceId },
      });
      const productUrls = source.productUrls.filter(
        (url) => url !== listing.url,
      );
      await tx.externalSource.update({
        where: { id: source.id },
        data: {
          productUrls,
          ...(productUrls.length ? {} : { enabled: false }),
        },
      });
    });
  return rejected.length;
}

async function main() {
  const client = new PublicStoreClient(
    "AMAZON",
    AbortSignal.timeout(600000),
    throttleHost,
    pauseHost,
  );
  let next = "https://www.amazon.sa/s?k=iphone";
  const visited = new Set(),
    products = new Map();
  const asin = (url) =>
    new URL(url).pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  while (next) {
    if (visited.has(next))
      throw new Error(
        "Amazon pagination loop detected; discovery is incomplete",
      );
    if (visited.size >= 100)
      throw new Error(
        "Discovery exceeded 100 pages; refusing to claim complete coverage",
      );
    const result = await client.get(next);
    if (result.status !== 200)
      throw new Error(`Amazon search returned HTTP ${result.status}`);
    const pageProducts = amazonSearchProducts(result.body);
    if (!pageProducts.length)
      throw new Error(`No device results on ${next}; discovery is incomplete`);
    for (const url of pageProducts)
      if (!products.has(asin(url))) products.set(asin(url), url);
    visited.add(next);
    console.log(
      `Search page ${visited.size}: ${pageProducts.length} devices; ${products.size} unique ASINs so far.`,
    );
    next = amazonNextSearchPage(result.body, next);
  }
  const urls = [...products.values()];
  if (!urls.length)
    throw new Error(
      "No iPhone device listings found; source data left unchanged",
    );
  const sources = await prisma.externalSource.findMany({
    where: { store: "AMAZON" },
  });
  const covered = new Set(
    sources.flatMap((source) => source.productUrls.map(asin)),
  );
  const added = urls.filter((url) => !covered.has(asin(url)));
  for (let start = 0; start < added.length; start += 25)
    sources.push(
      await prisma.externalSource.create({
        data: {
          name: `Amazon iPhones - batch ${sources.length + 1}`,
          store: "AMAZON",
          productUrls: added.slice(start, start + 25),
          sitemapUrls: [],
          enabled: true,
          intervalMinutes: 360,
        },
      }),
    );
  console.log(
    `Completed ${visited.size} search pages: ${urls.length} unique iPhone device listings.`,
  );
  const worker = new ExternalSyncService();
  for (const source of sources) {
    const run = await worker.run(source.id);
    console.log(
      JSON.stringify({
        sourceId: source.id,
        status: run.status,
        checked: run.checked,
        changed: run.changed,
        errors: run.errors,
      }),
    );
    if (run.status !== "SUCCEEDED") process.exitCode = 1;
    if (JSON.stringify(run.errors).includes("blocked/rate limited")) break;
  }
  const excludedAccessories = await excludeAccessories();
  const listings = await prisma.externalListing.findMany({
    where: { source: { store: "AMAZON" }, status: "ACTIVE" },
    select: { title: true, price: true, currency: true, availability: true },
    orderBy: { price: "asc" },
  });
  const discoveredAsins = new Set(urls.map(asin));
  const observed = await prisma.externalListing.findMany({
    where: { source: { store: "AMAZON" }, status: "ACTIVE" },
    select: { externalId: true },
  });
  console.log(
    JSON.stringify(
      {
        pages: visited.size,
        excludedAccessories,
        discovered: urls.length,
        importedTotal: listings.length,
        discoveredWithVerifiedPrices: observed.filter((listing) =>
          discoveredAsins.has(listing.externalId),
        ).length,
      },
      null,
      2,
    ),
  );
}
module.exports = { excludeAccessories };
if (require.main === module)
  main()
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Amazon import failed",
      );
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
