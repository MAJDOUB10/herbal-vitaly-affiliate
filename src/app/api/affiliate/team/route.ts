import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedMaster } from '@/lib/team-network-auth';

const headers = { 'Cache-Control': 'private, no-store' };
const verified = ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'];
export async function GET(request: NextRequest) {
  const master = await authenticatedMaster(request);
  if (!master) return NextResponse.json({ error: 'Master Partner access required' }, { status: 403, headers });
  const partners = await prisma.affiliate.findMany({
    where: { parentAffiliateId: master.affiliateId }, orderBy: { createdAt: 'desc' },
    take: 100, select: { id: true, referralCode: true, teamShareBps: true, createdAt: true,
      user: { select: { name: true, email: true, status: true, emailVerifiedAt: true } } },
  });
  const invites = await prisma.teamInvitation.findMany({
    where: { masterAffiliateId: master.affiliateId }, orderBy: { createdAt: 'desc' }, take: 30,
    select: { id: true, email: true, shareBps: true, expiresAt: true, usedAt: true, createdAt: true },
  });
  const ids = partners.map(p => p.id);
  const orders = ids.length ? await prisma.hvCodOrder.groupBy({
    by: ['affiliateId'], where: { affiliateId: { in: ids },
      currency: 'EGP', isCod: true, cancelled: false, refunded: false,
      delivered: true, courierCollected: true, merchantReconciled: true,
      attributionSource: { in: verified } },
    _count: { _all: true }, _sum: { orderTotalPiasters: true, commissionPreviewPiasters: true },
  }) : [];
  const performance = new Map(orders.map(o => [o.affiliateId, o]));
  return NextResponse.json({ partners: partners.map(p => ({
    id: p.id, name: p.user.name, email: p.user.email, status: p.user.status,
    verified: Boolean(p.user.emailVerifiedAt), referralCode: p.referralCode,
    shareBps: p.teamShareBps ?? 0, createdAt: p.createdAt,
    orders: performance.get(p.id)?._count._all ?? 0,
    salesPiasters: performance.get(p.id)?._sum.orderTotalPiasters ?? 0,
    commissionPoolPreviewPiasters: performance.get(p.id)?._sum.commissionPreviewPiasters ?? 0,
  })), invites, financialStatus: 'PREVIEW_ONLY_NOT_PAYABLE' }, { headers });
}

export async function PATCH(request: NextRequest) {
  const master = await authenticatedMaster(request);
  if (!master) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.partnerId !== 'string' || !Number.isInteger(body.shareBps) ||
      body.shareBps < 0 || body.shareBps > 10000)
    return NextResponse.json({ error: 'Invalid partner or share (0-10000 bps)' }, { status: 400, headers });
  const changed = await prisma.$transaction(async tx => {
    const before = await tx.affiliate.findFirst({ where: {
      id: body.partnerId, parentAffiliateId: master.affiliateId },
      select: { id: true, teamShareBps: true } });
    if (!before) return false;
    await tx.affiliate.update({ where: { id: before.id }, data: { teamShareBps: body.shareBps } });
    await tx.auditLog.create({ data: {
      actorId: master.userId, action: 'SET_SUB_PARTNER_SHARE',
      objectType: 'AFFILIATE', objectId: before.id,
      payload: { previousBps: before.teamShareBps, newBps: body.shareBps,
        effectiveFor: 'future_settlements_only' },
    } });
    return true;
  });
  return NextResponse.json(changed ? { success: true } : { error: 'Partner not in your team' },
    { status: changed ? 200 : 404, headers });
}
