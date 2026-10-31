import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { verifyShopifyHmac, normalizeShopifyOrder } from '../src/lib/hv-cod-connector.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Shopify order HMAC uses raw body and client secret, rejecting tampering', () => {
 const secret = 'test-client-secret';
 const raw = JSON.stringify({ id:19093759721794, name:'2063', currency:'EGP' });
 const good = createHmac('sha256', secret).update(raw).digest('base64');
 assert.equal(verifyShopifyHmac(raw, good, secret), true);
 assert.equal(verifyShopifyHmac(raw+' ', good, secret), false);
 assert.equal(verifyShopifyHmac(raw, good, 'wrong-secret'), false);
});

test('Order #2063 snapshot can be normalized as unpaid COD without delivery approval', () => {
 const p = normalizeShopifyOrder({
   id: '19093759721794', name:'2063', currency:'EGP',
   current_subtotal_price:'722.50', current_total_price:'722.50',
   updated_at:'2026-10-31T02:26:28Z',
   payment_gateway_names:['Cash on Delivery (COD)'],
   discount_codes:[{ code:'T15' }],
   refunds:[], cancelled_at:null, financial_status:'pending',
 });
 assert.equal(p.isCod,true);
 assert.equal(p.orderTotalPiasters,72250);
 assert.equal(p.commissionPreviewPiasters,14450);
 assert.equal(p.refunded,false);
 assert.equal(p.cancelled,false);
});

test('Production order receiver validates HMAC, target shop, dedupe and never writes payouts', () => {
 const w = read('src/app/api/integrations/shopify/orders/route.ts');
 const ingest = read('src/lib/hv-order-ingest.ts');
 assert.match(w, /\['preview', 'production'\]/);
 assert.match(w, /SHOPIFY_CLIENT_SECRET/);
 assert.match(w, /verifyShopifyHmac\(raw, signature, secret\)/);
 assert.match(w, /sourceShop !== shopDomain/);
 assert.match(w, /'shopify:' \+ deliveryId/);
 assert.match(ingest, /existing\.shopifyUpdatedAt >= order\.shopifyUpdatedAt/);
 assert.match(ingest, /merchantReconciled: Boolean\(existing\?\.merchantReconciled\)/);
 assert.doesNotMatch(w, /payout\.create|commission\.create|isPaid = true/);
});

test('only authenticated admin can install subscriptions for the official domain', () => {
 const route = read('src/app/api/admin/shopify/order-webhooks/route.ts');
 const page = read('src/components/orders/OrdersPage.tsx');
 assert.match(route, /request\.headers\.get\('x-authenticated-role'\) !== 'ADMIN'/);
 assert.match(route, /HV_ENABLE_SHOPIFY_ORDER_WEBHOOKS/);
 assert.match(route, /state\.hasOrderAccess/);
 assert.match(route, /read_orders/);
 assert.match(route, /webhookSubscriptionCreate/);
 assert.match(route, /userErrors \{ field message \}/);
 assert.doesNotMatch(route, /userErrors \{ field message code \}/);
 assert.match(route, /herbal-vitaly-affiliate\\.vercel\\.app\\/api\\/integrations\\/shopify\\/orders/);
 assert.doesNotMatch(route, /const ENDPOINT = 'https:\\/\\/partner\\.herbalvitaly\\.com/);
 assert.match(route, /request\\.headers\\.get\\('origin'\\) !== 'https:\\/\\/partner\\.herbalvitaly\\.com'/);
 assert.match(page, /Activate Shopify order webhooks/);
 assert.match(page, /Recover recent Shopify orders/);
 const recovery = read('src/app/api/admin/shopify/backfill-orders/route.ts');
 assert.match(recovery, /ingestShopifyOrderSnapshot/);
 assert.match(recovery, /financialValidation: 'NOT_PERFORMED'/);
});
