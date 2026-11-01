-- Admin-controlled policy for future partner Shopify discounts.
-- Existing coupons and financial records are not modified.
CREATE TABLE IF NOT EXISTS "auto_coupon_settings" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "prefix" TEXT NOT NULL DEFAULT 'HV',
  "discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "product_handles" TEXT[] NOT NULL DEFAULT ARRAY['tiynefret','ushabti']::TEXT[],
  "send_email" BOOLEAN NOT NULL DEFAULT TRUE,
  "updated_by" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "auto_coupon_settings" ("id","enabled","prefix","discount_percent","product_handles","send_email","updated_at")
VALUES ('default',TRUE,'HV',15,ARRAY['tiynefret','ushabti']::TEXT[],TRUE,CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
