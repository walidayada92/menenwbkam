ALTER TABLE "Offer" ADD COLUMN "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN "descriptionAr" TEXT,
ADD COLUMN "descriptionEn" TEXT,
ADD COLUMN "images" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_price_positive" CHECK ("price" > 0),
ADD CONSTRAINT "Offer_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_rating_range" CHECK ("rating" >= 0 AND "rating" <= 5);
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_limit_valid" CHECK ("productLimit" >= -1);
