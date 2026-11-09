import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedMaster } from '@/lib/team-network-auth';
import { splitTeamCommissionPiasters } from '@/lib/team-network-math';

const headers = { 'Cache-Control': 'private, no-store' };
const verified = ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'];
export async function GET(request: NextRequest) {
  const master = await authenticatedMaster(request);
  if (!master) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const children = await prisma.affiliate.findMany({
    where: { parentAffiliateId: master.affiliateId }, take: 100,
    select: { id: true, teamShareBps: true, user: { select: { name: true } } },
  });
  const byId = new Map(children.map(c => [c.id, c]));
  const orders = children.length ? await prisma.hvCodOrder.findMany({
    where: { affiliateId: { in: children.map(c => c.id) },
      attributionSource: { in: verified }, currency: 'EGP' },
    orderBy: { shopifyUpdatedAt: 'desc' }, take: 100,
    select: { shopifyOrderId: true, orderName: true, affiliateId: true,
      orderTotalPiasters: true, commissionPreviewPiasters: true,
      delivered: true, courierCollected: true, merchantReconciled: true,
      cancelled: true, refunded: true, isCod: true, shopifyUpdatedAt: true },
  }) : [];
  return NextResponse.json({
    financialStatus: 'ESTIMATE_ONLY',
    notice: 'No commission is accrued, approved, or paid by this endpoint.',
    rows: orders.flatMap(o => {
      const child = o.affiliateId ? byId.get(o.affiliateId) : null;
      if (!child) return [];
      const preview = splitTeamCommissionPiasters(Math.max(0, o.commissionPreviewPiasters), child.teamShareBps ?? 0);
      const stage = o.refunded ? 'REFUNDED' : o.cancelled ? 'CANCELLED' :
        !o.isCod ? 'PAYMENT_REVIEW' : !o.delivered ? 'AWAITING_DELIVERY' :
        !o.courierCollected || !o.merchantReconciled ? 'AWAITING_RECONCILIATION' : 'READY_FOR_FINANCIAL_REVIEW';
      return [{ orderId: o.shopifyOrderId, order: o.orderName,
        partner: child.user.name, amountPiasters: o.orderTotalPiasters,
        shareBps: child.teamShareBps ?? 0, ...preview,
        stage, updatedAt: o.shopifyUpdatedAt.toISOString() }];
    }),
  }, { headers });
}
