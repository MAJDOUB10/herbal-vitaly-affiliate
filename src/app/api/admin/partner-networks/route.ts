import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const headers = { 'Cache-Control': 'private, no-store' };
async function admin(request: NextRequest) {
  if (request.headers.get('x-authenticated-role') !== 'ADMIN') return null;
  const uid = request.headers.get('x-user-id');
  if (!uid) return null;
  const user = await prisma.user.findUnique({ where: { id: uid },
    select: { id: true, role: true, status: true } });
  return user?.role === 'ADMIN' && user.status === 'ACTIVE' ? user.id : null;
}

export async function GET(request: NextRequest) {
  if (!await admin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const partners = await prisma.affiliate.findMany({
    where: { parentAffiliateId: null }, take: 200, orderBy: { createdAt: 'desc' },
    select: { id: true, isMasterPartner: true, referralCode: true,
      user: { select: { name: true, email: true, status: true, emailVerifiedAt: true } },
      _count: { select: { subPartners: true } } },
  });
  return NextResponse.json({ partners }, { headers });
}

export async function PATCH(request: NextRequest) {
  const actorId = await admin(request);
  if (!actorId) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.affiliateId !== 'string' || body.affiliateId.length > 100 ||
      typeof body.enabled !== 'boolean')
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers });
  const partner = await prisma.affiliate.findUnique({ where: { id: body.affiliateId },
    select: { id: true, parentAffiliateId: true,
      user: { select: { role: true, status: true, emailVerifiedAt: true } } } });
  if (!partner || partner.parentAffiliateId || partner.user.role !== 'AFFILIATE' ||
      (body.enabled && (partner.user.status !== 'ACTIVE' || !partner.user.emailVerifiedAt)))
    return NextResponse.json({ error: 'Partner not eligible' }, { status: 409, headers });
  await prisma.$transaction(async tx => {
    await tx.affiliate.update({ where: { id: body.affiliateId },
      data: { isMasterPartner: body.enabled } });
    await tx.auditLog.create({ data: { actorId, action: 'SET_MASTER_PARTNER',
      objectType: 'AFFILIATE', objectId: body.affiliateId, payload: { enabled: body.enabled } } });
  });
  return NextResponse.json({ success: true }, { headers });
}
