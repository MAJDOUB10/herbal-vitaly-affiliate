import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signHvAttribution, verifyHvAttribution, verifiedShopifyOrderAttribution,
  shopifyAffiliateDestination, HV_ATTRIBUTION_TTL_MS,
} from '../src/lib/hv-shopify-attribution.ts';

const secret = 'hv-test-secret-do-not-use-in-production';
const referralCode = 'TESTOR-915C';
const attributionKey = 'attr_1793360000000_abc123456';
const issuedAt = Date.UTC(2026, 9, 30, 12, 0, 0);

test('signed Shopify referral token verifies, survives checkout attributes, and expires', () => {
  const token = signHvAttribution({ referralCode, attributionKey, issuedAt }, secret);
  assert.deepEqual(verifyHvAttribution(token, secret, issuedAt + 1000),
    { referralCode, attributionKey, issuedAt });
  assert.equal(verifyHvAttribution(token, secret, issuedAt + HV_ATTRIBUTION_TTL_MS + 1), null);
  assert.equal(verifyHvAttribution(token, 'wrong-key', issuedAt + 1000), null);
  assert.equal(verifyHvAttribution(token.replace('TESTOR', 'HACKER'), secret, issuedAt + 1000), null);
  assert.equal(verifyHvAttribution(token, secret, issuedAt - 310000), null);
});

test('Shopify note attributes require matching signed code and click reference', () => {
  const token = signHvAttribution({ referralCode, attributionKey, issuedAt }, secret);
  const note_attributes = [
    { name: 'hv_affiliate_code', value: referralCode },
    { name: 'hv_attribution_key', value: attributionKey },
    { name: 'hv_affiliate_token', value: token },
  ];
  assert.deepEqual(
    verifiedShopifyOrderAttribution({ note_attributes }, secret, issuedAt + 1),
    { referralCode, attributionKey, issuedAt },
  );
  assert.equal(verifiedShopifyOrderAttribution({ note_attributes: [
    { name: 'hv_affiliate_code', value: 'HACKER-915C' },
    ...note_attributes.slice(1),
  ] }, secret, issuedAt + 1), null);
  assert.equal(verifiedShopifyOrderAttribution({ note_attributes: [] }, secret), null);
});

test('Shopify destination stays on the official Herbal Vitaly domain', () => {
  assert.equal(shopifyAffiliateDestination(null).href, 'https://herbalvitaly.com/');
  assert.equal(shopifyAffiliateDestination('https://herbalvitaly.com/products/ushabti').href,
    'https://herbalvitaly.com/products/ushabti');
  assert.equal(shopifyAffiliateDestination('https://www.herbalvitaly.com/collections/all').hostname,
    'www.herbalvitaly.com');
  assert.equal(shopifyAffiliateDestination('https://herbalvitaly.com.evil.example/').href,
    'https://herbalvitaly.com/');
  assert.equal(shopifyAffiliateDestination('javascript:alert(1)').href,
    'https://herbalvitaly.com/');
  assert.equal(shopifyAffiliateDestination('http://herbalvitaly.com/').href,
    'https://herbalvitaly.com/');
});

test('tracking remains separate from affiliate cash-out and preserves audited webhook endpoint', async () => {
  const fs = await import('node:fs');
  const url = new URL('../src/app/api/integrations/shopify/orders/route.ts', import.meta.url);
  const source = fs.readFileSync(url, 'utf8');
  assert.match(source, /verifyShopifyHmac\(raw, signature, secret\)/);
  assert.match(source, /verifiedShopifyOrderAttribution/);
  assert.doesNotMatch(source, /create.*[Cc]ommission\(/);
});