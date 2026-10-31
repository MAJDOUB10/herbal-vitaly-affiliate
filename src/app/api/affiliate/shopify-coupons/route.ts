import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateDiscountCode, getShopifyCouponTargets, getShopifyProducts } from '@/lib/hv-shopify-discounts';

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
  // Shopify is the live authority. Historical synced codes often have no
  // Refferq product handles; never assume empty arrays mean entire store.
  try {
    const targets = await getShopifyCouponTargets(coupons.map(c => c.code));
    const hasAll = coupons.some(c => targets[c.code.toUpperCase()]?.scope === 'ALL');
    const allProducts = hasAll ? await getShopifyProducts() : [];
    const eligible = coupons.flatMap(c => {
      const target = targets[c.code.toUpperCase()];
      if (!validateDiscountCode(c.code) || !target || target.status !== 'ACTIVE') return [];
      const productList = target.scope === 'PRODUCTS' ? target.products :
        target.scope === 'ALL'
          ? allProducts.map(p => ({ id: p.id, title: p.title, handle: p.handle,
              url: p.onlineStoreUrl! }))
          : [];
      return [{
        id: c.id, code: c.code, discountType: c.discountType,
        discountValue: c.discountValue, scope: target.scope,
        products: productList.map(p => ({
          handle: p.handle, title: p.title, productUrl: p.url,
          affiliateLink: 'https://partner.herbalvitaly.com/r/' +
            encodeURIComponent(user.affiliate!.referralCode) +
            '?dest=' + encodeURIComponent(p.url) +
            '&promo=' + encodeURIComponent(c.code),
        })),
      }];
    });
    return NextResponse.json({ success: true, coupons: eligible },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Shopify eligibility verification currently unavailable' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
