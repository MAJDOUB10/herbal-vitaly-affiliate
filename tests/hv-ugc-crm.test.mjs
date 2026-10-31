import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('CRM schema preserves UGC Excel 14 columns and separate Bosta samples',()=>{
 const schema=read('prisma/schema.prisma');
 for(const attr of ['externalId','name','socialUrl','phone','contactStatus','acceptance','qualification','kind','priority','budgetEGP','contentUrl','product','videoConcept','notes']){
   assert.ok(schema.includes(attr),'missing UGC field: '+attr);
 }
 for(const attr of ['trackingNumber','recipientName','governorate','district','deliveryStatus','deliveryType','collectionType','amountEGP','capturedAt','source'])assert.ok(schema.includes(attr),'missing sample delivery field: '+attr);
 assert.match(schema,/model UgcContact \{/);
 assert.match(schema,/model UgcShipment \{/);
 assert.match(schema,/onDelete: SetNull/);
 const sql=read('prisma/migrations/20261031170000_ugc_partner_crm/migration.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS "ugc_contacts"/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS "ugc_shipments"/);
});

test('CRM endpoints require actual authenticated ACTIVE admin, not user-controlled role',()=>{
 const lib=read('src/lib/ugc-crm.ts');
 const contacts=read('src/app/api/admin/ugc-crm/route.ts');
 const shipments=read('src/app/api/admin/ugc-crm/shipments/route.ts');
 const proxy=read('src/proxy.ts');
 assert.match(proxy,/'\/api\/admin\/:path\*'/);
 assert.match(lib,/req\.headers\.get\('x-authenticated-role'\) !== 'ADMIN'/);
 assert.match(lib,/u\.role === 'ADMIN' && u\.status === 'ACTIVE'/);
 assert.match(contacts,/ugcAdmin\(req\)/);
 assert.match(shipments,/ugcAdmin\(req\)/);
 assert.match(contacts,/checkAffiliate/);
 assert.match(contacts,/emailVerifiedAt/);
 assert.match(shipments,/NO_COLLECTION/);
 for(const src of [contacts,shipments])assert.doesNotMatch(src,/prisma\.(commission|payout|hvCodOrder)\.(create|update|delete)/);
});

test('UGC dashboard supports contact management, content status, sample deliveries, and safe CSV export',()=>{
 const page=read('src/app/admin/ugc-crm/page.tsx');
 const nav=read('src/app/admin/layout.tsx');
 assert.match(nav,/Partner CRM \/ UGC/);
 assert.match(page,/Creator Pipeline/);
 assert.match(page,/Sample Deliveries/);
 assert.match(page,/Content production/);
 assert.match(page,/Qualification/);
 assert.match(page,/Video concepts/);
 assert.match(page,/Export CSV/);
 assert.match(page,/Add creator/);
 assert.match(page,/Save record/);
 assert.match(page,/Creator \/ Partner record/);
 assert.match(page,/https:\/\/wa\.me\//);
 assert.match(page,/csvSafe/);
 assert.match(page,/function csvSafe/);
 assert.match(page,/NO_COLLECTION/);
 assert.doesNotMatch(page,/import\.\w+\('fs'\)|process\.env\.DATABASE_URL/);
});
