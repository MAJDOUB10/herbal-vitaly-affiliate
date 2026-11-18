import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedMaster } from '@/lib/team-network-auth';
import { reportDays, trafficReport } from '@/lib/hv-traffic-report';

const headers={'Cache-Control':'private, no-store'};
export async function GET(request:NextRequest) {
  const master=await authenticatedMaster(request);
  if (!master)
    return NextResponse.json({error:'Master Partner authorization required'},{status:403,headers});
  try {
    const children=await prisma.affiliate.findMany({
      where:{parentAffiliateId:master.affiliateId},
      select:{id:true,referralCode:true,user:{select:{name:true}}},take:300,
    });
    const ids=[master.affiliateId,...children.map(p=>p.id)];
    const days=reportDays(request.nextUrl.searchParams.get('days'));
    const [report,individual]=await Promise.all([
      trafficReport(ids,days),
      Promise.all(children.slice(0,50).map(async p => {
        const since=new Date(Date.now()-days*86400_000);
        const [clicks,orders]=await Promise.all([
          prisma.referralClick.count({where:{createdAt:{gte:since},referral:{affiliateId:p.id}}}),
          prisma.hvCodOrder.count({where:{affiliateId:p.id,shopifyUpdatedAt:{gte:since},
            attributionSource:{in:['AFFILIATE_LINK','PROMO_CODE','LINK_AND_PROMO']}}}),
        ]);
        return {name:p.user.name,code:p.referralCode,clicks,orders};
      })),
    ]);
    return NextResponse.json({...report,team:individual,
      teamListComplete:children.length<=50},{headers});
  } catch {
    return NextResponse.json({error:'Unable to load team traffic'},{status:503,headers});
  }
}
