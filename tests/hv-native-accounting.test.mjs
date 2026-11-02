import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBalancedJournal,
  parseJournalDate,
  validateJournalDescription,
} from '../src/lib/hv-accounting-journal.ts';

const balanced = [
  { accountCode: '1101', debitPiasters: 5000, creditPiasters: 0 },
  { accountCode: '4101', debitPiasters: 0, creditPiasters: 5000 },
];

test('balanced EGP journal validates without money rounding', () => {
  const lines = validateBalancedJournal(balanced);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].debitPiasters, 5000);
});

test('unbalanced and one-sided journals are rejected', () => {
  assert.throws(() => validateBalancedJournal([{ ...balanced[0] }, { ...balanced[1], creditPiasters: 4999 }]), /balance/);
  assert.throws(() => validateBalancedJournal([{ ...balanced[0], creditPiasters: 5000 }, balanced[1]]), /exactly one/);
  assert.throws(() => validateBalancedJournal([{ ...balanced[0], debitPiasters: 0 }, balanced[1]]), /exactly one/);
});

test('unsafe, fractional and negative money values are rejected', () => {
  for (const n of [-1, 10.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateBalancedJournal([{ ...balanced[0], debitPiasters: n }, balanced[1]]));
  }
});

test('journal input must include valid accounts and at least two lines', () => {
  assert.throws(() => validateBalancedJournal([balanced[0]]), /between 2 and 200/);
  assert.throws(() => validateBalancedJournal([{ ...balanced[0], accountCode: '!' }, balanced[1]]), /account code/);
});

test('accounting date parser rejects invalid and nonexistent dates', () => {
  assert.equal(parseJournalDate('2026-11-02').toISOString(), '2026-11-02T00:00:00.000Z');
  assert.throws(() => parseJournalDate('2026-02-30'), /Invalid accounting date/);
  assert.throws(() => parseJournalDate('02/11/2026'), /YYYY-MM-DD/);
});

test('journal descriptions must be substantive but concise', () => {
  assert.equal(validateJournalDescription(' Supplier bill '), 'Supplier bill');
  assert.throws(() => validateJournalDescription(' '), /length/);
});
