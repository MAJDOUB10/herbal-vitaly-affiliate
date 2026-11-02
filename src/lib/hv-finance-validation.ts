/**
 * Pure validation helpers for provisional company-finance source documents.
 * Persist only integer EGP piasters. These values are NOT tax determinations.
 */
export function safeIntegerMoney(amount: unknown, allowZero = false): number {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0 ||
    (!allowZero && amount === 0)) throw new Error('Money must be a safe non-negative integer in EGP piasters');
  return amount;
}

export function safeShortText(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new Error(label + ' must be ' + min + ' to ' + max + ' characters');
  }
  return value.trim();
}

export function safeDocumentDate(raw: unknown): Date {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Expected ISO date YYYY-MM-DD');
  const date = new Date(raw + 'T00:00:00.000Z');
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0,10) !== raw) throw new Error('Invalid document date');
  return date;
}
