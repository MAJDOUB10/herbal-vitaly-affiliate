import { NextRequest, NextResponse } from 'next/server';
import { CommissionStatus, PayoutStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Read-only: no payout creation, payment approvals, ledger edits, or bank operations.
const privateHeaders = { 'Cache-Control': 'private, no-store' };
const cStatuses=['PENDING','APPROVED','PAID','CANCELLED','CLAWBACK'];
const pStatuses=['PENDING','PROCESSING','COMPLETED','FAILED'];
function cairoDate(d:Date){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(d);
  const part=(name:string)=>parts.find(x=>x.type===name)?.value||'';
  return part('year')+'-'+part('month')+'-'+part('day');
}
function shiftDate(s:string,days:number){
  const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
function cairoMidnight(s:string){
  const [y,m,d]=s.split('-').map(Number);
  const utcNoon=Date.UTC(y,m-1,d,12);
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23',
  }).formatToParts(new Date(utcNoon));
  const get=(name:string)=>Number(parts.find(x=>x.type===name)?.value||0);
  const offset=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'))-utcNoon;
  return new Date(Date.UTC(y,m-1,d)-offset);
}
function validDate(s:string){
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&
    !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
    new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
}
function selectedDates(p:URLSearchParams){
  const today=cairoDate(new Date()), preset=p.get('period')||'all';
  let from='',to='';
  if(preset==='today')from=to=today;
  else if(preset==='yesterday')from=to=shiftDate(today,-1);
  else if(['7d','30d','90d'].includes(preset)){
    from=shiftDate(today,1-Number(preset.slice(0,-1)));to=today;
  }else if(preset==='this-month'){from=today.slice(0,7)+'-01';to=today;}
  else if(preset==='last-month'){
    const start=today.slice(0,7)+'-01';to=shiftDate(start,-1);from=to.slice(0,7)+'-01';
  }else if(preset==='custom'){from=p.get('from')||'';to=p.get('to')||'';}
  else if(preset!=='all')throw Error('Invalid reporting period');
  if((from&&!validDate(from))||(to&&!validDate(to))||(from&&to&&from>to))
    throw Error('Invalid calendar dates');
  if(from&&to&&cairoMidnight(shiftDate(to,1)).getTime()-cairoMidnight(from).getTime()>367*86400000)
    throw Error('Limit the custom date range to one year');
  return Object.assign({},
    from?{gte:cairoMidnight(from)}:{},
    to?{lt:cairoMidnight(shiftDate(to,1))}:{}) as {gte?:Date;lt?:Date};
}
function csvSafe(value:unknown){
  let s=String(value??'');
  if(/^\s*[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
const commissionSelect={
  id:true,amountCents:true,rate:true,status:true,createdAt:true,
  approvedAt:true,paidAt:true,maturesAt:true,payoutId:true,
  conversion:{select:{currency:true}},
  payout:{select:{status:true,processedAt:true}},
} satisfies Prisma.CommissionSelect;
const payoutSelect={
  id:true,amountCents:true,commissionCount:true,status:true,
  method:true,createdAt:true,processedAt:true,
  commissions:{select:{id:true,amountCents:true,status:true,
    conversion:{select:{currency:true}}},take:30,orderBy:{createdAt:'desc'}},
} satisfies Prisma.PayoutSelect;
type C=Prisma.CommissionGetPayload<{select:typeof commissionSelect}>;
type P=Prisma.PayoutGetPayload<{select:typeof payoutSelect}>;
const commissionRow=(c:C)=>({
  id:c.id,amountCents:c.amountCents,rate:c.rate,status:c.status,
  currency:c.conversion.currency,createdAt:c.createdAt.toISOString(),
  approvedAt:c.approvedAt?.toISOString()||null,paidAt:c.paidAt?.toISOString()||null,
  maturesAt:c.maturesAt?.toISOString()||null,payoutId:c.payoutId,
  payoutStatus:c.payout?.status||null,
  payoutProcessedAt:c.payout?.processedAt?.toISOString()||null,
});
const payoutRow=(p:P)=>({
  id:p.id,amountCents:p.amountCents,status:p.status,
  method:p.method||null,commissionCount:p.commissionCount,
  createdAt:p.createdAt.toISOString(),
  processedAt:p.processedAt?.toISOString()||null,
  linkedCommissions:p.commissions.map(c=>({
    id:c.id,amountCents:c.amountCents,status:c.status,currency:c.conversion.currency,
  })),
  hasMoreLinkedCommissions:p.commissionCount>p.commissions.length,
});

export async function GET(request:NextRequest){
  const userId=request.headers.get('x-user-id');
  if(!userId||request.headers.get('x-authenticated-role')!=='AFFILIATE')
    return NextResponse.json({error:'Authentication required'},{status:401,headers:privateHeaders});
  try{
    const user=await prisma.user.findUnique({where:{id:userId},select:{
      id:true,role:true,status:true,emailVerifiedAt:true,
      affiliate:{select:{id:true,balanceCents:true}},
    }});
    if(user?.role!=='AFFILIATE'||user.status!=='ACTIVE'||!user.emailVerifiedAt||!user.affiliate)
      return NextResponse.json({error:'Access denied'},{status:403,headers:privateHeaders});
    const params=request.nextUrl.searchParams;
    const tab=params.get('tab')||'commissions';
    if(!['commissions','payouts'].includes(tab))
      return NextResponse.json({error:'Invalid ledger'},{status:400,headers:privateHeaders});
    let dates:ReturnType<typeof selectedDates>;
    try{dates=selectedDates(params);}catch(e){
      return NextResponse.json({error:e instanceof Error?e.message:'Invalid dates'},
        {status:400,headers:privateHeaders});
    }
    const dateFilter=Object.keys(dates).length?{createdAt:dates}:{};
    const affiliateId=user.affiliate.id;
    const baseC:Prisma.CommissionWhereInput={affiliateId,...dateFilter};
    const baseP:Prisma.PayoutWhereInput={affiliateId,userId:user.id,...dateFilter};
    const status=params.get('status')||'';
    const search=(params.get('search')||'').trim().slice(0,80);
    if(status&&!(tab==='commissions'?cStatuses:pStatuses).includes(status))
      return NextResponse.json({error:'Invalid status'},{status:400,headers:privateHeaders});
    const whereC:Prisma.CommissionWhereInput={
      ...baseC,...(tab==='commissions'&&status?{status:status as CommissionStatus}:{}),
      ...(tab==='commissions'&&search?{OR:[
        {id:{contains:search,mode:'insensitive'}},
        {payoutId:{contains:search,mode:'insensitive'}},
      ]}:{}),
    };
    const whereP:Prisma.PayoutWhereInput={
      ...baseP,...(tab==='payouts'&&status?{status:status as PayoutStatus}:{}),
      ...(tab==='payouts'&&search?{OR:[
        {id:{contains:search,mode:'insensitive'}},
        {method:{contains:search,mode:'insensitive'}},
      ]}:{}),
    };
    const pg=Number(params.get('page')),limit=Number(params.get('perPage'));
    const page=Number.isInteger(pg)?Math.min(1000,Math.max(1,pg)):1;
    const perPage=[10,25,50].includes(limit)?limit:25;
    const sort=params.get('sort')||'newest';
    const direction:Prisma.SortOrder=sort==='oldest'?'asc':'desc';
    const orderC:Prisma.CommissionOrderByWithRelationInput[]=
      sort==='highest'?[{amountCents:'desc'},{id:'desc'}]:
      sort==='lowest'?[{amountCents:'asc'},{id:'asc'}]:
      [{createdAt:direction},{id:direction}];
    const orderP:Prisma.PayoutOrderByWithRelationInput[]=
      sort==='highest'?[{amountCents:'desc'},{id:'desc'}]:
      sort==='lowest'?[{amountCents:'asc'},{id:'asc'}]:
      [{createdAt:direction},{id:direction}];
    const isCommission=tab==='commissions';
    const [total,cGrouped,pGrouped,unverifiedCount,latestC,latestP]=await Promise.all([
      isCommission?prisma.commission.count({where:whereC}):prisma.payout.count({where:whereP}),
      prisma.commission.groupBy({by:['status'],
        where:{...whereC,conversion:{currency:'EGP'}},
        _sum:{amountCents:true},_count:{_all:true}}),
      prisma.payout.groupBy({by:['status'],where:whereP,
        _sum:{amountCents:true},_count:{_all:true}}),
      prisma.commission.count({where:{...whereC,conversion:{isNot:{currency:'EGP'}}}}),
      prisma.commission.findFirst({where:baseC,orderBy:{updatedAt:'desc'},select:{updatedAt:true}}),
      prisma.payout.findFirst({where:baseP,orderBy:{updatedAt:'desc'},select:{updatedAt:true}}),
    ]);
    const commissionTotals=Object.fromEntries(cStatuses.map(x=>[x,{amountCents:0,count:0}]));
    const payoutTotals=Object.fromEntries(pStatuses.map(x=>[x,{amountCents:0,count:0}]));
    for(const x of cGrouped)commissionTotals[x.status]={amountCents:x._sum.amountCents||0,count:x._count._all};
    for(const x of pGrouped)payoutTotals[x.status]={amountCents:x._sum.amountCents||0,count:x._count._all};
    if(params.get('export')==='csv'){
      if(total>20000)return NextResponse.json({error:'Too many records: narrow the date range to export.'},
        {status:413,headers:privateHeaders});
      let offset=0;const encoder=new TextEncoder();
      const cols=isCommission?
        ['Reference','Created UTC','Status','Minor units','Currency','Rate','Approved UTC','Recorded paid UTC','Payout reference']:
        ['Reference','Created UTC','Status','Minor units','Currency caveat','Method','Processed UTC','Commission count'];
      const stream=new ReadableStream<Uint8Array>({
        start(c){c.enqueue(encoder.encode('\uFEFF'+cols.map(csvSafe).join(',')+'\r\n'));},
        async pull(c){
          try{
            if(isCommission){
              const rows=await prisma.commission.findMany({where:whereC,orderBy:orderC,
                skip:offset,take:500,select:commissionSelect});
              if(!rows.length){c.close();return;}offset+=rows.length;
              c.enqueue(encoder.encode(rows.map(x=>[
                x.id,x.createdAt.toISOString(),x.status,x.amountCents,x.conversion.currency,
                x.rate,x.approvedAt?.toISOString(),x.paidAt?.toISOString(),x.payoutId,
              ].map(csvSafe).join(',')).join('\r\n')+'\r\n'));
              if(rows.length<500||offset>=total)c.close();
            }else{
              const rows=await prisma.payout.findMany({where:whereP,orderBy:orderP,
                skip:offset,take:500,select:{id:true,createdAt:true,status:true,
                  amountCents:true,method:true,processedAt:true,commissionCount:true}});
              if(!rows.length){c.close();return;}offset+=rows.length;
              c.enqueue(encoder.encode(rows.map(x=>[
                x.id,x.createdAt.toISOString(),x.status,x.amountCents,
                'EGP configured, not stored',x.method,x.processedAt?.toISOString(),x.commissionCount,
              ].map(csvSafe).join(',')).join('\r\n')+'\r\n'));
              if(rows.length<500||offset>=total)c.close();
            }
          }catch(e){c.error(e);}
        },
      });
      return new Response(stream,{headers:{
        'Content-Type':'text/csv; charset=utf-8',
        'Content-Disposition':'attachment; filename="HerbalVitaly_Partner_'+tab+'.csv"',
        'X-Content-Type-Options':'nosniff',...privateHeaders,
      }});
    }
    const [commissions,payouts,ct,pt]=await Promise.all([
      isCommission?prisma.commission.findMany({where:whereC,orderBy:orderC,
        skip:(page-1)*perPage,take:perPage,select:commissionSelect}):Promise.resolve([]),
      !isCommission?prisma.payout.findMany({where:whereP,orderBy:orderP,
        skip:(page-1)*perPage,take:perPage,select:payoutSelect}):Promise.resolve([]),
      prisma.commission.findMany({where:{...whereC,conversion:{currency:'EGP'}},
        orderBy:{createdAt:'desc'},take:1201,
        select:{createdAt:true,amountCents:true,status:true}}),
      prisma.payout.findMany({where:whereP,orderBy:{createdAt:'desc'},take:1201,
        select:{createdAt:true,amountCents:true,status:true}}),
    ]);
    const trendMap=new Map<string,{month:string,pending:number,approved:number,
      commissionPaidRecorded:number,completedPayouts:number,openPayouts:number}>();
    const bucket=(dt:Date)=>{
      const month=cairoDate(dt).slice(0,7);
      const x=trendMap.get(month)||{month,pending:0,approved:0,
        commissionPaidRecorded:0,completedPayouts:0,openPayouts:0};
      trendMap.set(month,x);return x;
    };
    for(const c of ct.slice(0,1200)){
      const t=bucket(c.createdAt);
      if(c.status==='PENDING')t.pending+=c.amountCents/100;
      if(c.status==='APPROVED')t.approved+=c.amountCents/100;
      if(c.status==='PAID')t.commissionPaidRecorded+=c.amountCents/100;
    }
    for(const p of pt.slice(0,1200)){
      const t=bucket(p.createdAt);
      if(p.status==='COMPLETED')t.completedPayouts+=p.amountCents/100;
      else t.openPayouts+=p.amountCents/100;
    }
    const updated=Math.max(latestC?.updatedAt.getTime()||0,latestP?.updatedAt.getTime()||0);
    return NextResponse.json({
      success:true,tab,total,page,perPage,ledgerCurrency:'EGP',
      recordedBalanceCents:user.affiliate.balanceCents,
      commissionTotals,payoutTotals,nonEgpCommissionCount:unverifiedCount,
      latestFinancialUpdate:updated?new Date(updated).toISOString():null,
      commissions:commissions.map(commissionRow),payouts:payouts.map(payoutRow),
      trend:[...trendMap.values()].sort((a,b)=>a.month.localeCompare(b.month)),
      trendComplete:ct.length<=1200&&pt.length<=1200,
      limitations:{
        payoutCurrency:'Payout and balance schema lacks a currency field; EGP is the Egypt ledger configuration, not independently recorded per transfer.',
        commissionCurrency:'Only commissions linked to EGP conversions enter the EGP commission totals. No exchange rates are assumed.',
        paid:'Commission PAID flags are separate from COMPLETED payout records and are not bank confirmation.',
        schedule:'There is no verified guaranteed payout date or minimum threshold.',
      },
    },{headers:privateHeaders});
  }catch{
    return NextResponse.json({error:'Unable to load the partner financial ledger'},
      {status:500,headers:privateHeaders});
  }
}
