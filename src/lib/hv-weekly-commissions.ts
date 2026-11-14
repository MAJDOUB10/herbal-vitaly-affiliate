import { splitTeamCommissionPiasters } from './team-network-math.ts';

const DAY_MS = 86400000;
export const VERIFIED_COD_ATTRIBUTION = ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'] as const;

/** Monday 00:00 UTC inclusive to next Monday exclusive (explicit finance reporting timezone). */
export function mondayUtc(date: Date): Date {
  if (!Number.isFinite(date.valueOf())) throw new Error('Invalid date');
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

export function lastClosedWeekStart(now = new Date()): Date {
  return new Date(mondayUtc(now).getTime() - 7 * DAY_MS);
}

export function parseClosedWeek(raw: unknown, now = new Date()) {
  const start = raw === undefined || raw === null || raw === '' ? lastClosedWeekStart(now) :
    (() => {
      if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw))
        throw new Error('Week must be YYYY-MM-DD (UTC Monday)');
      const dt = new Date(raw + 'T00:00:00.000Z');
      if (!Number.isFinite(dt.valueOf()) || dt.toISOString().slice(0, 10) !== raw || dt.getUTCDay() !== 1)
        throw new Error('Week start must be a valid UTC Monday');
      return dt;
    })();
  const end = new Date(start.getTime() + 7 * DAY_MS);
  if (end.getTime() > now.getTime()) throw new Error('Only fully closed weeks may be generated');
  return { weekStart: start, weekEnd: end };
}

export type WeeklyEligibleOrder = {
  currency: string; isCod: boolean; delivered: boolean; courierCollected: boolean;
  merchantReconciled: boolean; cancelled: boolean; refunded: boolean;
  collectedPiasters: number; orderTotalPiasters: number; subtotalPiasters: number;
  commissionPreviewPiasters: number; referralCode: string | null; affiliateId: string | null;
  attributionSource: string; merchantSettlementReference: string | null;
  merchantSettledAt: Date | null;
};

/** Strict, evidence-backed candidate check, still NOT authorizing a payable commission. */
export function isWeeklyEligible(order: WeeklyEligibleOrder, weekStart: Date, weekEnd: Date) {
  return order.currency === 'EGP' && order.isCod && order.delivered && order.courierCollected &&
    order.merchantReconciled && !order.cancelled && !order.refunded &&
    Boolean(order.referralCode?.trim()) && Boolean(order.affiliateId) &&
    VERIFIED_COD_ATTRIBUTION.some(source => source === order.attributionSource) &&
    Boolean(order.merchantSettlementReference?.trim()) &&
    order.merchantSettledAt !== null && order.merchantSettledAt >= weekStart &&
    order.merchantSettledAt < weekEnd &&
    Number.isSafeInteger(order.collectedPiasters) &&
    Number.isSafeInteger(order.orderTotalPiasters) &&
    order.orderTotalPiasters > 0 && order.collectedPiasters >= order.orderTotalPiasters &&
    Number.isSafeInteger(order.subtotalPiasters) && order.subtotalPiasters > 0 &&
    Number.isSafeInteger(order.commissionPreviewPiasters) &&
    order.commissionPreviewPiasters > 0 &&
    order.commissionPreviewPiasters <= Math.floor(order.subtotalPiasters * 0.2 + 0.5);
}

export type WeeklyAllocation = { beneficiaryAffiliateId: string; beneficiaryRole: 'DIRECT' | 'SUB_PARTNER' | 'MASTER_PARTNER'; amountPiasters: number; shareBps: number };

/** Snapshot the existing pool and network split, never add 20% to the sub-partner rate. */
export function allocateWeeklyPool(
  poolPiasters: number, affiliateId: string, parentId: string | null, shareBps: number,
): WeeklyAllocation[] {
  if (!affiliateId) throw new Error('Invalid beneficiary');
  if (!parentId) {
    if (!Number.isSafeInteger(poolPiasters) || poolPiasters <= 0) throw new Error('Invalid pool');
    return [{ beneficiaryAffiliateId: affiliateId, beneficiaryRole: 'DIRECT',
      amountPiasters: poolPiasters, shareBps: 10000 }];
  }
  if (parentId === affiliateId) throw new Error('Self-referral hierarchy');
  const split = splitTeamCommissionPiasters(poolPiasters, shareBps);
  return [
    { beneficiaryAffiliateId: affiliateId, beneficiaryRole: 'SUB_PARTNER', amountPiasters: split.childPiasters, shareBps },
    { beneficiaryAffiliateId: parentId, beneficiaryRole: 'MASTER_PARTNER', amountPiasters: split.masterPiasters, shareBps: 10000 - shareBps },
  ].filter(part => part.amountPiasters > 0);
}

export function isWeeklyTransitionAllowed(current: string, action: string): boolean {
  if (action === 'EDIT') return current === 'DRAFT';
  if (action === 'VALIDATE') return current === 'DRAFT';
  if (action === 'CANCEL') return current === 'DRAFT' || current === 'VALIDATED';
  if (action === 'MARK_PAID') return current === 'VALIDATED';
  return false;
}
