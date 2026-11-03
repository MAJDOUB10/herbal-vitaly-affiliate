import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type ModuleName = 'deliveries' | 'returns';
const ATTRIBUTED = ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'];
const PRIVATE = { 'Cache-Control': 'private, no-store' };
const CAIRO = 'Africa/Cairo';
const dateParts = (d: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO, year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(d);
  const get = (n:string) => parts.find(p => p.type === n)?.value || '';
  return [get('year'),get('month'),get('day')].join('-');
};
const shiftDate = (day:string,delta:number) => {
  const d = new Date(day+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+delta);
  return d.toISOString().slice(0,10);
};
const cairoMidnight = (day:string) => {
  const [year,month,date] = day.split('-').map(Number);
  // Egypt currently observes DST; calculate the zone offset at each midnight.
  const noon = Date.UTC(year,month-1,date,12);
  const parts = new Intl.DateTimeFormat('en-GB',{
    timeZone:CAIRO,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23',
  }).formatToParts(new Date(noon));
  const val = (name:string)=>Number(parts.find(p=>p.type===name)?.value||0);
  const offset = Date.UTC(val('year'),val('month')-1,val('day'),val('hour'),val('minute'))-noon;
  return new Date(Date.UTC(year,month-1,date)-offset);
};
const validDay = (v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(new Date(v+'T00:00:00Z').getTime()) &&
  new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
function dateRange(params:URLSearchParams):{gte?:Date;lt?:Date} {
  const today=dateParts(new Date());
  const period=params.get('period') || '30d';
  let from='',to='';
  if(period==='today')from=to=today;
  else if(period==='yesterday')from=to=shiftDate(today,-1);
  else if(['7d','30d','90d'].includes(period)){
    const n=Number(period.slice(0,-1));from=shiftDate(today,1-n);to=today;
  } else if(period==='this-month'){from=today.slice(0,7)+'-01';to=today;}
  else if(period==='last-month'){
    const first=today.slice(0,7)+'-01';
    to=shiftDate(first,-1);from=to.slice(0,7)+'-01';
  } else if(period==='custom'){
    from=params.get('from')||'';to=params.get('to')||'';
  } else if(period!=='all') throw new Error('Invalid period');
  if((from&&!validDay(from))||(to&&!validDay(to))||(from&&to&&from>to))
    throw new Error('Invalid date range');
  if(from&&to&&cairoMidnight(shiftDate(to,1)).getTime()-cairoMidnight(from).getTime()>367*86400_000)
    throw new Error('Limit the custom range to 12 months');
  return { ...(from?{gte:cairoMidnight(from)}:{}), ...(to?{lt:cairoMidnight(shiftDate(to,1))}:{}) };
}
function buildWhere(module:ModuleName,params:URLSearchParams,affiliateId:string) {
  const and:Prisma.HvCodOrderWhereInput[]=[];
  const range=dateRange(params);
  if(range.gte||range.lt)and.push({shopifyUpdatedAt:range});
  const q=(params.get('search')||'').trim().slice(0,80);
  if(q)and.push({OR:[
    {orderName:{contains:q,mode:'insensitive'}},
    {shopifyOrderId:{contains:q,mode:'insensitive'}},
    {discountCode:{contains:q,mode:'insensitive'}},
    {bostaTrackingNumber:{contains:q,mode:'insensitive'}},
  ]});
  const coupon=(params.get('coupon')||'').trim().slice(0,80);
  if(coupon)and.push({discountCode:{equals:coupon,mode:'insensitive'}});
  const payment=params.get('payment');
  if(payment==='COD')and.push({isCod:true});
  if(payment==='NON_COD')and.push({isCod:false});
  const finance=params.get('finance');
  if(finance==='RECONCILED')and.push({merchantReconciled:true});
  if(finance==='PENDING')and.push({merchantReconciled:false});
  const source=params.get('source');
  if(source&&ATTRIBUTED.includes(source))and.push({attributionSource:source});
  const status=params.get('status')||'';
  if(status==='DELIVERED')and.push({delivered:true,cancelled:false,refunded:false});
  if(status==='PENDING')and.push({delivered:false,cancelled:false,refunded:false});
  if(status==='REFUNDED')and.push({refunded:true});
  if(status==='CANCELLED')and.push({cancelled:true,refunded:false});
  if(status==='SHIPMENT_RECORDED')and.push({OR:[
    {bostaDeliveryId:{not:null}},{bostaTrackingNumber:{not:null}},
  ]});
  if(status==='NO_TRACKING')and.push({bostaDeliveryId:null,bostaTrackingNumber:null});
  if(module==='returns')and.push({OR:[{refunded:true},{cancelled:true}]});
  return {affiliateId,
    attributionSource:{in:ATTRIBUTED},
    ...(and.length?{AND:and}:{}),
  } as Prisma.HvCodOrderWhereInput;
}
const select = {
  id:true,orderName:true,currency:true,orderTotalPiasters:true,
  shopifyUpdatedAt:true,discountCode:true,attributionSource:true,
  isCod:true,cancelled:true,refunded:true,delivered:true,
  bostaDeliveryId:true,bostaTrackingNumber:true,bostaState:true,
  bostaUpdatedAt:true,courierCollected:true,merchantReconciled:true,
  merchantSettledAt:true,collectedPiasters:true,
} satisfies Prisma.HvCodOrderSelect;
type RecordItem=Prisma.HvCodOrderGetPayload<{select:typeof select}>;
const row = (o:RecordItem)=>({
  id:o.id,order:o.orderName,
  updatedAt:o.shopifyUpdatedAt.toISOString(),
  currency:o.currency,amountEGP:o.currency==='EGP'?o.orderTotalPiasters/100:null,
  discountCode:o.discountCode,attributionSource:o.attributionSource,
  payment:o.isCod?'COD':'NON_COD',
  delivery:o.refunded?'REFUNDED':o.cancelled?'CANCELLED':o.delivered?'DELIVERED':'PENDING',
  refunded:o.refunded,cancelled:o.cancelled,delivered:o.delivered,
  tracking:o.bostaTrackingNumber,
  shipmentRecorded:Boolean(o.bostaDeliveryId||o.bostaTrackingNumber),
  bostaState:o.bostaState,bostaUpdatedAt:o.bostaUpdatedAt?.toISOString()||null,
  collected:o.courierCollected,reconciled:o.merchantReconciled,
  collectedEGP:o.currency==='EGP'?o.collectedPiasters/100:null,
  merchantSettledAt:o.merchantSettledAt?.toISOString()||null,
  returnReason:null,refundAmountEGP:null,product:null,commissionAdjustmentEGP:null,
});
function protectCsv(raw:unknown){
  let v=String(raw??'');
  if(/^\s*[=+\-@\t\r]/.test(v))v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"';
}
export async function GET(request:NextRequest) {
  const uid=request.headers.get('x-user-id');
  if(!uid||request.headers.get('x-authenticated-role')!=='AFFILIATE')
    return NextResponse.json({error:'Unauthenticated'},{status:401,headers:PRIVATE});
  const module=request.nextUrl.searchParams.get('module');
  if(module!=='deliveries'&&module!=='returns')
    return NextResponse.json({error:'Unknown module'},{status:400,headers:PRIVATE});
  try {
    const user=await prisma.user.findUnique({
      where:{id:uid},select:{role:true,status:true,emailVerifiedAt:true,
        affiliate:{select:{id:true}}},
    });
    if(user?.role!=='AFFILIATE'||user.status!=='ACTIVE'||!user.emailVerifiedAt||!user.affiliate)
      return NextResponse.json({error:'Forbidden'},{status:403,headers:PRIVATE});
    let where:Prisma.HvCodOrderWhereInput;
    try{where=buildWhere(module,request.nextUrl.searchParams,user.affiliate.id);}
    catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid filters'},
      {status:400,headers:PRIVATE});}
    const number=Number(request.nextUrl.searchParams.get('page'));
    const page=Number.isFinite(number)?Math.min(1000,Math.max(1,Math.floor(number))):1;
    const askedSize=Number(request.nextUrl.searchParams.get('perPage'));
    const perPage=[10,25,50].includes(askedSize)?askedSize:25;
    const sort=request.nextUrl.searchParams.get('sort')||'newest';
    const orderBy:Prisma.HvCodOrderOrderByWithRelationInput[]=
      sort==='oldest'?[{shopifyUpdatedAt:'asc'},{id:'asc'}]:
      sort==='highest'?[{orderTotalPiasters:'desc'},{id:'desc'}]:
      sort==='lowest'?[{orderTotalPiasters:'asc'},{id:'asc'}]:
      [{shopifyUpdatedAt:'desc'},{id:'desc'}];
    // Read-only and strictly affiliate-scoped. Never read addresses or buyer PII.
    const base:Prisma.HvCodOrderWhereInput={...where};
    const valid={cancelled:false,refunded:false};
    const shipment={OR:[{bostaDeliveryId:{not:null}},{bostaTrackingNumber:{not:null}}]};
    const [total,rows,orderSum,shipmentCount,deliveredCount,pendingCount,refundedCount,
      cancelledCount,reconciledCount,collectedCount,deliveredSum,collectedSum,latest,
      sampled,allPeriodCount] = await Promise.all([
      prisma.hvCodOrder.count({where}),
      prisma.hvCodOrder.findMany({where,select,orderBy,skip:(page-1)*perPage,take:perPage}),
      prisma.hvCodOrder.aggregate({where:{...where,currency:'EGP'},_sum:{orderTotalPiasters:true}}),
      prisma.hvCodOrder.count({where:{...where,AND:[where,shipment]}}),
      prisma.hvCodOrder.count({where:{...where,...valid,delivered:true}}),
      prisma.hvCodOrder.count({where:{...where,...valid,delivered:false}}),
      prisma.hvCodOrder.count({where:{...where,refunded:true}}),
      prisma.hvCodOrder.count({where:{...where,cancelled:true,refunded:false}}),
      prisma.hvCodOrder.count({where:{...where,...valid,merchantReconciled:true}}),
      prisma.hvCodOrder.count({where:{...where,...valid,courierCollected:true}}),
      prisma.hvCodOrder.aggregate({where:{...where,...valid,delivered:true,currency:'EGP'},_sum:{orderTotalPiasters:true}}),
      prisma.hvCodOrder.aggregate({where:{...where,...valid,merchantReconciled:true,currency:'EGP'},_sum:{collectedPiasters:true}}),
      prisma.hvCodOrder.findFirst({where,orderBy:{shopifyUpdatedAt:'desc'},select:{shopifyUpdatedAt:true,bostaUpdatedAt:true}}),
      prisma.hvCodOrder.findMany({where,orderBy:[{shopifyUpdatedAt:'desc'},{id:'desc'}],
        take:2001,select:{shopifyUpdatedAt:true,orderTotalPiasters:true,currency:true,
          refunded:true,cancelled:true,delivered:true}}),
      module==='returns'?prisma.hvCodOrder.count({where:{
        affiliateId:user.affiliate.id,attributionSource:{in:ATTRIBUTED},
        ...(dateRange(request.nextUrl.searchParams).gte||dateRange(request.nextUrl.searchParams).lt?
          {shopifyUpdatedAt:dateRange(request.nextUrl.searchParams)}:{}),
      }}):Promise.resolve(0),
    ]);
    const summary={
      total,orderValueEGP:(orderSum._sum.orderTotalPiasters||0)/100,
      shipmentsRecorded:shipmentCount,
      delivered:deliveredCount,pending:pendingCount,
      refunded:refundedCount,cancelled:cancelledCount,
      reconciled:reconciledCount,collected:collectedCount,
      deliveredValueEGP:(deliveredSum._sum.orderTotalPiasters||0)/100,
      collectedReconciledEGP:(collectedSum._sum.collectedPiasters||0)/100,
      deliverySuccessRate:total?Number((100*deliveredCount/total).toFixed(1)):null,
      timePeriodRefundRate:module==='returns'&&allPeriodCount?
        Number((100*refundedCount/allPeriodCount).toFixed(1)):null,
      inTransit:null,outForDelivery:null,failedDeliveries:null,physicalReturns:null,
      refundValueEGP:null,commissionAdjustmentsEGP:null,
    };
    if(request.nextUrl.searchParams.get('export')==='csv'){
      if(total>10000)return NextResponse.json({error:'Narrow the filters: maximum export is 10,000 rows.'},
        {status:413,headers:PRIVATE});
      const encoder=new TextEncoder();
      let offset=0;
      const stream=new ReadableStream<Uint8Array>({
        start(controller){
          controller.enqueue(encoder.encode('\uFEFF'+[
            'Order','Updated (UTC)','Discount code','Attribution','Order value EGP',
            'Delivery state','Payment','Tracking number','Collection','Reconciliation',
          ].map(protectCsv).join(',')+'\r\n'));
        },
        async pull(controller){
          try{
            const batch=await prisma.hvCodOrder.findMany({where,select,orderBy,skip:offset,take:500});
            if(!batch.length){controller.close();return;}
            offset+=batch.length;
            const content=batch.map(o=>{
              const d=row(o);
              return [d.order,d.updatedAt,d.discountCode,d.attributionSource,
                d.amountEGP,d.delivery,d.payment,d.tracking,
                d.collected?'Recorded':'Not confirmed',d.reconciled?'Recorded':'Pending',
              ].map(protectCsv).join(',');
            }).join('\r\n')+'\r\n';
            controller.enqueue(encoder.encode(content));
            if(batch.length<500||offset>=total)controller.close();
          }catch(e){controller.error(e);}
        },
      });
      return new Response(stream,{headers:{
        'Content-Type':'text/csv; charset=utf-8',
        'Content-Disposition':'attachment; filename="HerbalVitaly_Partner_'+module+'.csv"',
        'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
      }});
    }
    const dates=new Map<string,{date:string,orders:number,egp:number,refunded:number,cancelled:number,delivered:number}>();
    for(const o of sampled.slice(0,2000)){
      const day=dateParts(o.shopifyUpdatedAt);
      const v=dates.get(day)||{date:day,orders:0,egp:0,refunded:0,cancelled:0,delivered:0};
      v.orders++;
      if(o.currency==='EGP')v.egp+=o.orderTotalPiasters/100;
      if(o.refunded)v.refunded++;
      else if(o.cancelled)v.cancelled++;
      else if(o.delivered)v.delivered++;
      dates.set(day,v);
    }
    return NextResponse.json({
      success:true,module,page,perPage,total,rows:rows.map(row),summary,
      latestOrderUpdate:latest?.shopifyUpdatedAt.toISOString()||null,
      latestProviderUpdate:latest?.bostaUpdatedAt?.toISOString()||null,
      trends:[...dates.values()].sort((a,b)=>a.date.localeCompare(b.date)),
      trendsComplete:sampled.length<=2000,
      limitations:{
        bosta:'Raw provider codes are stored, but verified transit and failure status mappings are not available',
        physicalReturn:'Physical shipment returns are not reliably recorded in hv_cod_orders',
        refundAmount:'Actual refunded amounts are not stored in the synchronized order record',
        returnReason:'Detailed reasons are not synchronized from Shopify or Bosta',
        product:'Order line items are not stored in the synchronized order record',
        commissions:'Per-order commission adjustments are not linked to the order record',
      },
    },{headers:PRIVATE});
  }catch {
    return NextResponse.json({error:'Unable to load partner operations'},{status:500,headers:PRIVATE});
  }
}
