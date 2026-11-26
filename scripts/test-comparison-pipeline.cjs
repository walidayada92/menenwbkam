// Integration checks use temporary, uniquely named rows in the configured database.
require("reflect-metadata");
try {
  require("node:process").loadEnvFile(
    require("node:path").resolve(__dirname, "../.env"),
  );
} catch {
  /* Environment can be supplied externally. */
}
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { prisma } = require("@menenwbkam/database");
const {
  queueJob,
  claimJob,
  finishJob,
  failJob,
} = require("../apps/api/dist/external-sync/job-queue.js");
const {
  matchListing,
} = require("../apps/api/dist/external-sync/product-matcher.js");
const {
  indexListing,
  indexedPage,
} = require("../apps/api/dist/external-sync/search-index.js");
const marker = "pipelinefixture" + randomUUID().replaceAll("-", "");
const {
  pauseHost,
  throttleHost,
} = require("../apps/api/dist/external-sync/host-throttle.js");
const {
  StoreBackoffError,
  crawlSettings,
} = require("../apps/api/dist/external-sync/crawl-policy.js");
const testHost = marker + ".invalid";
const sources = [],
  listings = [],
  jobs = [],
  products = new Set();
async function main() {
  const kind = "TEST_" + marker;
  const [first, duplicate] = await Promise.all([
    queueJob(kind, { test: marker }, marker + ":dedupe"),
    queueJob(kind, { test: marker }, marker + ":dedupe"),
  ]);
  assert.equal(first.id, duplicate.id);
  jobs.push(first.id);
  const other = await queueJob(kind, { test: marker });
  jobs.push(other.id);
  const [a, b] = await Promise.all([claimJob([kind]), claimJob([kind])]);
  assert(a && b);
  assert.notEqual(a.id, b.id);
  await finishJob(b, { ok: true });
  await failJob(a, new Error("Temporary failure"));
  let row = await prisma.externalJob.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(row.status, "WAITING");
  assert(row.availableAt.getTime() > Date.now());
  assert.equal(await claimJob([kind]), null); // SQL and Node clocks must agree on the retry deadline.
  await prisma.externalJob.update({
    where: { id: a.id },
    data: { availableAt: new Date(0) },
  });
  const recovered = await claimJob([kind]);
  assert.equal(recovered.id, a.id);
  assert.equal(recovered.attempts, 2);
  assert.equal((await finishJob(a, { stale: true })).count, 0);
  await prisma.externalJob.update({
    where: { id: recovered.id },
    data: { lockedUntil: new Date(0) },
  });
  const reclaimed = await claimJob([kind]);
  assert.equal(reclaimed.id, a.id);
  assert.equal(reclaimed.attempts, 3);
  await prisma.externalJob.update({
    where: { id: reclaimed.id },
    data: { attempts: 4, lockedUntil: new Date(0) },
  });
  assert.equal(await claimJob([kind]), null);
  row = await prisma.externalJob.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(row.status, "FAILED");
  console.log(
    "PASS: atomic deduplication, competing workers, delayed retry, stale owner fencing, crash recovery, dead-letter state",
  );
  const passive = await queueJob(kind, { test: marker });
  jobs.push(passive.id);
  await prisma.externalJob.update({
    where: { id: passive.id },
    data: { maxAttempts: 1 },
  });
  const passiveClaim = await claimJob([kind]);
  const deadline = new Date(Date.now() + 3600000);
  await failJob(
    passiveClaim,
    new StoreBackoffError("Shared host pause", deadline, "COOLDOWN", true),
  );
  const deferred = await prisma.externalJob.findUniqueOrThrow({
    where: { id: passive.id },
  });
  assert.equal(deferred.status, "WAITING");
  assert.equal(deferred.attempts, 0);
  assert(deferred.availableAt >= deadline);
  await throttleHost(testHost, 5, AbortSignal.timeout(2000));
  const until = await pauseHost(testHost, "RATE_LIMITED", "7200");
  assert(until.getTime() >= Date.now() + 7199000);
  await assert.rejects(
    throttleHost(testHost, 5, AbortSignal.timeout(2000)),
    (error) => error.kind === "COOLDOWN",
  );
  await prisma.externalHostThrottle.update({
    where: { host: testHost },
    data: {
      cooldownUntil: null,
      nextAllowedAt: new Date(),
      hourRequests: crawlSettings().hourlyBudget,
    },
  });
  await assert.rejects(
    throttleHost(testHost, 5, AbortSignal.timeout(2000)),
    (error) => error.kind === "BUDGET",
  );
  console.log(
    "PASS: persistent host cooldown, Retry-After, shared request budget, passive deferral without attempt exhaustion",
  );

  for (const store of ["AMAZON", "ALMANEA"])
    sources.push(
      await prisma.externalSource.create({
        data: {
          name: marker,
          store,
          productUrls: [],
          sitemapUrls: [],
          enabled: false,
        },
      }),
    );
  for (let i = 0; i < 3; i++)
    listings.push(
      await prisma.externalListing.create({
        data: {
          sourceId: sources[i % 2].id,
          url: `https://www.amazon.sa/test/${marker}/${i}`,
          title: marker + (i === 2 ? " Refurbished" : ""),
          titleEn: marker,
          currency: "SAR",
          price: [100, 120, 80][i],
          gtin: "4006381333931",
          itemCondition: i === 2 ? "RefurbishedCondition" : "NewCondition",
          availability: "InStock",
        },
      }),
    );
  for (const listing of listings) {
    await matchListing(listing.id);
    await indexListing(listing.id);
  }
  const matched = await prisma.externalListing.findMany({
    where: { id: { in: listings.map((x) => x.id) } },
    orderBy: { price: "asc" },
  });
  for (const row of matched)
    if (row.comparisonProductId) products.add(row.comparisonProductId);
  const newProduct = matched.find(
    (x) => x.id === listings[0].id,
  ).comparisonProductId;
  assert.equal(
    newProduct,
    matched.find((x) => x.id === listings[1].id).comparisonProductId,
  );
  assert.notEqual(
    newProduct,
    matched.find((x) => x.id === listings[2].id).comparisonProductId,
  );
  const result = await indexedPage(marker);
  assert.equal(result.total, 3);
  assert.equal(result.ids[0], listings[2].id);
  const exact = await indexedPage(marker, 1, newProduct);
  assert.equal(exact.total, 2);
  await prisma.externalListing.update({
    where: { id: listings[0].id },
    data: { status: "REMOVED" },
  });
  assert.equal((await indexedPage(marker)).total, 2); // stale index can never expose a removed listing
  await indexListing(listings[0].id);
  assert.equal(
    await prisma.externalSearchDocument.count({
      where: { listingId: listings[0].id },
    }),
    0,
  );
  const indexes =
    await prisma.$queryRaw`SELECT indexdef FROM pg_indexes WHERE indexname='ExternalSearchDocument_tokens_gin'`;
  assert(indexes[0].indexdef.includes("USING gin"));
  console.log(
    "PASS: cross-store matching, condition isolation, indexed price order, exact-product search, removal propagation, real GIN index",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.externalHostThrottle.deleteMany({ where: { host: testHost } });
    const ids = listings.map((x) => x.id);
    if (ids.length)
      await prisma.externalJob.deleteMany({
        where: {
          OR: ids.map((id) => ({
            payload: { path: ["listingId"], equals: id },
          })),
        },
      });
    await prisma.externalJob.deleteMany({
      where: { OR: [{ id: { in: jobs } }, { kind: "TEST_" + marker }] },
    });
    await prisma.externalSource.deleteMany({
      where: { id: { in: sources.map((x) => x.id) } },
    });
    await prisma.comparisonProduct.deleteMany({
      where: { id: { in: [...products] }, listings: { none: {} } },
    });
    await prisma.$disconnect();
  });
