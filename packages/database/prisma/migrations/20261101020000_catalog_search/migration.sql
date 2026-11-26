CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_model_search" ON "Product" USING GIN ("modelName" gin_trgm_ops);
CREATE INDEX "Product_ar_search" ON "Product" USING GIN ("descriptionAr" gin_trgm_ops);
CREATE INDEX "Product_en_search" ON "Product" USING GIN ("descriptionEn" gin_trgm_ops);
CREATE INDEX "Brand_ar_search" ON "Brand" USING GIN ("nameAr" gin_trgm_ops);
CREATE INDEX "Brand_en_search" ON "Brand" USING GIN ("nameEn" gin_trgm_ops);
CREATE INDEX "Seller_status" ON "Seller" ("status");
