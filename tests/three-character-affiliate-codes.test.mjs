import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  automaticShortCouponCode, randomShortCouponCode,
  SHORT_COUPON_ALPHABET, SHORT_COUPON_LENGTH, SHORT_COUPON_SPACE,
} from '../src/lib/short-partner-code.ts';

const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const onboarding = file('src/lib/auto-partner-shopify-coupon.ts');
const manual = file('src/app/api/admin/coupons/route.ts');
const admin = file('src/app/admin/coupons/page.tsx');
const migration = file('prisma/migrations/20261101114000_one_auto_coupon_per_partner/migration.sql');

test('automatic codes are EXACTLY 3 simple uppercase letters/digits without ambiguous symbols', () => {
  assert.equal(SHORT_COUPON_ALPHABET.length, 32);
  assert.equal(SHORT_COUPON_LENGTH, 3);
  assert.equal(SHORT_COUPON_SPACE, 32 ** 3);
  for(let i=0;i<200;i++) {
    const code=automaticShortCouponCode('affiliate_123',i,'secure-test-secret');
    assert.match(code,/^[A-HJ-NP-Z2-9]{3}$/);
    assert.ok(!/[01IO]/.test(code));
    assert.equal(automaticShortCouponCode('affiliate_123',i,'secure-test-secret'),code);
  }
  for(let i=0;i<100;i++) assert.match(randomShortCouponCode(),/^[A-HJ-NP-Z2-9]{3}$/);
  assert.notEqual(automaticShortCouponCode('partner1',0,'secret'),automaticShortCouponCode('partner2',0,'secret'));
  assert.throws(()=>automaticShortCouponCode('partner',-1,'secret'));
  assert.throws(()=>automaticShortCouponCode('partner',0,''));
});

test('partner-chosen codes are checked in Shopify and Refferq before creation',()=>{
  assert.ok(onboarding.includes("requestedCode.trim().toUpperCase()"));
  assert.ok(onboarding.includes('/^[A-Z0-9]{3}$/.test(chosenCode)'));
  assert.ok(onboarding.includes('prisma.coupon.findUnique({ where: { code: chosenCode }'));
  assert.ok(onboarding.includes('getShopifyDiscountByCode(chosenCode)'));
  assert.ok(onboarding.includes('prisma.coupon.create({'));
  assert.ok(onboarding.includes("error.code === 'P2002'"));
  assert.ok(onboarding.includes("description: 'Automatic OTP-verified affiliate onboarding'"));
  assert.ok(onboarding.includes('const code = coupon.code;'));
  assert.ok(onboarding.includes('coupon.shopifyStatus === \'ACTIVE\' && !coupon.autoEmailSentAt'));
  assert.ok(!onboarding.includes("const fromReferral ="));
  assert.ok(!onboarding.includes('automaticShortCouponCode('));
});

test('manual admin coupon generation uses exactly 3 characters when code field is blank',()=>{
  assert.ok(manual.includes('randomShortCouponCode()'));
  assert.ok(manual.includes('for (let attempt = 0; attempt < 96; attempt++)'));
  assert.ok(manual.includes('await getShopifyDiscountByCode(candidate)'));
  assert.ok(manual.includes('await prisma.coupon.findUnique({ where: { code: candidate }'));
  assert.ok(manual.includes('validateDiscountCode(body.code)'));
});

test('dashboard clearly communicates no prefix and three-character codes',()=>{
  assert.ok(admin.includes('3 characters — automatic'));
  assert.ok(admin.includes('No prefix.'));
  assert.ok(admin.includes('K7M'));
  assert.ok(!admin.includes('id="auto-coupon-prefix"'));
});

test('one automatic coupon per partner regardless of concurrent requests',()=>{
  assert.ok(migration.includes('CREATE UNIQUE INDEX IF NOT EXISTS'));
  assert.ok(migration.includes('"affiliate_id"'));
  assert.ok(migration.includes("description\" = 'Automatic OTP-verified affiliate onboarding'"));
  assert.ok(!/DELETE FROM|DROP TABLE|TRUNCATE/i.test(migration));
});
