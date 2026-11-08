# Herbal Vitaly — E-commerce Performance Center (first implementation)

Route: /admin/performance (ADMIN only). API: GET /api/admin/performance?days=7|30|90|365.

## Included in first implementation
- Existing Shopify COD table: tracked order count/value, delivered, cancelled, refunded, courier-collected but awaiting merchant reconciliation, and evidence-reconciled COD order totals.
- Separate Vondera imported-order count/value from existing raw table, reported by sync date. **Not merged or deduplicated with Shopify**.
- Recorded EGP affiliate commissions by pending/approved/paid state (not per-order profit attribution).
- Assumption-based, entirely local cost simulator with editable product, shipping, Meta Ads, other fees, and affiliate commission rate.
- Protected API uses signed-session headers added by src/proxy.ts AND checks active admin in database.
- No changes to existing payouts, COD state, order data, invoices or ledger.

## Financial integrity
- Order value is not a booked net sale.
- Courier collection / COD reconciliation are not bank balances.
- The simulator returns an illustrative balance, **never actual net profit**.
- Shopify data is filtered by source update timestamp, not order placement date.
- Suppresses period aggregates when over 2,000 imported Shopify orders are found.
- Recent orders are capped at 200 rows, with no personal contact data.
- Vondera rows are only imported snapshots; there is no cross-platform deduplication yet.
- This release does not create marketing costs, Bosta shipping fees, SKU-level COGS or an accounting P&L.

## Required follow-on integrations
1. Implement idempotent source-specific external order keys and order-line snapshots with explicit source identity.
2. Reconcile Shopify/Vondera duplicate orders only when stable identifiers prove equivalence.
3. Import Meta Ads spend by date/account/campaign with source timestamp, currency and FX evidence. Keep Meta-attributed conversions separate from merchant orders.
4. Import verified Bosta shipping/return fees and settlement references. Verify against bank remittances.
5. Configure effective-dated manufacturing/packaging COGS per SKU, including bundles and returns.
6. Assign affiliate commissions to individual qualified, non-refunded, merchant-reconciled orders without changing existing payout controls.
7. Add manual expenses, landed costs, payment fees, taxes, and bank reconciliation; only then compute fully qualified contribution margin and reconciled P&L.
8. Provide periodic exports and automated discrepancy/late-sync alerts.

## Release checks
- npm run verify (test uses Node.js strip-types)
- npm run build with the exact repository dependencies and non-production environment configuration.
- Check admin-only access, loading/error states, 7/30/90/365 filters and no data leakage.
- Test a sample reconciled order, failed return, and overlapping source identifiers.
- Keep production unchanged until approved preview and verified financial methodology.
