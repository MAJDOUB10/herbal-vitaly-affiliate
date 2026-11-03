import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { affiliateLandingPageLink, trackedAffiliateLandingLink } from '../src/lib/hv-shopify-discounts.ts';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const api = read('src/app/api/affiliate/shopify-coupons/route.ts');
const page = read('src/app/affiliate/coupons/page.tsx');

test('Shopify direct product page URLs carry each partner Shopify promo code, not TEST15 fixture', () => {
  for (const code of ['TEST03', 'MR14', 'AB12', 'SARA15', 'ALMASR-2AEF']) {
    for (const handle of ['ushabti', 'tiynefret']) {
      assert.equal(affiliateLandingPageLink(code, handle),
        'https://herbalvitaly.com/pages/' + handle + '-affiliate?ref=' + code);
    }
  }
  assert.equal(affiliateLandingPageLink('hvTEST15', 'tiynefret'),
    'https://herbalvitaly.com/pages/tiynefret-affiliate?ref=HVTEST15');
  assert.throws(() => affiliateLandingPageLink('TEST03', 'flexoria'));
});

test('coupon API verifies Shopify activation and eligible products before giving direct links', () => {
  for(const s of [
    'getShopifyCouponTargets(coupons.map(c => c.code))',
    "affiliateId: user.affiliate.id, source: 'SHOPIFY'",
    "shopifyStatus: 'ACTIVE', isActive: true",
    "target.status !== 'ACTIVE'",
    "target.scope === 'PRODUCTS'",
    "affiliateLandingPageLink(c.code, p.handle)",
    "trackedAffiliateLandingLink(user.affiliate!.referralCode, c.code, p.handle)",
    'trackedLink:', 'affiliateLink:',
    "['tiynefret', 'ushabti'].includes(p.handle)"
  ]) assert.ok(api.includes(s), s);
  assert.ok(!api.includes('affiliateLandingPageLink(user.affiliate!.referralCode'));
});

test('optional tracked URL redirects to same Shopify page, records signed click attribution', () => {
  const link=trackedAffiliateLandingLink('GOOGLE-C6E5F062ADBB05','TEST03','ushabti');
  const u=new URL(link);
  assert.equal(u.pathname,'/r/GOOGLE-C6E5F062ADBB05');
  assert.equal(u.searchParams.get('promo'),'TEST03');
  assert.equal(u.searchParams.get('dest'),
    'https://herbalvitaly.com/pages/ushabti-affiliate?ref=TEST03');
});

test('the main visible link and copy action use direct URL, tracking is optional', () => {
  assert.ok(page.includes('href={p.affiliateLink}'));
  assert.ok(page.includes('value={p.affiliateLink}'));
  assert.ok(page.includes('onClick={() => copy(p.affiliateLink)}'));
  assert.ok(page.includes('Copy Shopify link'));
  assert.ok(page.includes('p.trackedLink &&'));
  assert.ok(page.includes('copy(p.trackedLink!)'));
  assert.ok(page.includes('Copy tracked link'));
  assert.ok(page.includes('product-page link with your code in ?ref='));
  assert.ok(!page.includes('https://herbalvitaly.com/pages/ushabti-affiliate?ref=TEST15'));
});
