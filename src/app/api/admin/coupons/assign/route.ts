import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Changes only the Refferq affiliate_id mapping for a Shopify-synced coupon.
 * No Shopify discount mutation, checkout price change or financial write.
 */
export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview')
    return NextResponse.json({ error: 'STAGING only until validation' }, { status: 423 });
  const actorId = request.headers.get('x-user-id');
  if (!actorId || request.headers.get('x-authenticated-role') !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await prisma.user.findUnique({
    where: { id: actorId }, select: { id: true, role: true, status: true },
  });
  if (actor?.role !== 'ADMIN' || actor.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let data: unknown;
  try { data = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return NextResponse.json({ error: 'Invalid payload' }, { status: 422 });
  const { couponId, affiliateId, expectedAffiliateId } = data as Record<string, unknown>;
  const validId = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 100;
  if (!validId(couponId) || !(affiliateId === null || validId(affiliateId)) ||
      !(expectedAffiliateId === null || validId(expectedAffiliateId)))
    return NextResponse.json({ error: 'Invalid coupon or partner IDs' }, { status: 422 });
  try {
    const result = await prisma.$transaction(async tx => {
      const coupon = await tx.coupon.findUnique({
        where: { id: couponId as string },
        select: { id: true, code: true, source: true, isActive: true, affiliateId: true },
      });
      if (!coupon || coupon.source !== 'SHOPIFY')
        return { status: 404, error: 'Synced Shopify coupon not found' };
      if (coupon.affiliateId !== expectedAffiliateId)
        return { status: 409, error: 'Mapping changed. Refresh the coupon list.' };
      if (affiliateId !== null) {
        if (!coupon.isActive)
          return { status: 422, error: 'Inactive code cannot be assigned.' };
        const partner = await tx.affiliate.findUnique({
          where: { id: affiliateId as string },
          select: { user: { select: { role: true, status: true, emailVerifiedAt: true } } },
        });
        if (!partner || partner.user.role !== 'AFFILIATE' ||
            partner.user.status !== 'ACTIVE' || !partner.user.emailVerifiedAt)
          return { status: 422, error: 'Affiliate must be active and email-verified.' };
      }
      if (coupon.affiliateId === affiliateId)
        return { status: 200, unchanged: true };
      const updated = await tx.coupon.updateMany({
        where: { id: coupon.id, source: 'SHOPIFY', affiliateId: expectedAffiliateId as string | null },
        data: { affiliateId: affiliateId as string | null },
      });
      if (updated.count !== 1)
        return { status: 409, error: 'Concurrent update; refresh.' };
      await tx.auditLog.create({
        data: { actorId: actor.id, action: 'ASSIGN_SHOPIFY_COUPON', objectType: 'COUPON',
          objectId: coupon.id, payload: { code: coupon.code,
            from: coupon.affiliateId, to: affiliateId,
            historicalOrdersChanged: false, payoutCreated: false } },
      });
      return { status: 200, unchanged: false };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status as 404 | 409 | 422 });
    return NextResponse.json({ success: true, unchanged: result.unchanged, commissionsCreated: 0 },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not save partner mapping' }, { status: 500 });
  }
}
