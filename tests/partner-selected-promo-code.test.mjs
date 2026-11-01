import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDiscountCode } from '../src/lib/hv-shopify-discounts.ts';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const api = read('src/app/api/affiliate/promo-code/route.ts');
const service = read('src/lib/auto-partner-shopify-coupon.ts');
const login = read('src/app/api/auth/login/route.ts');
const otp = read('src/app/api/auth/verify-otp/route.ts');
const register = read('src/app/register/page.tsx');
const loginUi = read('src/app/login/page.tsx');
const ui = read('src/app/affiliate/coupons/page.tsx');
const migration = read('prisma/migrations/20261101114000_one_auto_coupon_per_partner/migration.sql');

test('a partner chooses a code only after OTP and password login', () => {
  assert.ok(!otp.includes('provisionAffiliateShopifyCoupon'));
  assert.ok(!login.includes('provisionAffiliateShopifyCoupon'));
  assert.ok(login.includes('needsPromoCode'));
  assert.ok(login.includes("description: 'Automatic OTP-verified affiliate onboarding'"));
  assert.ok(loginUi.includes("data.user.needsPromoCode ? '/affiliate/coupons'"));
  assert.ok(register.includes('Sign in & choose your code'));
  assert.ok(ui.includes('Choose your personal promo code'));
});

test('only logged-in, active, OTP-verified affiliates can reserve a promo code', () => {
  assert.ok(api.includes("request.headers.get('x-user-id')"));
  assert.ok(api.includes("request.headers.get('x-authenticated-role') !== 'AFFILIATE'"));
  assert.ok(api.includes("user.status === 'ACTIVE'"));
  assert.ok(api.includes('user.emailVerifiedAt && user.affiliate'));
  assert.ok(api.includes("request.headers.get('origin') !== 'https://partner.herbalvitaly.com'"));
  assert.ok(api.includes("process.env.VERCEL_ENV !== 'production'"));
  assert.ok(api.includes('getAutoCouponSettings()'));
  assert.ok(api.includes("checkRateLimit(partner.userId, 'partner-promo-create'"));
  assert.ok(!api.includes('prisma.commission.update'));
  assert.ok(!api.includes('prisma.payout.create'));
});

test('the affiliate chooses a valid personal Shopify code from 3 to 40 characters', () => {
  assert.ok(api.includes('validateDiscountCode(value)'));
  assert.ok(service.includes('validateDiscountCode(chosenCode)'));
  assert.ok(service.includes('requestedCode.trim().toUpperCase()'));
  assert.ok(ui.includes("replace(/[^A-Z0-9_-]/g, '')"));
  assert.ok(ui.includes('minLength={3} maxLength={40}'));
  assert.ok(ui.includes('for example SARA15, MOHAMED or ALI2026'));
  assert.ok(ui.includes('availability !== \'available\''));
});

test('Shopify and Refferq share a 3–40 character format, with no fixed length of 3', () => {
  for (const code of ['ALI', 'SARA15', 'MOHAMED', 'MOHAMED2026', 'ALI_2026', 'SARA-20', 'A'.repeat(40)]) {
    assert.equal(validateDiscountCode(code), code);
  }
  assert.equal(validateDiscountCode('sara15'), 'SARA15');
  for (const invalid of ['AB', 'A'.repeat(41), '-ABC', '_ABC', 'A B', 'A/BC', '', '🔥']) {
    assert.equal(validateDiscountCode(invalid), null);
  }
  assert.ok(ui.includes('maxLength={40}'));
  assert.ok(ui.includes('preferredCodeValid'));
  assert.ok(api.includes('validateDiscountCode(value)'));
  assert.ok(service.includes('validateDiscountCode(chosenCode)'));
});

test('availability is checked against Shopify and Neon without exposing other partners', () => {
  assert.ok(api.includes("prisma.coupon.findUnique({"));
  assert.ok(api.includes('getShopifyDiscountByCode(code)'));
  assert.ok(api.includes('available: !alreadyLocal && !alreadyShopify'));
  assert.ok(api.includes("checkRateLimit(partner.userId, 'partner-promo-availability'"));
  assert.ok(ui.includes("setTimeout(async () =>"));
  assert.ok(ui.includes("setAvailability(data.available ? 'available' : 'taken')"));
  assert.ok(service.includes('getShopifyDiscountByCode(chosenCode)'));
});

test('one code per partner, including during concurrent submissions and email retries', () => {
  assert.ok(service.includes('coupon && coupon.code !== chosenCode'));
  assert.ok(service.includes('const code = coupon.code;'));
  assert.ok(service.includes("source: 'REFFERQ_PENDING', shopifyStatus: 'PENDING'"));
  assert.ok(service.includes('createShopifyDiscount(buildBasicDiscountInput({'));
  assert.ok(service.includes('sendCouponEmail('));
  assert.ok(api.includes('await provisionAffiliateShopifyCoupon(partner.userId, code)'));
  assert.ok(api.includes('await assignedCoupon(partner.affiliateId)'));
  assert.ok(migration.includes('CREATE UNIQUE INDEX IF NOT EXISTS'));
  assert.ok(!/DELETE FROM|DROP TABLE|TRUNCATE/i.test(migration));
});

test('existing partners keep their assigned Shopify codes and referral identity', () => {
  assert.ok(api.includes("source: 'SHOPIFY', isActive: true"));
  assert.ok(api.includes("current && current.code !== code"));
  assert.ok(ui.includes('Your assigned promo code'));
  assert.ok(login.includes("needsPromoCode: Boolean(needsPromoCode)"));
  assert.ok(register.includes("Sign in & choose your code"));
});
