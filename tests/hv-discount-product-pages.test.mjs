import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getShopifyCouponTargets } from '../src/lib/hv-shopify-discounts.ts';

test('legacy Shopify codes resolve to their actual product pages, not empty local arrays', async () => {
  const oldFetch = globalThis.fetch;
  const oldShop = process.env.SHOPIFY_SHOP_DOMAIN;
  const oldToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  process.env.SHOPIFY_SHOP_DOMAIN = 'kk20pd-es.myshopify.com';
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'test-only-token';
  let requests = 0;
  try {
    globalThis.fetch = async (_url, args) => {
      requests += 1;
      const vars = JSON.parse(args.body).variables;
      const data = {};
      for (const [idx, code] of Object.values(vars).entries()) {
        const products = code === 'T15' ? [
          { id: 'gid://shopify/Product/12345', title: 'USHABTI', handle: 'ushabti', onlineStoreUrl: 'https://herbalvitaly.com/products/ushabti' },
          { id: 'gid://shopify/Product/67890', title: 'TIYNEFRET', handle: 'tiynefret', onlineStoreUrl: 'https://herbalvitaly.com/products/tiynefret' },
          { id: 'gid://shopify/Product/77777', title: 'External product', handle: 'external', onlineStoreUrl: 'https://untrusted.example/products/external' },
        ] : [];
        data['c' + idx] = code === 'UNKNOWN' ? null : {
          id: 'gid://shopify/DiscountCodeNode/1',
          codeDiscount: { status: code === 'EXPIRED10' ? 'EXPIRED' : 'ACTIVE',
            customerGets: { items: code === 'WELCOME10' ? { __typename: 'AllDiscountItems' } : {
              __typename: 'DiscountProducts', products: { nodes: products, pageInfo: { hasNextPage: false } },
            } } },
        };
      }
      return { ok: true, json: async () => ({ data }) };
    };
    const result = await getShopifyCouponTargets(['t15', 'WELCOME10', 'UNKNOWN', 'EXPIRED10']);
    assert.equal(requests, 1);
    assert.equal(result.T15.status, 'ACTIVE');
    assert.deepEqual(result.T15.products.map(p => p.handle), ['ushabti','tiynefret']);
    assert.equal(result.WELCOME10.scope, 'ALL');
    assert.equal(result.UNKNOWN.scope, 'MISSING');
    assert.equal(result.EXPIRED10.status, 'EXPIRED');
    assert.equal(result.T15.truncated, false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldShop === undefined) delete process.env.SHOPIFY_SHOP_DOMAIN;
    else process.env.SHOPIFY_SHOP_DOMAIN = oldShop;
    if (oldToken === undefined) delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    else process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = oldToken;
  }
});
test('coupon API and UI use authoritative product eligibility, not inferred descriptions', () => {
  const root = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
  const admin = root('src/app/api/admin/coupons/route.ts');
  const page = root('src/app/admin/coupons/page.tsx');
  const partner = root('src/app/api/affiliate/shopify-coupons/route.ts');
  const redir = root('src/app/r/[code]/route.ts');
  assert.match(admin,/getShopifyCouponTargets/);
  assert.match(admin,/shopifyVerificationError/);
  assert.match(page,/eligibleProducts/);
  assert.match(page,/Copy promo link/);
  assert.match(page,/Filter by Shopify product/);
  assert.match(partner,/affiliateId: user\.affiliate\.id/);
  assert.match(partner,/target\.status !== 'ACTIVE'/);
  assert.match(redir,/getShopifyCouponTargets/);
  assert.match(redir,/affiliateId: affiliate\.id/);
  assert.match(redir,/live\?\.status === 'ACTIVE'/);
});
