# Herbal Vitaly Native Accounting — Production Release Plan

**Decision:** A native accounting module inside `partner.herbalvitaly.com` using Next.js 16,
Prisma/PostgreSQL (Neon), Vercel, and EGP. **No Bigcapital or Railway required.**

**Current branch scope:** Additive schema for GL accounts/journals/lines/periods,
balanced-journal validation, admin read-only general ledger and Preview-only
draft/post endpoints with two-person approval. This is **NOT** a complete
accounting, tax, billing or reporting product.

## 0. Critical production facts

- Existing production Finance dashboard is an **operational** Shopify/Bosta/
  Affiliate reporting view. Imported order totals are not recognized revenue.
- No full GL, tax or net-profit information can legitimately be calculated
  from the existing Refferq COD table alone.
- Some old affiliate invoice/coupon/program records still default to INR;
  do not silently convert records. Do not reuse affiliate payout invoices
  as company customer invoices.
- Preserve existing COD/commission approval guards.
- The production journal **posting API is unconditionally disabled** in this
  branch (`VERCEL_ENV !== 'preview'`). Enabling production posting needs a
  separate reviewed release with full approvals and tests.
- Database updates are **not** done merely by a successful Vercel deployment.
  The new `hv_gl_*` schema requires a reviewed, dedicated migration and DB
  backup/restore plan before enabling the read flag.

## 1. Deploy model

```text
Shopify ----> operational sync ----> Neon (Refferq orders)
Bosta ------> operational sync ----> Neon (COD and collections)
Affiliate --> operational sync ----> Neon (commission lifecycle)
                                     |
                            approved document mapping
                                     |
                                     v
                 Neon (dedicated hv_gl_* native accounting tables)
                                     |
                           Vercel Next.js API routes
                                     |
                         /admin/finance/journals
```

Vercel runs stateless API handlers. Neon stores durable accounting tables.
No ERP server, Docker image or MariaDB is required. All accounting writes
are transactional, authorization-checked, auditable, idempotent and
two-person controlled in Preview.

## 2. Isolated staging (mandatory)

- Provision a **separate Neon branch or database** for Preview with its own
  `DATABASE_URL`. Do not point Preview at the live Production Neon DB when
  enabling test financial writes.
- Store secrets in Vercel Settings -> Environment Variables. Never commit or
  paste secret values to GitHub.
- Review the Prisma schema diff and **generate a versioned SQL migration**,
  inspect its DDL and apply using `prisma migrate deploy` only against the
  isolated staging DB. Do not use `prisma db push` on Production.
- Define approved EGP chart of accounts (ASSET, LIABILITY, EQUITY, REVENUE,
  EXPENSE), and insert finance periods for the required fiscal year.
- Take and verify a restore point before any eventual Production migration.

**Preview-only flags** (default to unset/false):

```dotenv
HV_NATIVE_ACCOUNTING_SCHEMA_READY=true
HV_NATIVE_ACCOUNTING_STAGING_DATABASE_VERIFIED=true
HV_NATIVE_ACCOUNTING_DRAFTS_ENABLED=true
HV_NATIVE_ACCOUNTING_POSTING_ENABLED=true
```

The `STAGING_DATABASE_VERIFIED` flag is an operator sign-off, not automated
proof of isolation. Set it ONLY after independent verification that Preview
and Production use separate Neon databases. All flags must remain **unset**
in Production until a separate release is approved. Even if set in Production,
the current draft/post handlers refuse writes.

## 3. Staging tests

- `npm ci`, `npx prisma validate`, `npm run verify`,
  `npx tsc --noEmit`, `npm run build`.
- Authorize `/admin/finance` and `/admin/finance/journals` for active
  ADMIN only. AFFILIATE role must receive 403/redirect.
- Create a **draft** with `POST /api/admin/finance/journals`:
  `{ "idempotencyKey":"test-...","effectiveDate":"2026-11-02","description":"Test journal","lines":[{"accountCode":"1101","debitPiasters":10000,"creditPiasters":0},{"accountCode":"4101","debitPiasters":0,"creditPiasters":10000}] }`.
  (The accounts and period must already exist in the staging GL.)
- Confirm an unbalanced, fractional or duplicate journal is rejected.
- As a **different** active admin, post it via
  `POST /api/admin/finance/journals/<id>/post`.
- Confirm the same user cannot create and post the entry, the posting
  cannot occur twice, and a closed month is blocked. No deletion/edit route
  exists for posted journals; corrections must use future reversal entries.
- Confirm posting does not authorize an Affiliate payout, change COD
  settlement, create a Shopify order, file tax, or transfer bank money.
- Confirm backups, disaster recovery and access logs meet finance requirements.

## 4. Remaining functionality required for company-wide go-live

This first ledger phase does NOT deliver production sales, purchases or tax
accounting. Complete and validate before enabling real financial posting:

1. **Master data**: companies, customers, suppliers, product/SKU and
   cost center masters; controlled effective-dated EGP chart of accounts.
2. **Receivables**: Shopify sales invoices and credit notes with discounts,
   shipping, tax category, refund logic, due dates, idempotency and audit.
3. **Payables**: supplier master, purchase orders, supplier invoices, expense
   allocation, payment due/settlement, purchase VAT and withholding.
4. **Inventory & COGS**: controlled inventory receipts, movement valuation,
   unit cost and stock reconciliation by SKU/batch/expiry where needed.
5. **Payments**: bank and Paymob feeds, Bosta COD collection clearing,
   remittance net of fees, cash handling and reconciled payment evidence.
6. **Affiliate**: commission accrual only after validated COD/approved
   eligibility; payout execution and clawbacks tracked separately.
7. **Tax compliance**: Egyptian accountant-approved tax matrix for supplements,
   ETA e-Invoice/e-Receipt depending on obligation, document signatures,
   fiscal calendar, submissions and audit.
8. **Statements**: GL trial balance, balance sheet, P&L, taxes payable,
   aged AR/AP, cash-flow statement and category/product profitability from
   posted balanced journals ONLY.
9. **Controls**: two-person approvals, immutable posted documents with reversal,
   closed-period locking, permissions, audit logs, exports, encryption,
   monitoring, backups/restore and reconciliation tests.

Accounting policy, sales recognition, VAT category, corporate tax and e-document
obligations must be approved by a qualified Egyptian accountant before
Production posting. This module does not itself prove regulatory compliance.

## 5. Release sequence for actual Production

1. Review the new PR on GitHub against the **current** `main` and require
   green GitHub and Vercel Preview checks.
2. Run the isolated staging migration and full API/browser tests.
3. Obtain the accountant's sign-off on trial balance, opening balances,
   document numbering, access controls and tax mapping.
4. Backup Production Neon with verified restore; prepare additive versioned
   Prisma migration, and conduct a dry run against a restored copy.
5. Apply an approved migration through a controlled release process.
6. Merge the reviewed PR to `main` only when the business is ready for the
   release. Vercel Git integration will auto-deploy main to Production if set.
7. Confirm `/admin/finance/journals` reads correctly and third-party sales
   operations are unchanged. Keep accounting writes **off** by default.
8. Implement and approve a separate posting-enabled Production PR once *all*
   accounting and fiscal acceptance tests above pass.
9. Monitor deployment errors and financial reconciliation exceptions;
   retain tested rollback plans for code **and** database.

**Never** describe the current read-only dashboard or the current staging
GL proof of concept as a completed official accounting system.
