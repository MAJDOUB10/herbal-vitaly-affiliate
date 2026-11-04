import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Scoped to the signed ADMIN session authenticated by src/proxy.ts.
export async function GET(request: NextRequest) {
  const actorId = request.headers.get('x-user-id');
  if (!actorId || request.headers.get('x-authenticated-role') !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const actor = await prisma.user.findUnique({
    where: { id: actorId }, select: { role: true, status: true },
  });
  if (actor?.role !== 'ADMIN' || actor.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const partners = await prisma.affiliate.findMany({
    where: { user: { role: 'AFFILIATE', status: 'ACTIVE', emailVerifiedAt: { not: null } } },
    select: { id: true, referralCode: true, user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }, take: 500,
  });
  return NextResponse.json({
    success: true,
    partners: partners.map(p => ({ id: p.id, referralCode: p.referralCode, name: p.user.name })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
