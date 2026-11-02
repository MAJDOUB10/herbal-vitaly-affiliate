/**
 * Monetary validation for Herbal Vitaly's native double-entry journals.
 * EGP amounts are transported as integer piasters (never floating point money).
 * A validated draft is not an approved or posted financial transaction.
 */
export type HvJournalLineInput = {
  accountCode: string;
  debitPiasters: number;
  creditPiasters: number;
  memo?: string;
};

const ACCOUNT_CODE = /^[A-Za-z0-9._-]{2,32}$/;
const MAX_LINES = 200;

export function validateBalancedJournal(input: unknown): HvJournalLineInput[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > MAX_LINES) {
    throw new Error('A journal must have between 2 and 200 lines');
  }
  const normalized = input.map((raw: unknown, index): HvJournalLineInput => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Invalid journal line ' + (index + 1));
    }
    const line = raw as Record<string, unknown>;
    const accountCode = typeof line.accountCode === 'string' ? line.accountCode.trim() : '';
    if (!ACCOUNT_CODE.test(accountCode)) {
      throw new Error('Invalid account code at line ' + (index + 1));
    }
    const debit = line.debitPiasters;
    const credit = line.creditPiasters;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) ||
        typeof debit !== 'number' || typeof credit !== 'number' ||
        debit < 0 || credit < 0 ||
        (debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
      throw new Error('Each line needs exactly one positive debit or credit, in integer piasters');
    }
    const memo = typeof line.memo === 'string' ? line.memo.trim() : '';
    if (memo.length > 500) throw new Error('Line memo too long');
    return { accountCode, debitPiasters: debit, creditPiasters: credit, memo };
  });
  const debits = normalized.reduce((sum, line) => sum + BigInt(line.debitPiasters), 0n);
  const credits = normalized.reduce((sum, line) => sum + BigInt(line.creditPiasters), 0n);
  if (debits <= 0n || debits !== credits) throw new Error('Journal debits and credits must balance');
  return normalized;
}

export function parseJournalDate(raw: unknown): Date {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error('Accounting date must use YYYY-MM-DD');
  }
  const date = new Date(raw + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    throw new Error('Invalid accounting date');
  }
  return date;
}

export function validateJournalDescription(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('Journal description is required');
  const description = raw.trim();
  if (description.length < 3 || description.length > 500) {
    throw new Error('Journal description length must be 3–500 characters');
  }
  return description;
}
