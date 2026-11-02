import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function adminOnly(request: NextRequest): Promise<boolean> {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN') return false;
  const account = await prisma.user.findUnique({
    where: { id: userId }, select: { role: true, status: true },
  });
  return account?.role === 'ADMIN' && account.status === 'ACTIVE';
}

/**
 * Healthcheck verifies the DB actually used by this Vercel deployment.
 * Does not log or expose DATABASE_URL, host, role, project or credentials.
 * It does not enable GL posting or make this ledger statutory-compliant.
 */
export async function GET(request: NextRequest) {
  try {
    if (!await adminOnly(request)) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 403 });
    }
    const [accounts, journals, periods] = await Promise.all([
      prisma.hvGlAccount.count(), prisma.hvGlJournal.count(),
      prisma.hvGlPeriod.count(),
    ]);
    return NextResponse.json({
      success: true,
      ledgerSchemaReachable: true,
      readOnly: process.env.VERCEL_ENV === 'production',
      status: accounts === 0 || periods === 0 ? 'AWAITING_ACCOUNTANT_SETUP' : 'SCHEMA_READY',
      accountsCount: accounts,
      journalsCount: journals,
      periodsCount: periods,
      postingEnabled: false,
      accountingCertified: false,
      message: 'Schema connection verified for this deployment; opening balances, tax mapping and accountant approval are separate.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Native accounting health check failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({
      success: false, ledgerSchemaReachable: false, status: 'DATABASE_NOT_READY',
      postingEnabled: false, accountingCertified: false,
    }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
