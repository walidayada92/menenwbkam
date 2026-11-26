-- CreateTable
CREATE TABLE "ExternalSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "productUrls" TEXT[],
    "sitemapUrls" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 360,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalListing" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "externalId" TEXT,
    "price" DECIMAL(12,2),
    "currency" TEXT,
    "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "stock" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalListingChange" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalListingChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSyncRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "checked" INTEGER NOT NULL DEFAULT 0,
    "changed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalSource_enabled_nextRunAt_idx" ON "ExternalSource"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "ExternalListing_sourceId_status_idx" ON "ExternalListing"("sourceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalListing_sourceId_url_key" ON "ExternalListing"("sourceId", "url");

-- CreateIndex
CREATE INDEX "ExternalListingChange_listingId_createdAt_idx" ON "ExternalListingChange"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "ExternalSyncRun_sourceId_startedAt_idx" ON "ExternalSyncRun"("sourceId", "startedAt");

-- AddForeignKey
ALTER TABLE "ExternalListing" ADD CONSTRAINT "ExternalListing_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExternalSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalListingChange" ADD CONSTRAINT "ExternalListingChange_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ExternalListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSyncRun" ADD CONSTRAINT "ExternalSyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExternalSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
