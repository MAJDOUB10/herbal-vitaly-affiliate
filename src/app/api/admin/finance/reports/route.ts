import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
const accountTypes = new Set<AccountType>(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 403 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }, select: { role: true, status: true },
    });
    if (user?.role !== 'ADMIN' || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw = request.nextUrl.searchParams.get('asOf');
    const asOf = raw || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) ||
        Number.isNaN(Date.parse(asOf + 'T00:00:00.000Z')) ||
        new Date(asOf + 'T00:00:00.000Z').toISOString().slice(0,10) !== asOf) {
      return NextResponse.json({ error: 'Invalid asOf date' }, { status: 422 });
    }
    // Upper bound exclusive for DATE columns; do not depend on local timezone.
    const dayAfter = new Date(Date.parse(asOf + 'T00:00:00.000Z') + 86400000);
    const [accounts, totals, postedCount, periodCount] = await Promise.all([
      prisma.hvGlAccount.findMany({ select: { id: true, code: true, name: true, accountType: true }, orderBy: { code: 'asc' } }),
      prisma.hvGlLine.groupBy({
        by: ['accountId'],
        where: { journal: { status: 'POSTED', effectiveDate: { lt: dayAfter } } },
        _sum: { debitPiasters: true, creditPiasters: true },
      }),
      prisma.hvGlJournal.count({ where: { status: 'POSTED', effectiveDate: { lt: dayAfter } } }),
      prisma.hvGlPeriod.count(),
    ]);
    const byId = new Map(totals.map(t => [t.accountId, t]));
    let totalDebits = BigInt(0), totalCredits = BigInt(0);
    let assets = BigInt(0), liabilities = BigInt(0), equity = BigInt(0),
      revenue = BigInt(0), expenses = BigInt(0);
    const unknownTypes: string[] = [];
    const trialBalance = accounts.map(account => {
      const sums = byId.get(account.id)?._sum;
      const debit = sums?.debitPiasters ?? BigInt(0);
      const credit = sums?.creditPiasters ?? BigInt(0);
      totalDebits += debit; totalCredits += credit;
      const kind = account.accountType as AccountType;
      if (!accountTypes.has(kind)) unknownTypes.push(account.code);
      else if (kind === 'ASSET') assets += debit - credit;
      else if (kind === 'LIABILITY') liabilities += credit - debit;
      else if (kind === 'EQUITY') equity += credit - debit;
      else if (kind === 'REVENUE') revenue += credit - debit;
      else expenses += debit - credit;
      return {
        code: account.code, name: account.name, type: kind,
        debitPiasters: debit.toString(), creditPiasters: credit.toString(),
        netDebitPiasters: (debit - credit).toString(),
      };
    });
    const balanced = totalDebits === totalCredits;
    const profit = revenue - expenses;
    const balanceSheetDifference = assets - (liabilities + equity + profit);
    const certifiable = false; // Requires independent opening balance, tax, stock and period sign-off.
    return NextResponse.json({
      success: true, currency: 'EGP', asOf,
      status: accounts.length > 0 && periodCount > 0 && postedCount > 0 ? 'UNCERTIFIED_LEDGER_DATA' : 'AWAITING_ACCOUNTANT_SETUP',
      certified: certifiable,
      postedJournalCount: postedCount, accountsCount: accounts.length,
      journalDebitsPiasters: totalDebits.toString(),
      journalCreditsPiasters: totalCredits.toString(),
      trialBalanceBalanced: balanced,
      unknownAccountTypes: unknownTypes,
      trialBalance,
      indicative: postedCount > 0 && balanced && unknownTypes.length === 0 ? {
        assetsPiasters: assets.toString(), liabilitiesPiasters: liabilities.toString(),
        equityPiasters: equity.toString(), revenueToDatePiasters: revenue.toString(),
        expensesToDatePiasters: expenses.toString(), profitToDatePiasters: profit.toString(),
        balanceSheetDifferencePiasters: balanceSheetDifference.toString(),
      } : null,
      limitations: [
        'Posted journals only, not Shopify order totals.',
        'This is cumulative since ledger inception, not a fiscal-year P&L.',
        'No certified opening balances, taxes, bank statements, supplier bills or inventory COGS.',
        'No statutory statements or tax filing available until accountant validation.',
      ],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Accounting reports unavailable', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: 'General-ledger reporting unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
