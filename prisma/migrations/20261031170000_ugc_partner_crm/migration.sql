-- Operational UGC / affiliate prospect CRM. Separate from affiliate logins and COD financial orders.
CREATE TABLE IF NOT EXISTS "ugc_contacts" (
  "id" TEXT NOT NULL,
  "external_id" TEXT,
  "name" TEXT NOT NULL,
  "social_url" TEXT,
  "phone" TEXT,
  "contact_status" TEXT NOT NULL DEFAULT 'NEW',
  "acceptance" TEXT NOT NULL DEFAULT 'PENDING',
  "qualification" TEXT NOT NULL DEFAULT 'UNREVIEWED',
  "kind" TEXT NOT NULL DEFAULT 'UGC',
  "priority" INTEGER NOT NULL DEFAULT 3,
  "budget_egp" INTEGER,
  "content_url" TEXT,
  "product" TEXT,
  "video_concept" TEXT,
  "content_status" TEXT NOT NULL DEFAULT 'IDEA',
  "notes" TEXT,
  "affiliate_id" TEXT,
  "next_follow_up_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ugc_contacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ugc_contacts_external_id_key" ON "ugc_contacts"("external_id");
CREATE INDEX IF NOT EXISTS "ugc_contacts_contact_status_idx" ON "ugc_contacts"("contact_status");
CREATE INDEX IF NOT EXISTS "ugc_contacts_kind_idx" ON "ugc_contacts"("kind");
CREATE INDEX IF NOT EXISTS "ugc_contacts_affiliate_id_idx" ON "ugc_contacts"("affiliate_id");
CREATE INDEX IF NOT EXISTS "ugc_contacts_next_follow_up_at_idx" ON "ugc_contacts"("next_follow_up_at");

CREATE TABLE IF NOT EXISTS "ugc_shipments" (
  "id" TEXT NOT NULL,
  "contact_id" TEXT,
  "tracking_number" TEXT,
  "recipient_name" TEXT NOT NULL,
  "phone" TEXT,
  "governorate" TEXT,
  "district" TEXT,
  "delivery_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "delivery_type" TEXT,
  "collection_type" TEXT NOT NULL DEFAULT 'NO_COLLECTION',
  "amount_egp" INTEGER,
  "captured_at" TIMESTAMP(3),
  "source" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ugc_shipments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ugc_shipments_tracking_number_key" ON "ugc_shipments"("tracking_number");
CREATE INDEX IF NOT EXISTS "ugc_shipments_contact_id_idx" ON "ugc_shipments"("contact_id");
CREATE INDEX IF NOT EXISTS "ugc_shipments_delivery_status_idx" ON "ugc_shipments"("delivery_status");
ALTER TABLE "ugc_shipments" ADD CONSTRAINT "ugc_shipments_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "ugc_contacts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ugc_contact_activities" (
  "id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ugc_contact_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ugc_contact_activities_contact_id_created_at_idx" ON "ugc_contact_activities"("contact_id","created_at");
ALTER TABLE "ugc_contact_activities" ADD CONSTRAINT "ugc_contact_activities_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "ugc_contacts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
