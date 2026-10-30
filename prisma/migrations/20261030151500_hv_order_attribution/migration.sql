-- Run only against a dedicated STAGING database after verifying backups.
-- Existing records remain UNVERIFIED and are not silently assigned to a partner.
ALTER TABLE "hv_cod_orders"
  ADD COLUMN IF NOT EXISTS "affiliate_id" TEXT,
  ADD COLUMN IF NOT EXISTS "attribution_source" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "discount_code" TEXT,
  ADD COLUMN IF NOT EXISTS "attribution_key" TEXT;
CREATE INDEX IF NOT EXISTS "hv_cod_orders_affiliate_id_shopify_updated_at_idx"
  ON "hv_cod_orders" ("affiliate_id", "shopifyUpdatedAt");
CREATE INDEX IF NOT EXISTS "hv_cod_orders_attribution_source_idx"
  ON "hv_cod_orders" ("attribution_source");
