import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isApprovedAffiliate, canAssignCoupon } from '@/lib/hv-coupon-assignment';

// The coupon discount and Shopify API are never modified by this endpoint.
// The sole mutable field is Refferq coupons.affiliate_id.
export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Partner assignments are enabled in staging only' }, { status: 423 });
  }
  const actorId = request.headers.get('x-user-id');
  if (!actorId || request.headers.get('x-authenticated-role') !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await prisma.user.findUnique({
    where: { id: actorId }, select: { id: true, role: true, status: true },
  });
  if (actor?.role !== 'ADMIN' || actor?.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return NextResponse.json({ error: 'Invalid payload' }, { status: 422 });
  const fields = body as Record<string, unknown>;
  const { couponId, affiliateId, expectedAffiliateId } = fields;
  if (typeof couponId !== 'string' || couponId.length < 1 || couponId.length > 100 ||
      !(affiliateId === null || (typeof affiliateId === 'string' && affiliateId.length <= 100 && affiliateId.length > 0)) ||
      !(expectedAffiliateId === null || (typeof expectedAffiliateId === 'string' && expectedAffiliateId.length <= 100 && expectedAffiliateId.length > 0))) {
    return NextResponse.json({ error: 'couponId, affiliateId, expectedAffiliateId required' }, { status: 422 });
  }

  try {
    const outcome = await prisma.$transaction(async tx => {
      const coupon = await tx.coupon.findUnique({
        where: { id: couponId }, select: { id: true, code: true, source: true, isActive: true, affiliateId: true },
      });
      if (!coupon || coupon.source !== 'SHOPIFY')
        return { status: 404, error: 'Shopify coupon not found' };
      if (coupon.affiliateId !== expectedAffiliateId)
        return { status: 409, error: 'Assignment changed. Refresh the coupon list.' };
      if (!canAssignCoupon(coupon, affiliateId))
        return { status: 409, error: 'Inactive Shopify coupons cannot be assigned.' };

      if (affiliateId !== null) {
        const partner = await tx.affiliate.findUnique({
          where: { id: affiliateId },
          select: { id: true, user: { select: { role: true, status: true, emailVerifiedAt: true } } },
        });
        if (!partner || !isApprovedAffiliate(partner.user))
          return { status: 422, error: 'Partner must be approved, active, and email verified' };
      }
      if (coupon.affiliateId === affiliateId)
        return { status: 200, affiliateId, unchanged: true };

      const result = await tx.coupon.updateMany({
        where: { id: coupon.id, source: 'SHOPIFY', affiliateId: expectedAffiliateId },
        data: { affiliateId },
      });
      if (result.count !== 1)
        return { status: 409, error: 'Concurrent assignment. Refresh and retry.' };

      await tx.auditLog.create({
        data: {
          actorId: actor.id, action: 'ASSIGN_SHOPIFY_COUPON', objectType: 'COUPON',
          objectId: coupon.id,
          payload: {
            code: coupon.code, previousAffiliateId: coupon.affiliateId,
            newAffiliateId: affiliateId, commissionCreated: false, moneyMoved: false,
          },
        },
      });
      return { status: 200, affiliateId, unchanged: false };
    });
    if ('error' in outcome)
      return NextResponse.json({ error: outcome.error }, { status: outcome.status as 404 | 409 | 422 });
    return NextResponse.json({
      success: true, affiliateId: outcome.affiliateId,
      unchanged: outcome.unchanged, commissionsCreated: 0, payoutsCreated: 0,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Shopify coupon assignment failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Unable to save assignment' }, { status: 500 });
  }
}
