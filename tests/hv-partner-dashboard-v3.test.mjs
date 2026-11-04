import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('partner V3 is isolated from the admin dashboard', () => {
  const shared = src('src/components/dashboard/HvDashboard.tsx');
  const partner = src('src/components/dashboard/AffiliateDashboardV3.tsx');
  const admin = src('src/app/admin/page.tsx');
  assert.match(shared, /role === 'AFFILIATE' \? <AffiliateDashboardV3/);
  assert.match(admin, /AdminCommandCenter/);
  const adminOnly = src('src/app/api/admin/command-center/route.ts');
  assert.match(adminOnly, /actor\.role !== 'ADMIN'/);
  assert.match(adminOnly, /actor\.status !== 'ACTIVE'/);
  assert.match(partner, /\/api\/dashboard\/insights/);
  assert.match(partner, /\/api\/affiliate\/shopify-coupons/);
});

test('verified server totals, not capped display samples, power overview metrics', () => {
  const api = src('src/app/api/dashboard/insights/route.ts');
  const partner = src('src/components/dashboard/AffiliateDashboardV3.tsx');
  assert.match(api, /prisma\.hvCodOrder\.aggregate/);
  assert.match(api, /deliveredValueEGP/);
  assert.match(api, /reconciledCollectedEGP/);
  assert.match(api, /previousOrderValueEGP/);
  assert.match(partner, /Exact summary totals are calculated across all matching orders/);
  assert.match(partner, /insights\.totals\.reconciledCollectedEGP/);
  assert.match(partner, /insights\.finance\.approvedEGP/);
  assert.doesNotMatch(partner, /Math\.random|fake reviews|guaranteed payouts/i);
});

test('orders use authenticated ownership and server-side filters', () => {
  const api = src('src/app/api/affiliate/shopify-orders/route.ts');
  const page = src('src/components/orders/OrdersPage.tsx');
  assert.match(api, /request\.headers\.get\('x-user-id'\)/);
  assert.match(api, /request\.headers\.get\('x-authenticated-role'\)/);
  assert.match(api, /affiliateId/);
  assert.match(api, /shopifyUpdatedAt/);
  assert.match(api, /where\.attributionSource/);
  assert.match(api, /where\.cancelled/);
  assert.match(api, /where\.refunded/);
  assert.match(api, /where\.OR/);
  assert.match(api, /take: perPage/);
  assert.match(page, /params\.set\('search', search\)/);
  assert.match(page, /params\.set\('status', status\)/);
  assert.match(page, /expanded===o\.id/);
  assert.doesNotMatch(api, /prisma\.hvCodOrder\.update\(/);
});

test('Egyptian display currency and no invented payout schedules', () => {
  for (const path of [
    'src/components/dashboard/AffiliateDashboardV3.tsx',
    'src/app/affiliate/reports/page.tsx',
    'src/app/affiliate/payouts/page.tsx',
  ]) {
    const text = src(path);
    assert.match(text, /EGP/, path);
    assert.doesNotMatch(text, /IndianRupee|en-IN|₹/, path);
  }
  const payouts = src('src/app/affiliate/payouts/page.tsx');
  assert.doesNotMatch(payouts, /Payouts are processed on the 1st/);
  assert.match(payouts, /financial approval/);
});

test('partner links, mobile and transparent unknown data remain supported', () => {
  const partner = src('src/components/dashboard/AffiliateDashboardV3.tsx');
  for (const name of ['id="shopify-products"', 'id="delivery-status"', 'id="return-reasons"',
    'href="/affiliate/orders"', 'href="/affiliate/coupons"', 'href="/affiliate/payouts"',
    'lg:grid-cols-4', 'sm:grid-cols-3', 'No reasons are inferred']) {
    assert.ok(partner.includes(name), name);
  }
});
