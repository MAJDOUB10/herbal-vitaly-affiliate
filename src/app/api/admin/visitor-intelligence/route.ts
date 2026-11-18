import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportDays, trafficReport } from '@/lib/hv-traffic-report';

const headers={'Cache-Control':'private, no-store'};
export async function GET(request:NextRequest) {
  const userId=request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN')
    return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  try {
    const actor=await prisma.user.findUnique({where:{id:userId},
      select:{role:true,status:true}});
    if (actor?.role !== 'ADMIN' || actor.status !== 'ACTIVE')
      return NextResponse.json({error:'Forbidden'},{status:403,headers});
    const requestedId=request.nextUrl.searchParams.get('affiliateId') || null;
    if (requestedId && (requestedId.length>100 || !/^[a-zA-Z0-9_-]+$/.test(requestedId)))
      return NextResponse.json({error:'Invalid affiliate filter'},{status:422,headers});
    if (requestedId && !await prisma.affiliate.findUnique({
      where:{id:requestedId},select:{id:true}}))
      return NextResponse.json({error:'Partner not found'},{status:404,headers});
    const [report,partners]=await Promise.all([
      trafficReport(requestedId?[requestedId]:null,
        reportDays(request.nextUrl.searchParams.get('days'))),
      prisma.affiliate.findMany({where:{user:{status:'ACTIVE'}},
        orderBy:{createdAt:'desc'},take:300,
        select:{id:true,referralCode:true,user:{select:{name:true}}}}),
    ]);
    return NextResponse.json({...report,selectedAffiliateId:requestedId,
      partners:partners.map(p=>({id:p.id,name:p.user.name,code:p.referralCode})),
      coverage:'Attributed affiliate activity only; not all unaffiliated storefront visitors.'},
      {headers});
  } catch {
    return NextResponse.json({error:'Unable to load Admin visitor intelligence'},{status:503,headers});
  }
}
