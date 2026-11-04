import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeShopifyOrder, verifyShopifyHmac } from '@/lib/hv-cod-connector';
import { verifiedShopifyOrderAttribution } from '@/lib/hv-shopify-attribution';
import { normalizeDiscountCode, resolveOrderAttribution } from '@/lib/hv-order-attribution';

// Only receives Shopify order status snapshots. It never creates or approves
// commissions or changes balances. Enable subscriptions only after credentials
// and domain have been reviewed by Herbal Vitaly.
export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Staging only' }, { status: 423 });
  }
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!secret || !shopDomain) {
    return NextResponse.json({ error: 'Shopify webhook credentials not configured' }, { status: 503 });
  }
  const raw = await request.text();
  const sourceShop = request.headers.get('x-shopify-shop-domain');
  const signature = request.headers.get('x-shopify-hmac-sha256');
  const topic = request.headers.get('x-shopify-topic');
  const deliveryId = request.headers.get('x-shopify-webhook-id');
  if (sourceShop !== shopDomain || !verifyShopifyHmac(raw, signature, secret))
    return NextResponse.json({ error: 'Invalid Shopify signature or shop' }, { status: 401 });
  if (!['orders/create', 'orders/updated', 'orders/cancelled'].includes(topic || '') || !deliveryId || deliveryId.length > 128)
    return NextResponse.json({ error: 'Unsupported topic or missing delivery ID' }, { status: 422 });
  try {
    const payload = JSON.parse(raw);
    const order = normalizeShopifyOrder(payload);
    const tokenSecret = process.env.HV_ATTRIBUTION_SECRET || process.env.JWT_SECRET || '';
    const verified = verifiedShopifyOrderAttribution(payload, tokenSecret);

    // Only verified/approved partners and Shopify-applied promo codes count.
    let signedPartner: { affiliateId: string; referralCode: string; attributionKey: string } | null = null;
    if (verified) {
      const owner = await prisma.affiliate.findUnique({
        where: { referralCode: verified.referralCode },
        select: { id: true, referralCode: true, user: { select: { role: true, status: true, emailVerifiedAt: true } } },
      });
      if (owner?.user.role === 'AFFILIATE' && owner.user.status === 'ACTIVE' &&
          owner.user.emailVerifiedAt) {
        signedPartner = { affiliateId: owner.id, referralCode: owner.referralCode, attributionKey: verified.attributionKey };
      }
    }

    const appliedCodes = [...new Set(
      ((payload.discount_codes || []) as Array<{ code?: unknown }>).map(x => normalizeDiscountCode(x.code)).filter(Boolean)
    )].slice(0, 20);
    const assignedCoupons = appliedCodes.length ? await prisma.coupon.findMany({
      where: {
        isActive: true, affiliateId: { not: null },
        OR: appliedCodes.map(code => ({ code: { equals: code, mode: 'insensitive' as const } })),
      },
      select: { code: true, affiliateId: true },
      take: 30,
    }) : [];
    const activePartnerIds = [...new Set(assignedCoupons.map(c => c.affiliateId).filter((x): x is string => !!x))];
    const owners = activePartnerIds.length ? await prisma.affiliate.findMany({
      where: {
        id: { in: activePartnerIds },
        user: { role: 'AFFILIATE', status: 'ACTIVE', emailVerifiedAt: { not: null } },
      },
      select: { id: true, referralCode: true },
    }) : [];
    const ownersById = new Map(owners.map(p => [p.id, p]));
    const couponPartners = assignedCoupons.flatMap(c => {
      const owner = c.affiliateId ? ownersById.get(c.affiliateId) : null;
      return owner ? [{ code: c.code, affiliateId: owner.id, referralCode: owner.referralCode }] : [];
    });
    const attributed = resolveOrderAttribution(signedPartner, appliedCodes, couponPartners);
    const dedupeKey = 'shopify:' + deliveryId;
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.hvCodOrder.findUnique({ where: { shopifyOrderId: order.shopifyOrderId } });
      await tx.hvCodEvent.create({ data: {
        id: randomUUID(), dedupeKey, source: 'SHOPIFY', orderName: order.orderName,
        state: topic!, occurredAt: order.shopifyUpdatedAt,
      } });
      if (existing && existing.shopifyUpdatedAt >= order.shopifyUpdatedAt) return 'stale';
      const cancelled = topic === 'orders/cancelled' || order.cancelled;
      // Freeze the attributed partner across later Shopify order updates.
      // If new trustworthy evidence points to a different partner, quarantine for review.
      const conflict = existing?.affiliateId && attributed.affiliateId &&
        existing.affiliateId !== attributed.affiliateId;
      const prevVerified = existing?.affiliateId &&
        ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'].includes(existing.attributionSource);
      const effective = conflict || existing?.attributionSource === 'CONFLICT'
        ? { affiliateId: null, referralCode: null, attributionSource: 'CONFLICT',
            discountCode: attributed.discountCode, attributionKey: null }
        : prevVerified ? {
            affiliateId: existing!.affiliateId, referralCode: existing!.referralCode,
            attributionSource: existing!.attributionSource,
            discountCode: existing!.discountCode || attributed.discountCode,
            attributionKey: existing!.attributionKey,
          } : attributed;
      const changed = existing && (existing.orderTotalPiasters !== order.orderTotalPiasters ||
        existing.subtotalPiasters !== order.subtotalPiasters);
      const record = {
        currency: order.currency, orderName: order.orderName,
        subtotalPiasters: order.subtotalPiasters,
        orderTotalPiasters: order.orderTotalPiasters,
        commissionPreviewPiasters: order.commissionPreviewPiasters,
        isCod: order.isCod, cancelled, refunded: order.refunded,
        referralCode: effective.referralCode,
        affiliateId: effective.affiliateId,
        attributionSource: effective.attributionSource,
        discountCode: effective.discountCode,
        attributionKey: effective.attributionKey,
        shopifyUpdatedAt: order.shopifyUpdatedAt,
        merchantReconciled: Boolean(existing?.merchantReconciled) && !changed && !cancelled && !order.refunded,
      };
      if (existing) {
        await tx.hvCodOrder.update({ where: { id: existing.id }, data: record });
      } else {
        await tx.hvCodOrder.create({ data: { id: randomUUID(), shopifyOrderId: order.shopifyOrderId, ...record } });
      }
      return 'stored';
    });
    return NextResponse.json({ success: true, status: result, orderName: order.orderName });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return NextResponse.json({ success: true, status: 'duplicate' });
    console.error('Shopify COD webhook rejected', e instanceof Error ? e.name : 'unknown');
    return NextResponse.json({ error: 'Invalid Shopify order event' }, { status: 422 });
  }
}
