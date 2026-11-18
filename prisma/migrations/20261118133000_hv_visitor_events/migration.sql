-- Additive analytics-only table. Run Prisma migrations in staging before production.
-- Financial and historical partner records remain untouched.
CREATE TABLE IF NOT EXISTS "hv_visitor_events" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "affiliate_id" TEXT NOT NULL,
  "attribution_key" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "page_path" TEXT NOT NULL,
  "product_handle" TEXT,
  "channel" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hv_visitor_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "hv_visitor_events_event_id_key" ON "hv_visitor_events" ("event_id");
CREATE INDEX IF NOT EXISTS "hv_visitor_events_affiliate_id_created_at_idx" ON "hv_visitor_events" ("affiliate_id","created_at");
CREATE INDEX IF NOT EXISTS "hv_visitor_events_affiliate_id_event_type_created_at_idx" ON "hv_visitor_events" ("affiliate_id","event_type","created_at");
CREATE INDEX IF NOT EXISTS "hv_visitor_events_attribution_key_idx" ON "hv_visitor_events" ("attribution_key");
