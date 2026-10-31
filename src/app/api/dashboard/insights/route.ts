import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Read-only, role-scoped dashboard of actually synchronized Refferq orders.
 * No Shopify order mutation, no Bosta state modification, no commission approval.
 * Order line items / return reasons are NOT stored in hv_cod_orders; do not invent them.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const headerRole = request.headers.get('x-authenticated-role');
  if (!userId || !['ADMIN', 'AFFILIATE'].includes(headerRole || '')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, status: true, emailVerifiedAt: true,
        affiliate: { select: { id: true, referralCode: true } } },
    });
    if (!user || user.status !== 'ACTIVE' || user.role !== headerRole ||
        (user.role === 'AFFILIATE' && (!user.emailVerifiedAt || !user.affiliate))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    const admin = user.role === 'ADMIN';
    const requestedDays = Number(request.nextUrl.searchParams.get('days') || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const from = new Date(Date.now() - days * 86400_000);
    const orderWhere: Prisma.HvCodOrderWhereInput = {
      shopifyUpdatedAt: { gte: from },
      ...(!admin ? { affiliateId: user.affiliate!.id,
        attributionSource: { in: ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'] } } : {}),
    };
    const affiliateFilter = admin ? (request.nextUrl.searchParams.get('affiliateId') || '') : '';
    if (admin && affiliateFilter && /^[a-zA-Z0-9_-]{5,90}$/.test(affiliateFilter)) {
      orderWhere.affiliateId = affiliateFilter;
    }
    const commissionWhere: Prisma.CommissionWhereInput = {
      createdAt: { gte: from },
      ...(!admin ? { affiliateId: user.affiliate!.id } :
        (affiliateFilter ? { affiliateId: affiliateFilter } : {})),
    };
    const clicksWhere: Prisma.ReferralClickWhereInput = {
      createdAt: { gte: from },
      ...(!admin ? { referral: { affiliateId: user.affiliate!.id } } :
        (affiliateFilter ? { referral: { affiliateId: affiliateFilter } } : {})),
    };
    const [orders, totalOrders, clicks, totalClicks, commissions, partners, coupons, leads] =
      await Promise.all([
        prisma.hvCodOrder.findMany({
          where: orderWhere, orderBy: { shopifyUpdatedAt: 'desc' }, take: 2001,
          select: {
            id: true, shopifyOrderId: true, orderName: true, orderTotalPiasters: true,
            commissionPreviewPiasters: true, shopifyUpdatedAt: true, affiliateId: true,
            referralCode: true, discountCode: true, attributionSource: true, currency: true,
            isCod: true, delivered: true, cancelled: true, refunded: true,
            courierCollected: true, merchantReconciled: true, bostaState: true,
            bostaTrackingNumber: true,
          },
        }),
        prisma.hvCodOrder.count({ where: orderWhere }),
        prisma.referralClick.findMany({ where: clicksWhere, orderBy: { createdAt: 'desc' },
          take: 2001, select: { createdAt: true } }),
        prisma.referralClick.count({ where: clicksWhere }),
        prisma.commission.findMany({ where: commissionWhere,
          select: { amountCents: true, status: true } }),
        admin ? prisma.affiliate.findMany({
          take: 1000, select: { id: true, referralCode: true,
            user: { select: { name: true, status: true } } } }) : Promise.resolve([]),
        admin ? prisma.coupon.count({ where: { isActive: true, shopifyStatus: 'ACTIVE',
          startsAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } })
          : Promise.resolve(0),
        prisma.referral.count({ where: {
          createdAt: { gte: from },
          ...(!admin ? { affiliateId: user.affiliate!.id } :
            (affiliateFilter ? { affiliateId: affiliateFilter } : {})),
        }}),
      ]);
    const limited = orders.slice(0, 2000);
    const partnerMap = new Map(partners.map(p => [p.id,
      { name: p.user.name, referralCode: p.referralCode }]));
    const totals = { trackedOrders: totalOrders, clicks: totalClicks, leads,
      orderValueEGP: 0, deliveredOrders: 0, pendingOrders: 0,
      returnedOrders: 0, cancelledOrders: 0, settledOrders: 0 };
    const rows = limited.map(o => {
      const state = o.refunded ? 'REFUNDED' : o.cancelled ? 'CANCELLED' :
        o.delivered ? 'DELIVERED' : 'PENDING';
      if (o.currency === 'EGP') totals.orderValueEGP += o.orderTotalPiasters / 100;
      if (state === 'DELIVERED') totals.deliveredOrders++;
      if (state === 'PENDING') totals.pendingOrders++;
      if (state === 'REFUNDED') totals.returnedOrders++;
      if (state === 'CANCELLED') totals.cancelledOrders++;
      if (o.merchantReconciled) totals.settledOrders++;
      return {
        id: o.id, name: o.orderName, date: o.shopifyUpdatedAt.toISOString(),
        totalEGP: o.currency === 'EGP' ? o.orderTotalPiasters / 100 : null,
        currency: o.currency, code: o.discountCode || null,
        referralCode: o.referralCode || null, source: o.attributionSource,
        status: state, cod: o.isCod, collected: o.courierCollected,
        reconciled: o.merchantReconciled, bostaState: o.bostaState,
        trackingNumber: admin ? o.bostaTrackingNumber : null,
        returnReason: null, // This is not yet collected by the connector.
        product: null, // Product line items are not in hv_cod_orders.
        partnerId: admin ? o.affiliateId : null,
        partner: admin ? (partnerMap.get(o.affiliateId || '')?.name || null) : null,
        shopifyOrderUrl: admin && /^\d+$/.test(o.shopifyOrderId)
          ? 'https://admin.shopify.com/store/herbal-vitaly-2/orders/' + o.shopifyOrderId : null,
      };
    });
    const finance = {
      approvedEGP: commissions.filter(c => c.status === 'APPROVED')
        .reduce((a, c) => a + c.amountCents / 100, 0),
      pendingEGP: commissions.filter(c => c.status === 'PENDING')
        .reduce((a, c) => a + c.amountCents / 100, 0),
      paidEGP: commissions.filter(c => c.status === 'PAID')
        .reduce((a, c) => a + c.amountCents / 100, 0),
    };
    return NextResponse.json({
      success: true, role: user.role, name: user.name,
      referralCode: !admin ? user.affiliate!.referralCode : null,
      days, totals, finance,
      activeCoupons: coupons,
      orders: rows, clicksByDay: clicks.slice(0, 2000).map(c => c.createdAt.toISOString().slice(0, 10)),
      partners: admin ? partners.filter(p => p.user.status === 'ACTIVE')
        .map(p => ({ id: p.id, name: p.user.name, code: p.referralCode })) : [],
      complete: orders.length <= 2000 && clicks.length <= 2000,
      limitations: {
        returnReasons: 'Not yet provided by Bosta/Shopify order connector',
        productLineItems: 'Not yet stored in Refferq order table',
        revenue: 'Synchronized order value; not collected revenue',
        conversion: 'Attributed Shopify orders / tracked clicks (indicative)',
        commission: 'Only recorded commission ledger entries, never estimated payouts',
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load dashboard analytics' }, { status: 500 });
  }
}
