import test from 'node:test';
import assert from 'node:assert/strict';
import { lastClosedWeekStart, parseClosedWeek, allocateWeeklyPool, isWeeklyEligible, isWeeklyTransitionAllowed } from '../src/lib/hv-weekly-commissions.ts';
import { readFileSync } from 'node:fs';

test('closed Monday UTC weeks are deterministic; current week cannot be generated', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  assert.equal(lastClosedWeekStart(now).toISOString(), '2026-11-02T00:00:00.000Z');
  const { weekStart, weekEnd } = parseClosedWeek('2026-11-02', now);
  assert.equal(weekEnd.toISOString(), '2026-11-09T00:00:00.000Z');
  assert.equal(weekStart.toISOString(), '2026-11-02T00:00:00.000Z');
  for (const w of ['2026-11-09','2026-11-03','2026-02-30','garbage']) {
    assert.throws(() => parseClosedWeek(w, now));
  }
});

test('weekly pool shares: direct 20% of pool and Master / child 4%-16% example', () => {
  assert.deepEqual(allocateWeeklyPool(20000, 'child', 'master', 2000), [
    { beneficiaryAffiliateId:'child', beneficiaryRole:'SUB_PARTNER', amountPiasters:4000, shareBps:2000 },
    { beneficiaryAffiliateId:'master', beneficiaryRole:'MASTER_PARTNER', amountPiasters:16000, shareBps:8000 },
  ]);
  assert.deepEqual(allocateWeeklyPool(20000,'direct',null,0), [
    { beneficiaryAffiliateId:'direct', beneficiaryRole:'DIRECT', amountPiasters:20000, shareBps:10000 },
  ]);
  for (const p of [0,1,17,20000,99999]) for (const s of [0,1,2000,5000,9999,10000]) {
    if (!p) continue;
    const rows=allocateWeeklyPool(p,'a','b',s);
    assert.equal(rows.reduce((sum,row)=>sum+row.amountPiasters,0),p);
  }
});

test('COD weekly candidates must be reconciled, attributed, funded and within settled week', () => {
  const start=new Date('2026-11-02Z'),end=new Date('2026-11-09Z');
  const order={
    currency:'EGP', isCod:true,delivered:true,courierCollected:true,merchantReconciled:true,
    cancelled:false,refunded:false,collectedPiasters:100000,orderTotalPiasters:100000,
    subtotalPiasters:100000,commissionPreviewPiasters:20000,referralCode:'ABC',
    affiliateId:'aff',attributionSource:'PROMO_CODE',
    merchantSettlementReference:'REM-123456',merchantSettledAt:new Date('2026-11-03Z')
  };
  assert.equal(isWeeklyEligible(order,start,end),true);
  for(const patch of [{refunded:true},{cancelled:true},{merchantReconciled:false},
    {collectedPiasters:0},{merchantSettlementReference:null},{merchantSettledAt:null},
    {attributionSource:'UNVERIFIED'},{commissionPreviewPiasters:30000},
    {merchantSettledAt:new Date('2026-11-09Z')}]) {
    assert.equal(isWeeklyEligible({...order,...patch},start,end),false);
  }
});

test('paid rows remain immutable and validation cannot be repeated',()=>{
  for (const action of ['EDIT','VALIDATE','CANCEL','MARK_PAID']) {
    assert.equal(isWeeklyTransitionAllowed('PAID',action),false);
  }
  assert.equal(isWeeklyTransitionAllowed('DRAFT','VALIDATE'),true);
  assert.equal(isWeeklyTransitionAllowed('VALIDATED','MARK_PAID'),true);
  assert.equal(isWeeklyTransitionAllowed('VALIDATED','EDIT'),false);
});

test('weekly workflow is isolated from legacy payout and balance writes', () => {
  for (const p of ['src/app/api/admin/weekly-commissions/route.ts',
    'src/app/api/admin/weekly-commissions/lines/route.ts',
    'src/lib/hv-weekly-commission-generator.ts']) {
    const text=readFileSync(new URL('../'+p,import.meta.url),'utf8');
    assert.doesNotMatch(text,/\.payout\.create|\.commission\.create|balanceCents:|teamCommissionSplit\.create/);
  }
});
