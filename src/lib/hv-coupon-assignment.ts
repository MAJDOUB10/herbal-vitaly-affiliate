// Only approved and verified Refferq partners may own Shopify coupon codes.
export function isApprovedAffiliate(user: {
  role: string; status: string; emailVerifiedAt: Date | string | null;
}) {
  return user.role === 'AFFILIATE' &&
    user.status === 'ACTIVE' &&
    user.emailVerifiedAt !== null;
}
export function canAssignCoupon(
  coupon: { source: string; isActive: boolean },
  affiliateId: string | null,
) {
  return coupon.source === 'SHOPIFY' &&
    (affiliateId === null || coupon.isActive);
}
export function eligibleReferralCodes(
  activeAffiliates: Array<{ id: string; referralCode: string }>,
  mappedCoupons: Array<{ code: string; affiliateId: string | null; isActive: boolean }>,
) {
  const approvedIds = new Set(activeAffiliates.map(a => a.id));
  const codes = new Set(activeAffiliates.map(a => a.referralCode.trim().toUpperCase()));
  for (const c of mappedCoupons) {
    if (c.isActive && c.affiliateId && approvedIds.has(c.affiliateId)) {
      codes.add(c.code.trim().toUpperCase());
    }
  }
  return codes;
}
