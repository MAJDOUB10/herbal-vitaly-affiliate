import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  if (request.headers.get('x-authenticated-role') !== 'AFFILIATE')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, affiliate: { select: { id: true } } },
  });
  if (user?.role !== 'AFFILIATE' || user.status !== 'ACTIVE' || !user.affiliate)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const pageRaw = Number(request.nextUrl.searchParams.get('page') || '1');
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 10000 ? pageRaw : 1;
  const where = { beneficiaryAffiliateId: user.affiliate.id };
  const [lines, total] = await Promise.all([
    prisma.hvWeeklyCommissionLine.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 40, skip: (page - 1) * 40,
      select: {
        id: true, sourceOrderName: true, beneficiaryRole: true, amountPiasters: true,
        status: true, reviewedAt: true, paidAt: true, createdAt: true,
        batch: { select: { weekStart: true, weekEnd: true } },
      },
    }),
    prisma.hvWeeklyCommissionLine.count({ where }),
  ]);
  return NextResponse.json({
    success: true, lines, page, total, pages: Math.ceil(total / 40),
    financialStatus: 'REPORT_ONLY_NOT_PAYABLE',
    notice: 'Weekly reports are indicative. VALIDATED does not mean bank payment or balance approval.',
  }, { headers });
}
