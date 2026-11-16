ALTER TABLE "ExternalListing"
  ADD COLUMN "titleEn" TEXT,
  ADD COLUMN "titleAr" TEXT,
  ADD COLUMN "urlEn" TEXT,
  ADD COLUMN "urlAr" TEXT;

UPDATE "ExternalListing"
SET "titleAr" = "title", "urlAr" = "url"
WHERE "title" ~ '[؀-ۿ]';

UPDATE "ExternalListing"
SET "titleEn" = "title", "urlEn" = "url"
WHERE "title" IS NOT NULL AND "title" !~ '[؀-ۿ]';
