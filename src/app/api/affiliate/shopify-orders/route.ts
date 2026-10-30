import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Read-only Shopify order tracking for the authenticated affiliate.
 * Only their own, previously verified referralCode is queried.
 * Never exposes customer PII or creates/approves commissions.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'AFFILIATE')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true, affiliate: { select: { referralCode: true } } },
    });
    if (!user || user.role !== 'AFFILIATE' || user.status !== 'ACTIVE' ||
        !user.affiliate?.referralCode) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const orders = await prisma.hvCodOrder.findMany({
      where: { referralCode: user.affiliate.referralCode },
      orderBy: { shopifyUpdatedAt: 'desc' },
      take: 25,
      select: {
        id: true, orderName: true, orderTotalPiasters: true, currency: true,
        shopifyUpdatedAt: true, isCod: true, delivered: true, courierCollected: true,
        merchantReconciled: true, cancelled: true, refunded: true,
      },
    });
    const safeOrders = orders.map(order => ({
      id: order.id,
      orderName: order.orderName,
      totalEGP: (order.orderTotalPiasters / 100).toFixed(2),
      currency: order.currency,
      updatedAt: order.shopifyUpdatedAt,
      status: order.cancelled ? 'CANCELLED' : order.refunded ? 'REFUNDED' :
        !order.isCod ? 'NON_COD_REVIEW' :
        order.delivered && order.courierCollected && order.merchantReconciled ?
          'PENDING_FINANCIAL_APPROVAL' : 'PENDING_DELIVERY_AND_COLLECTION',
    }));
    return NextResponse.json(
      { success: true, orders: safeOrders, commissionsApproved: false },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Unable to load Shopify order tracking' }, { status: 500 });
  }
}
