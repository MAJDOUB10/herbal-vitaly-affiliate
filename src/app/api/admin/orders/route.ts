import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { orderStatus } from '@/lib/hv-order-attribution';

/** Admin-only, read-only and PII-minimized Shopify order tracking. */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const actor = await prisma.user.findUnique({
      where: { id: userId }, select: { role: true, status: true },
    });
    if (actor?.role !== 'ADMIN' || actor.status !== 'ACTIVE')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const qs = request.nextUrl.searchParams;
    const page = Math.min(1000, Math.max(1, Number(qs.get('page')) || 1));
    const perPage = 50;
    const affiliateId = qs.get('affiliateId') || '';
    const source = qs.get('source') || '';
    const search = (qs.get('search') || '').trim().slice(0, 80);
    const sourceOptions = ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO', 'UNATTRIBUTED', 'UNVERIFIED', 'CONFLICT'];
    const where: Prisma.HvCodOrderWhereInput = {};
    if (affiliateId) where.affiliateId = affiliateId;
    if (sourceOptions.includes(source)) where.attributionSource = source;
    if (search) where.OR = [
      { orderName: { contains: search, mode: 'insensitive' } },
      { discountCode: { contains: search, mode: 'insensitive' } },
      { referralCode: { contains: search, mode: 'insensitive' } },
    ];

    const [count, orders, partners] = await Promise.all([
      prisma.hvCodOrder.count({ where }),
      prisma.hvCodOrder.findMany({
        where, orderBy: { shopifyUpdatedAt: 'desc' },
        skip: (page - 1) * perPage, take: perPage,
        select: { id: true, orderName: true, orderTotalPiasters: true,
          subtotalPiasters: true, currency: true, shopifyUpdatedAt: true,
          referralCode: true, affiliateId: true, attributionSource: true, discountCode: true,
          isCod: true, cancelled: true, refunded: true, delivered: true,
          courierCollected: true, merchantReconciled: true },
      }),
      prisma.affiliate.findMany({ select: { id: true, referralCode: true,
        user: { select: { name: true, status: true } } }, take: 1000 }),
    ]);
    const byId = new Map(partners.map(p => [p.id, p]));
    return NextResponse.json({
      success: true, total: count, page, perPage,
      partners: partners.filter(p => p.user.status === 'ACTIVE').map(p => ({
        id: p.id, name: p.user.name, code: p.referralCode,
      })),
      orders: orders.map(o => ({
        id: o.id, orderName: o.orderName,
        totalEGP: (o.orderTotalPiasters / 100).toFixed(2),
        subtotalEGP: (o.subtotalPiasters / 100).toFixed(2),
        currency: o.currency, updatedAt: o.shopifyUpdatedAt,
        attributionSource: o.attributionSource,
        referralCode: o.referralCode, discountCode: o.discountCode,
        affiliateId: o.affiliateId,
        partnerName: o.affiliateId ? byId.get(o.affiliateId)?.user.name || 'Partner unavailable' : null,
        status: orderStatus(o),
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load Shopify orders' }, { status: 500 });
  }
}
