import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { orderStatus } from '@/lib/hv-order-attribution';

/** Private read-only orders for the authenticated, approved partner. */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'AFFILIATE')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true, emailVerifiedAt: true,
        affiliate: { select: { id: true, referralCode: true } } },
    });
    if (user?.role !== 'AFFILIATE' || user.status !== 'ACTIVE' ||
        !user.emailVerifiedAt || !user.affiliate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const affiliateId = user.affiliate.id;
    const page = Math.min(1000, Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1));
    const perPage = 25;
    const where = { affiliateId,
      attributionSource: { in: ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'] },
    } as Prisma.HvCodOrderWhereInput;
    const search = (request.nextUrl.searchParams.get('search') || '').trim().slice(0, 80);
    const source = request.nextUrl.searchParams.get('source') || '';
    const status = request.nextUrl.searchParams.get('status') || '';
    const from = request.nextUrl.searchParams.get('from') || '';
    const to = request.nextUrl.searchParams.get('to') || '';
    if (search) where.OR = [
      { orderName: { contains: search, mode: 'insensitive' } },
      { discountCode: { contains: search, mode: 'insensitive' } },
    ];
    if (['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'].includes(source))
      where.attributionSource = source;
    if (status === 'REFUNDED') where.refunded = true;
    if (status === 'CANCELLED') { where.cancelled = true; where.refunded = false; }
    if (status === 'PENDING_DELIVERY') {
      where.delivered = false; where.isCod = true; where.cancelled = false; where.refunded = false;
    }
    if (status === 'AWAITING_COD_RECONCILIATION') {
      where.delivered = true; where.isCod = true; where.merchantReconciled = false;
      where.cancelled = false; where.refunded = false;
    }
    if (status === 'PENDING_FINANCIAL_APPROVAL') {
      where.delivered = true; where.isCod = true; where.courierCollected = true;
      where.merchantReconciled = true; where.cancelled = false; where.refunded = false;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(from) || /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const gte = /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(from + 'T00:00:00Z') : undefined;
      const lt = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(new Date(to + 'T00:00:00Z').getTime() + 86400000) : undefined;
      if ((!gte || !Number.isNaN(gte.getTime())) && (!lt || !Number.isNaN(lt.getTime())))
        where.shopifyUpdatedAt = { gte, lt };
    }
    const [total, orders] = await Promise.all([
      prisma.hvCodOrder.count({ where }),
      prisma.hvCodOrder.findMany({
        where, orderBy: { shopifyUpdatedAt: 'desc' },
        skip: (page - 1) * perPage, take: perPage,
        select: {
          id: true, orderName: true, subtotalPiasters: true, orderTotalPiasters: true,
          currency: true, shopifyUpdatedAt: true, isCod: true, delivered: true,
          courierCollected: true, merchantReconciled: true, cancelled: true,
          refunded: true, attributionSource: true, discountCode: true,
          bostaState: true, bostaTrackingNumber: true,
        },
      }),
    ]);
    const safeOrders = orders.map(o => ({
      id: o.id, orderName: o.orderName,
      totalEGP: (o.orderTotalPiasters / 100).toFixed(2),
      subtotalEGP: (o.subtotalPiasters / 100).toFixed(2),
      currency: o.currency, updatedAt: o.shopifyUpdatedAt,
      attributionSource: o.attributionSource, discountCode: o.discountCode,
      status: orderStatus(o),
      bostaState: o.bostaState, trackingNumber: o.bostaTrackingNumber,
      cod: o.isCod, courierCollected: o.courierCollected,
      reconciled: o.merchantReconciled,
    }));
    return NextResponse.json({ success: true, orders: safeOrders, total, page,
      perPage, commissionsApproved: false },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load Shopify order tracking' }, { status: 500 });
  }
}
