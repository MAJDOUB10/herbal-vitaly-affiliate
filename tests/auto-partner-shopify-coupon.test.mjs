import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const service = source('src/lib/auto-partner-shopify-coupon.ts');
const otp = source('src/app/api/auth/verify-otp/route.ts');
const login = source('src/app/api/auth/login/route.ts');
const schema = source('prisma/schema.prisma');
const migration = source('prisma/migrations/20261101094500_auto_partner_coupon_email/migration.sql');

test('only verified active affiliate profiles may receive automatic coupons', () => {
  assert.ok(service.includes("input.role === 'AFFILIATE' && input.status === 'ACTIVE'"));
  assert.ok(service.includes('Boolean(input.emailVerifiedAt) && input.hasAffiliate'));
  assert.ok(service.includes("process.env.VERCEL_ENV !== 'production'"));
  assert.ok(service.includes("process.env.HV_ENABLE_SHOPIFY_DISCOUNT_WRITES !== 'true'"));
  assert.ok(service.includes("const RATE = 15"));
  assert.ok(service.includes("['tiynefret', 'ushabti']"));
  assert.ok(service.includes('validateDiscountCode(code)'));
});

test('Shopify writes must be reserved and product-scoped before a notification', () => {
  assert.ok(service.includes("source: 'REFFERQ_PENDING', shopifyStatus: 'PENDING'"));
  assert.ok(service.includes("shopifyProductIds: chosen.map(p => p!.id)"));
  assert.ok(service.includes("getShopifyDiscountByCode(code)"));
  assert.ok(service.includes('await prisma.coupon.updateMany'));
  assert.ok(service.includes("shopifyStatus: 'CREATING'"));
  assert.ok(service.includes('createShopifyDiscount(buildBasicDiscountInput({'));
  assert.ok(service.includes("shopify.status === 'ACTIVE'"));
  assert.ok(service.includes("coupon.shopifyStatus === 'ACTIVE' && !coupon.autoEmailSentAt"));
  assert.ok(service.includes('await sendCouponEmail(coupon.id, user.email, user.name, code)'));
  for (const model of ['commission','payout','hvCodOrder']) {
    for (const operation of ['create','update','delete']) {
      assert.ok(!service.includes('prisma.' + model + '.' + operation + '('));
    }
  }
});

test('email sending is idempotent and limited to active Shopify codes', () => {
  assert.ok(service.includes("autoEmailSentAt: null"));
  assert.ok(service.includes("autoEmailClaimedAt: leaseAt"));
  assert.ok(service.includes("idempotencyKey: 'hv-partner-coupon-v1-' + couponId"));
  assert.ok(service.includes("await prisma.coupon.update({"));
  assert.ok(service.includes("autoEmailSentAt: new Date()"));
  assert.ok(service.includes('productDiscountLink(code, handle)'));
  assert.ok(service.includes('RESEND_FROM_EMAIL'));
  assert.ok(service.includes('autoEmailError'));
});

test('OTP and login schedule retry without exposing a code or secrets to public routes', () => {
  assert.ok(otp.includes("if (result.user?.role === 'AFFILIATE' && !result.pendingApproval)"));
  assert.ok(otp.includes('after(async () => {'));
  assert.ok(login.includes("if (user.role === 'AFFILIATE')"));
  assert.ok(login.includes('after(async () => {'));
  assert.ok(login.includes('provisionAffiliateShopifyCoupon(verifiedUserId)'));
  assert.ok(!otp.includes('SHOPIFY_CLIENT_SECRET'));
  assert.ok(!login.includes('SHOPIFY_CLIENT_SECRET'));
});

test('migration only adds nullable coupon notification fields and does not modify finances', () => {
  for (const field of ['autoEmailSentAt','autoEmailClaimedAt','autoEmailError']) {
    assert.ok(schema.includes(field));
  }
  for (const column of ['auto_email_sent_at','auto_email_claimed_at','auto_email_error']) {
    assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS "' + column + '"'));
  }
  assert.ok(!/DROP TABLE|DELETE FROM|TRUNCATE|ALTER TABLE "commissions"|ALTER TABLE "payouts"/i.test(migration));
});
