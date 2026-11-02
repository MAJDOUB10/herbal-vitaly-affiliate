import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function financeAdmin(request: NextRequest): Promise<string | null> {
  const id = request.headers.get('x-user-id');
  if (!id || request.headers.get('x-authenticated-role') !== 'ADMIN') return null;
  const user = await prisma.user.findUnique({
    where: { id }, select: { id: true, role: true, status: true },
  });
  return user?.role === 'ADMIN' && user.status === 'ACTIVE' ? user.id : null;
}

export function financeReadOnlyResponse() {
  return NextResponse.json({ error: 'Finance draft editing is disabled until the company accounting database and access checks are verified.' }, { status: 423 });
}
export function financeDraftWriteAllowed(request: NextRequest): boolean {
  if (process.env.HV_FINANCE_SOURCE_DRAFTS_ENABLED !== 'true') return false;
  const origin = request.headers.get('origin');
  // Browser-submitted origin required, no cross-site finance writes.
  if (!origin) return false;
  try {
    const originURL = new URL(origin);
    const requestURL = new URL(request.url);
    return originURL.protocol === 'https:' && originURL.origin === requestURL.origin;
  } catch {
    return false;
  }
}
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
