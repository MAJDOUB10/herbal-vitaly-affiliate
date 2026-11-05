import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NO_WHATSAPP_CACHE, whatsAppBusinessNumber, inServiceWindow } from '@/lib/hv-whatsapp';

export const dynamic='force-dynamic';

// Partner sees only conversations deliberately linked by an authenticated admin.
// Phone numbers, other partners, unmatched inbox messages and Meta tokens never leak.
export async function GET(request: NextRequest) {
  const userId=request.headers.get('x-user-id');
  if(!userId || request.headers.get('x-authenticated-role')!=='AFFILIATE')
    return NextResponse.json({error:'Partner sign-in required'},{status:401});
  try{
    const user=await prisma.user.findUnique({where:{id:userId},select:{
      role:true,status:true,emailVerifiedAt:true,
      affiliate:{select:{id:true,referralCode:true}},
    }});
    if(!user || user.role!=='AFFILIATE' || user.status!=='ACTIVE' ||
      !user.emailVerifiedAt || !user.affiliate)
      return NextResponse.json({error:'Verified partner required'},{status:403});
    const threads=await prisma.waConversation.findMany({
      where:{affiliateId:user.affiliate.id},
      orderBy:{lastMessageAt:'desc'},take:10,
      select:{id:true,lastMessageAt:true,lastInboundAt:true,
        messages:{orderBy:{createdAt:'desc'},take:100,
          select:{id:true,direction:true,messageType:true,body:true,status:true,createdAt:true}}},
    });
    return NextResponse.json({success:true,referralCode:user.affiliate.referralCode,
      businessNumber:whatsAppBusinessNumber(),
      conversations:threads.map(t=>({
        id:t.id,lastMessageAt:t.lastMessageAt,
        replyWindowOpen:inServiceWindow(t.lastInboundAt),
        messages:t.messages.reverse(),
      })),
    },{headers:NO_WHATSAPP_CACHE});
  }catch{
    return NextResponse.json({error:'WhatsApp message history unavailable'},
      {status:503,headers:NO_WHATSAPP_CACHE});
  }
}
