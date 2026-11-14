# Herbal Vitaly — Weekly Commission Reports (preview-only finance workflow)

## Scope and locations
- Admin: `/admin/weekly-commissions`
- Affiliate / Master / sub-partner: `/affiliate/weekly-commissions` (read-only, strictly own beneficiary id)
- Cron (no login, authenticated by `Authorization: Bearer $CRON_SECRET`): `GET /api/cron/weekly-commissions`

## Schedule and accounting basis
- Vercel schedule: **every Monday 06:00 UTC** (`0 6 * * 1`).
- Weeks use Monday 00:00 UTC inclusive through next Monday 00:00 UTC exclusive.
- Cron generates a report for the most recently closed week; admin may re-run **any** closed UTC week to pick up late COD reconciliation.
- Year/week selected by authenticated admin; no current or future partial weeks.
- Candidate date is `merchantSettledAt`, **not** order-created date.
- Only confirmed Egypt EGP COD orders with `delivered=true`, `courierCollected=true`, `merchantReconciled=true`, `collectedPiasters >= orderTotalPiasters`, verified attribution, positive commission preview, settlement reference, and no cancellation/refund.
- Inconsistent or incomplete evidence is excluded.
- Direct affiliates: receive full existing commission pool from the validated source order.
- Sub-partner + Master: split the **same** commission pool by the child team's configured `teamShareBps`. Example: 1,000 EGP purchase pool 200 EGP, child share 20% of pool (40 EGP), Master 160 EGP.
- Report amounts in **integer EGP piastres** with immutable original allocation and editable smaller amount; never allow upward adjustments beyond original.
- Existing TeamCommissionSplit source orders are excluded to minimize cross-ledger overlap.
- Same source order + beneficiary is uniquely constrained in PostgreSQL, preventing double reporting from repeated cron/admin runs.

## Administrative states
- `DRAFT` → `VALIDATED` after checking live order status, attribution and immutable pool.
- `DRAFT` → `DRAFT` via EDIT (requires reason, positive amount <= original).
- `DRAFT` or `VALIDATED` → `CANCELLED` (reason required).
- `VALIDATED` → `PAID` requires external payment evidence AND authenticated COD finance write gate. **CURRENTLY LOCKED**, since `isCodFinanceWriteEnabled()` is deliberately hardcoded false.
- `PAID` is immutable. Paid corrections require future explicit reversal workflows, not deleting records.
- Every admin generation and edit/validation/cancellation operation is written to AuditLog.
- **VALIDATED** is internal review, not a payout authorization; it must not appear as real bank confirmation.
- No API in this module writes `Commission`, `Payout`, `Affiliate.balanceCents`, `TeamCommissionSplit`, or the financial general ledger.
- This module does not send money, email partners automatically, or substitute for an approved COD settlement system.

## Deployment prerequisites
1. Review all 2026-11-14 migration SQL and Prisma fields against a **separate non-production Neon database**.
2. Apply migration on that preview database, run `npx prisma generate`, `npm run verify`, and `npm run build`. Verify the two new tables exist and unique indexes work.
3. Manually simulate duplicate generation of the same closed week; verify 0 duplicate inserts.
4. Test a verified Shopify+Bosta COD order with real settlement reference and collected amount, and a return/refund exclusion.
5. Test an ACTIVE ADMIN vs unauthorized affiliate for all admin endpoints and restricted affiliate read access.
6. Set `CRON_SECRET` (random secret with 24+ characters) in Vercel through protected settings, never in source code.
7. Test cron authentication and idempotence in the isolated environment.
8. Confirm existing finance/payment locks remain active and external evidence is still required.
9. Only after migration/security verification, merge and deploy the feature; never run a production DB migration solely because a preview build passes.

## Planned extensions
- Pagination/filter search across all weeks via server-side query.
- Ledger-backed bank transfer reconciliation + independent payment proof verification.
- Automated email/PDF statements per partner and Master.
- Two-person approval and reversal/dispute workflow for paid items.
- Automatic reserve/hold period and notifications for refunds.
