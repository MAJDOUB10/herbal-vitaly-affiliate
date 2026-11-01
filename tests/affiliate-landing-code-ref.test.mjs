import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { affiliateLandingPageLink, trackedAffiliateLandingLink } from '../src/lib/hv-shopify-discounts.ts';

const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const redirect = source('src/app/r/[code]/route.ts');
const partner = source('src/app/api/affiliate/shopify-coupons/route.ts');
const email = source('src/lib/auto-partner-shopify-coupon.ts');
const admin = source('src/app/admin/coupons/page.tsx');

test('real partner Shopify codes replace demo TEST15 in both affiliate pages', () => {
  const code = 'HVPARTNERABC123';
  assert.equal(affiliateLandingPageLink(code, 'tiynefret'),
    'https://herbalvitaly.com/pages/tiynefret-affiliate?ref=HVPARTNERABC123');
  assert.equal(affiliateLandingPageLink(code, 'ushabti'),
    'https://herbalvitaly.com/pages/ushabti-affiliate?ref=HVPARTNERABC123');
  assert.throws(() => affiliateLandingPageLink(code, 'other-product'));
  assert.throws(() => affiliateLandingPageLink('ABC/REF', 'ushabti'));
});

test('partner share links preserve attribution and carry verified Shopify promo', () => {
  const link = new URL(trackedAffiliateLandingLink('REFERRAL_ABC', 'HVPARTNERABC123', 'tiynefret'));
  assert.equal(link.origin, 'https://partner.herbalvitaly.com');
  assert.equal(link.pathname, '/r/REFERRAL_ABC');
  assert.equal(link.searchParams.get('promo'), 'HVPARTNERABC123');
  assert.equal(new URL(link.searchParams.get('dest')).pathname, '/pages/tiynefret-affiliate');
  assert.equal(new URL(link.searchParams.get('dest')).searchParams.get('ref'), 'HVPARTNERABC123');
});

test('redirect validates ownership, product eligibility and uses promo as COD ref', () => {
  assert.ok(redirect.includes("redirectUrl.pathname.match(/^\\/pages\\/(tiynefret|ushabti)-affiliate\\/?$/)"));
  assert.ok(redirect.includes("redirectUrl.searchParams.delete('ref')"));
  assert.ok(redirect.includes("affiliateId: affiliate.id, source: 'SHOPIFY'"));
  assert.ok(redirect.includes('getShopifyCouponTargets([coupon.code])'));
  assert.ok(redirect.includes("live?.status === 'ACTIVE' && validProduct"));
  assert.ok(redirect.includes("redirectUrl.searchParams.set('ref', coupon.code)"));
  assert.ok(redirect.includes("redirectUrl.searchParams.set('hv_ref', referralCode)"));
  assert.ok(redirect.includes("redirectUrl.searchParams.set('hv_token', hvToken)"));
  assert.ok(redirect.includes("redirectUrl.pathname.startsWith('/products/')"));
  assert.ok(redirect.includes("'/discount/' + encodeURIComponent(coupon.code)"));
  assert.ok(!redirect.includes("redirectUrl.searchParams.set('ref', promo)"));
});

test('partner dashboard, welcome emails and admin copy use dynamic affiliate pages', () => {
  assert.ok(partner.includes('trackedAffiliateLandingLink(user.affiliate!.referralCode, c.code, p.handle)'));
  assert.ok(email.includes('trackedAffiliateLandingLink(referralCode, code, handle)'));
  assert.ok(admin.includes("'/pages/' + p.handle + '-affiliate?ref='"));
  assert.ok(!partner.includes('TEST15'));
  assert.ok(!email.includes('TEST15'));
});
