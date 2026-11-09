
-- Apply to an isolated preview database first. No production mutation is performed.
ALTER TABLE "affiliates" ADD COLUMN "is_master_partner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "affiliates" ADD COLUMN "parent_affiliate_id" TEXT;
ALTER TABLE "affiliates" ADD COLUMN "team_share_bps" INTEGER;
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_team_share_bps_check" CHECK ("team_share_bps" IS NULL OR "team_share_bps" BETWEEN 0 AND 10000);
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_no_self_parent_check" CHECK ("parent_affiliate_id" IS NULL OR "parent_affiliate_id" <> "id");
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_parent_affiliate_id_fkey" FOREIGN KEY ("parent_affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "affiliates_parent_affiliate_id_idx" ON "affiliates"("parent_affiliate_id");
CREATE TABLE "team_invitations" (
  "id" TEXT NOT NULL PRIMARY KEY, "master_affiliate_id" TEXT NOT NULL,
  "email" TEXT NOT NULL, "share_bps" INTEGER NOT NULL CHECK ("share_bps" BETWEEN 0 AND 10000),
  "token_hash" TEXT NOT NULL UNIQUE, "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "team_invitations_master_affiliate_id_fkey" FOREIGN KEY ("master_affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "team_invitations_master_affiliate_id_created_at_idx" ON "team_invitations"("master_affiliate_id", "created_at");
CREATE INDEX "team_invitations_email_expires_at_idx" ON "team_invitations"("email", "expires_at");
CREATE TABLE "team_commission_splits" (
  "id" TEXT NOT NULL PRIMARY KEY, "source_type" TEXT NOT NULL, "source_id" TEXT NOT NULL,
  "master_affiliate_id" TEXT NOT NULL, "child_affiliate_id" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP', "total_piasters" BIGINT NOT NULL CHECK ("total_piasters" >= 0),
  "child_piasters" BIGINT NOT NULL CHECK ("child_piasters" >= 0),
  "master_piasters" BIGINT NOT NULL CHECK ("master_piasters" >= 0),
  "share_bps" INTEGER NOT NULL CHECK ("share_bps" BETWEEN 0 AND 10000),
  "status" TEXT NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "team_commission_splits_sum_check" CHECK ("total_piasters" = "child_piasters" + "master_piasters"),
  CONSTRAINT "team_commission_splits_master_affiliate_id_fkey" FOREIGN KEY ("master_affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "team_commission_splits_child_affiliate_id_fkey" FOREIGN KEY ("child_affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "team_commission_splits_source_type_source_id_key" ON "team_commission_splits"("source_type", "source_id");
CREATE INDEX "team_commission_splits_master_affiliate_id_status_idx" ON "team_commission_splits"("master_affiliate_id", "status");
CREATE INDEX "team_commission_splits_child_affiliate_id_status_idx" ON "team_commission_splits"("child_affiliate_id", "status");
