import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Operational finance snapshot, NOT a statutory accounting statement.
 *
 * Authentication: src/proxy.ts verifies the signed HttpOnly cookie, discards any
 * user-supplied identity headers and injects x-user-id / x-authenticated-role.
 *
 * Financial posting and payouts are deliberately not enabled here. Bosta
 * delivered/collected is not proof of settlement with Herbal Vitaly.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requestedDays = Number(request.nextUrl.searchParams.get('days') || 30);
    const days = [7, 30, 90, 365].includes(requestedDays) ? requestedDays : 30;
    const from = new Date(Date.now() - days * 86_400_000);
    const orders: Prisma.HvCodOrderWhereInput = {
      currency: 'EGP',
      shopifyUpdatedAt: { gte: from },
    };
    const eligibleDelivered: Prisma.HvCodOrderWhereInput = {
      ...orders, delivered: true, cancelled: false, refunded: false,
    };
    const settledCod: Prisma.HvCodOrderWhereInput = {
      ...eligibleDelivered, isCod: true, courierCollected: true, merchantReconciled: true,
      merchantSettlementReference: { not: null },
    };
    const waitingCod: Prisma.HvCodOrderWhereInput = {
      ...eligibleDelivered, isCod: true, courierCollected: true, merchantReconciled: false,
    };
    const commissions: Prisma.CommissionWhereInput = { createdAt: { gte: from } };

    const [
      allOrders, delivered, cancelled, refunded, settled, waiting,
      pendingCommissions, approvedCommissions, paidCommissions,
    ] = await Promise.all([
      prisma.hvCodOrder.aggregate({
        where: orders, _count: { _all: true }, _sum: { orderTotalPiasters: true },
      }),
      prisma.hvCodOrder.count({ where: eligibleDelivered }),
      prisma.hvCodOrder.count({ where: { ...orders, cancelled: true } }),
      prisma.hvCodOrder.count({ where: { ...orders, refunded: true } }),
      prisma.hvCodOrder.aggregate({
        where: settledCod, _count: { _all: true }, _sum: { orderTotalPiasters: true },
      }),
      prisma.hvCodOrder.aggregate({
        where: waitingCod, _count: { _all: true }, _sum: { orderTotalPiasters: true },
      }),
      prisma.commission.aggregate({
        where: { ...commissions, status: 'PENDING' }, _sum: { amountCents: true },
      }),
      prisma.commission.aggregate({
        where: { ...commissions, status: 'APPROVED' }, _sum: { amountCents: true },
      }),
      prisma.commission.aggregate({
        where: { ...commissions, status: 'PAID' }, _sum: { amountCents: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      days,
      currency: 'EGP',
      dataAsOf: new Date().toISOString(),
      operational: {
        trackedOrders: allOrders._count._all,
        trackedOrderValuePiasters: allOrders._sum.orderTotalPiasters || 0,
        deliveredOrders: delivered,
        cancelledOrders: cancelled,
        refundedOrders: refunded,
        codReconciledOrders: settled._count._all,
        codReconciledOrderValuePiasters: settled._sum.orderTotalPiasters || 0,
        codAwaitingReconciliationOrders: waiting._count._all,
        codAwaitingReconciliationOrderValuePiasters: waiting._sum.orderTotalPiasters || 0,
        pendingCommissionsPiasters: pendingCommissions._sum.amountCents || 0,
        approvedCommissionsPiasters: approvedCommissions._sum.amountCents || 0,
        paidCommissionsPiasters: paidCommissions._sum.amountCents || 0,
      },
      accounting: {
        connected: false,
        revenue: null,
        purchases: null,
        expenses: null,
        taxPayable: null,
        cashBalance: null,
        grossProfit: null,
        netProfit: null,
        balanceSheet: null,
      },
      limitations: [
        'Tracked Shopify order value is not accounting revenue or cash received.',
        'Bosta delivery/collection and COD reconciliation are distinct states.',
        'COD reconciled order value is not a bank statement balance.',
        'No supplier bills, product-level COGS, bank statements or tax postings are connected.',
        'Commission figures use recorded Refferq states only; never treat pending amounts as payable.',
      ],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Finance overview read failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Finance overview unavailable' }, { status: 500 });
  }
}
