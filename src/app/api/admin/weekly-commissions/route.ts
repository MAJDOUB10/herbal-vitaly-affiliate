import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateWeeklyCommissionReport } from '@/lib/hv-weekly-commission-generator';

const headers = { 'Cache-Control': 'private, no-store' };
async function activeAdmin(request: NextRequest) {
  if (request.headers.get('x-authenticated-role') !== 'ADMIN') return null;
  const id = request.headers.get('x-user-id');
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  return user?.role === 'ADMIN' && user.status === 'ACTIVE' ? user.id : null;
}

export async function GET(request: NextRequest) {
  if (!await activeAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const weekStartRaw = request.nextUrl.searchParams.get('weekStart');
  const pageParam = Number(request.nextUrl.searchParams.get('page') || '1');
  const page = Number.isInteger(pageParam) && pageParam >= 1 && pageParam <= 10000 ? pageParam : 1;
  const batches = await prisma.hvWeeklyCommissionBatch.findMany({
    orderBy: { weekStart: 'desc' }, take: 32,
    select: { id: true, weekStart: true, weekEnd: true, createdAt: true,
      _count: { select: { lines: true } } },
  });
  const selectedBatch = weekStartRaw
    ? batches.find(b => b.weekStart.toISOString().slice(0, 10) === weekStartRaw) ??
      await prisma.hvWeeklyCommissionBatch.findUnique({
        where: { weekStart: new Date(/^\d{4}-\d{2}-\d{2}$/.test(weekStartRaw) ? weekStartRaw + 'T00:00:00.000Z' : '1970-01-01T00:00:00.000Z') },
        select: { id: true, weekStart: true, weekEnd: true, createdAt: true,
          _count: { select: { lines: true } } },
      })
    : batches[0];
  const id = selectedBatch?.id;
  const lines = id ? await prisma.hvWeeklyCommissionLine.findMany({
    where: { batchId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    skip: (page - 1) * 50, take: 50,
  }) : [];
  const groups = id ? await prisma.hvWeeklyCommissionLine.groupBy({
    by: ['status'], where: { batchId: id },
    _sum: { amountPiasters: true }, _count: { _all: true },
  }) : [];
  const total = id ? await prisma.hvWeeklyCommissionLine.count({ where: { batchId: id } }) : 0;

  const affiliateIds = [...new Set(lines.map(line => line.beneficiaryAffiliateId))];
  const affiliates = affiliateIds.length ? await prisma.affiliate.findMany({
    where: { id: { in: affiliateIds } },
    select: { id: true, referralCode: true, user: { select: { name: true } } },
  }) : [];
  const names = new Map(affiliates.map(a => [a.id, a]));
  return NextResponse.json({
    batches: batches.map(b => ({ ...b, lineCount: b._count.lines })),
    selectedWeek: selectedBatch?.weekStart.toISOString().slice(0, 10) || null,
    page, pageSize: 50, total, pages: Math.ceil(total / 50),
    totals: groups.map(g => ({ status: g.status, count: g._count._all, amountPiasters: g._sum.amountPiasters ?? 0 })),
    lines: lines.map(l => ({
      ...l, partnerName: names.get(l.beneficiaryAffiliateId)?.user.name || 'Unknown',
      referralCode: names.get(l.beneficiaryAffiliateId)?.referralCode || null,
    })),
    paymentRecordingEnabled: false,
    financialStatus: 'REPORT_ONLY_NOT_PAYABLE',
  }, { headers });
}

/** Generate an idempotent draft for a closed UTC week. No payments or balance changes. */
export async function POST(request: NextRequest) {
  const actorId = await activeAdmin(request);
  if (!actorId) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const body = await request.json().catch(() => null);
  if (!body || (body.weekStart !== undefined && typeof body.weekStart !== 'string'))
    return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400, headers });
  try {
    const summary = await generateWeeklyCommissionReport(body.weekStart, actorId);
    return NextResponse.json({ success: true, ...summary }, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unable to generate weekly report';
    if (/Week |week |More than/.test(message))
      return NextResponse.json({ error: message }, { status: 422, headers });
    console.error('Weekly commission generator failed', e);
    return NextResponse.json({ error: 'Generation failed; check report schema migration and COD data' },
      { status: 500, headers });
  }
}
