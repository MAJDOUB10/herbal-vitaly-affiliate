# Herbal Vitaly Affiliate Hub — Shopify Orders Module (link + promo)

## New dashboard routes
- `/admin/orders` — Shopify order list, EGP values, partner filter, source filter, code/order search, pagination and reconciliation status. Admin session only.
- `/affiliate/orders` — same read-only reporting, restricted by the signed session's immutable affiliate ID; customer personal data is not returned.
- `/admin/coupons` — partner selector for imported Shopify coupons only, requiring active email-verified partners. Saves ONLY the Refferq coupon-affiliate association and audit entry; does not mutate the Shopify discount.

## Attribution policy
1. **AFFILIATE_LINK** — Shopify cart has a server-signed referral token whose owner is a verified, active Refferq affiliate.
2. **PROMO_CODE** — Shopify order webhook confirms use of a coupon code that is mapped in Refferq to an active, verified affiliate.
3. **LINK_AND_PROMO** — both signals belong to the same affiliate; count as **one** order.
4. **CONFLICT** — link and Shopify promo refer to different affiliates, or multiple applied promo codes map to multiple different affiliates. No automatic assignment.
5. **UNATTRIBUTED/UNVERIFIED** — no trustworthy evidence, including all pre-migration orders. Not visible as attributed sales to a partner.

The order stores immutable affiliate ID, referral code, attribution source, discount code and attribution key. Existing credited orders keep their original owner on later Shopify updates; competing valid evidence flags a conflict instead of silently changing attribution.

## Database
- Migration `prisma/migrations/20261030151500_hv_order_attribution/migration.sql` adds 4 nullable/additive metadata columns and two indexes.
- Executed and verified on **Neon herbal-vitaly-affiliate-staging / affiliate_staging** on 30 October 2026.
- Existing orders default to `UNVERIFIED`, with no retrospective attribution. No commission balances or payouts touched.
- Production has not been migrated or published. Do not run Prisma `db push --force-reset`.

## Shopify
- Affiliate storefront link lands on `https://herbalvitaly.com/` and carries a signed token.
- The snippet `snippets/hv-affiliate-tracking.liquid` exists only in the **unpublished** Shopify theme copy ID `195153690946`.
- Before live orders can be tracked by link, add and validate this snippet on the active Shopify theme; ensure consent requirements and mobile/cart/checkout behavior are tested.
- Verified Shopify webhook endpoint: `/api/integrations/shopify/orders` (Preview-only; HMAC + shop domain).
- Webhook topics: `orders/create`, `orders/updated`, `orders/cancelled`.
- **Blocking configuration:** `SHOPIFY_WEBHOOK_SECRET` and `SHOPIFY_SHOP_DOMAIN` are scoped to the older staging branch on Vercel. Do not copy sensitive secrets into logs, or expose them to every Preview branch. Add them securely to the tested deployment branch or integrate this code into the properly configured staging branch before registering webhooks.
- Coupon assignments are read from Refferq `coupons`; must have `source=SHOPIFY` and an approved affiliate for UI assignment. An authenticated Shopify webhook proves the promo was applied in the actual order.

## QA
- Signed token + linked order -> correct affiliate
- Mapped Shopify promo with no referral link -> correct affiliate
- Both valid signals same owner -> one order, source LINK_AND_PROMO
- Different owners / two mapped codes -> CONFLICT, never assign
- Unmapped promo -> UNATTRIBUTED
- Cancellations, refunds and COD/Bosta checks never create or pay commissions
- Admin can list/filter all records; partner cannot access others' orders
- Coupon reassignment does not change historical order owners
- Responsive pages and EGP formatting
- Tests in `tests/hv-orders-attribution.test.mjs` included in Vercel build
- Confirm Vercel latest build READY, and test one fictitious Shopify order end-to-end after installing and subscribing the webhooks

## Security / release
The feature is developed in `feat/hv-orders-affiliate-link-coupons-20261030` and must not overwrite the existing public `partner.herbalvitaly.com` alias before preview QA and Shopify webhook credentials are ready. No theme publication, no automatic finance write.
