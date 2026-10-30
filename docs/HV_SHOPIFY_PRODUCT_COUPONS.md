# Herbal Vitaly Affiliate Hub — Shopify product coupons

## Implemented
- Admin `/admin/coupons`: approved-partner selector, multi-product Shopify catalog picker, discount percent or EGP, optional generated code, max uses, expiry, success/error messaging.
- Creating a coupon means creating an actual Shopify `discountCodeBasicCreate` via Admin GraphQL. Product restrictions use `customerGets.items.products.productsToAdd`.
- Shopify returns its discount ID, status and summary; the Refferq coupon becomes `source=SHOPIFY` and `isActive=true` **only if** Shopify reports `ACTIVE`.
- A local inactive `REFFERQ_PENDING` reservation protects against parallel code duplicates. Failures are visible and do not claim the code is live.
- Affiliate `/affiliate/coupons`: approved partners see their own active codes and individual product links. These go via `/r/REFCODE?dest=<product>&promo=<code>`, record a signed referral, then use Shopify `/discount/CODE?redirect=<encoded product URL + signed tracking>` to apply a discount.
- Product IDs and handles stored on the coupon for server-side eligibility checks, with no cross-affiliate sharing.
- Existing Shopify-managed discounts cannot be edited or deleted locally: Shopify is the source of truth. Codes not synced from Shopify stay labelled legacy.
- No automatic approval or payout is created.

## Security and rollout gate (important)
1. App requires `SHOPIFY_ADMIN_ACCESS_TOKEN` (Shopify custom app, `read_products`, `read_discounts`, `write_discounts`) and `SHOPIFY_SHOP_DOMAIN=kk20pd-es.myshopify.com` configured as **server-only Vercel environment variables for the reviewed Preview branch**.
2. **The necessary Admin API token is not yet present** in the Vercel project. Without it the product picker shows an explicit setup error and the server refuses discount writes. Never paste tokens into chat or GitHub.
3. Coupon POST is intentionally locked to `VERCEL_ENV=preview` until all checks are completed; it cannot silently create discounts from unreviewed Production.
4. This Shopify account is a live Egypt storefront: creating a coupon with active `startsAt` affects real checkout prices. Use an internal QA code with a strict usage limit and verified product, then revoke after testing.
5. The theme snippet for referral tracking remains on the **unpublished** Shopify theme copy, so live orders may not capture the attribution token until published after consent + checkout QA.
6. Sync job can overwrite Shopify status and metadata; verify sync preserves `affiliateId`, `shopifyProductIds`, `shopifyProductHandles` when handling an already linked code.
7. No production alias change was made by this PR. Merge and release only after verified Shopify API access, storefront checkout test and COD order attribution.
8. Securely verify the Admin API token permissions; do not store in NEXT_PUBLIC variables or browser/localStorage.

## Database
The STAGING database `affiliate_staging` received two additive array columns:
- `shopify_product_ids TEXT[] NOT NULL DEFAULT '{}'`
- `shopify_product_handles TEXT[] NOT NULL DEFAULT '{}'`

All old coupons remain unchanged; no mass reactivation or recalculation occurred.

## QA
- Browse active products; choose TIYNEFRET and test a 1-use code with explicit admin review.
- Confirm discount status ACTIVE in Shopify, product restriction, currency EGP, no combinations unless explicitly permitted.
- Verify a non-selected product does not receive the discount.
- Verify one product link in `/affiliate/coupons` sends customer to correct product after Shopify applies promo.
- Confirm `hv_ref`, `hv_attr`, `hv_token` survive the Shopify redirect.
- Reject a different partner trying to reuse another partner's code via `promo`.
- Do not create referral commissions until order webhook signature, coupon association, COD/Bosta delivery/collection/financial validation succeed.
- Test expired code, duplicate code, inactive affiliate, wrong product, missing Shopify credential.
- Validate mobile UI and translations as separate improvements.
