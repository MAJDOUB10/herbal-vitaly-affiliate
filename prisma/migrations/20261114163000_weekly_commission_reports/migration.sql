-- Additive and reversible ONLY through a reviewed database procedure.
-- Apply to an isolated preview Neon branch first.
-- This report ledger NEVER credits balances or creates payouts.
CREATE TABLE "hv_weekly_commission_batches" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "week_start" TIMESTAMP(3) NOT NULL,
 "week_end" TIMESTAMP(3) NOT NULL,
 "currency" TEXT NOT NULL DEFAULT 'EGP',
 "created_by" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "hv_weekly_batches_week_check" CHECK ("week_end" > "week_start"),
 CONSTRAINT "hv_weekly_batches_currency_check" CHECK ("currency" = 'EGP')
);
CREATE UNIQUE INDEX "hv_weekly_commission_batches_week_start_key"
 ON "hv_weekly_commission_batches"("week_start");

CREATE TABLE "hv_weekly_commission_lines" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "batch_id" TEXT NOT NULL,
 "source_order_id" TEXT NOT NULL,
 "source_order_name" TEXT NOT NULL,
 "beneficiary_affiliate_id" TEXT NOT NULL,
 "beneficiary_role" TEXT NOT NULL,
 "sale_piasters" INTEGER NOT NULL,
 "pool_piasters" INTEGER NOT NULL,
 "original_piasters" INTEGER NOT NULL,
 "amount_piasters" INTEGER NOT NULL,
 "share_bps" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "notes" TEXT,
 "reviewed_by" TEXT,
 "reviewed_at" TIMESTAMP(3),
 "cancelled_by" TEXT,
 "cancelled_at" TIMESTAMP(3),
 "cancellation_reason" TEXT,
 "payment_reference" TEXT,
 "paid_by" TEXT,
 "paid_at" TIMESTAMP(3),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "hv_weekly_line_batch_fkey" FOREIGN KEY ("batch_id")
    REFERENCES "hv_weekly_commission_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "hv_weekly_line_amount_check" CHECK (
   "sale_piasters" >= 0 AND "pool_piasters" > 0 AND
   "original_piasters" > 0 AND "amount_piasters" > 0 AND
   "amount_piasters" <= "original_piasters" AND "share_bps" BETWEEN 0 AND 10000
 ),
 CONSTRAINT "hv_weekly_line_status_check" CHECK ("status" IN ('DRAFT', 'VALIDATED', 'PAID', 'CANCELLED')),
 CONSTRAINT "hv_weekly_line_role_check" CHECK ("beneficiary_role" IN ('DIRECT', 'SUB_PARTNER', 'MASTER_PARTNER'))
);
CREATE UNIQUE INDEX "hv_weekly_commission_lines_source_order_id_beneficiary_affiliate_id_key"
 ON "hv_weekly_commission_lines"("source_order_id", "beneficiary_affiliate_id");
CREATE INDEX "hv_weekly_commission_lines_batch_id_status_idx" ON "hv_weekly_commission_lines"("batch_id", "status");
CREATE INDEX "hv_weekly_commission_lines_beneficiary_affiliate_id_status_idx" ON "hv_weekly_commission_lines"("beneficiary_affiliate_id", "status");
CREATE INDEX "hv_weekly_commission_lines_source_order_id_idx" ON "hv_weekly_commission_lines"("source_order_id");
