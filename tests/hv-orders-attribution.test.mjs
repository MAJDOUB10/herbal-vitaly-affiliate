import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrderAttribution, orderStatus } from '../src/lib/hv-order-attribution.ts';

const link = { affiliateId: 'partner-1', referralCode: 'TESTOR-915C', attributionKey: 'attr_12345' };
const coupon1 = { affiliateId: 'partner-1', referralCode: 'TESTOR-915C', code: 'CREATOR15' };
const coupon2 = { affiliateId: 'partner-2', referralCode: 'OTHER22', code: 'OTHER10' };

test('signed affiliate referral alone attributes the order to its partner', () => {
  assert.deepEqual(resolveOrderAttribution(link, [], []), {
    affiliateId: 'partner-1', referralCode: 'TESTOR-915C', attributionSource: 'AFFILIATE_LINK',
    discountCode: null, attributionKey: 'attr_12345',
  });
});
test('Shopify-applied promo code mapped to affiliate attributes without a referral click', () => {
  const res = resolveOrderAttribution(null, [' creator15 '], [coupon1]);
  assert.equal(res.affiliateId, 'partner-1');
  assert.equal(res.referralCode, 'TESTOR-915C');
  assert.equal(res.attributionSource, 'PROMO_CODE');
  assert.equal(res.discountCode, 'CREATOR15');
});
test('link and promo for same affiliate never duplicate the order or commission', () => {
  const res = resolveOrderAttribution(link, ['CREATOR15'], [coupon1]);
  assert.equal(res.attributionSource, 'LINK_AND_PROMO');
  assert.equal(res.affiliateId, 'partner-1');
});
test('different link and promo partner becomes an unattributed manual conflict', () => {
  const res = resolveOrderAttribution(link, ['OTHER10'], [coupon2]);
  assert.equal(res.affiliateId, null);
  assert.equal(res.referralCode, null);
  assert.equal(res.attributionSource, 'CONFLICT');
});
test('two mapped promo codes owned by different partners are blocked for review', () => {
  const res = resolveOrderAttribution(null, ['CREATOR15', 'OTHER10'], [coupon1, coupon2]);
  assert.equal(res.attributionSource, 'CONFLICT');
  assert.equal(res.affiliateId, null);
});
test('unmapped promo code is not treated as valid affiliate identity', () => {
  const res = resolveOrderAttribution(null, ['PUBLIC10'], []);
  assert.equal(res.attributionSource, 'UNATTRIBUTED');
  assert.equal(res.discountCode, 'PUBLIC10');
});
test('status respects COD delivery and reconciliation, without automatic cashout', () => {
  const base = { attributionSource: 'PROMO_CODE', cancelled: false, refunded: false,
    isCod: true, delivered: false, courierCollected: false, merchantReconciled: false };
  assert.equal(orderStatus(base), 'PENDING_DELIVERY');
  assert.equal(orderStatus({ ...base, delivered: true }), 'AWAITING_COD_RECONCILIATION');
  assert.equal(orderStatus({ ...base, delivered: true, courierCollected: true, merchantReconciled: true }),
    'PENDING_FINANCIAL_APPROVAL');
  assert.equal(orderStatus({ ...base, refunded: true }), 'REFUNDED');
  assert.equal(orderStatus({ ...base, attributionSource: 'CONFLICT' }), 'ATTRIBUTION_CONFLICT');
});
test('API routes restrict partner data and never mutate orders or approve payout', async () => {
  const fs = await import('node:fs');
  const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const admin = read('src/app/api/admin/orders/route.ts');
  const affiliate = read('src/app/api/affiliate/shopify-orders/route.ts');
  const webhook = read('src/app/api/integrations/shopify/orders/route.ts');
  const ingest = read('src/lib/hv-order-ingest.ts');
  assert.match(admin, /x-authenticated-role.*ADMIN/);
  assert.match(affiliate, /x-authenticated-role.*AFFILIATE/);
  assert.match(affiliate, /where = \{ affiliateId,/);
  assert.match(webhook, /verifyShopifyHmac\(raw, signature, secret\)/);
  assert.match(ingest, /resolveOrderAttribution/);
  assert.doesNotMatch(webhook, /commission\.create|payout\.create/);
});
