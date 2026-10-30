import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateDiscountCode, validateProductIds, buildBasicDiscountInput, productDiscountLink,
} from '../src/lib/hv-shopify-discounts.ts';

const a = 'gid://shopify/Product/10293646197058';
const b = 'gid://shopify/Product/10295637377346';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Shopify promo codes are constrained and normalized', () => {
  assert.equal(validateDiscountCode(' sara10 '), 'SARA10');
  assert.equal(validateDiscountCode('x'), null);
  assert.equal(validateDiscountCode('https://evil.site'), null);
  assert.equal(validateDiscountCode('HV_01-TEST'), 'HV_01-TEST');
});

test('product restrictions require valid and unique Shopify Product IDs', () => {
  assert.deepEqual(validateProductIds([a,a,b]), [a,b]);
  assert.equal(validateProductIds([]), null);
  assert.equal(validateProductIds(['gid://shopify/Product/not-numeric']), null);
});

test('percentage discount is mapped to Shopify fractional percentage on selected products', () => {
  const out = buildBasicDiscountInput({
    code:'SARA10',discountType:'PERCENTAGE',discountValue:10,
    productIds:[a,b],startsAt:new Date('2026-11-01T10:00:00Z'),maxUses:20,
  });
  assert.equal(out.code,'SARA10');
  assert.equal(out.usageLimit,20);
  assert.deepEqual(out.context,{ all:'ALL' });
  assert.deepEqual(out.combinesWith,{ orderDiscounts:false,productDiscounts:false,shippingDiscounts:false });
  assert.deepEqual(out.customerGets, {
    items:{products:{productsToAdd:[a,b]}},
    value:{percentage:0.1},
  });
});

test('fixed discount uses EGP units as Decimal and applies per eligible item', () => {
  const out = buildBasicDiscountInput({
    code:'HV150',discountType:'FIXED',discountValue:150,
    productIds:[a],startsAt:new Date('2026-11-01T10:00:00Z'),
  });
  assert.deepEqual(out.customerGets, {
    items:{products:{productsToAdd:[a]}},
    value:{discountAmount:{amount:'150.00',appliesOnEachItem:true}},
  });
  assert.throws(()=>buildBasicDiscountInput({
    code:'HV150',discountType:'PERCENTAGE',discountValue:105,
    productIds:[a],startsAt:new Date(),
  }));
});

test('product checkout discount URL is constrained to the Herbal Vitaly shop', () => {
  assert.equal(productDiscountLink('SARA10','tiynefret'),
    'https://herbalvitaly.com/discount/SARA10?redirect=%2Fproducts%2Ftiynefret');
  assert.throws(()=>productDiscountLink('SARA10','evil/path'));
});

test('only Shopify-verified active coupons are shareable and the tracking token survives discount redirect', () => {
  const route=read('src/app/r/[code]/route.ts');
  const portal=read('src/app/api/affiliate/shopify-coupons/route.ts');
  const creator=read('src/app/api/admin/coupons/route.ts');
  assert.match(route,/shopifyProductHandles: \{ has: handle \}/);
  assert.match(route,/redirectUrl\.pathname \+ redirectUrl\.search/);
  assert.match(route,/shopifyStatus: 'ACTIVE'/);
  assert.match(portal,/affiliateId: user\.affiliate\.id/);
  assert.match(portal,/shopifyStatus: 'ACTIVE'/);
  assert.match(creator,/createShopifyDiscount\(basicDiscount\)/);
  assert.match(creator,/isActive: false, shopifyStatus: 'PENDING'/);
  assert.match(creator,/source: 'SHOPIFY', shopifyDiscountId: shopify\.id/);
  assert.match(creator,/process\.env\.VERCEL_ENV !== 'preview'/);
});
