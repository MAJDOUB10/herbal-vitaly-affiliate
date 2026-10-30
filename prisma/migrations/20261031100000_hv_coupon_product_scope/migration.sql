-- Additive migration: only records new product targeting, existing coupons unchanged.
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "shopify_product_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
