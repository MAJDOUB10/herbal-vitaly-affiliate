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
export { safeIntegerMoney, safeShortText, safeDocumentDate } from './hv-finance-validation';
