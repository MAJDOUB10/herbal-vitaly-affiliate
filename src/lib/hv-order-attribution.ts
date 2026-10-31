/**
 * Affiliate order attribution is derived only from a signed referral token
 * or from a Shopify-applied discount mapped to a verified, approved partner.
 * An arbitrary code entered in the checkout is never accepted as a partner ID.
 */
export type AttributionSource = 'AFFILIATE_LINK' | 'PROMO_CODE' | 'LINK_AND_PROMO' | 'CONFLICT' | 'UNATTRIBUTED';

export type PartnerIdentity = {
  affiliateId: string;
  referralCode: string;
};

export type AppliedPartnerCoupon = PartnerIdentity & { code: string };

export type OrderAttribution = {
  affiliateId: string | null;
  referralCode: string | null;
  attributionSource: AttributionSource;
  discountCode: string | null;
  attributionKey: string | null;
};

export function normalizeDiscountCode(code: unknown): string {
  return typeof code === 'string' ? code.trim().toUpperCase().slice(0, 100) : '';
}

export function resolveOrderAttribution(
  verifiedLink: (PartnerIdentity & { attributionKey: string }) | null,
  discountCodes: string[],
  validCouponAssignments: AppliedPartnerCoupon[],
): OrderAttribution {
  const codes = [...new Set(discountCodes.map(normalizeDiscountCode).filter(Boolean))];
  const matching = validCouponAssignments.filter(c => codes.includes(normalizeDiscountCode(c.code)));
  const partnerIds = new Set(matching.map(c => c.affiliateId));
  if (verifiedLink && partnerIds.size > 0 && !partnerIds.has(verifiedLink.affiliateId)) {
    return { affiliateId: null, referralCode: null, attributionSource: 'CONFLICT', discountCode: matching[0].code, attributionKey: null };
  }
  if (partnerIds.size > 1) {
    return { affiliateId: null, referralCode: null, attributionSource: 'CONFLICT', discountCode: matching[0].code, attributionKey: null };
  }
  const promo = matching[0];
  if (verifiedLink) {
    return {
      affiliateId: verifiedLink.affiliateId, referralCode: verifiedLink.referralCode,
      attributionSource: promo ? 'LINK_AND_PROMO' : 'AFFILIATE_LINK',
      discountCode: promo?.code || codes[0] || null, attributionKey: verifiedLink.attributionKey,
    };
  }
  if (promo) {
    return {
      affiliateId: promo.affiliateId, referralCode: promo.referralCode,
      attributionSource: 'PROMO_CODE', discountCode: promo.code, attributionKey: null,
    };
  }
  return { affiliateId: null, referralCode: null, attributionSource: 'UNATTRIBUTED', discountCode: codes[0] || null, attributionKey: null };
}

export function orderStatus(order: {
  cancelled: boolean; refunded: boolean; isCod: boolean;
  delivered: boolean; courierCollected: boolean; merchantReconciled: boolean;
  attributionSource: string;
}): string {
  if (order.cancelled) return 'CANCELLED';
  if (order.refunded) return 'REFUNDED';
  if (order.attributionSource === 'CONFLICT') return 'ATTRIBUTION_CONFLICT';
  if (order.attributionSource === 'UNATTRIBUTED' || order.attributionSource === 'UNVERIFIED') return 'UNATTRIBUTED';
  if (!order.isCod) return 'NON_COD_REVIEW';
  if (order.delivered && order.courierCollected && order.merchantReconciled) return 'PENDING_FINANCIAL_APPROVAL';
  if (order.delivered) return 'AWAITING_COD_RECONCILIATION';
  return 'PENDING_DELIVERY';
}
