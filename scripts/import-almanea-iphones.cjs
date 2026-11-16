// Import every unique iPhone product linked from Almanea's public category.
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
  storeUrl,
} = require("../apps/api/dist/external-sync/public-store.js");
const {
  ExternalSyncService,
} = require("../apps/api/dist/external-sync/external-sync.service.js");

async function main() {
  const category = "https://www.almanea.sa/iphones-c-7651";
  const client = new PublicStoreClient(
    "ALMANEA",
    AbortSignal.timeout(120000),
    throttleHost,
    pauseHost,
  );
  const pages = [category],
    visited = new Set(),
    products = new Set();
  while (pages.length) {
    const page = pages.shift();
    if (visited.has(page)) continue;
    if (visited.size >= 10)
      throw new Error(
        "Category pagination exceeded 10 pages; refusing a partial import",
      );
    visited.add(page);
    const result = await client.get(page);
    if (result.status !== 200)
      throw new Error(`Category returned HTTP ${result.status}`);
    for (const match of result.body.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      const url = new URL(match[1].replace(/&amp;/g, "&"), page);
      if (url.hostname !== "www.almanea.sa") continue;
      if (
        url.pathname.startsWith("/product/") &&
        /iphone/i.test(url.pathname)
      ) {
        url.search = "";
        url.hash = "";
        products.add(storeUrl(url.toString(), "ALMANEA"));
      }
      if (
        url.pathname === new URL(category).pathname &&
        (url.searchParams.has("page") || url.searchParams.has("p"))
      ) {
        url.hash = "";
        if (!visited.has(url.toString())) pages.push(url.toString());
      }
    }
  }
  if (!products.size)
    throw new Error(
      "No product URLs discovered; existing sources were left unchanged",
    );
  const urls = [...products].sort();
  const sources = await prisma.externalSource.findMany({
    where: { store: "ALMANEA", productUrls: { hasSome: urls } },
  });
  const covered = new Set(sources.flatMap((source) => source.productUrls));
  const remaining = urls.filter((url) => !covered.has(url));
  // Keep each source within the worker's 25-product run budget.
  for (let start = 0; start < remaining.length; start += 25) {
    sources.push(
      await prisma.externalSource.create({
        data: {
          name: `Almanea iPhones - batch ${sources.length + 1}`,
          store: "ALMANEA",
          productUrls: remaining.slice(start, start + 25),
          sitemapUrls: [],
          intervalMinutes: 360,
          enabled: true,
        },
      }),
    );
  }
  console.log(
    `Discovered ${urls.length} unique iPhone listings across ${visited.size} category page(s). Syncing ${sources.length} source(s).`,
  );
  const worker = new ExternalSyncService();
  const runs = [];
  for (const source of sources) {
    await prisma.externalSource.update({
      where: { id: source.id },
      data: { enabled: true },
    });
    const run = await worker.run(source.id);
    runs.push({
      sourceId: source.id,
      status: run.status,
      checked: run.checked,
      changed: run.changed,
      errors: run.errors,
    });
    console.log(JSON.stringify(runs.at(-1)));
  }
  const listings = await prisma.externalListing.findMany({
    where: {
      source: { store: "ALMANEA" },
      url: { in: urls },
      status: "ACTIVE",
    },
    select: {
      title: true,
      price: true,
      currency: true,
      availability: true,
      lastSeenAt: true,
    },
    orderBy: { price: "asc" },
  });
  console.log(
    JSON.stringify(
      { discovered: urls.length, imported: listings.length, listings },
      null,
      2,
    ),
  );
  if (
    listings.length !== urls.length ||
    runs.some((run) => run.status !== "SUCCEEDED")
  )
    process.exitCode = 1;
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Import failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
