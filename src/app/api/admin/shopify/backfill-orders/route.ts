import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { shopifyAdminGraphQL } from '@/lib/hv-shopify-discounts';
import { ingestShopifyOrderSnapshot } from '@/lib/hv-order-ingest';

/** Bounded, admin-triggered reconciliation for Shopify events missed while
 * webhooks were disabled. Does not approve any commission or alter Shopify.
 */
type ShopifyOrder = {
  id: string; name: string; updatedAt: string; currencyCode: string;
  currentSubtotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  discountCodes: string[];
  paymentGatewayNames: string[];
  cancelledAt: string | null;
  refunds: Array<{ id: string }>;
  displayFinancialStatus: string;
  customAttributes: Array<{ key: string; value: string }>;
};
const QUERY = `query HvRecentOrders($filter: String!) {
  orders(first: 50, query: $filter, sortKey: UPDATED_AT, reverse: true) {
    nodes {
      id name updatedAt currencyCode
      currentSubtotalPriceSet { shopMoney { amount currencyCode } }
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      discountCodes paymentGatewayNames cancelledAt
      refunds { id } displayFinancialStatus customAttributes { key value }
    }
    pageInfo { hasNextPage }
  }
}`;
async function authorized(request: NextRequest): Promise<boolean> {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN') return false;
  const user = await prisma.user.findUnique({ where: { id: userId },
    select: { role: true, status: true } });
  return user?.role === 'ADMIN' && user.status === 'ACTIVE';
}
export async function POST(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  if (process.env.VERCEL_ENV !== 'production' ||
      request.headers.get('origin') !== 'https://partner.herbalvitaly.com')
    return NextResponse.json({ error: 'Production portal only' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const days = body.days === 1 || body.days === 2 || body.days === 7 ? body.days : 2;
  const since = new Date(Date.now() - days * 86400000);
  const filter = 'updated_at:>=' + since.toISOString();
  try {
    const result = await shopifyAdminGraphQL<{
      orders: { nodes: ShopifyOrder[]; pageInfo: { hasNextPage: boolean } };
    }>(QUERY, { filter });
    let stored = 0, unchanged = 0, failed = 0;
    for (const order of result.orders.nodes) {
      try {
        const numeric = /^gid:\/\/shopify\/Order\/(\d+)$/.exec(order.id)?.[1];
        if (!numeric || order.currencyCode !== 'EGP') { failed++; continue; }
        const payload = {
          id: numeric,
          name: order.name,
          updated_at: order.updatedAt,
          currency: order.currencyCode,
          current_subtotal_price: order.currentSubtotalPriceSet.shopMoney.amount,
          current_total_price: order.currentTotalPriceSet.shopMoney.amount,
          discount_codes: order.discountCodes.map(code => ({ code })),
          payment_gateway_names: order.paymentGatewayNames,
          cancelled_at: order.cancelledAt,
          refunds: order.refunds,
          financial_status: order.displayFinancialStatus.toLowerCase(),
          note_attributes: order.customAttributes.map(({ key, value }) => ({ name: key, value })),
        };
        const received = await ingestShopifyOrderSnapshot(
          payload, 'orders/updated', 'backfill:' + numeric + ':' + order.updatedAt
        );
        if (received.status === 'stored') stored++;
        else unchanged++;
      } catch (e) {
        // Existing unique event keys are an expected result of an idempotent retry.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') unchanged++;
        else failed++;
      }
    }
    return NextResponse.json({ success: failed === 0, scanned: result.orders.nodes.length,
      importedOrUpdated: stored, unchanged, failed,
      moreAvailable: result.orders.pageInfo.hasNextPage,
      scope: 'Most recently updated ' + days + ' days, maximum 50 orders',
      financialValidation: 'NOT_PERFORMED',
    }, { status: failed ? 207 : 200, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({
      error: 'Cannot read Shopify orders with this app. Add read_orders to Affiliate Portal and approve its access.',
    }, { status: 503 });
  }
}
