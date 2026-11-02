-- Verified as an additive one-time DDL script on Neon staging and the
-- branch named production-herbal-vitaly-20261031 on 2026-11-02.
-- IMPORTANT: This is intentionally NOT a Prisma migrate-deploy migration:
-- live Neon database currently has no public._prisma_migrations history.
-- Future Prisma Migrate must be baselined before automatic deploy.
-- Running this script again WILL FAIL intentionally; inspect schema first.
-- No data rows, account codes, taxes or balances were inserted.
-- Additive Herbal Vitaly Native Accounting foundation (EGP).
-- Reviewed against prisma/schema.prisma from main.
-- Does not touch Shopify, Bosta, Affiliate, existing invoices or commissions.
-- No seeds, no opening balances, no journal postings, no data deletion.
--
-- Before applying to production: verify correct Vercel DATABASE_URL -> Neon branch,
-- confirm restore-capable backup, migrations history and accountant acceptance.
CREATE TABLE "hv_gl_accounts" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "accountType" VARCHAR(32) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hv_gl_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hv_gl_accounts_code_key" ON "hv_gl_accounts"("code");
CREATE TABLE "hv_gl_journals" (
  "id" TEXT NOT NULL,
  "documentNo" VARCHAR(80) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'EGP',
  "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  "sourceType" VARCHAR(80),
  "sourceId" VARCHAR(160),
  "createdByUserId" VARCHAR(80) NOT NULL,
  "postedByUserId" VARCHAR(80),
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hv_gl_journals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hv_gl_journals_documentNo_key" ON "hv_gl_journals"("documentNo");
CREATE UNIQUE INDEX "hv_gl_journals_idempotencyKey_key" ON "hv_gl_journals"("idempotencyKey");
CREATE INDEX "hv_gl_journals_effectiveDate_status_idx" ON "hv_gl_journals"("effectiveDate", "status");
CREATE INDEX "hv_gl_journals_sourceType_sourceId_idx" ON "hv_gl_journals"("sourceType", "sourceId");
CREATE TABLE "hv_gl_lines" (
  "id" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "debitPiasters" BIGINT NOT NULL DEFAULT 0,
  "creditPiasters" BIGINT NOT NULL DEFAULT 0,
  "memo" VARCHAR(500),
  CONSTRAINT "hv_gl_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hv_gl_lines_journalId_lineNumber_key" ON "hv_gl_lines"("journalId", "lineNumber");
CREATE INDEX "hv_gl_lines_accountId_idx" ON "hv_gl_lines"("accountId");
ALTER TABLE "hv_gl_lines" ADD CONSTRAINT "hv_gl_lines_journalId_fkey"
  FOREIGN KEY ("journalId") REFERENCES "hv_gl_journals"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hv_gl_lines" ADD CONSTRAINT "hv_gl_lines_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "hv_gl_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "hv_gl_periods" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "closedAt" TIMESTAMP(3),
  "closedBy" VARCHAR(80),
  CONSTRAINT "hv_gl_periods_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hv_gl_periods_year_month_key" ON "hv_gl_periods"("year", "month");
