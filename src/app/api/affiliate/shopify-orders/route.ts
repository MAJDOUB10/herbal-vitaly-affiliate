import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { orderStatus } from '@/lib/hv-order-attribution';

/**
 * Authenticated, read-only Herbal Vitaly partner order intelligence.
 * Data source: synchronized hv_cod_orders; no inference of Bosta state codes,
 * product lines, return reasons or per-order commission ledger entries.
 */
const ATTRIBUTED = ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'];
const headers = { 'Cache-Control': 'private, no-store' };
const timezone = 'Africa/Cairo';
const cairoDay = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)?.value || '';
  return part('year') + '-' + part('month') + '-' + part('day');
};
function shiftDay(day: string, n: number) {
  const dt = new Date(day + 'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function cairoMidnight(day: string) {
  const [y,m,d] = day.split('-').map(Number);
  const noonUtc = Date.UTC(y,m-1,d,12,0,0);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(noonUtc));
  const val = (name: string) => Number(parts.find(p => p.type === name)?.value || 0);
  const localNoonEpoch = Date.UTC(val('year'),val('month')-1,val('day'),val('hour'),val('minute'));
  const offset = localNoonEpoch - noonUtc;
  return new Date(Date.UTC(y,m-1,d) - offset);
}
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(new Date(s + 'T00:00:00Z').getTime()) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0,10) === s;
function filterDates(params: URLSearchParams) {
  const today = cairoDay(new Date());
  const preset = params.get('period') || '';
  let from = '', to = '';
  switch (preset) {
    case 'today': from=today; to=today; break;
    case 'yesterday': from=shiftDay(today,-1); to=from; break;
    case '7d': from=shiftDay(today,-6); to=today; break;
    case '30d': from=shiftDay(today,-29); to=today; break;
    case '90d': from=shiftDay(today,-89); to=today; break;
    case 'this-month': from=today.slice(0,7)+'-01'; to=today; break;
    case 'last-month': {
      const beginning = today.slice(0,7)+'-01';
      to=shiftDay(beginning,-1); from=to.slice(0,7)+'-01'; break;
    }
    default: break;
  }
  if (preset === 'custom' || !preset) {
    from = params.get('from') || '';
    to = params.get('to') || '';
  }
  if (from && !isDay(from)) throw new Error('Invalid from date');
  if (to && !isDay(to)) throw new Error('Invalid to date');
  if (from && to && from > to) throw new Error('Invalid date range');
  if (from && to && (cairoMidnight(shiftDay(to,1)).getTime() - cairoMidnight(from).getTime()) > 366*86400_000)
    throw new Error('Select a date range of up to one year');
  return { from, to };
}
function addOrderFilters(where: Prisma.HvCodOrderWhereInput, params: URLSearchParams) {
  const search = (params.get('search') || '').trim().slice(0,80);
  const coupon = (params.get('coupon') || '').trim().slice(0,80);
  const source = params.get('source') || '';
  const status = params.get('status') || params.get('delivery') || '';
  const payment = params.get('payment') || '';
  const finance = params.get('finance') || '';
  if (search) where.OR = [
    { orderName: { contains: search, mode: 'insensitive' } },
    { shopifyOrderId: { contains: search, mode: 'insensitive' } },
    { discountCode: { contains: search, mode: 'insensitive' } },
  ];
  if (coupon) where.discountCode = coupon;
  if (ATTRIBUTED.includes(source)) where.attributionSource = source;
  if (payment === 'COD') where.isCod = true;
  if (payment === 'NON_COD') where.isCod = false;
  if (finance === 'RECONCILED') where.merchantReconciled = true;
  if (finance === 'NOT_RECONCILED') where.merchantReconciled = false;
  if (status === 'REFUNDED' || status === 'RETURNED') where.refunded = true;
  if (status === 'CANCELLED') { where.cancelled=true; where.refunded=false; }
  if (status === 'PENDING' || status === 'PENDING_DELIVERY') {
    where.delivered=false; where.cancelled=false; where.refunded=false;
  }
  if (status === 'DELIVERED') {
    where.delivered=true; where.cancelled=false; where.refunded=false;
  }
  if (status === 'NON_COD_REVIEW') {
    where.isCod=false; where.cancelled=false; where.refunded=false;
  }
  if (status === 'AWAITING_COD_RECONCILIATION') {
    where.isCod=true; where.delivered=true; where.merchantReconciled=false;
    where.cancelled=false; where.refunded=false;
  }
  if (status === 'PENDING_FINANCIAL_APPROVAL') {
    where.delivered=true; where.isCod=true; where.courierCollected=true;
    where.merchantReconciled=true; where.cancelled=false; where.refunded=false;
  }
  const {from,to} = filterDates(params);
  if (from || to) where.shopifyUpdatedAt = {
    ...(from ? { gte:cairoMidnight(from) } : {}),
    ...(to ? { lt:cairoMidnight(shiftDay(to,1)) } : {}),
  };
}
const selectOrder = {
  id:true, orderName:true, subtotalPiasters:true, orderTotalPiasters:true,
  currency:true, shopifyUpdatedAt:true, isCod:true, delivered:true,
  courierCollected:true, merchantReconciled:true, cancelled:true,
  refunded:true, attributionSource:true, discountCode:true,
  bostaState:true, bostaTrackingNumber:true, bostaUpdatedAt:true,
  merchantSettledAt:true, collectedPiasters:true,
} satisfies Prisma.HvCodOrderSelect;
type OrderRecord = Prisma.HvCodOrderGetPayload<{ select: typeof selectOrder }>;
function serializeOrder(o: OrderRecord) {
  return {
    id:o.id, orderName:o.orderName,
    totalEGP:o.currency === 'EGP' ? (o.orderTotalPiasters/100).toFixed(2) : null,
    subtotalEGP:o.currency === 'EGP' ? (o.subtotalPiasters/100).toFixed(2) : null,
    currency:o.currency, updatedAt:o.shopifyUpdatedAt.toISOString(),
    attributionSource:o.attributionSource, discountCode:o.discountCode,
    status:orderStatus(o),
    delivered:o.delivered, refunded:o.refunded, cancelled:o.cancelled,
    bostaState:o.bostaState, trackingNumber:o.bostaTrackingNumber,
    bostaUpdatedAt:o.bostaUpdatedAt?.toISOString() || null,
    merchantSettledAt:o.merchantSettledAt?.toISOString() || null,
    cod:o.isCod, courierCollected:o.courierCollected,
    reconciled:o.merchantReconciled,
    collectedEGP:o.currency === 'EGP' ? (o.collectedPiasters/100).toFixed(2) : null,
    product:null, returnReason:null, commissionStatus:null,
  };
}
const protectCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g,'""') + '"';
};

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'AFFILIATE')
    return NextResponse.json({ error:'Unauthorized' }, {status:401,headers});
  try {
    const user = await prisma.user.findUnique({
      where:{id:userId},
      select:{role:true,status:true,emailVerifiedAt:true,
        affiliate:{select:{id:true}}},
    });
    if (user?.role !== 'AFFILIATE' || user.status !== 'ACTIVE' ||
      !user.emailVerifiedAt || !user.affiliate)
      return NextResponse.json({error:'Forbidden'},{status:403,headers});

    const affiliateId = user.affiliate.id;
    const page = Math.min(1000, Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1));
    const perPage = [10,25,50].includes(Number(request.nextUrl.searchParams.get('perPage')))
      ? Number(request.nextUrl.searchParams.get('perPage')) : 25;
    // Identity is always from the trusted authenticated session, never URL input.
    const where = { affiliateId,
      attributionSource: { in: ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'] },
    } as Prisma.HvCodOrderWhereInput;
    try { addOrderFilters(where, request.nextUrl.searchParams); }
    catch (err) { return NextResponse.json({
      error:err instanceof Error ? err.message : 'Invalid filters',
    }, {status:400,headers}); }
    const sort = request.nextUrl.searchParams.get('sort') || 'newest';
    const orderBy: Prisma.HvCodOrderOrderByWithRelationInput[] =
      sort === 'oldest' ? [{shopifyUpdatedAt:'asc'},{id:'asc'}] :
      sort === 'highest' ? [{orderTotalPiasters:'desc'},{id:'desc'}] :
      sort === 'lowest' ? [{orderTotalPiasters:'asc'},{id:'asc'}] :
      [{shopifyUpdatedAt:'desc'},{id:'desc'}];

    const [total, orders, orderValue, deliveredCount, pendingCount,
      refundedCount, cancelledCount, reconciledCount, collectedCount,
      deliveredValue, collectedValue, latest] = await Promise.all([
      prisma.hvCodOrder.count({where}),
      prisma.hvCodOrder.findMany({where,orderBy,skip:(page-1)*perPage,take: perPage,select:selectOrder}),
      prisma.hvCodOrder.aggregate({where:{...where,currency:'EGP'},_sum:{orderTotalPiasters:true}}),
      prisma.hvCodOrder.count({where:{...where,delivered:true,cancelled:false,refunded:false}}),
      prisma.hvCodOrder.count({where:{...where,delivered:false,cancelled:false,refunded:false}}),
      prisma.hvCodOrder.count({where:{...where,refunded:true}}),
      prisma.hvCodOrder.count({where:{...where,cancelled:true,refunded:false}}),
      prisma.hvCodOrder.count({where:{...where,merchantReconciled:true,cancelled:false,refunded:false}}),
      prisma.hvCodOrder.count({where:{...where,courierCollected:true,cancelled:false,refunded:false}}),
      prisma.hvCodOrder.aggregate({where:{...where,currency:'EGP',delivered:true,cancelled:false,refunded:false},_sum:{orderTotalPiasters:true}}),
      prisma.hvCodOrder.aggregate({where:{...where,currency:'EGP',merchantReconciled:true,cancelled:false,refunded:false},_sum:{collectedPiasters:true}}),
      prisma.hvCodOrder.findFirst({where,orderBy:{shopifyUpdatedAt:'desc'},select:{shopifyUpdatedAt:true}}),
    ]);
    const summary = {
      totalOrders:total, orderValueEGP:(orderValue._sum.orderTotalPiasters||0)/100,
      deliveredValueEGP:(deliveredValue._sum.orderTotalPiasters||0)/100,
      collectedReconciledEGP:(collectedValue._sum.collectedPiasters||0)/100,
      deliveredOrders:deliveredCount, pendingOrders:pendingCount,
      refundedOrders:refundedCount,cancelledOrders:cancelledCount,
      reconciledOrders:reconciledCount, collectedOrders:collectedCount,
      deliverySuccessPercent:total>0 ? Number((100*deliveredCount/total).toFixed(1)) : null,
    };
    if (request.nextUrl.searchParams.get('export') === 'csv') {
      if (total > 25000) return NextResponse.json({
        error:'Export exceeds 25,000 orders. Please narrow your date range.',
      }, {status:413,headers});
      const encoder = new TextEncoder();
      let offset = 0;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const cols = ['Order','Shopify Updated (UTC)','Promo Code','Attribution','Delivery Status',
            'Payment','Courier Collection','Merchant Reconciled','Value EGP','Currency','Tracking Number'];
          controller.enqueue(encoder.encode('\uFEFF'+cols.map(protectCell).join(',')+'\r\n'));
        },
        async pull(controller) {
          try {
            const batch = await prisma.hvCodOrder.findMany({
              where,orderBy,skip:offset,take:500,select:selectOrder,
            });
            if (!batch.length) { controller.close();return; }
            offset += batch.length;
            const csv = batch.map(o => {
              const d=serializeOrder(o);
              return [d.orderName,d.updatedAt,d.discountCode,d.attributionSource,d.status,
                d.cod?'COD':'Non-COD',d.courierCollected?'Recorded':'Not confirmed',
                d.reconciled?'Yes':'No',d.totalEGP,d.currency,d.trackingNumber].map(protectCell).join(',');
            }).join('\r\n')+'\r\n';
            controller.enqueue(encoder.encode(csv));
            if (batch.length < 500 || offset >= total) controller.close();
          } catch (error) { controller.error(error); }
        },
      });
      return new Response(stream, {
        headers:{
          'Content-Type':'text/csv; charset=utf-8',
          'Content-Disposition':'attachment; filename="HerbalVitaly_Partner_Orders.csv"',
          'Cache-Control':'private, no-store',
          'X-Content-Type-Options':'nosniff',
        },
      });
    }

    // Trend charts may be sampled, but all KPI aggregates above are exact.
    const trendRecords = await prisma.hvCodOrder.findMany({
      where,orderBy:[{shopifyUpdatedAt:'desc'},{id:'desc'}],
      select:{shopifyUpdatedAt:true,orderTotalPiasters:true,currency:true},
      take:5001,
    });
    const trendComplete = trendRecords.length <= 5000;
    const byDay = new Map<string,{date:string,orders:number,valueEGP:number}>();
    trendRecords.slice(0,5000).forEach(o => {
      const key=cairoDay(o.shopifyUpdatedAt);
      const v=byDay.get(key)||{date:key,orders:0,valueEGP:0};
      v.orders++;
      if (o.currency==='EGP') v.valueEGP+=o.orderTotalPiasters/100;
      byDay.set(key,v);
    });
    return NextResponse.json({
      success:true,orders:orders.map(serializeOrder),total,page,perPage,
      summary,trend:Array.from(byDay.values()).sort((a,b)=>a.date.localeCompare(b.date)),
      trendComplete,latestUpdatedAt:latest?.shopifyUpdatedAt.toISOString()||null,
      commissionsApproved:false,
      limitations:{
        product:'Line items are not stored in synchronized orders',
        returns:'Detailed return reasons are not currently synchronized',
        commissions:'Per-order commission approval is not linked to this order record',
        bosta:'Raw Bosta codes have not been mapped to verified timeline events',
      },
    },{headers});
  } catch {
    return NextResponse.json({error:'Unable to load Shopify order tracking'},{status:500,headers});
  }
}
