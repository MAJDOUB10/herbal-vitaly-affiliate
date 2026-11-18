import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allowedStorefrontOrigin, safeStorefrontPath, safeTrafficChannel,
  validateVisitorEvent,
} from '../src/lib/hv-visitor-policy.ts';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('strict origin allowlisting blocks arbitrary websites',()=>{
  assert.equal(allowedStorefrontOrigin('https://herbalvitaly.com'),true);
  assert.equal(allowedStorefrontOrigin('https://www.herbalvitaly.com'),true);
  assert.equal(allowedStorefrontOrigin('https://partner.herbalvitaly.com'),false);
  assert.equal(allowedStorefrontOrigin('https://herbalvitaly.com.attacker.example'),false);
  assert.equal(allowedStorefrontOrigin('null'),false);
  assert.equal(allowedStorefrontOrigin(null),false);
});
test('storefront path strips sensitive URL parameters and rejects non-store origins',()=>{
  assert.equal(safeStorefrontPath('https://herbalvitaly.com/products/ushabti?email=secret@example.com#x'),'/products/ushabti');
  assert.equal(safeStorefrontPath('https://evil.example/products/ushabti'),null);
  assert.equal(safeStorefrontPath('/products/ushabti'),null);
  assert.equal(safeStorefrontPath('https://herbalvitaly.com/account/jane@example.com'),null);
});
test('event validation refuses non-consent, PII-like metadata and spoofed names',()=>{
  const input={
    consent:true,token:'hv1.TEST.attr_abcdefgh.1790000000000.signature',
    eventId:'a'.repeat(32),sessionId:'b'.repeat(32),
    eventType:'PRODUCT_VIEWED',pageUrl:'https://herbalvitaly.com/products/ushabti?phone=1234',
    channel:'Instagram'
  };
  const event=validateVisitorEvent(input);
  assert.equal(event?.pagePath,'/products/ushabti');
  assert.equal(event?.productHandle,'ushabti');
  assert.equal(event?.channel,'instagram');
  assert.equal(validateVisitorEvent({...input,consent:false}),null);
  assert.equal(validateVisitorEvent({...input,eventType:'PURCHASE'}),null);
  assert.equal(validateVisitorEvent({...input,sessionId:'visitor-email@example.com'}),null);
  assert.equal(safeTrafficChannel('user@example.com'),null);
});
test('every partner traffic query derives identity from signed session',()=>{
  const partner=read('src/app/api/affiliate/analytics/route.ts');
  const master=read('src/app/api/affiliate/team/traffic/route.ts');
  const admin=read('src/app/api/admin/visitor-intelligence/route.ts');
  const proxy=read('src/proxy.ts');
  assert.ok(proxy.includes("'/api/affiliate/:path*'"));
  assert.ok(proxy.includes("'/api/admin/:path*'"));
  assert.ok(partner.includes("request.headers.get('x-user-id')"));
  assert.ok(partner.includes('trafficReport([user.affiliate.id]'));
  assert.ok(!partner.includes("searchParams.get('affiliateId')"));
  assert.ok(master.includes('authenticatedMaster(request)'));
  assert.ok(master.includes('parentAffiliateId:master.affiliateId'));
  assert.ok(admin.includes("request.headers.get('x-authenticated-role') !== 'ADMIN'"));
});
test('visitor events require signed click, verified partner and do not create purchases',()=>{
  const ingest=read('src/app/api/analytics/events/route.ts');
  const report=read('src/lib/hv-traffic-report.ts');
  const schema=read('prisma/schema.prisma');
  assert.ok(ingest.includes('verifyHvAttribution('));
  assert.ok(ingest.includes("path:['attribution_key']"));
  assert.ok(ingest.includes("referralCode:signed.referralCode"));
  assert.ok(ingest.includes('allowedStorefrontOrigin('));
  assert.ok(ingest.includes('validateVisitorEvent('));
  assert.ok(ingest.includes('prisma.hvVisitorEvent.create'));
  assert.ok(!ingest.includes('prisma.commission.'));
  assert.ok(!ingest.includes('prisma.hvCodOrder.create'));
  assert.ok(report.includes('prisma.hvCodOrder.count'));
  assert.ok(report.includes('prisma.referralClick.count'));
  assert.ok(schema.includes('model HvVisitorEvent'));
  assert.ok(!schema.includes('visitorEmail'));
});
test('dashboard navigation includes role-specific traffic entry points',()=>{
  assert.ok(read('src/app/affiliate/layout.tsx').includes("url: '/affiliate/analytics'"));
  assert.ok(read('src/app/affiliate/layout.tsx').includes("url: '/affiliate/team/traffic'"));
  assert.ok(read('src/app/admin/layout.tsx').includes("url: '/admin/visitor-intelligence'"));
  assert.ok(read('shopify/snippets/hv-affiliate-tracking.liquid').includes('analyticsProcessingAllowed'));
});
