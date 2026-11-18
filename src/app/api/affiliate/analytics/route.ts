import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportDays, trafficReport } from '@/lib/hv-traffic-report';

const headers={'Cache-Control':'private, no-store'};
export async function GET(request:NextRequest) {
  const userId=request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'AFFILIATE')
    return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  try {
    const user=await prisma.user.findUnique({where:{id:userId},
      select:{role:true,status:true,emailVerifiedAt:true,
        affiliate:{select:{id:true}}}});
    if (user?.role !== 'AFFILIATE' || user.status !== 'ACTIVE' ||
        !user.emailVerifiedAt || !user.affiliate)
      return NextResponse.json({error:'Forbidden'},{status:403,headers});
    // No affiliateId URL/body parameter: identity comes exclusively from the session.
    const report=await trafficReport([user.affiliate.id],reportDays(request.nextUrl.searchParams.get('days')));
    return NextResponse.json(report,{headers});
  } catch {
    return NextResponse.json({error:'Unable to load partner traffic'},{status:503,headers});
  }
}
