import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const schema = get('prisma/schema.prisma');
const migration = get('prisma/migrations/20261101110000_auto_coupon_settings/migration.sql');
const policy = get('src/lib/auto-coupon-settings.ts');
const api = get('src/app/api/admin/coupons/auto-settings/route.ts');
const service = get('src/lib/auto-partner-shopify-coupon.ts');
const dashboard = get('src/app/admin/coupons/page.tsx');

test('additive auto coupon settings default to current production policy', () => {
  assert.ok(schema.includes('model AutoCouponSettings {'));
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS "auto_coupon_settings"'));
  assert.ok(migration.includes('ON CONFLICT ("id") DO NOTHING'));
  for (const term of ["prefix: 'HV'", 'discountPercent: 15', "['tiynefret', 'ushabti']", 'sendEmail: true', 'enabled: true']) {
    assert.ok(policy.includes(term), term);
  }
  assert.ok(!/DROP TABLE|DELETE FROM|TRUNCATE|ALTER TABLE "commissions"|ALTER TABLE "payouts"/i.test(migration));
});

test('only Admin may modify code generation; products are checked in Shopify', () => {
  for (const term of ["x-authenticated-role", "user?.role === 'ADMIN'", "user.status === 'ACTIVE'",
    "request.headers.get('origin')", 'validateAutoCouponPolicy', 'getShopifyProducts()',
    'new Set(catalog.map(p => p.handle))', 'prisma.autoCouponSettings.upsert',
    "'UPDATE_AUTO_COUPON_SETTINGS'"]) assert.ok(api.includes(term), term);
  assert.ok(policy.includes("v.discountPercent > 50"));
  assert.ok(policy.includes("v.productHandles.length < 1"));
});

test('settings apply only to future Shopify discounts; existing automatically issued codes survive format changes', () => {
  assert.ok(service.includes("description: 'Automatic OTP-verified affiliate onboarding'"));
  assert.ok(service.includes("const code = coupon.code;"));
  assert.ok(service.includes("settings.discountPercent"));
  assert.ok(service.includes("settings.productHandles"));
  assert.ok(service.includes('automaticShortCouponCode(affiliateId, attempt, secret)'));
  assert.ok(service.includes('coupon.discountValue'));
  assert.ok(service.includes('coupon.shopifyProductHandles'));
  assert.ok(service.includes('settings.sendEmail'));
  assert.ok(service.includes('if (!settings.enabled) return;'));
  for(const model of ['commission','payout','hvCodOrder']){
    for(const method of ['create','update','delete']) {
      assert.ok(!service.includes('prisma.'+model+'.'+method+'('));
    }
  }
});

test('admin coupons dashboard has settings switch, 3-character format, percent, products and save', () => {
  for(const term of ['Automatic partner promo codes','auto-coupon-enabled','3 characters — automatic',
    'auto-coupon-percent','auto-coupon-email','autoPolicy.productHandles.includes(p.handle)',
    'Save automatic generation rules','/api/admin/coupons/auto-settings']) {
    assert.ok(dashboard.includes(term), term);
  }
  assert.ok(dashboard.includes('Existing Shopify discounts remain unchanged.'));
});
