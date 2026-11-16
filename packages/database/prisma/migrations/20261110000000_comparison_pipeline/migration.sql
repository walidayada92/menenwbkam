-- AlterTable
ALTER TABLE "ExternalListing" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "comparisonProductId" TEXT,
ADD COLUMN     "gtin" TEXT,
ADD COLUMN     "itemCondition" TEXT,
ADD COLUMN     "matchReason" TEXT,
ADD COLUMN     "matchStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "mpn" TEXT;

-- AlterTable
ALTER TABLE "ExternalSource" ADD COLUMN     "discoveryId" TEXT;

-- CreateTable
CREATE TABLE "ExternalDiscovery" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "startUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 1440,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCompletedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastPages" INTEGER NOT NULL DEFAULT 0,
    "lastProducts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "lastError" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonProduct" (
    "id" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSearchDocument" (
    "listingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tokens" tsvector,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalSearchDocument_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "ExternalHostThrottle" (
    "host" TEXT NOT NULL,
    "nextAllowedAt" TIMESTAMP(3) NOT NULL,
    "delayMs" INTEGER NOT NULL DEFAULT 2000,

    CONSTRAINT "ExternalHostThrottle_pkey" PRIMARY KEY ("host")
);

-- CreateIndex
CREATE INDEX "ExternalDiscovery_enabled_nextRunAt_idx" ON "ExternalDiscovery"("enabled", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalDiscovery_store_startUrl_key" ON "ExternalDiscovery"("store", "startUrl");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalJob_dedupeKey_key" ON "ExternalJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "ExternalJob_status_availableAt_idx" ON "ExternalJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "ExternalJob_status_lockedUntil_idx" ON "ExternalJob"("status", "lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonProduct_identityKey_key" ON "ComparisonProduct"("identityKey");

-- CreateIndex
CREATE INDEX "ExternalListing_comparisonProductId_status_price_idx" ON "ExternalListing"("comparisonProductId", "status", "price");

-- AddForeignKey
ALTER TABLE "ExternalSource" ADD CONSTRAINT "ExternalSource_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "ExternalDiscovery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalListing" ADD CONSTRAINT "ExternalListing_comparisonProductId_fkey" FOREIGN KEY ("comparisonProductId") REFERENCES "ComparisonProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSearchDocument" ADD CONSTRAINT "ExternalSearchDocument_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ExternalListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ExternalSearchDocument_tokens_gin" ON "ExternalSearchDocument" USING GIN (tokens);
