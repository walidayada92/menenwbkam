UPDATE "OrderItem" i SET "productId"=o."productId", "title"=o."title"
FROM "Offer" o WHERE i."offerId"=o.id AND i."productId"='';
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK (quantity>0),
ADD CONSTRAINT "OrderItem_price_positive" CHECK ("priceAtPurchase">0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_nonnegative" CHECK ("totalAmount">=0);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK (rating BETWEEN 1 AND 5),
ADD CONSTRAINT "Review_target_consistent" CHECK ((target='SELLER' AND "productId" IS NULL AND "targetKey"='SELLER') OR (target='PRODUCT' AND "productId" IS NOT NULL AND "targetKey"='PRODUCT:'||"productId"));
