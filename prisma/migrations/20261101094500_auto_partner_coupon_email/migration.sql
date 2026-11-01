-- Additive delivery tracking for automatically provisioned Shopify affiliate coupons.
-- Existing orders, commissions, payouts and coupon assignments remain unchanged.
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "auto_email_sent_at" TIMESTAMP(3);
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "auto_email_claimed_at" TIMESTAMP(3);
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "auto_email_error" TEXT;
