import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  NO_WHATSAPP_CACHE, inServiceWindow, maskedWhatsAppPhone,
  sendWhatsAppText, validateWhatsAppText, whatsAppBusinessNumber, whatsAppReady,
} from '@/lib/hv-whatsapp';

export const dynamic = 'force-dynamic';

async function adminActor(request: NextRequest) {
  const id = request.headers.get('x-user-id');
  if (!id || request.headers.get('x-authenticated-role') !== 'ADMIN') return null;
  const user = await prisma.user.findUnique({ where: { id },
    select: { id:true, role:true, status:true } });
  return user?.role==='ADMIN' && user.status==='ACTIVE' ? user : null;
}

function writable(request: NextRequest) {
  return process.env.VERCEL_ENV==='production' &&
    request.headers.get('origin')==='https://partner.herbalvitaly.com';
}

export async function GET(request: NextRequest) {
  const admin = await adminActor(request);
  if (!admin) return NextResponse.json({error:'Admin access required'},{status:403});
  try {
    const id=request.nextUrl.searchParams.get('conversationId');
    if (id) {
      if (!/^[a-z0-9]{12,40}$/.test(id)) return NextResponse.json({error:'Invalid conversation ID'},{status:422});
      const conversation=await prisma.waConversation.findUnique({
        where: {id},
        include: {
          affiliate: { select:{id:true,referralCode:true,user:{select:{name:true,email:true}}} },
        },
      });
      if(!conversation) return NextResponse.json({error:'Conversation not found'},{status:404});
      const recent=await prisma.waMessage.findMany({where:{conversationId:id},
        orderBy:{createdAt:'desc'},take:150,
        select:{id:true,direction:true,messageType:true,body:true,status:true,createdAt:true}});
      return NextResponse.json({success:true,conversation:{
        ...conversation,windowOpen:inServiceWindow(conversation.lastInboundAt),
        maskedPhone:maskedWhatsAppPhone(conversation.waId),
      }, messages:recent.reverse()},
      {headers:NO_WHATSAPP_CACHE});
    }
    const [rows,partners]=await Promise.all([
      prisma.waConversation.findMany({
        orderBy: {lastMessageAt:'desc'},take:150,
        include: {
          affiliate: {select:{id:true,referralCode:true,user:{select:{name:true}}}},
          messages:{orderBy:{createdAt:'desc'},take:1,
            select:{body:true,direction:true,createdAt:true}},
        },
      }),
      prisma.affiliate.findMany({where:{user:{role:'AFFILIATE',status:'ACTIVE',emailVerifiedAt:{not:null}}},
        select:{id:true,referralCode:true,user:{select:{name:true,email:true}}},
        orderBy:{createdAt:'desc'},take:1000}),
    ]);
    return NextResponse.json({
      success:true,configured:whatsAppReady(),publicNumber:whatsAppBusinessNumber(),
      conversations: rows.map(c=>({
        id:c.id,waId:c.waId,maskedPhone:maskedWhatsAppPhone(c.waId),
        displayName:c.displayName,affiliateId:c.affiliateId,
        partner:c.affiliate?{id:c.affiliate.id,name:c.affiliate.user.name,
          referralCode:c.affiliate.referralCode}:null,
        lastInboundAt:c.lastInboundAt,lastMessageAt:c.lastMessageAt,
        windowOpen:inServiceWindow(c.lastInboundAt),
        preview:c.messages[0]?.body??null,
      })),
      partners:partners.map(a=>({id:a.id,name:a.user.name,email:a.user.email,code:a.referralCode})),
      partnersTruncated:partners.length===1000,
    },{headers:NO_WHATSAPP_CACHE});
  } catch(error) {
    console.error('WhatsApp Admin read failed',error instanceof Error?error.name:'unknown');
    return NextResponse.json({error:'WhatsApp inbox data unavailable; verify database migration'},
      {status:503,headers:NO_WHATSAPP_CACHE});
  }
}

