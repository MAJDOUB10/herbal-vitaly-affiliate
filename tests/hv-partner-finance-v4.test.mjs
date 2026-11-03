import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const api=src('src/app/api/affiliate/finance/route.ts');
const ui=src('src/components/finance/PartnerPayoutsV4.tsx');

test('dedicated V4 payout portal uses the original protected partner route',()=>{
  assert.match(src('src/app/affiliate/payouts/page.tsx'),/PartnerPayoutsV4/);
  assert.match(ui,/Commissions & Payouts/);
  assert.match(ui,/HERBAL VITALY \/ PARTNER FINANCE/);
  assert.match(ui,/lg:hidden/);
  assert.match(src('src/app/admin/payouts/page.tsx'),/export default function PayoutsPage/);
});
test('finance API checks trusted partner role, verified active account, affiliate identity',()=>{
  for(const needle of [
    "request.headers.get('x-user-id')",
    "request.headers.get('x-authenticated-role')!=='AFFILIATE'",
    "user.status!=='ACTIVE'","user.emailVerifiedAt",
    'affiliateId=user.affiliate.id',
    "userId:user.id",
  ])assert.ok(api.includes(needle),needle);
  assert.ok(!api.includes("params.get('affiliateId')"));
  assert.doesNotMatch(api,/prisma\.(commission|payout|affiliate)\.(create|update|delete|updateMany|createMany)/);
  assert.doesNotMatch(api,/export async function POST|export async function PUT|export async function DELETE/);
});
test('finance separates EGP-source commissions and currency-unspecified payout records',()=>{
  for(const needle of [
    "conversion:{currency:'EGP'}","conversion:{isNot:{currency:'EGP'}}",
    'nonEgpCommissionCount','recordedBalanceCents','commissionTotals',
    'payoutTotals','COMPLETED','PAID','CLAWBACK',
  ])assert.ok(api.includes(needle),needle);
  assert.match(ui,/commission PAID|commissions marked PAID|Commissions marked PAID/);
  assert.match(ui,/schema does not store currency|no currency field/);
  assert.match(ui,/Recorded affiliate balance/);
  assert.doesNotMatch(ui,/Payouts are processed on the 1st|minimum payout is/);
});
test('finance totals are full filtered server-side aggregates, independently of pages',()=>{
  assert.match(api,/prisma\.commission\.groupBy/);
  assert.match(api,/prisma\.payout\.groupBy/);
  assert.match(api,/prisma\.commission\.count/);
  assert.match(api,/prisma\.payout\.count/);
  assert.match(api,/take:perPage/);
  assert.match(api,/take:1201/);
  assert.match(ui,/Charts use up to 1,200 recent records/);
});
test('read-only finance csv uses owner filters and formula-injection protection',()=>{
  for(const needle of ['ReadableStream','csvSafe','text/csv',
    "if(/^\\s*[=+\\-@\\t\\r]/.test(s))",
    'Content-Disposition','private, no-store','20000',
    'where:whereC','where:whereP',
  ])assert.ok(api.includes(needle),needle);
  assert.match(ui,/new URLSearchParams\(query\)/);
  assert.match(ui,/Export CSV/);
});
test('filtering includes Cairo date periods, commission and payout statuses',()=>{
  for(const needle of ['Africa/Cairo','cairoMidnight','selectedDates',
    'this-month','last-month','CANCELLED','CLAWBACK',
    'PROCESSING','FAILED','sort','perPage'])
    assert.ok(api.includes(needle),needle);
  for(const needle of ['Custom range','Payout history','Commission ledger',
    'Mark','Reference','Rows per page','View commission details',
    'View payout details','Recorded status distribution'])
    assert.ok(ui.includes(needle),needle);
});
