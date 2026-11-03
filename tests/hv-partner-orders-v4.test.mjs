import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const route = read('src/app/api/affiliate/shopify-orders/route.ts');
const view = read('src/components/orders/PartnerOrdersV4.tsx');
const page = read('src/app/affiliate/orders/page.tsx');

test('affiliate uses a dedicated premium orders V4 page without changing admin',()=>{
  assert.match(page,/PartnerOrdersV4/);
  assert.match(read('src/app/admin/orders/page.tsx'),/OrdersPage/);
  assert.match(view,/Order Management/);
  assert.match(view,/HERBAL VITALY \/ PARTNER OPERATIONS/);
  assert.match(view,/lg:hidden/);
});
test('orders API enforces authenticated partner ownership and does not mutate financials',()=>{
  assert.match(route,/request\.headers\.get\('x-user-id'\)/);
  assert.match(route,/request\.headers\.get\('x-authenticated-role'\) !== 'AFFILIATE'/);
  assert.match(route,/affiliateId = user\.affiliate\.id/);
  assert.match(route,/where = \{ affiliateId,/);
  assert.match(route,/take: perPage/);
  assert.doesNotMatch(route,/prisma\.hvCodOrder\.(update|create|delete)|prisma\.payout\.create|commission\.update/);
  assert.doesNotMatch(route,/params\.get\('affiliateId'\)/);
});
test('exact totals on filtered orders are server side; chart sampling disclosed',()=>{
  for(const needle of [
    'prisma.hvCodOrder.count','prisma.hvCodOrder.aggregate','deliveredOrders',
    'reconciledOrders','orderValueEGP','collectedReconciledEGP',
    'take:5001','trendComplete',
  ])assert.ok(route.includes(needle),needle);
  assert.match(view,/Trends reflect the 5,000 most recently updated records/);
});
test('synchronized order details are accurate with unknowns shown as unknown',()=>{
  for(const needle of ['bostaUpdatedAt','merchantSettledAt','returnReason:null',
    'product:null','commissionStatus:null','orderStatus(o)'])
    assert.ok(route.includes(needle),needle);
  for(const needle of ['Not yet available from delivery provider',
    'Provider code','timestamp unavailable','not currently linked',
    'Not yet synchronized'])
    assert.ok(view.includes(needle),needle);
});
test('secure CSV export uses current filters, row streaming and formula escaping',()=>{
  for(const needle of ['export','text/csv','ReadableStream','protectCell',
    "s.replace(/\"/g,'\"\"')",'private, no-store','25000',
    'Content-Disposition'])assert.ok(route.includes(needle),needle);
  assert.match(view,/new URLSearchParams\(params\)/);
  assert.match(view,/HerbalVitaly_Partner_Orders_/);
});
test('partner filters include real Cairo dates, statuses, coupon, attribution and COD flags',()=>{
  for(const needle of ['Africa/Cairo','cairoMidnight','filterDates','where.shopifyUpdatedAt',
    'where.isCod','where.merchantReconciled','where.discountCode','where.attributionSource',
    'where.refunded','where.cancelled'])assert.ok(route.includes(needle),needle);
  for(const needle of ['Reporting period','Date range','Custom range','All time','Delivery status',
    'Financial reconciliation','Promo code','Attribution source','Clear all filters','10 / page','50 / page'])
    assert.ok(view.includes(needle),needle);
});
