# Herbal Vitaly — Shopify affiliate orders tracking (STAGING)

## Customer journey
1. Approved partner shares `https://partner.herbalvitaly.com/r/TESTOR-915C`.
2. Refferq records a click and redirects to `https://herbalvitaly.com/?hv_ref=TESTOR-915C&hv_attr=...&hv_token=...`.
3. `hv_token` is signed server-side; code and click reference cannot be changed without invalidating its HMAC. It is **not** a discount code or a permission to pay commissions.
4. Shopify theme snippet persists that token in **Shopify cart attributes** (and in first-party localStorage for up to 30 days, subject to consent).
5. On Shopify order creation or update, a **verified Shopify webhook** sends `note_attributes` to Refferq. Refferq validates the Shopify HMAC *and* the signed token, checks that the partner is approved, and stores the order in the COD order ledger.
6. The affiliate can view their own orders through `/api/affiliate/shopify-orders` and the read-only `Shopify Orders` dashboard card.
7. Delivery, courier collection, merchant reconciliation and manual finance review remain prerequisites for commission. **No automated payout/approval.**

## Shopify theme installation (manual on an unpublished theme first)
A. Shopify Admin > Online Store > Themes > select an **unpublished theme copy** > Edit code.
B. Create `snippets/hv-affiliate-tracking.liquid`. Copy contents of:
   `shopify/snippets/hv-affiliate-tracking.liquid` from this repository.
C. Open `layout/theme.liquid` and insert once, immediately before `</body>`:
   `{% render 'hv-affiliate-tracking' %}`
D. Save and preview the draft theme. Do **not** publish without QA. Test the current locale root (Arabic, English, French), cart drawers, product pages and checkout flows.
E. On the preview, navigate to a signed test `/r/...` link and verify Shopify storefront URL parameters appear. Inspect `/cart.js` and confirm:
   `attributes.hv_affiliate_code`,
   `attributes.hv_attribution_key`,
   `attributes.hv_affiliate_token`.
F. Place a **test** order (not a real customer's payment) and inspect its Shopify order note attributes.
G. Only after QA, publish the theme change. Follow consent/privacy requirements applicable to the customer and geography.

## Webhook setup — staging first
- Scope: Shopify shop `kk20pd-es.myshopify.com`, verify it matches `SHOPIFY_SHOP_DOMAIN`.
- Destination for testing: the current Refferq Preview webhook endpoint `/api/integrations/shopify/orders`.
- Topics handled in the code: `orders/create`, `orders/updated`, `orders/cancelled`.
- Configure `SHOPIFY_WEBHOOK_SECRET` only as a server-side Vercel environment variable.
- The webhook code intentionally accepts events only in `VERCEL_ENV=preview` until explicit production security/finance release.
- Do not point the real Shopify live webhooks to a public endpoint without checking its signing secret, registration and failure monitoring.
- Never infer a payable commission from a click, the `ref` URL query, or an unverified order discount. The `HV_ATTRIBUTION_SECRET` may be configured separately; otherwise the existing server-only `JWT_SECRET` is used with an HMAC domain prefix.

## QA checklist
- Valid partner URL reaches `herbalvitaly.com` and captures a click.
- Invalid partner code does not issue a signed token.
- Malicious redirect destination is blocked; only `https://herbalvitaly.com` and `https://www.herbalvitaly.com` are allowed.
- Parameter tampering, stale token and modified cart attributes produce no signed attribution.
- Test order webhook delivers proper code and order reference, visible only to that approved affiliate.
- COD/Bosta/finance controls stay unchanged; refunds/cancellations never auto-pay.
- Storefront code does not change prices, product pages, discounts, checkout or customer data.
- On every language storefront the snippet executes exactly once and respects consent.
- Test tracking with and without cookie consent, with cart drawer and mobile checkout.
- Old fake `Click Visitor` rows no longer appear as leads.
- Check idempotency: duplicate Shopify webhook delivery does not duplicate an order.
- Preserve the prior live deployment ID for rollback.

## Operational warning
**This Pull Request alone does not install the snippet inside Shopify and does not subscribe Shopify webhooks.** Do not claim end-to-end purchase tracking is activated before those two external steps have passed a test order. `partner.herbalvitaly.com` remains mapped to the previous tested build until the new code is reviewed and deployed.
