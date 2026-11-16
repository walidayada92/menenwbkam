-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "sourceVisitorHash" TEXT;
INSERT INTO "OfferPrice" (id,"offerId",price,"createdAt") SELECT 'baseline-'||id,id,price,CURRENT_TIMESTAMP FROM "Offer";
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_stock_threshold" CHECK ("lowStockThreshold" BETWEEN 0 AND 1000);
