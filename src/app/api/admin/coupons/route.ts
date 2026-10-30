import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'node:crypto';
import { buildBasicDiscountInput, createShopifyDiscount, getShopifyDiscountByCode, getShopifyProducts, validateDiscountCode, validateProductIds } from '@/lib/hv-shopify-discounts';

async function verifyAdmin(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE' || request.headers.get('x-authenticated-role') !== 'ADMIN') return null;
    return user;
  } catch (_e) {
    return null;
  }
}

// GET: List all coupons
export async function GET(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error('Admin coupons GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
  }
}

// POST: Create an actual ACTIVE product-scoped discount in Shopify before
// enabling the mapping in Refferq. Does not change existing Shopify discounts.
export async function POST(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // All discount writes are staged until the storefront and finance flow pass QA.
  if (process.env.VERCEL_ENV !== 'preview')
    return NextResponse.json({ error: 'Shopify coupon creation is restricted to vetted Preview deployments' }, { status: 423 });
  let reservedId: string | null = null;
  let shopifyCreated = false;
  try {
    const body = await request.json() as Record<string, unknown>;
    const productIds = validateProductIds(body.productIds);
    const affiliateId = typeof body.affiliateId === 'string' ? body.affiliateId : '';
    const discountType = body.discountType;
    const discountValue = Number(body.discountValue);
    const maxUses = body.maxUses == null || body.maxUses === '' ? null : Number(body.maxUses);
    const code = validateDiscountCode(body.code) || (
      body.code == null || body.code === ''
        ? 'HV' + randomBytes(6).toString('hex').toUpperCase()
        : null
    );
    if (!code || !productIds || !affiliateId ||
        !['PERCENTAGE','FIXED'].includes(String(discountType)) ||
        !Number.isFinite(discountValue) || discountValue <= 0 ||
        (discountType === 'PERCENTAGE' && discountValue > 100) ||
        (discountType === 'FIXED' && discountValue > 100000) ||
        (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1))) {
      return NextResponse.json({ error: 'Choose an approved partner, at least one product and valid code/value' }, { status: 422 });
    }
    const partner = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { id: true, user: { select: { role: true, status: true, emailVerifiedAt: true } } },
    });
    if (!partner || partner.user.role !== 'AFFILIATE' ||
        partner.user.status !== 'ACTIVE' || !partner.user.emailVerifiedAt)
      return NextResponse.json({ error: 'Partner must be approved and email verified' }, { status: 422 });
    const local = await prisma.coupon.findUnique({ where: { code } });
    if (local) return NextResponse.json({ error: 'This code already exists in Refferq' }, { status: 409 });

    // Catalog server-side validation prevents arbitrary or inactive Product IDs.
    const available = await getShopifyProducts();
    const productMap = new Map(available.map(p => [p.id, p]));
    if (productIds.some(id => !productMap.has(id)))
      return NextResponse.json({ error: 'Product selection includes unpublished or unavailable Shopify products' }, { status: 422 });
    if (await getShopifyDiscountByCode(code))
      return NextResponse.json({ error: 'This code already exists in Shopify' }, { status: 409 });
    const startsAt = new Date();
    const expiresAt = typeof body.expiresAt === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(body.expiresAt)
      ? new Date(body.expiresAt + 'T23:59:59Z') : null;
    const basicDiscount = buildBasicDiscountInput({
      code, discountType: discountType as 'PERCENTAGE' | 'FIXED', discountValue,
      productIds, startsAt, expiresAt, maxUses,
    });
    // Reserve code as inactive BEFORE remote Shopify mutation (deduplication).
    const reservation = await prisma.coupon.create({
      data: {
        code, description: typeof body.description === 'string' ? body.description.slice(0,300) : null,
        discountType: discountType as string, discountValue, currency: 'EGP',
        maxUses, affiliateId, startsAt, expiresAt,
        source: 'REFFERQ_PENDING', isActive: false, shopifyStatus: 'PENDING',
        shopifyProductIds: productIds, createdBy: user.id,
      },
    });
    reservedId = reservation.id;
    const shopify = await createShopifyDiscount(basicDiscount);
    shopifyCreated = true;
    // If the remote response is scheduled/disabled, don't mark coupon active.
    const active = shopify.status === 'ACTIVE';
    const coupon = await prisma.coupon.update({
      where: { id: reservation.id },
      data: { source: 'SHOPIFY', shopifyDiscountId: shopify.id,
        shopifySummary: shopify.summary, shopifyStatus: shopify.status,
        shopifySyncedAt: new Date(), isActive: active },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: 'CREATE_SHOPIFY_AFFILIATE_DISCOUNT',
        objectType: 'COUPON', objectId: coupon.id,
        payload: { code, affiliateId, productIds, shopifyDiscountId: shopify.id,
          shopifyStatus: shopify.status, currency: 'EGP', cashoutApproved: false } },
    });
    return NextResponse.json({
      success: true, coupon, shopifyStatus: shopify.status,
      products: productIds.map(id => productMap.get(id)),
      message: active ? 'Coupon created and active in Shopify' : 'Coupon created but not yet active in Shopify',
    }, { status: 201 });
  } catch (err) {
    // Remote success + local failure must remain flagged for reconciliation,
    // not be silently retried to make duplicate Shopify discounts.
    if (reservedId && !shopifyCreated) {
      await prisma.coupon.updateMany({
        where: { id: reservedId, source: 'REFFERQ_PENDING' },
        data: { shopifyStatus: 'ERROR', isActive: false },
      }).catch(() => {});
    }
    const message = err instanceof Error ? err.message : 'Unable to create Shopify coupon';
    return NextResponse.json({
      error: message, status: shopifyCreated ? 'SHOPIFY_CREATED_RECONCILE' : 'NOT_ACTIVATED',
    }, { status: 502 });
  }
}

// PUT: Update coupon
export async function PUT(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Coupon ID required' }, { status: 400 });
    }

    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    if (existing.source === 'SHOPIFY' || existing.source === 'REFFERQ_PENDING')
      return NextResponse.json({ error: 'Shopify-managed coupon: edit the discount in Shopify, then synchronize.' }, { status: 409 });

    // Only allow specific fields (prevent mass assignment)
    const allowedFields = ['code', 'description', 'discountType', 'discountValue', 'maxUses', 'isActive', 'expiresAt', 'startsAt', 'minimumAmount'];
    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body && body[key] !== undefined) updates[key] = body[key];
    }
    if (updates.expiresAt) updates.expiresAt = new Date(updates.expiresAt);
    if (updates.startsAt) updates.startsAt = new Date(updates.startsAt);

    const coupon = await prisma.coupon.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    console.error('Admin coupons PUT error:', error);
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 });
  }
}

// DELETE: Delete coupon
export async function DELETE(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Coupon ID required' }, { status: 400 });
    }

    const old = await prisma.coupon.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    if (old.source === 'SHOPIFY' || old.source === 'REFFERQ_PENDING')
      return NextResponse.json({ error: 'Shopify-managed coupon: manage deletion in Shopify, then synchronize.' }, { status: 409 });
    await prisma.coupon.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin coupons DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 });
  }
}
