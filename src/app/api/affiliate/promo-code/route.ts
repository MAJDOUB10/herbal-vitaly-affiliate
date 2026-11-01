import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAutoCouponSettings } from '@/lib/auto-coupon-settings';
import { getShopifyDiscountByCode, validateDiscountCode } from '@/lib/hv-shopify-discounts';
import { provisionAffiliateShopifyCoupon } from '@/lib/auto-partner-shopify-coupon';
import { checkRateLimit } from '@/lib/rate-limit';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function selectedCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Reuse exactly the same 3–40 character policy as Shopify coupon creation.
  return validateDiscountCode(value);
}

async function verifiedPartner(request: NextRequest) {
  const id = request.headers.get('x-user-id');
  if (!id || request.headers.get('x-authenticated-role') !== 'AFFILIATE') return null;
  const user = await prisma.user.findUnique({
    where: { id }, select: { id: true, role: true, status: true,
      emailVerifiedAt: true, affiliate: { select: { id: true } } },
  });
  return user?.role === 'AFFILIATE' && user.status === 'ACTIVE' &&
    user.emailVerifiedAt && user.affiliate ? { userId: user.id, affiliateId: user.affiliate.id } : null;
}

async function assignedCoupon(affiliateId: string) {
  return prisma.coupon.findFirst({
    where: { affiliateId, OR: [
      { description: 'Automatic OTP-verified affiliate onboarding' },
      { source: 'SHOPIFY', isActive: true },
    ] },
    orderBy: { createdAt: 'asc' },
    select: { code: true, source: true, shopifyStatus: true,
      isActive: true, autoEmailSentAt: true },
  });
}

/** After login: display the existing code or check a partner-selected code. */
export async function GET(request: NextRequest) {
  const partner = await verifiedPartner(request);
  if (!partner) return NextResponse.json({ error: 'Verified partner login required' }, { status: 401 });
  try {
    const assigned = await assignedCoupon(partner.affiliateId);
    const policy = await getAutoCouponSettings();
    if (assigned) return NextResponse.json({
      success: true, assigned: {
        code: assigned.code, active: assigned.source === 'SHOPIFY' &&
          assigned.shopifyStatus === 'ACTIVE' && assigned.isActive,
        emailSent: Boolean(assigned.autoEmailSentAt),
      }, enabled: policy.enabled,
    }, { headers: NO_STORE });

    const proposed = request.nextUrl.searchParams.get('code');
    if (proposed === null)
      return NextResponse.json({ success: true, assigned: null, enabled: policy.enabled },
        { headers: NO_STORE });
    const code = selectedCode(proposed);
    if (!code) return NextResponse.json({ error: 'Enter 3–40 characters: letters, numbers, - or _' },
      { status: 422, headers: NO_STORE });
    if (!policy.enabled) return NextResponse.json({ success: true, available: false,
      message: 'New promo codes are temporarily disabled' }, { headers: NO_STORE });

    const limit = await checkRateLimit(partner.userId, 'partner-promo-availability', 18, 60_000);
    if (!limit.allowed) return NextResponse.json({ error: 'Too many checks. Try later.' },
      { status: 429, headers: NO_STORE });
    const alreadyLocal = await prisma.coupon.findUnique({
      where: { code }, select: { id: true },
    });
    // Fail closed if Shopify is unavailable. Never claim that an unknown code is free.
    const alreadyShopify = alreadyLocal ? true : Boolean(await getShopifyDiscountByCode(code));
    return NextResponse.json({
      success: true, code, available: !alreadyLocal && !alreadyShopify,
      message: !alreadyLocal && !alreadyShopify ? 'Code available' : 'Code already taken',
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Unable to verify code availability. Try again.' },
      { status: 503, headers: NO_STORE });
  }
}

/** One-time, authenticated selection. No public route may provision discounts. */
export async function POST(request: NextRequest) {
  const partner = await verifiedPartner(request);
  if (!partner) return NextResponse.json({ error: 'Verified partner login required' }, { status: 401 });
  if (process.env.VERCEL_ENV !== 'production')
    return NextResponse.json({ error: 'Code creation is available in Production only' }, { status: 423 });
  if (request.headers.get('origin') !== 'https://partner.herbalvitaly.com')
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  try {
    const submitted = await request.json();
    const code = selectedCode(submitted?.code);
    if (!code) return NextResponse.json({ error: 'Choose 3–40 characters: letters, numbers, - or _' }, { status: 422 });
    const policy = await getAutoCouponSettings();
    if (!policy.enabled)
      return NextResponse.json({ error: 'Partner promo code creation is disabled by Admin' }, { status: 423 });
    const rate = await checkRateLimit(partner.userId, 'partner-promo-create', 6, 60 * 60_000);
    if (!rate.allowed) return NextResponse.json({ error: 'Too many attempts. Try later.' }, { status: 429 });

    const current = await assignedCoupon(partner.affiliateId);
    if (current && current.code !== code)
      return NextResponse.json({ error: 'Your account already has a promo code', assigned: current.code },
        { status: 409 });
    try {
      await provisionAffiliateShopifyCoupon(partner.userId, code);
    } catch (error) {
      // The remote Shopify mutation might have succeeded before a transient
      // email failure. Read the reservation instead of inviting a second code.
      const existing = await assignedCoupon(partner.affiliateId);
      if (existing && existing.code === code) {
        return NextResponse.json({ success: true, code, active: existing.isActive &&
          existing.shopifyStatus === 'ACTIVE', emailSent: Boolean(existing.autoEmailSentAt),
          pending: !existing.isActive || existing.shopifyStatus !== 'ACTIVE',
          message: 'Code reserved. Shopify/email confirmation may require retry.' },
        { status: 202, headers: NO_STORE });
      }
      const message = error instanceof Error ? error.message : 'Code could not be created';
      const status = /taken|already assigned/i.test(message) ? 409 : 503;
      return NextResponse.json({ error: status === 409 ? message : 'Shopify verification failed. Try again.' },
        { status, headers: NO_STORE });
    }
    const created = await assignedCoupon(partner.affiliateId);
    if (!created || created.code !== code)
      return NextResponse.json({ error: 'Could not confirm coupon creation' }, { status: 503 });
    return NextResponse.json({ success: true, code, active: created.isActive &&
      created.shopifyStatus === 'ACTIVE', emailSent: Boolean(created.autoEmailSentAt),
      pending: !created.isActive || created.shopifyStatus !== 'ACTIVE' },
    { status: created.isActive ? 201 : 202, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Unable to create partner code' },
      { status: 503, headers: NO_STORE });
  }
}
