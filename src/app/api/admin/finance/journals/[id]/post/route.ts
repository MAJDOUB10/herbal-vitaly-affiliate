import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

class PostingError extends Error {
  constructor(message: string, readonly statusCode: number) { super(message); }
}

/**
 * Staging-only, two-person journal posting. This action ONLY changes native
 * ledger entries; it does not change Shopify orders, Bosta COD or affiliate
 * payouts, nor does it execute a bank transfer.
 *
 * Production posting is intentionally disabled pending approved accounting
 * policy, migration, tax classification and accountant sign-off.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.HV_NATIVE_ACCOUNTING_SCHEMA_READY !== 'true' ||
      process.env.HV_NATIVE_ACCOUNTING_STAGING_DATABASE_VERIFIED !== 'true' ||
      process.env.HV_NATIVE_ACCOUNTING_POSTING_ENABLED !== 'true') {
    return NextResponse.json({
      error: 'Accounting posting is locked until a verified isolated staging environment and two-person approval are configured',
    }, { status: 423 });
  }
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }, select: { id: true, role: true, status: true },
    });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid journal ID' }, { status: 422 });
    }

    const result = await prisma.$transaction(async tx => {
      const j = await tx.hvGlJournal.findUnique({
        where: { id }, include: { lines: { include: { account: true } } },
      });
      if (!j) throw new PostingError('Journal not found', 404);
      if (j.status !== 'DRAFT' || j.postedAt) {
        throw new PostingError('Only unposted draft journals are eligible', 409);
      }
      if (j.createdByUserId === user.id) {
        throw new PostingError('A different finance approver must post this journal', 403);
      }
      if (j.currency !== 'EGP' || j.lines.length < 2) {
        throw new PostingError('Invalid journal currency or number of lines', 422);
      }
      const year = j.effectiveDate.getUTCFullYear();
      const month = j.effectiveDate.getUTCMonth() + 1;
      const period = await tx.hvGlPeriod.findUnique({ where: { year_month: { year, month } } });
      if (!period || period.isClosed) throw new PostingError('Period is absent or closed', 409);

      let totalDebits = BigInt(0), totalCredits = BigInt(0);
      for (const line of j.lines) {
        if (!line.account.isActive || line.debitPiasters < BigInt(0) || line.creditPiasters < BigInt(0) ||
          (line.debitPiasters === BigInt(0) && line.creditPiasters === BigInt(0)) ||
          (line.debitPiasters > BigInt(0) && line.creditPiasters > BigInt(0))) {
          throw new PostingError('Inactive account or invalid debit/credit line', 422);
        }
        totalDebits += line.debitPiasters;
        totalCredits += line.creditPiasters;
      }
      if (totalDebits === BigInt(0) || totalDebits !== totalCredits) {
        throw new PostingError('Unbalanced journal cannot be posted', 422);
      }
      const changed = await tx.hvGlJournal.updateMany({
        where: { id, status: 'DRAFT', postedAt: null },
        data: { status: 'POSTED', postedAt: new Date(), postedByUserId: user.id },
      });
      if (changed.count !== 1) throw new PostingError('Concurrent journal posting rejected', 409);
      return { id: j.id, documentNo: j.documentNo, status: 'POSTED', totalDebitsPiasters: totalDebits.toString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({
      success: true, journal: result, moneyMoved: false, taxFiled: false,
      note: 'Staging ledger journal posted; no physical bank movement was performed.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof PostingError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Staging ledger posting failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Journal posting failed' }, { status: 500 });
  }
}
