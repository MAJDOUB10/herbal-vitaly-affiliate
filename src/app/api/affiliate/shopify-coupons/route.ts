import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateDiscountCode } from '@/lib/hv-shopify-discounts';

/** Read-only approved partner discounts, scoped to the authenticated account. */
export async function GET(request: NextRequest) {
  const id = request.headers.get('x-user-id');
  if (!id || request.headers.get('x-authenticated-role') !== 'AFFILIATE')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id },
    select: { status: true, role: true, emailVerifiedAt: true,
      affiliate: { select: { id: true, referralCode: true } } } });
  if (user?.role !== 'AFFILIATE' || user.status !== 'ACTIVE' ||
      !user.emailVerifiedAt || !user.affiliate)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const coupons = await prisma.coupon.findMany({
    where: { affiliateId: user.affiliate.id, source: 'SHOPIFY',
      shopifyStatus: 'ACTIVE', isActive: true, startsAt: { lte: new Date() },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { id: true, code: true, discountType: true, discountValue: true,
      shopifyProductHandles: true, shopifyProductIds: true },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  const valid = coupons.filter(c => validateDiscountCode(c.code) &&
    c.shopifyProductHandles.length === c.shopifyProductIds.length);
  return NextResponse.json({
    success: true,
    coupons: valid.map(c => ({
      ...c,
      products: c.shopifyProductHandles.map(handle => ({
        handle,
        productUrl: 'https://herbalvitaly.com/products/' + encodeURIComponent(handle),
        affiliateLink: 'https://partner.herbalvitaly.com/r/' +
          encodeURIComponent(user.affiliate!.referralCode) +
          '?dest=' + encodeURIComponent('https://herbalvitaly.com/products/' + encodeURIComponent(handle)) +
          '&promo=' + encodeURIComponent(c.code),
      })),
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
