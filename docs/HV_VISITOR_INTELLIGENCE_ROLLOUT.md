# Herbal Vitaly — Partner Visitor Intelligence (staged)

## Implemented in this branch

- `/affiliate/analytics`: **My Traffic**, resolved exclusively from signed affiliate session.
- `/affiliate/team/traffic`: Master Partner's own traffic and directly authorized children.
- `/admin/visitor-intelligence`: global attributed affiliate traffic and filter by partner.
- Read-only traffic APIs using existing `referral_clicks` and verified `hv_cod_orders`.
- Additive `hv_visitor_events` table for consent-gated anonymous storefront events.
- Signed affiliate click verification for cross-site event intake.
- Clicks, anonymized sessions, product views, cart activity, limited engagement, and verified orders shown as **different data sources**.
- Mobile responsive dashboards, bounded trends and explicit tracking limitations.

## Critical rollout gates

1. **Do not apply this migration blindly to the production Neon database.** Verify a backup and apply the committed Prisma migration to staging, then production after QA:
   `prisma/migrations/20261118133000_hv_visitor_events/migration.sql`.
2. Run `npx prisma generate`, `npm run verify`, TypeScript check and Vercel Preview build with the migrated staging database.
3. The Shopify snippet `shopify/snippets/hv-affiliate-tracking.liquid` now contains the visitor-intelligence extension. Install the **full** snippet exactly once in a reviewed unpublished Shopify theme with `{% render 'hv-affiliate-tracking' %}` immediately before closing body. Do not publish a live theme or duplicate existing attribution installation without consent and checkout testing.
4. Confirm that Shopify Customer Privacy analytics consent is present and **explicitly allowed** before the extension records any event. Consent refusal should produce no events and no session identifiers.
5. Verify that signed `hv_token` from the `/r/CODE` redirect is present, the click is recorded in the referral table and POST to `/api/analytics/events` succeeds from the storefront origin.
6. Check that session IDs are random per browser tab and are not shopper identity. No raw URL query, form input or direct contact details are persisted in visitor events.
7. Validate partner A cannot view partner B; Master Partners see only direct children; Admin can filter verified partners. Run test suite and API/permission checks.
8. Test clicks, Shopify orders, cancellation/return and COD reconcilation against their existing authoritative sources.
9. No approved commissions or financial balances are modified by these analytics APIs.

## What is not claimed complete

- No Microsoft Clarity Project ID is configured here, and no Clarity replay or heatmap data is connected. This must be done separately using the official privacy-consented integration.
- Shopify checkout pages are isolated from theme scripts. `CHECKOUT_STARTED` is accepted by the API but requires a separately reviewed Shopify Customer Events custom pixel or supported integration; there is no claim of complete checkout event coverage.
- Product page events require installing the extension in a reviewed Shopify theme. Merely merging the GitHub branch does not install it.
- The dashboard measures **affiliate-attributed** activity, not all website traffic. The unique-visitor metric is deliberately not claimed because anonymous unique people cannot be reliably counted without additional permitted identification.
- Funnel steps use different data sources and are **not** a deduplicated, full end-to-end customer cohort. Checkout abandonment rates cannot be accurately computed until supported checkout events and compatible session joins exist.
- No automatic continuous session recording, invasive tracking or raw per-visitor replay is enabled.

## Security and operational policy

- No unauthenticated dashboard reads. Proxy injects trusted user identity from signed HttpOnly session.
- Event ingestion checks exact Shopify origins and verifies an HMAC-signed affiliate token plus matching recorded click.
- Event IDs are idempotent, rate limits are per hashed attribution key, and only a restricted event vocabulary is accepted.
- The intake does not accept affiliate IDs, order values, commissions, raw browser event payloads or checkout customer fields.
- Anonymous analytics should have a documented retention/deletion process before production. Existing legacy referral-click IP storage is outside this migration and should be audited separately.
- Keep the feature preview-only until signed-off. Never run destructive Prisma reset operations.
