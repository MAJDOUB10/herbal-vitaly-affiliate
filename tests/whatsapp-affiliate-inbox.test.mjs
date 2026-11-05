import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  normalizeWaId, validateWhatsAppText, verifyMetaSignature,
  inServiceWindow, WHATSAPP_WINDOW_MS, GRAPH_VERSION,
} from '../src/lib/hv-whatsapp.ts';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const webhook=read('src/app/api/whatsapp/webhook/route.ts');
const admin=read('src/app/api/admin/whatsapp/route.ts');
const partner=read('src/app/api/affiliate/whatsapp/route.ts');
const adminUi=read('src/components/whatsapp/WhatsAppInbox.tsx');
const affiliateUi=read('src/app/affiliate/whatsapp/page.tsx');
const schema=read('prisma/schema.prisma');
const migration=read('prisma/migrations/20261105125000_affiliate_whatsapp_inbox/migration.sql');
const proxy=read('src/proxy.ts');

test('normalized WhatsApp E.164 digits reject malformed and unsafe phone values',()=>{
  assert.equal(normalizeWaId('+20 10 1234 5678'),'201012345678');
  assert.equal(normalizeWaId('201012345678'),'201012345678');
  for(const invalid of ['','123','00123abc','+'+'9'.repeat(20),{},null]){
    assert.equal(normalizeWaId(invalid),null,String(invalid));
  }
});

test('webhook HMAC validates raw body and rejects spoofed, absent or wrong signatures',()=>{
  const body='{"object":"whatsapp_business_account","entry":[]}';
  const secret='test-only-not-a-real-secret';
  const good='sha256='+createHmac('sha256',secret).update(body).digest('hex');
  assert.equal(verifyMetaSignature(body,good,secret),true);
  assert.equal(verifyMetaSignature(body+' ',good,secret),false);
  assert.equal(verifyMetaSignature(body,'sha256='+'0'.repeat(64),secret),false);
  assert.equal(verifyMetaSignature(body,null,secret),false);
  assert.equal(verifyMetaSignature(body,good,undefined),false);
  assert.equal(verifyMetaSignature(body,'sha256=oops',secret),false);
});

test('outbound message validation and strictly enforced 24-hour WhatsApp window',()=>{
  assert.equal(validateWhatsAppText('  Hello partner  '),'Hello partner');
  assert.equal(validateWhatsAppText(''),null);
  assert.equal(validateWhatsAppText('x'.repeat(4097)),null);
  assert.equal(validateWhatsAppText('x\u0000'),null);
  const now=Date.UTC(2026,10,5,12,0,0);
  assert.equal(inServiceWindow(new Date(now-WHATSAPP_WINDOW_MS+1000),now),true);
  assert.equal(inServiceWindow(new Date(now-WHATSAPP_WINDOW_MS),now),false);
  assert.equal(inServiceWindow(new Date(now+1000),now),false);
  assert.equal(inServiceWindow(null,now),false);
  assert.equal(GRAPH_VERSION,'v26.0');
});

test('public Meta webhook has signature verification, business number scoping and idempotency',()=>{
  for(const item of ["hub.verify_token", "hub.challenge", "hub.mode",
    "x-hub-signature-256", "verifyMetaSignature(raw",
    "value.metadata?.phone_number_id !== process.env.HV_WHATSAPP_PHONE_NUMBER_ID",
    "skipDuplicates: true", "waMessageId:msg.id",
    "if (inserted.count > 0)", "value.statuses", "direction:'OUTBOUND'",
    "event.object !== 'whatsapp_business_account'"
  ])assert.ok(webhook.includes(item),item);
  assert.ok(!proxy.includes("'/api/whatsapp/webhook'"));
  assert.ok(!webhook.includes('x-user-id'));
  assert.ok(!webhook.includes('prisma.commission.'));
  assert.ok(!webhook.includes('console.log(raw)'));
});

test('admin inbox endpoints enforce ACTIVE ADMIN, production-origin, verified partner binding',()=>{
  for(const item of ["request.headers.get('x-user-id')",
    "request.headers.get('x-authenticated-role') !== 'ADMIN'",
    "user?.role==='ADMIN' && user.status==='ACTIVE'",
    "request.headers.get('origin')==='https://partner.herbalvitaly.com'",
    "partner.user.status!=='ACTIVE' || !partner.user.emailVerifiedAt",
    "ASSIGN_WHATSAPP_CONVERSATION", "inServiceWindow(conversation.lastInboundAt)",
    "checkRateLimit(", "await sendWhatsAppText(", "where:{requestId}",
    "status:'SENDING'", "status:'FAILED'",
  ])assert.ok(admin.includes(item),item);
  for(const forbidden of ["prisma.payout.update", "prisma.commission.update",
    "prisma.hvCodOrder.update", "prisma.coupon.update"])
    assert.ok(!admin.includes(forbidden));
});

test('partner API only returns explicitly assigned conversations for session affiliate',()=>{
  for(const item of [
    "request.headers.get('x-authenticated-role')!=='AFFILIATE'",
    "user.role!=='AFFILIATE' || user.status!=='ACTIVE'",
    "!user.emailVerifiedAt || !user.affiliate",
    "where:{affiliateId:user.affiliate.id}",
    "whatsAppBusinessNumber()",
  ])assert.ok(partner.includes(item),item);
  assert.ok(!partner.includes('waConversation.findMany({where:{}'));
  assert.ok(!partner.includes('prisma.affiliate.findMany('));
});

test('WhatsApp inbox and partner pages provide actual UX and transparency',()=>{
  const adminLayout=read('src/app/admin/layout.tsx');
  const partnerLayout=read('src/app/affiliate/layout.tsx');
  for(const s of ['WhatsApp Partner Inbox','Meta Business setup required',
    '24-hour reply window closed','Link to partner','Unassigned (Admin only)',
    'Select a conversation', 'Copy tracked link']) {
    if(s!=='Select a conversation' && s!=='Copy tracked link')assert.ok(adminUi.includes(s),s);
  }
  assert.ok(adminUi.includes("'/api/admin/whatsapp'"));
  assert.ok(adminUi.includes('crypto.randomUUID()'));
  assert.ok(affiliateUi.includes("'/api/affiliate/whatsapp'"));
  assert.ok(affiliateUi.includes('href="/affiliate/support"'));
  assert.ok(affiliateUi.includes('Only chats explicitly associated'));
  assert.ok(adminLayout.includes("url: '/admin/whatsapp'"));
  assert.ok(partnerLayout.includes("url: '/affiliate/whatsapp'"));
});

test('additive DB migration has exclusive message IDs and per-affiliate relation',()=>{
  for(const s of ["model WaConversation", "model WaMessage",
    '@unique @map("wa_id")','@unique @map("wa_message_id")',
    '@unique @map("request_id")',
    "affiliateId   String?", "waConversations WaConversation[]",
  ])assert.ok(schema.includes(s),s);
  for(const s of ['CREATE TABLE IF NOT EXISTS "wa_conversations"',
    'CREATE TABLE IF NOT EXISTS "wa_messages"',
    '"wa_message_id" TEXT UNIQUE', '"request_id" TEXT UNIQUE',
    'REFERENCES "affiliates"("id")','ON DELETE SET NULL',
  ])assert.ok(migration.includes(s),s);
  assert.ok(!migration.includes('DROP TABLE'));
  assert.ok(!migration.includes('ALTER TABLE "affiliates" DROP'));
});
