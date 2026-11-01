import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NO_STORE, supportActor, supportRecord, supportStatus } from '@/lib/hv-support';

export async function GET(request: NextRequest) {
  const admin = await supportActor(request, 'ADMIN');
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const desiredStatus = request.nextUrl.searchParams.get('status');
  const status = desiredStatus ? supportStatus(desiredStatus) : null;
  if (desiredStatus && !status)
    return NextResponse.json({ error: 'Invalid support status' }, { status: 422 });
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { name:true,email:true } },
        _count: { select: { messages:true } } },
      orderBy: { lastMessageAt:'desc' },
      take:250,
    });
    const counts = await prisma.supportTicket.groupBy({ by:['status'], _count: { _all:true } });
    return NextResponse.json({ success:true,
      tickets: tickets.map(t => ({ ...supportRecord(t),messageCount:t._count.messages })),
      counts: Object.fromEntries(counts.map(c => [c.status,c._count._all])),
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Unable to load support queue' }, { status:503 });
  }
}
