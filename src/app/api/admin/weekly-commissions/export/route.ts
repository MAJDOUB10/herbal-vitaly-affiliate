import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const csvCell = (input: unknown): string => {
  const raw = String(input ?? '');
  const safe = /^[\s]*[=+@\-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g,'""') + '"';
};
export async function GET(request: NextRequest) {
  if(request.headers.get('x-authenticated-role')!=='ADMIN')
    return NextResponse.json({error:'Forbidden'},{status:403});
  const id=request.headers.get('x-user-id');
  if(!id)return NextResponse.json({error:'Forbidden'},{status:403});
  const actor=await prisma.user.findUnique({where:{id},select:{role:true,status:true}});
  if(actor?.role!=='ADMIN'||actor.status!=='ACTIVE')
    return NextResponse.json({error:'Forbidden'},{status:403});
  const week=request.nextUrl.searchParams.get('weekStart')||'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||!Number.isFinite(new Date(week+'T00:00:00Z').valueOf()))
    return NextResponse.json({error:'Invalid UTC week'},{status:400});
  const batch=await prisma.hvWeeklyCommissionBatch.findUnique({
    where:{weekStart:new Date(week+'T00:00:00Z')},select:{id:true},
  });
  if(!batch)return NextResponse.json({error:'No generated week found'},{status:404});
  const rows=await prisma.hvWeeklyCommissionLine.findMany({
    where:{batchId:batch.id},orderBy:[{sourceOrderName:'asc'},{id:'asc'}],take:10001,
  });
  if(rows.length>10000)return NextResponse.json({error:'Too many rows for this export'},{status:413});
  const ids=[...new Set(rows.map(x=>x.beneficiaryAffiliateId))];
  const affiliates=ids.length?await prisma.affiliate.findMany({
    where:{id:{in:ids}},select:{id:true,referralCode:true,user:{select:{name:true,email:true}}},
  }):[];
  const names=new Map(affiliates.map(a=>[a.id,a]));
  const header=['Week UTC','Order','Shopify order ID','Partner name','Partner email','Partner code',
    'Role','Sale EGP','Pool EGP','Original commission EGP','Current commission EGP','Status',
    'Review date','Payment date','Payment reference','Cancellation reason','Notes'];
  const lines=rows.map(r=>{
    const a=names.get(r.beneficiaryAffiliateId);
    return [week,r.sourceOrderName,r.sourceOrderId,a?.user.name||'',a?.user.email||'',
      a?.referralCode||'',r.beneficiaryRole,
      (r.salePiasters/100).toFixed(2),(r.poolPiasters/100).toFixed(2),
      (r.originalPiasters/100).toFixed(2),(r.amountPiasters/100).toFixed(2),
      r.status,r.reviewedAt?.toISOString()||'',r.paidAt?.toISOString()||'',
      r.paymentReference||'',r.cancellationReason||'',r.notes||''];
  });
  const contents=[header,...lines].map(line=>line.map(csvCell).join(',')).join('\r\n');
  return new NextResponse('\uFEFF'+contents,{
    status:200,headers:{'Content-Type':'text/csv; charset=utf-8',
      'Content-Disposition':'attachment; filename="HV-Weekly-Commissions-'+week+'.csv"',
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},
  });
}
