ALTER TABLE "Invoice" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'CHANGE';
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_nonnegative_prices" CHECK ("monthlyPrice" >= 0 AND "yearlyPrice" >= 0);
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_trial_grace_range" CHECK ("trialDays" BETWEEN 0 AND 90 AND "graceDays" BETWEEN 0 AND 30);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_discount_range" CHECK ("percentOff" BETWEEN 1 AND 100);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_redemptions_range" CHECK ("redemptionCount" >= 0 AND "maxRedemptions" > 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_valid" CHECK ("subtotalHalalas" >= 0 AND "discountHalalas" BETWEEN 0 AND "subtotalHalalas" AND "vatBasisPoints" BETWEEN 0 AND 10000 AND "vatHalalas" >= 0 AND "totalHalalas" = "subtotalHalalas" - "discountHalalas" + "vatHalalas");
