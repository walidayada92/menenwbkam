-- AlterTable
ALTER TABLE "ExternalHostThrottle" ADD COLUMN     "blockCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cooldownUntil" TIMESTAMPTZ(3),
ADD COLUMN     "dayRequests" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dayStartedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hourRequests" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hourStartedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastBlockReason" TEXT,
ADD COLUMN     "lastBlockedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "ExternalListing" ADD COLUMN     "localizedCheckedAt" TIMESTAMPTZ(3);
-- Existing localized names can be reused without immediately re-fetching every page.
UPDATE "ExternalListing" SET "localizedCheckedAt" = "lastCheckedAt" AT TIME ZONE 'UTC'
WHERE "titleEn" IS NOT NULL OR "titleAr" IS NOT NULL;
