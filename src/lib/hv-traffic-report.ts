import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Read-only attributable traffic. Clicks and Shopify COD order snapshots are
 * separate sources of truth; session events are never treated as purchases.
 * Scope must be passed only by a trusted server-side authorization handler.
 */
const VERIFIED_SOURCES = ['AFFILIATE_LINK','PROMO_CODE','LINK_AND_PROMO'];

export function reportDays(value: string | null): number {
  const n = Number(value);
  return [1,7,30,90].includes(n) ? n : 30;
}

export async function trafficReport(affiliateIds: string[] | null, days: number) {
  const from = new Date(Date.now() - days * 86400_000);
  const affiliateFilter = affiliateIds === null ? {} : { affiliateId: { in: affiliateIds } };
  const clickWhere: Prisma.ReferralClickWhereInput = {
    createdAt:{gte:from},
    ...(affiliateIds === null ? {} : { referral: { affiliateId: { in: affiliateIds } } }),
  };
  const orderWhere: Prisma.HvCodOrderWhereInput = {
    ...affiliateFilter, shopifyUpdatedAt:{gte:from},
    attributionSource:{in:VERIFIED_SOURCES},
  };
  const validOrders: Prisma.HvCodOrderWhereInput = {
    ...orderWhere, cancelled:false, refunded:false, currency:'EGP',
  };
  const [clicks, recentClicks, attributedOrders, valid, delivered, reconciled] =
    await Promise.all([
      prisma.referralClick.count({where:clickWhere}),
      prisma.referralClick.findMany({
        where:clickWhere, orderBy:{createdAt:'desc'}, take:5001,
        select:{createdAt:true,referer:true},
      }),
      prisma.hvCodOrder.count({where:orderWhere}),
      prisma.hvCodOrder.aggregate({where:validOrders,
        _count:{_all:true},_sum:{orderTotalPiasters:true}}),
      prisma.hvCodOrder.count({where:{...validOrders,delivered:true}}),
      prisma.hvCodOrder.count({where:{...validOrders,merchantReconciled:true,courierCollected:true}}),
    ]);
  const byDay = new Map<string,number>();
  for (const click of recentClicks.slice(0,5000)) {
    const date=click.createdAt.toISOString().slice(0,10);
    byDay.set(date,(byDay.get(date)||0)+1);
  }
  let trackingReady = true;
  let eventsRecorded = 0;
  let sessions: number | null = 0;
  let activeSessions: number | null = 0;
  let sessionCountComplete = true;
  const eventCounts: Record<string,number> = {};
  let products: Array<{handle:string,views:number}> = [];
  let channels: Array<{name:string,events:number}> = [];
  try {
    const eventWhere: Prisma.HvVisitorEventWhereInput = {
      ...affiliateFilter, createdAt:{gte:from},
    };
    const [counts,uniqueSessions,active,productGroups,sourceGroups] = await Promise.all([
      prisma.hvVisitorEvent.groupBy({by:['eventType'],where:eventWhere,_count:{_all:true}}),
      prisma.hvVisitorEvent.findMany({where:eventWhere,distinct:['sessionId'],
        select:{sessionId:true},take:5001}),
      prisma.hvVisitorEvent.findMany({
        where:{...affiliateFilter,createdAt:{gte:new Date(Date.now()-5*60_000)}},
        distinct:['sessionId'],select:{sessionId:true},take:5001}),
      prisma.hvVisitorEvent.groupBy({
        by:['productHandle'],where:{...eventWhere,eventType:'PRODUCT_VIEWED',
          productHandle:{not:null}},_count:{_all:true},
      }),
      prisma.hvVisitorEvent.groupBy({by:['channel'],where:eventWhere,
        _count:{_all:true}}),
    ]);
    for (const item of counts) {
      eventCounts[item.eventType] = item._count._all;
      eventsRecorded += item._count._all;
    }
    sessionCountComplete=uniqueSessions.length<=5000 && active.length<=5000;
    sessions=uniqueSessions.length>5000?null:uniqueSessions.length;
    activeSessions=active.length>5000?null:active.length;
    products=productGroups.filter(x=>x.productHandle).map(x=>({
      handle:x.productHandle!,views:x._count._all,
    })).sort((a,b)=>b.views-a.views).slice(0,10);
    channels=sourceGroups.filter(x=>x.channel).map(x=>({
      name:x.channel!,events:x._count._all,
    })).sort((a,b)=>b.events-a.events).slice(0,10);
  } catch(error) {
    // Show pre-existing clicks/orders before the additive migration is applied;
    // never invent zero visits while event tracking is unavailable.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      trackingReady=false; sessions=null; activeSessions=null; sessionCountComplete=false;
    } else throw error;
  }
  const funnel = [
    {stage:'Referral link clicks',count:clicks,source:'Signed referral redirects'},
    {stage:'Tracked sessions',count:sessions,source:'Consent-eligible browser events'},
    {stage:'Product views',count:eventCounts.PRODUCT_VIEWED ?? (trackingReady?0:null),source:'Browser events'},
    {stage:'Cart updates',count:eventCounts.CART_UPDATED ?? (trackingReady?0:null),source:'Browser events'},
    {stage:'Checkout starts',count:eventCounts.CHECKOUT_STARTED ?? (trackingReady?0:null),source:'Where available'},
    {stage:'Attributed orders',count:attributedOrders,source:'Verified Shopify order attribution'},
  ];
  return {
    success:true, days, from:from.toISOString(), scope:affiliateIds===null?'all':affiliateIds,
    clicks, clickTrend:Array.from(byDay,([date,count])=>({date,count})).sort((a,b)=>a.date.localeCompare(b.date)),
    clickTrendComplete:clicks<=5000,
    sessions,activeSessions,sessionCountComplete,eventsRecorded,trackingReady,
    pageViews:eventCounts.PAGE_VIEWED ?? (trackingReady?0:null),
    productViews:eventCounts.PRODUCT_VIEWED ?? (trackingReady?0:null),
    cartViews:eventCounts.CART_VIEWED ?? (trackingReady?0:null),
    cartUpdates:eventCounts.CART_UPDATED ?? (trackingReady?0:null),
    checkoutStarts:eventCounts.CHECKOUT_STARTED ?? (trackingReady?0:null),
    attributedOrders,validOrders:valid._count._all,deliveredOrders:delivered,
    reconciledOrders:reconciled,
    attributedRevenueEGP:(valid._sum.orderTotalPiasters||0)/100,
    conversionPerClick:clicks?Number((100*attributedOrders/clicks).toFixed(2)):null,
    products,channels,funnel,
    limitations:[
      'Clicks, tracked sessions and Shopify orders have different denominators; funnel steps are not a single identified cohort.',
      'Visitor identity is anonymous and consent-limited; individual unique people cannot be counted reliably.',
      'Browser events require an installed, consent-aware Shopify instrumentation snippet.',
      'Checkout steps are unavailable unless explicitly instrumented with a supported Shopify pixel.',
      'Revenue is attributed order value, not collected COD or payable commission.',
      ...(clicks>5000?['Click trend displays only the latest 5,000 clicks.']:[]),
      ...(!sessionCountComplete?['Session distinct count exceeded the bounded report; displayed as unavailable.']:[]),
    ],
  };
}
