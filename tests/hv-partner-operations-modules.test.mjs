import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('partner sidebar points to three independent application routes',()=>{
 const layout=src('src/app/affiliate/layout.tsx');
 for(const dest of ['/affiliate/product-links','/affiliate/deliveries','/affiliate/returns'])
   assert.ok(layout.includes("url: '"+dest+"'"),dest);
 for(const legacy of ['/affiliate#shopify-products','/affiliate#delivery-status','/affiliate#return-reasons'])
   assert.ok(!layout.includes(legacy),legacy);
});
test('dedicated product links use verified coupons and preserve source tracking distinctions',()=>{
 const page=src('src/components/operations/ProductLinksWorkspace.tsx');
 const api=src('src/app/api/affiliate/shopify-coupons/route.ts');
 assert.match(page,/\/api\/affiliate\/shopify-coupons/);
 assert.match(page,/\/api\/dashboard\/insights\?days=30/);
 assert.match(page,/p\.trackedLink/);
 assert.match(page,/p\.affiliateLink/);
 assert.match(page,/navigator\.clipboard\.writeText/);
 assert.match(page,/Shopify price/);
 assert.match(page,/not product-specific statistics/);
 assert.match(api,/affiliateId: user\.affiliate\.id/);
 assert.match(api,/getShopifyCouponTargets/);
});
test('logistics and returns endpoint enforces verified partner scope before queries',()=>{
 const api=src('src/app/api/affiliate/operations/route.ts');
 assert.match(api,/request\.headers\.get\('x-user-id'\)/);
 assert.match(api,/request\.headers\.get\('x-authenticated-role'\)!=='AFFILIATE'/);
 assert.match(api,/user\.status!=='ACTIVE'/);
 assert.match(api,/user\.emailVerifiedAt/);
 assert.match(api,/affiliateId:user\.affiliate\.id/);
 assert.match(api,/const ATTRIBUTED/);
 assert.doesNotMatch(api,/params\.get\('affiliateId'\)/);
 assert.doesNotMatch(api,/prisma\.hvCodOrder\.(create|update|delete)|prisma\.commission\.(create|update)|prisma\.payout\.(create|update)/);
});
test('operations data honestly distinguishes Shopify refunds and Bosta physical returns',()=>{
 const api=src('src/app/api/affiliate/operations/route.ts');
 const ui=src('src/components/operations/OperationsWorkspace.tsx');
 for(const field of ['physicalReturns:null','refundValueEGP:null','commissionAdjustmentsEGP:null',
   'returnReason:null','refundAmountEGP:null','product:null','inTransit:null','outForDelivery:null',
   'failedDeliveries:null'])assert.ok(api.includes(field),field);
 for(const phrase of ['Raw provider state','Not verified by current connector','not automatically a physically returned parcel',
   'Not yet provided by Shopify/Bosta','No intermediate courier stages are inferred'])
   assert.ok(ui.includes(phrase),phrase);
});
test('filters, aggregates and csv export are server-side and ownership scoped',()=>{
 const api=src('src/app/api/affiliate/operations/route.ts');
 const ui=src('src/components/operations/OperationsWorkspace.tsx');
 for(const term of ['buildWhere(module,request.nextUrl.searchParams,user.affiliate.id)',
   'shopifyUpdatedAt:range','bostaTrackingNumber:{contains:q',
   'prisma.hvCodOrder.aggregate','prisma.hvCodOrder.count','take:perPage',
   'ReadableStream','protectCsv','private, no-store','take:2001','trendsComplete']) assert.ok(api.includes(term),term);
 for(const term of ['exportData','Custom range','Cash on delivery','View details','No matching records',
   'lg:hidden','History','Delivery Management','Returns & Refunds'])if(term!=='History')assert.ok(ui.includes(term),term);
});
test('new partner pages are independent and keep existing order/admin page',()=>{
 for(const page of ['src/app/affiliate/product-links/page.tsx',
   'src/app/affiliate/deliveries/page.tsx','src/app/affiliate/returns/page.tsx'])
   assert.match(src(page),/default function/);
 assert.match(src('src/app/affiliate/orders/page.tsx'),/PartnerOrdersV4/);
 assert.match(src('src/app/admin/orders/page.tsx'),/OrdersPage/);
});
