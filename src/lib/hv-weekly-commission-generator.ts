import { prisma } from '@/lib/prisma';
import { allocateWeeklyPool, isWeeklyEligible, parseClosedWeek } from '@/lib/hv-weekly-commissions';

const MAX_PER_RUN = 5000;

/**
 * Creates weekly REPORT rows, not approved earnings. Idempotent across retries,
 * weeks, and overlapping cron/admin calls due to database uniqueness rules.
 * No existing Commission/Payout/TeamCommissionSplit/balance is mutated.
 */
export async function generateWeeklyCommissionReport(week: unknown, actorId: string | null) {
  const { weekStart, weekEnd } = parseClosedWeek(week);
  const candidates = await prisma.hvCodOrder.findMany({
    where: {
      merchantSettledAt: { gte: weekStart, lt: weekEnd },
      isCod: true, delivered: true, courierCollected: true, merchantReconciled: true,
      refunded: false, cancelled: false, currency: 'EGP',
      attributionSource: { in: ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'] },
    },
    take: MAX_PER_RUN + 1, orderBy: { merchantSettledAt: 'asc' },
  });
  if (candidates.length > MAX_PER_RUN)
    throw new Error('More than 5000 COD orders for this week; paginate before generating');

  const affiliates = await prisma.affiliate.findMany({
    where: { id: { in: Array.from(new Set(candidates.map(o => o.affiliateId).filter((v): v is string => Boolean(v)))) } },
    select: { id: true, teamShareBps: true, parentAffiliateId: true, isMasterPartner: true,
      user: { select: { role: true, status: true, emailVerifiedAt: true } },
      parentAffiliate: {
        select: { id: true, isMasterPartner: true, parentAffiliateId: true,
          user: { select: { role: true, status: true, emailVerifiedAt: true } } },
      },
    },
  });
  const active = (u: { role: string; status: string; emailVerifiedAt: Date | null }) =>
    u.role === 'AFFILIATE' && u.status === 'ACTIVE' && Boolean(u.emailVerifiedAt);
  const byId = new Map(affiliates.map(a => [a.id, a]));
  const existingSplits = await prisma.teamCommissionSplit.findMany({
    where: { sourceId: { in: candidates.map(o => o.shopifyOrderId) } },
    select: { sourceId: true },
  });
  const inSplitLedger = new Set(existingSplits.map(r => r.sourceId));
  const prepared: Array<{
    sourceOrderId: string; sourceOrderName: string; beneficiaryAffiliateId: string;
    beneficiaryRole: string; salePiasters: number; poolPiasters: number;
    originalPiasters: number; amountPiasters: number; shareBps: number;
  }> = [];
  let excluded = 0;
  for (const order of candidates) {
    if (!isWeeklyEligible(order, weekStart, weekEnd) || !order.affiliateId ||
        inSplitLedger.has(order.shopifyOrderId)) { excluded++; continue; }
    const affiliate = byId.get(order.affiliateId);
    if (!affiliate || !active(affiliate.user)) { excluded++; continue; }

    const parent = affiliate.parentAffiliate;
    if (parent && (!parent.isMasterPartner || parent.parentAffiliateId || !active(parent.user))) {
      excluded++; continue;
    }
    const allocated = allocateWeeklyPool(
      order.commissionPreviewPiasters, affiliate.id, parent?.id ?? null, affiliate.teamShareBps ?? 0,
    );
    for (const part of allocated) prepared.push({
      sourceOrderId: order.shopifyOrderId,
      sourceOrderName: order.orderName,
      beneficiaryAffiliateId: part.beneficiaryAffiliateId,
      beneficiaryRole: part.beneficiaryRole,
      salePiasters: order.subtotalPiasters,
      poolPiasters: order.commissionPreviewPiasters,
      originalPiasters: part.amountPiasters,
      amountPiasters: part.amountPiasters,
      shareBps: part.shareBps,
    });
  }

  const result = await prisma.$transaction(async tx => {
    const batch = await tx.hvWeeklyCommissionBatch.upsert({
      where: { weekStart },
      create: { weekStart, weekEnd, currency: 'EGP', createdBy: actorId },
      update: {},
      select: { id: true, weekStart: true, weekEnd: true },
    });
    const inserted = prepared.length ? await tx.hvWeeklyCommissionLine.createMany({
      data: prepared.map(row => ({ ...row, batchId: batch.id })),
      skipDuplicates: true,
    }) : { count: 0 };
    if (actorId) await tx.auditLog.create({
      data: { actorId, action: 'GENERATE_WEEKLY_COD_REPORT', objectType: 'HV_WEEKLY_COMMISSION_BATCH',
        objectId: batch.id,
        payload: { weekStart: weekStart.toISOString(), candidates: candidates.length,
          prepared: prepared.length, inserted: inserted.count, excluded } },
    });
    return { batchId: batch.id, weekStart: batch.weekStart.toISOString(),
      weekEnd: batch.weekEnd.toISOString(), candidates: candidates.length, excluded,
      prepared: prepared.length, inserted: inserted.count,
      duplicatesSkipped: prepared.length - inserted.count,
      financialStatus: 'REPORT_ONLY_NOT_PAYABLE' };
  });
  return result;
}
