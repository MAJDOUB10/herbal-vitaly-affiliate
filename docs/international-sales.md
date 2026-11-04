# Herbal Vitaly — International Sales (staging implementation)

## Scope
Admin-only workspace at /admin/international, separate from domestic Shopify / Refferq affiliate commissions:
- B2B distributors and their legal/contact records
- Contract register and external signed-document URLs, expiry tracking
- USD product catalogue, automatic quotation math, unique quote reference and browser Print / Save as PDF
- Accepted quotation → one immutable-order snapshot, order fulfillment status
- Manual receipts with unique bank evidence references; accrual only when order is fully collected
- Per-client, per-beneficiary fixed USD-per-unit commission rules
- Pending → Approved → Paid, with evidence reference; no automatic transfer
- Append-only international audit records

## Data and safety
- All new tables use the intl_ prefix and do not share/modify affiliate payouts, COD reconciliation, or EGP ledgers.
- Only active ADMIN users pass /api/admin/international, verified via src/proxy.ts signed-session headers and database recheck.
- Feature is **disabled by default**. INTERNATIONAL_SALES_ENABLED=true is required to enable it.
- Current Vercel Preview branch is scoped to the Neon **affiliate_staging / main** branch. Production env is unchanged.
- Schema SQL: prisma/migrations/20261104_international_sales/migration.sql. Apply manually to the correct approved database first.
- IMPORTANT: These raw-SQL tables are not yet represented in Prisma schema.prisma. Do NOT run prisma db push against a database holding them until a reviewed Prisma model mapping exists; db push may attempt unexpected schema changes.
- Staging only: products 3.68, 2.96, 3.03, 3.53 USD; Gulf Generic reference account and 36-month draft contract; Mahmoud Alam rule USD 0.40/unit. No financial transactions seeded.

## Commercial safeguards
- A quote is a price offer, not an invoice or payment confirmation. Print / Save as PDF from the quotation register.
- Quotes require explicit SENT and ACCEPTED status transitions before conversion to an order.
- An order can be created only once per accepted quote.
- Payments are manually recorded against the same order, not inferred from shipment delivery.
- Fixed per-unit commissions are accrued ONCE when the full value is recorded as paid; they are never automatically approved or transferred.
- Returned orders void unpaid commissions. A return with already paid commissions is blocked pending manual clawback reconciliation.
- Initial version handles whole-order returns; partial returns, credit notes, independent bank reconciliation and multi-currency accounting are future milestones.
- A contract can be marked ACTIVE only with a document URL, but users must independently verify that it is fully signed, legally effective and registrable under the relevant country's laws.
- The Gulf Generic license previously supplied showed 2026-01-05 expiry; renewed documents and signatory authority must be obtained before treating it as signed.
- Incoterms should be agreed with an exact named place (e.g. FCA [named factory delivery point], Incoterms 2020). This module does not invent a manufacturer's identity.

## Suggested acceptance test (staging only)
1. Sign into a Preview URL as an ACTIVE ADMIN.
2. Open /admin/international. Confirm Gulf Generic and Mahmoud Alam 0.40 rule are visible.
3. Generate a sample quotation with 2,000 USHABTI units: 2,000 × $3.68 = $7,360.
4. Print the quote to PDF. Check reference, customer address, product, price, quantity and footer.
5. Mark SENT → ACCEPTED. Convert once to an order, and verify a second conversion is rejected.
6. Record payment with unique bank evidence, verify commission does not accrue until fully paid.
7. When fully paid, verify 2,000 × $0.40 = $800 PENDING commission.
8. Approve, then mark Paid only with a non-empty transfer reference.
9. Confirm domestic affiliate/Shopify dashboards remain unchanged.

## Not yet enabled in production
Approval required: review new code and migration, reconcile table ownership with Prisma schema,
validate eligibility and returns with finance/legal, test protected Vercel Preview and ensure Vercel
Production has correct DB migration before enabling the feature flag. Do not merge to main on the basis of schema creation alone.
