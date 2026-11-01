import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getShopifyProducts } from '@/lib/hv-shopify-discounts';
import { getAutoCouponSettings, validateAutoCouponPolicy } from '@/lib/auto-coupon-settings';

async function adminOnly(request: NextRequest) {
  const id = request.headers.get('x-user-id');
  if (!id || request.headers.get('x-authenticated-role') !== 'ADMIN') return null;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  return user?.role === 'ADMIN' && user.status === 'ACTIVE' ? user : null;
}

export async function GET(request: NextRequest) {
  const admin = await adminOnly(request);
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  try {
    const policy = await getAutoCouponSettings();
    return NextResponse.json({ success: true, policy }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load coupon configuration' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await adminOnly(request);
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  if (process.env.VERCEL_ENV === 'production' &&
      request.headers.get('origin') !== 'https://partner.herbalvitaly.com')
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  try {
    const policy = validateAutoCouponPolicy(await request.json());
    // Check products against the live Shopify catalog before enabling the policy.
    const catalog = await getShopifyProducts();
    const activeHandles = new Set(catalog.map(p => p.handle));
    if (policy.productHandles.some(handle => !activeHandles.has(handle)))
      return NextResponse.json({ error: 'Choose active and published Shopify products only' }, { status: 422 });

    const previous = await getAutoCouponSettings();
    const saved = await prisma.autoCouponSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...policy, updatedBy: admin.id },
      update: { ...policy, updatedBy: admin.id },
    });
    await prisma.auditLog.create({ data: {
      actorId: admin.id, action: 'UPDATE_AUTO_COUPON_SETTINGS',
      objectType: 'AUTO_COUPON_SETTINGS', objectId: saved.id,
      payload: { previous, next: policy, existingShopifyCodesModified: false },
    } });
    return NextResponse.json({
      success: true, policy,
      message: 'Saved. These rules apply only to future partner codes, not existing Shopify discounts.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error:
      error instanceof Error ? error.message.slice(0,180) : 'Unable to save coupon settings'
    }, { status: 422 });
  }
}
