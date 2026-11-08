import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { summarizeOrders, isSettledCod, isVerifiedAffiliate } from '@/lib/hv-performance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type VonderaSummary = { orders: bigint; total_piasters: string | number | bigint | null; last_sync: Date | null };

export async function GET(request: NextRequest) {
  const id = request.headers.get('x-user-id');
  if (!id || request.headers.get('x-authenticated-role') !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { role: true, status: true } });
    if (user?.role !== 'ADMIN' || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const requested = Number(request.nextUrl.searchParams.get('days') || 30);
    const days = [7, 30, 90, 365].includes(requested) ? requested : 30;
    const from = new Date(Date.now() - days * 86_400_000);
    const where = { currency: 'EGP', shopifyUpdatedAt: { gte: from } };
    const [allOrders, totalOrders, pending, approved, paid] = await Promise.all([
      prisma.hvCodOrder.findMany({
        where, orderBy: { shopifyUpdatedAt: 'desc' }, take: 2000,
        select: {
          orderName: true, shopifyUpdatedAt: true, subtotalPiasters: true,
          orderTotalPiasters: true, isCod: true, delivered: true,
          courierCollected: true, merchantReconciled: true,
          merchantSettlementReference: true, cancelled: true, refunded: true,
          affiliateId: true, attributionSource: true, discountCode: true,
        },
      }),
      prisma.hvCodOrder.count({ where }),
      prisma.commission.aggregate({
        where: { status: 'PENDING', conversion: { is: { currency: 'EGP' } }, createdAt: { gte: from } },
        _sum: { amountCents: true },
      }),
      prisma.commission.aggregate({
        where: { status: 'APPROVED', conversion: { is: { currency: 'EGP' } }, createdAt: { gte: from } },
        _sum: { amountCents: true },
      }),
      prisma.commission.aggregate({
        where: { status: 'PAID', conversion: { is: { currency: 'EGP' } }, createdAt: { gte: from } },
        _sum: { amountCents: true },
      }),
    ]);
    // Suppress aggregates when the bounded Shopify read is incomplete.
    const complete = allOrders.length === totalOrders;
    const summary = complete ? summarizeOrders(allOrders) : null;
    const affiliateBasisSubtotalPiasters = complete ? allOrders
      .filter(o => isSettledCod(o) && isVerifiedAffiliate(o))
      .reduce((sum, o) => sum + o.subtotalPiasters, 0) : null;

    let vondera: { orders: number; importedOrderValuePiasters: number; lastSync: string | null } | null = null;
    try {
      // SQL text is constant and $1 is bound, never interpolated into the SQL string.
      const sql = "SELECT COUNT(*)::bigint AS orders, COALESCE(SUM(total_piasters),0)::text AS total_piasters, MAX(synced_at) AS last_sync FROM hv_vondera_orders WHERE currency = 'EGP' AND synced_at >= $1";
      const data = await prisma.$queryRawUnsafe<VonderaSummary[]>(sql, from);
      const row = data[0];
      const numberOrders = Number(row?.orders || 0);
      const amount = Number(row?.total_piasters || 0);
      if (!Number.isSafeInteger(numberOrders) || !Number.isSafeInteger(amount)) throw new Error('Invalid aggregation');
      vondera = {
        orders: numberOrders, importedOrderValuePiasters: amount,
        lastSync: row?.last_sync?.toISOString() || null,
      };
    } catch (_) {
      // Raw Vondera table may be absent in a deployment. Never make Shopify totals depend on it.
    }

    return NextResponse.json({
      success: true, currency: 'EGP', days, dataAsOf: new Date().toISOString(),
      sourceHealth: {
        shopify: { state: complete ? 'TRACKED' : 'TRUNCATED', records: totalOrders },
        vondera: vondera ? { state: 'IMPORTED_UNRECONCILED', ...vondera } : { state: 'UNAVAILABLE' },
        meta: { state: 'NOT_CONNECTED' },
        bostaFees: { state: 'NOT_CONNECTED' },
        productCosts: { state: 'NOT_CONFIGURED' },
      },
      summary, affiliateBasisSubtotalPiasters,
      commissions: {
        pendingPiasters: pending._sum.amountCents || 0,
        approvedPiasters: approved._sum.amountCents || 0,
        paidPiasters: paid._sum.amountCents || 0,
      },
      orders: allOrders.slice(0, 200).map(o => ({
        orderName: o.orderName,
        updatedAt: o.shopifyUpdatedAt.toISOString(),
        amountPiasters: o.orderTotalPiasters,
        verifiedAffiliate: isVerifiedAffiliate(o),
        discountCode: o.discountCode,
        status: o.cancelled ? 'CANCELLED' : o.refunded ? 'REFUNDED' :
          isSettledCod(o) ? 'COD_RECONCILED' :
          o.isCod && o.delivered && o.courierCollected ? 'AWAITING_MERCHANT_SETTLEMENT' :
          o.delivered ? 'DELIVERED_UNRECONCILED' : 'UNCONFIRMED',
      })),
      limitations: [
        'Shopify totals describe imported order records, not audited revenue.',
        'COD merchant reconciliation is not verified bank cash.',
        'Vondera is reported separately because cross-platform order deduplication is unavailable.',
        'Actual product COGS, Meta expenses and Bosta fees are missing; actual profit cannot yet be calculated.',
        'Recorded affiliate commission status totals are not reconciled to individual Shopify orders.',
        ...(complete ? [] : ['More than 2,000 Shopify orders: period totals withheld to prevent partial results.']),
      ],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Admin performance error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Performance data unavailable' }, { status: 500 });
  }
}
