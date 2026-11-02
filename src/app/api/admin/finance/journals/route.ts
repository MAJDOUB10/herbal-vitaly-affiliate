import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  parseJournalDate, validateBalancedJournal, validateJournalDescription,
} from '@/lib/hv-accounting-journal';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN') return null;
  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { id: true, role: true, status: true },
  });
  return user?.role === 'ADMIN' && user.status === 'ACTIVE' ? user : null;
}

/**
 * PostgreSQL-native accounting module (no external ERP).
 * The database migration is a separate, reviewed step.
 * Posted journals must never be edited or deleted by this API.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (process.env.HV_NATIVE_ACCOUNTING_SCHEMA_READY !== 'true') {
      return NextResponse.json({
        success: true, status: 'NOT_ACTIVATED', journals: [],
        note: 'Native accounting tables and approved opening balances are not yet activated.',
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const rows = await prisma.hvGlJournal.findMany({
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: { lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { lineNumber: 'asc' } } },
    });
    return NextResponse.json({
      success: true, status: 'SCHEMA_READY',
      journals: rows.map(j => ({
        id: j.id, documentNo: j.documentNo, effectiveDate: j.effectiveDate.toISOString().slice(0, 10),
        description: j.description, currency: j.currency, status: j.status, createdAt: j.createdAt,
        postedAt: j.postedAt, lines: j.lines.map(l => ({
          lineNumber: l.lineNumber, accountCode: l.account.code, accountName: l.account.name,
          debitPiasters: l.debitPiasters.toString(), creditPiasters: l.creditPiasters.toString(),
          memo: l.memo,
        })),
      })),
      note: 'Only POSTED entries are included in statutory-style reports; drafts are excluded.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Native accounting journals read failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Journal records unavailable' }, { status: 500 });
  }
}

/**
 * Draft-only staging entry creation. No posting or cash movement is performed.
 * Requires a separate manual migration of accounting tables and approved chart.
 */
export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.HV_NATIVE_ACCOUNTING_SCHEMA_READY !== 'true' ||
      process.env.HV_NATIVE_ACCOUNTING_DRAFTS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Accounting draft writes are disabled outside approved Preview staging' }, { status: 423 });
  }
  try {
    const user = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
    }
    const input = body as Record<string, unknown>;
    const lines = validateBalancedJournal(input.lines);
    const description = validateJournalDescription(input.description);
    const effectiveDate = parseJournalDate(input.effectiveDate);
    const idempotencyKey = input.idempotencyKey;
    if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9:_-]{10,120}$/.test(idempotencyKey)) {
      return NextResponse.json({ error: 'A stable idempotency key (10–120 characters) is required' }, { status: 422 });
    }

    const year = effectiveDate.getUTCFullYear();
    const month = effectiveDate.getUTCMonth() + 1;
    const monthPeriod = await prisma.hvGlPeriod.findUnique({ where: { year_month: { year, month } } });
    if (!monthPeriod || monthPeriod.isClosed) {
      return NextResponse.json({ error: 'Accounting period is missing or closed' }, { status: 409 });
    }

    const codes = [...new Set(lines.map(line => line.accountCode))];
    const accounts = await prisma.hvGlAccount.findMany({
      where: { code: { in: codes }, isActive: true }, select: { id: true, code: true },
    });
    const accountMap = new Map(accounts.map(a => [a.code, a.id]));
    if (accounts.length !== codes.length) {
      return NextResponse.json({ error: 'Some journal accounts are missing or inactive' }, { status: 422 });
    }

    const journal = await prisma.hvGlJournal.create({
      data: {
        documentNo: 'HVJ-' + year + '-' + randomUUID(),
        idempotencyKey, effectiveDate, description, currency: 'EGP',
        status: 'DRAFT', sourceType: 'MANUAL_STAGING',
        createdByUserId: user.id,
        lines: {
          create: lines.map((line, i) => ({
            lineNumber: i + 1, accountId: accountMap.get(line.accountCode)!,
            debitPiasters: BigInt(line.debitPiasters), creditPiasters: BigInt(line.creditPiasters),
            memo: line.memo || null,
          })),
        },
      },
      select: { id: true, documentNo: true, status: true },
    });
    return NextResponse.json({
      success: true, journal, posted: false, moneyMoved: false,
      note: 'Staging draft only. A separate approver and posting review are required.',
    }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Journal') || error.message.includes('journal') ||
      error.message.includes('line') || error.message.includes('date') ||
      error.message.includes('description') || error.message.includes('account')
    )) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Duplicate journal idempotency key or document number' }, { status: 409 });
    }
    console.error('Accounting draft rejected', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Could not create draft journal' }, { status: 500 });
  }
}
