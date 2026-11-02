-- Herbal Vitaly: company supplier/customer and source document draft tables.
-- Additive non-destructive schema for the native EGP finance module.
-- Reviewed against prisma/schema.prisma. Existing Neon DB has no Prisma migration
-- baseline, therefore this is a documented one-time script, not an automatically
-- replayed Prisma migration. Apply only after verifying current branch and backup.
-- All source documents are NON-ISSUED DRAFT records; no tax postings.
CREATE TABLE "hv_finance_parties" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "kind" VARCHAR(24) NOT NULL,
  "taxId" VARCHAR(50),
  "email" VARCHAR(200),
  "phone" VARCHAR(80),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hv_finance_parties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hv_finance_parties_kind_check" CHECK ("kind" IN ('SUPPLIER','CUSTOMER','BOTH'))
);
CREATE INDEX "hv_finance_parties_kind_isActive_idx" ON "hv_finance_parties"("kind","isActive");

CREATE TABLE "hv_finance_documents" (
  "id" TEXT NOT NULL,
  "number" VARCHAR(80) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  "description" VARCHAR(500) NOT NULL,
  "counterpartyId" TEXT,
  "documentDate" DATE NOT NULL,
  "dueDate" DATE,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'EGP',
  "subtotalPiasters" BIGINT NOT NULL,
  "taxPiasters" BIGINT NOT NULL DEFAULT 0,
  "totalPiasters" BIGINT NOT NULL,
  "externalRef" VARCHAR(160),
  "source" VARCHAR(60) NOT NULL DEFAULT 'MANUAL_DRAFT',
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hv_finance_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hv_finance_documents_kind_check" CHECK ("kind" IN ('SUPPLIER_BILL','CUSTOMER_INVOICE','EXPENSE','CREDIT_NOTE')),
  CONSTRAINT "hv_finance_documents_status_check" CHECK ("status" = 'DRAFT'),
  CONSTRAINT "hv_finance_documents_currency_check" CHECK ("currency" = 'EGP'),
  CONSTRAINT "hv_finance_documents_amounts_check" CHECK ("subtotalPiasters" >= 0 AND "taxPiasters" >= 0 AND "totalPiasters" > 0 AND "totalPiasters" = "subtotalPiasters"+"taxPiasters")
);
CREATE UNIQUE INDEX "hv_finance_documents_number_key" ON "hv_finance_documents"("number");
CREATE UNIQUE INDEX "hv_finance_documents_idempotencyKey_key" ON "hv_finance_documents"("idempotencyKey");
CREATE INDEX "hv_finance_documents_kind_documentDate_idx" ON "hv_finance_documents"("kind","documentDate");
CREATE INDEX "hv_finance_documents_counterpartyId_status_idx" ON "hv_finance_documents"("counterpartyId","status");
ALTER TABLE "hv_finance_documents" ADD CONSTRAINT "hv_finance_documents_counterpartyId_fkey"
  FOREIGN KEY ("counterpartyId") REFERENCES "hv_finance_parties"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "hv_finance_document_lines" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "description" VARCHAR(350) NOT NULL,
  "sku" VARCHAR(120),
  "netPiasters" BIGINT NOT NULL,
  "taxPiasters" BIGINT NOT NULL DEFAULT 0,
  "taxCode" VARCHAR(40),
  CONSTRAINT "hv_finance_document_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hv_finance_document_lines_amounts_check" CHECK ("netPiasters" >= 0 AND "taxPiasters" >= 0 AND ("netPiasters" + "taxPiasters") > 0)
);
CREATE UNIQUE INDEX "hv_finance_document_lines_documentId_lineNumber_key" ON "hv_finance_document_lines"("documentId","lineNumber");
ALTER TABLE "hv_finance_document_lines" ADD CONSTRAINT "hv_finance_document_lines_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "hv_finance_documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
