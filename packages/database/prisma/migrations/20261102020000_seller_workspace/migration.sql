-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('MANAGER', 'CATALOG', 'ORDERS', 'ANALYST');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('INVITED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "MetricKind" AS ENUM ('IMPRESSION', 'CLICK');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('LOW_STOCK', 'PRICE_DROP');

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "brandColor" TEXT NOT NULL DEFAULT '#126b50',
ADD COLUMN     "lowStockAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "priceDropAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL,
    "status" "TeamStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferMetric" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "kind" "MetricKind" NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferPrice" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAlert" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "data" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_sellerId_userId_key" ON "TeamMember"("sellerId", "userId");

-- CreateIndex
CREATE INDEX "OfferMetric_day_offerId_kind_idx" ON "OfferMetric"("day", "offerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "OfferMetric_offerId_kind_visitorHash_day_key" ON "OfferMetric"("offerId", "kind", "visitorHash", "day");

-- CreateIndex
CREATE INDEX "OfferPrice_offerId_createdAt_idx" ON "OfferPrice"("offerId", "createdAt");

-- CreateIndex
CREATE INDEX "SellerAlert_sellerId_resolvedAt_idx" ON "SellerAlert"("sellerId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerAlert_offerId_kind_key" ON "SellerAlert"("offerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_slug_key" ON "Seller"("slug");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferMetric" ADD CONSTRAINT "OfferMetric_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPrice" ADD CONSTRAINT "OfferPrice_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAlert" ADD CONSTRAINT "SellerAlert_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAlert" ADD CONSTRAINT "SellerAlert_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
