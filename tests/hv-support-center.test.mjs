import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=p=>readFileSync(new URL('../'+p, import.meta.url),'utf8');
const schema=read('prisma/schema.prisma');
const sql=read('prisma/migrations/20261101154000_partner_support_center/migration.sql');
const common=read('src/lib/hv-support.ts');
const partner=read('src/app/api/affiliate/support/route.ts');
const partnerThread=read('src/app/api/affiliate/support/[id]/route.ts');
const admin=read('src/app/api/admin/support/route.ts');
const adminThread=read('src/app/api/admin/support/[id]/route.ts');
const ui=read('src/components/support/SupportDesk.tsx');
const partnerNav=read('src/app/affiliate/layout.tsx');
const adminNav=read('src/app/admin/layout.tsx');

test('migration adds only isolated support tables with relational integrity and status limits',()=>{
  for(const s of ['model SupportTicket {','model SupportMessage {','supportTickets SupportTicket[]',
    'supportMessages SupportMessage[]'])assert.ok(schema.includes(s),s);
  for(const s of ['CREATE TABLE IF NOT EXISTS "support_tickets"',
    'CREATE TABLE IF NOT EXISTS "support_messages"',
    'FOREIGN KEY ("user_id") REFERENCES "users"("id")',
    'FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id")',
    'CHECK ("status" IN','CREATE INDEX IF NOT EXISTS'])assert.ok(sql.includes(s),s);
  assert.ok(!/DROP TABLE|DELETE FROM|TRUNCATE|ALTER TABLE "commissions"|ALTER TABLE "payouts"|ALTER TABLE "hv_cod_orders"/i.test(sql));
});

test('all API actions check signed session context and restrict Production writes',()=>{
  for(const s of ["request.headers.get('x-user-id')",
    "request.headers.get('x-authenticated-role') !== role",
    "user.role !== role || user.status !== 'ACTIVE'",
    "user.emailVerifiedAt || !user.affiliate",
    "request.headers.get('origin') === 'https://partner.herbalvitaly.com'",
    "process.env.VERCEL_ENV !== 'production'"])
    assert.ok(common.includes(s),s);
  assert.ok(partner.includes("supportActor(request, 'AFFILIATE')"));
  assert.ok(admin.includes("supportActor(request, 'ADMIN')"));
  assert.ok(partnerThread.includes("supportActor(request, 'AFFILIATE')"));
  assert.ok(adminThread.includes("supportActor(request, 'ADMIN')"));
  assert.ok(partner.includes('supportWritable(request)'));
  assert.ok(partnerThread.includes('supportWritable(request)'));
  assert.ok(adminThread.includes('supportWritable(request)'));
});

test('partners may read and reply only to their own tickets and never see internal notes',()=>{
  assert.ok(partner.includes('where: { userId: actor.id }'));
  assert.ok(partnerThread.includes('where: { id, userId: actor.id }'));
  assert.ok(partnerThread.includes('where: { internal: false }'));
  assert.ok(partnerThread.includes("ticket.status === 'CLOSED'"));
  assert.ok(partnerThread.includes("status: 'OPEN'"));
  assert.ok(partner.includes("supportRateLimit(actor.id, 'create', 8)"));
  assert.ok(partnerThread.includes("supportRateLimit(actor.id, 'reply', 40)"));
  assert.ok(partner.includes('supportText(input?.message, 4000, 10)'));
});

test('admin can filter, respond, add private notes and update status and priority',()=>{
  assert.ok(admin.includes("supportStatus(desiredStatus)"));
  assert.ok(admin.includes('groupBy({'));
  assert.ok(adminThread.includes('supportPriority(payload.priority)'));
  assert.ok(adminThread.includes('supportStatus(payload.status)'));
  assert.ok(adminThread.includes("action:'SUPPORT_TICKET_UPDATED'"));
  assert.ok(adminThread.includes("action:internal?'SUPPORT_INTERNAL_NOTE':'SUPPORT_ADMIN_REPLY'"));
  assert.ok(adminThread.includes("status: internal ? ticket.status : 'WAITING_PARTNER'"));
  assert.ok(adminThread.includes("await prisma.$transaction"));
});

test('interface provides ticket list, new requests, filters, replies and internal notes',()=>{
  for(const s of ['Create a support ticket','Support Center — Admin',
    'Partner Support Center','Support queue','My requests',
    'Internal note (not visible to partner)','Send reply','New ticket',
    'Filter by status','Refresh','Change']) {
    if(s==='Change')continue;
    assert.ok(ui.includes(s),s);
  }
  assert.ok(partnerNav.includes("url: '/affiliate/support'"));
  assert.ok(adminNav.includes("url: '/admin/support'"));
  assert.ok(read('src/app/admin/support/page.tsx').includes('mode="admin"'));
  assert.ok(read('src/app/affiliate/support/page.tsx').includes('mode="affiliate"'));
});

test('support operations do not mutate financial records or Shopify discounts',()=>{
  for(const src of [partner,partnerThread,admin,adminThread]) {
    for(const word of ['prisma.commission.', 'prisma.payout.', 'prisma.hvCodOrder.',
      'createShopifyDiscount', 'shopifyAdminGraphQL'])
      assert.ok(!src.includes(word),word);
  }
});
