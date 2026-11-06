# Vondera → Herbal Vitaly Partner integration (Preview-first)

**Status:** Draft implementation, not live. No orders, commissions, payouts, or Shopify records are modified.

## Verified topology
- Vondera merchant store: Herbalvitaly, storefront \`https://shop.herbalvitaly.com\`
- Partner portal: \`https://partner.herbalvitaly.com\` on Vercel/Next.js
- PostgreSQL: Neon with an isolated Staging branch
- Vondera exposes webhook triggers: \`orders.created\`, \`orders.updated\`, \`orders.deleted\`, \`products.created\`, \`products.updated\`, \`products.deleted\`, \`customers.*\`, \`inventory.updated\`, and others.
- Storefront API docs: https://www.vondera.app/developers
- Vondera webhook signing / retry payload specification has **not** been verified. Do not assume HMAC header support.

## Deployment gates
1. Apply \`db/migrations/20261106_vondera_readonly.sql\` ONLY on an isolated Neon testing branch, never production during initial testing.
2. Set the following on Vercel **Preview** scope only, without exposing any value in a pull request:
   - \`VONDERA_SYNC_ENABLED=true\`
   - \`VONDERA_STORE_ID=<actual connected Vondera store id>\`
   - \`VONDERA_WEBHOOK_TOKEN=<cryptographically random 32+-character token>\`
   - \`DATABASE_URL=<isolated Neon testing branch URL>\`
3. A Vondera webhook subscribes to one event. Example endpoint (do not use until the Preview is reachable to Vondera): \`https://<deployment>/api/integrations/vondera/webhook?event=orders.created&token=<secret>\`
4. Vondera webhook settings currently accept endpoint URL and method, but not authenticated headers. Token-in-URL is a **fallback**, with leakage risk in logs and dashboards. Review with Vondera support whether signed deliveries or custom headers are supported; upgrade to HMAC/mTLS/reverse proxy whenever available.
5. Configure webhooks as **INACTIVE** first; activate only after endpoint reachability and payload shape are verified (Vercel Preview SSO may prevent external webhooks).
6. Test created/updated/deleted orders and products, retries, wrong token, oversized payload, no PII exposure, out-of-order messages, and duplicate deliveries.
7. Add a backfill process from a documented **merchant** API. The storefront API does not provide an authenticated merchant-wide list of all orders; do not build backfill from public checkout APIs.
8. Once validated, schedule a reviewed Neon Production migration and release; then create **ACTIVE** webhooks for the production endpoint. Rotate token, monitor errors and replays.

## Data semantics
- \`hv_vondera_webhook_events\`: deduplicated, PII-reduced inbox.
- \`hv_vondera_orders\`: order snapshot in **EGP piasters**, coupon/referral codes retained for attribution review.
- \`hv_vondera_products\`: product summaries.
- Customer events and inventory are accepted into the sanitized event inbox but are **not projected into CRM records yet**. Additional privacy and source mapping decisions are needed.
- No affiliate conversion or commission is automatically posted. Affiliate attribution is not verified until coupon/code mappings, COD delivery, returns, and merchant collection are reconciled.
- Vondera and Shopify orders remain isolated. Never merge solely by customer name or phone; where a real-world order exists in both systems, establish an explicit cross-platform mapping first.
- Implement a 30-day inbox retention policy and an admin-only audit dashboard before production release.