export async function PATCH(request: NextRequest) {
  const admin=await adminActor(request);
  if(!admin) return NextResponse.json({error:'Admin access required'},{status:403});
  if(!writable(request)) return NextResponse.json({error:'Production origin required'},{status:403});
  try {
    const payload=await request.json();
    const id=typeof payload?.conversationId==='string'?payload.conversationId:'';
    const affiliateId=payload?.affiliateId;
    if(!/^[a-z0-9]{12,40}$/.test(id) ||
      !(affiliateId===null || (typeof affiliateId==='string' && /^[a-zA-Z0-9_-]{5,90}$/.test(affiliateId))))
      return NextResponse.json({error:'Invalid partner or conversation ID'},{status:422});
    const conversation=await prisma.waConversation.findUnique({where:{id},
      select:{id:true,affiliateId:true}});
    if(!conversation) return NextResponse.json({error:'Conversation not found'},{status:404});
    if(affiliateId){
      const partner=await prisma.affiliate.findUnique({where:{id:affiliateId},
        select:{user:{select:{role:true,status:true,emailVerifiedAt:true}}}});
      if(!partner || partner.user.role!=='AFFILIATE' ||
        partner.user.status!=='ACTIVE' || !partner.user.emailVerifiedAt)
        return NextResponse.json({error:'Partner must be verified and active'},{status:422});
    }
    if(conversation.affiliateId !== affiliateId){
      await prisma.$transaction([
        prisma.waConversation.update({where:{id},data:{affiliateId}}),
        prisma.auditLog.create({data:{
          actorId:admin.id,action:'ASSIGN_WHATSAPP_CONVERSATION',
          objectType:'WHATSAPP_CONVERSATION',objectId:id,
          payload:{previousAffiliateId:conversation.affiliateId,newAffiliateId:affiliateId},
        }}),
      ]);
    }
    return NextResponse.json({success:true},{headers:NO_WHATSAPP_CACHE});
  }catch(error){
    console.error('WhatsApp partner assignment failed',error instanceof Error?error.name:'unknown');
    return NextResponse.json({error:'Unable to update partner assignment'},{status:503});
  }
}

export async function POST(request: NextRequest) {
  const admin=await adminActor(request);
  if(!admin) return NextResponse.json({error:'Admin access required'},{status:403});
  if(!writable(request)) return NextResponse.json({error:'Production origin required'},{status:403});
  if(!whatsAppReady()) return NextResponse.json({error:'Connect WhatsApp Cloud API first'},{status:423});
  let requestId: string|null=null;
  try {
    const input=await request.json();
    const conversationId=typeof input?.conversationId==='string'?input.conversationId:'';
    const body=validateWhatsAppText(input?.message);
    requestId=typeof input?.requestId==='string'?input.requestId:'';
    if(!/^[a-z0-9]{12,40}$/.test(conversationId) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
      || !body) return NextResponse.json({error:'Invalid message or request ID'},{status:422});
    const existing=await prisma.waMessage.findUnique({where:{requestId},
      select:{id:true,status:true}});
    if(existing) return NextResponse.json({success:true,duplicate:true,status:existing.status},
      {headers:NO_WHATSAPP_CACHE});
    const conversation=await prisma.waConversation.findUnique({where:{id:conversationId},
      select:{id:true,waId:true,lastInboundAt:true}});
    if(!conversation) return NextResponse.json({error:'Conversation not found'},{status:404});
    if(!inServiceWindow(conversation.lastInboundAt))
      return NextResponse.json({error:'24-hour reply window closed. Use a Meta-approved template through WhatsApp Manager.'},{status:422});

    const limit=await checkRateLimit(admin.id,'hv-whatsapp-manual-send',40,60*60_000);
    if(!limit.allowed) return NextResponse.json({error:'Hourly message limit reached'},{status:429});
    // Reserve the client UUID before sending to avoid repeated sends on duplicate API calls.
    await prisma.waMessage.create({data:{
      conversationId:conversation.id,requestId,direction:'OUTBOUND',
      messageType:'text',body,status:'SENDING',authorUserId:admin.id,
    }});
    try{
      const messageId=await sendWhatsAppText(conversation.waId,body);
      await prisma.waMessage.update({where:{requestId},
        data:{waMessageId:messageId,status:'SENT'}});
      await prisma.waConversation.update({where:{id:conversation.id},
        data:{lastMessageAt:new Date()}});
      return NextResponse.json({success:true},{status:201,headers:NO_WHATSAPP_CACHE});
    }catch(err){
      await prisma.waMessage.updateMany({where:{requestId},
        data:{status:'FAILED'}});
      // If Meta accepted a message before a timeout, sending again may duplicate it.
      console.error('WhatsApp outbound send unconfirmed',err instanceof Error?err.name:'unknown');
      return NextResponse.json({error:'Message delivery not confirmed; check WhatsApp before attempting again.'},
        {status:502});
    }
  }catch(error){
    console.error('WhatsApp reply failed',error instanceof Error?error.name:'unknown');
    return NextResponse.json({error:'Unable to send WhatsApp reply'},{status:503});
  }
}
