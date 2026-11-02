import test from 'node:test';
import assert from 'node:assert/strict';
import { safeIntegerMoney, safeShortText, safeDocumentDate } from '../src/lib/hv-finance-validation.ts';
import { readFileSync } from 'node:fs';

test('finance documents enforce integer EGP piasters without floating point', () => {
  assert.equal(safeIntegerMoney(123456), 123456);
  assert.equal(safeIntegerMoney(0,true), 0);
  for (const v of [-1, 1.25, Number.MAX_SAFE_INTEGER+1, '100', null]) {
    assert.throws(() => safeIntegerMoney(v,true), /Money must be/);
  }
  assert.throws(() => safeIntegerMoney(0), /Money must be/);
});

test('supplier identities are bounded and strings are trimmed', () => {
  assert.equal(safeShortText('  Supplier A  ', 2, 200, 'Name'),'Supplier A');
  assert.throws(() => safeShortText('  ', 2, 200, 'Name'), /Name must be/);
  assert.throws(() => safeShortText('X'.repeat(201), 2, 200, 'Name'), /Name must be/);
});

test('finance dates reject invalid leap days and ambiguous local dates', () => {
  assert.equal(safeDocumentDate('2026-11-02').toISOString().slice(0,10), '2026-11-02');
  assert.throws(() => safeDocumentDate('2026-02-30'), /Invalid document date/);
  assert.throws(() => safeDocumentDate('11/02/2026'), /Expected ISO/);
});

test('finance documents and counterparties do not change affiliate commissions or COD balances', () => {
  const documents = readFileSync('src/app/api/admin/finance/documents/route.ts','utf8');
  const parties = readFileSync('src/app/api/admin/finance/parties/route.ts','utf8');
  assert.match(documents, /status: 'DRAFT'/);
  assert.match(documents, /posted: false/);
  assert.match(documents, /submittedToETA: false/);
  assert.match(documents, /moneyMoved: false/);
  assert.doesNotMatch(documents+parties, /prisma\.(?:payout|commission|hvCodOrder)\.(?:update|create|delete)/);
});

test('finance writes stay locked behind explicit flag and same-origin browser request', () => {
  const guards=readFileSync('src/lib/hv-finance-documents.ts','utf8');
  assert.match(guards, /HV_FINANCE_SOURCE_DRAFTS_ENABLED/);
  assert.match(guards, /originURL\.origin === requestURL\.origin/);
});

test('accounting reports are derived from posted journals, not gross Shopify order value', () => {
  const source=readFileSync('src/app/api/admin/finance/reports/route.ts','utf8');
  assert.match(source, /status: 'POSTED'/);
  assert.match(source, /certifiable = false/);
  assert.doesNotMatch(source, /orderTotalPiasters/);
});
