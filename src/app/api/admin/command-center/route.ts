import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Read-only executive operating queues for Herbal Vitaly.
 * Money, revenue and payable commissions belong to the dedicated
 * finance ledger and reconciliation endpoints. Do not infer payouts.
 * Security: src/proxy.ts verifies auth and injects trusted identity headers;
 * this endpoint additionally checks the ACTIVE ADMIN user in the database.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN') {
    return NextResponse.json({ error: 'Administrator sign-in required' }, { status: 401 });
  }

  try {
    const actor = await prisma.user.findUnique({
      where: { id: userId }, select: { role: true, status: true },
    });
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Administrator access denied' }, { status: 403 });
    }
    const requested = Number(request.nextUrl.searchParams.get('days') ?? 30);
    const days = [7, 30, 90].includes(requested) ? requested : 30;
    const from = new Date(Date.now() - days * 86_400_000);
    const orderWindow: Prisma.HvCodOrderWhereInput = { shopifyUpdatedAt: { gte: from } };
    const openTicket = { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTNER'] } };
    const codQueue: Prisma.HvCodOrderWhereInput = {
      isCod: true, delivered: true, courierCollected: true, merchantReconciled: false,
      cancelled: false, refunded: false,
    };

    const [
      activePartners, pendingPartners, unverifiedPartners,
      openTickets, urgentTickets, pendingPayouts, pendingPayoutAmount,
      activeCoupons, couponSyncIssues, codWaiting, attributionIssues,
      recentlyJoined, recentTickets, topGroups,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'AFFILIATE', status: 'ACTIVE',
        emailVerifiedAt: { not: null }, affiliate: { isNot: null } } }),
      prisma.user.count({ where: { role: 'AFFILIATE', status: 'PENDING' } }),
      prisma.user.count({ where: { role: 'AFFILIATE', status: 'PENDING',
        emailVerifiedAt: null } }),
      prisma.supportTicket.count({ where: openTicket }),
      prisma.supportTicket.count({ where: { ...openTicket,
        priority: { in: ['HIGH', 'URGENT'] } } }),
      prisma.payout.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      prisma.payout.aggregate({ where: { status: { in: ['PENDING', 'PROCESSING'] } },
        _sum: { amountCents: true } }),
      prisma.coupon.count({ where: { source: 'SHOPIFY', isActive: true,
        shopifyStatus: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
      prisma.coupon.count({ where: { source: 'SHOPIFY',
        shopifyStatus: { in: ['PENDING', 'FAILED', 'EXPIRED', 'ERROR'] }, isActive: false } }),
      prisma.hvCodOrder.count({ where: codQueue }),
      prisma.hvCodOrder.count({ where: { ...orderWindow,
        attributionSource: { in: ['CONFLICT', 'UNVERIFIED', 'UNATTRIBUTED'] } } }),
      prisma.user.findMany({ where: { role: 'AFFILIATE', createdAt: { gte: from } },
        orderBy: { createdAt: 'desc' }, take: 6,
        select: { id: true, name: true, status: true, createdAt: true,
          affiliate: { select: { id: true, referralCode: true } } } }),
      prisma.supportTicket.findMany({ where: openTicket,
        orderBy: { lastMessageAt: 'desc' }, take: 5,
        select: { id: true, subject: true, status: true, priority: true, lastMessageAt: true,
          user: { select: { name: true } } } }),
      prisma.hvCodOrder.groupBy({
        by: ['affiliateId'],
        where: { ...orderWindow, currency: 'EGP', affiliateId: { not: null } },
        _count: { _all: true },
        _sum: { orderTotalPiasters: true },
        orderBy: { _sum: { orderTotalPiasters: 'desc' } },
        take: 8,
      }),
    ]);

    const topIds = topGroups.map(g => g.affiliateId).filter((id): id is string => !!id);
    const topPartners = await prisma.affiliate.findMany({
      where: { id: { in: topIds } },
      select: { id: true, referralCode: true, user: { select: { name: true } } },
    });
    const partnerMap = new Map(topPartners.map(p => [p.id, p]));
    const leaderboard = topGroups.map(g => ({
      affiliateId: g.affiliateId,
      name: partnerMap.get(g.affiliateId || '')?.user.name ?? 'Partner',
      referralCode: partnerMap.get(g.affiliateId || '')?.referralCode ?? '—',
      orderCount: g._count._all,
      trackedOrderValueEGP: (g._sum.orderTotalPiasters || 0) / 100,
    }));

    return NextResponse.json({
      success: true, days, currency: 'EGP', dataAsOf: new Date().toISOString(),
      liveQueues: {
        activePartners, pendingPartners, unverifiedPartners,
        openTickets, urgentTickets, pendingPayouts,
        pendingPayoutValueEGP: (pendingPayoutAmount._sum.amountCents || 0) / 100,
        activeShopifyCoupons: activeCoupons,
        couponSyncIssues, codWaiting,
      },
      period: { attributionIssues },
      newPartners: recentlyJoined.map(p => ({
        id: p.id, name: p.name, status: p.status, createdAt: p.createdAt,
        referralCode: p.affiliate?.referralCode ?? null,
      })),
      supportQueue: recentTickets.map(t => ({
        id: t.id, subject: t.subject, status: t.status, priority: t.priority,
        lastMessageAt: t.lastMessageAt, partner: t.user.name,
      })),
      leaderboard,
      caveats: [
        'Live action queues are not limited to the selected reporting date range.',
        'Partner ranking is by synchronized Shopify order value, not paid revenue.',
        'Payout queue amounts are requested records, not bank transfers or approved payables.',
        'COD awaiting reconciliation is not necessarily unpaid by the end customer.',
      ],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Admin command center read failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Admin operating queues are temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
