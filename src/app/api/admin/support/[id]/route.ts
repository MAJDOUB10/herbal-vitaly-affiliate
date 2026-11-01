import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  NO_STORE, supportActor, supportPriority, supportRateLimit,
  supportRecord, supportStatus, supportText, supportWritable,
} from '@/lib/hv-support';

type Context = { params:Promise<{id:string}> };
export async function GET(request: NextRequest, ctx: Context) {
  const admin = await supportActor(request, 'ADMIN');
  if (!admin) return NextResponse.json({ error:'Admin access required' }, { status:403 });
  const { id } = await ctx.params;
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where:{id},
      include: {
        user: { select: {name:true,email:true} },
        messages: {
          select: {id:true,body:true,internal:true,createdAt:true,
            author:{select:{name:true,role:true}} },
          orderBy:{createdAt:'asc'},take:500,
        },
      },
    });
    if (!ticket) return NextResponse.json({error:'Ticket not found'},{status:404});
    return NextResponse.json({success:true,ticket:{
      ...supportRecord(ticket),messages:ticket.messages,
    }},{headers:NO_STORE});
  } catch {
    return NextResponse.json({error:'Unable to load support ticket'},{status:503});
  }
}

export async function POST(request: NextRequest, ctx:Context) {
  const admin=await supportActor(request,'ADMIN');
  if(!admin)return NextResponse.json({error:'Admin access required'},{status:403});
  if(!supportWritable(request))
    return NextResponse.json({error:'Support writes require the Production portal'},{status:403});
  const {id}=await ctx.params;
  try{
    const input=await request.json();
    const body=supportText(input?.message,4000,2);
    const internal=input?.internal===true;
    if(!body||typeof input?.internal!=='boolean')
      return NextResponse.json({error:'Enter a valid support response'},{status:422});
    if(!await supportRateLimit(admin.id,'admin-reply',100))
      return NextResponse.json({error:'Reply limit reached'},{status:429});
    const ticket=await prisma.supportTicket.findUnique({
      where:{id},select:{id:true,status:true},
    });
    if(!ticket)return NextResponse.json({error:'Ticket not found'},{status:404});
    await prisma.$transaction([
      prisma.supportMessage.create({data:{ticketId:id,authorId:admin.id,body,internal}}),
      prisma.supportTicket.update({where:{id},data:{
        lastMessageAt:new Date(),
        status: internal ? ticket.status : 'WAITING_PARTNER',
      }}),
      prisma.auditLog.create({data:{
        actorId:admin.id,action:internal?'SUPPORT_INTERNAL_NOTE':'SUPPORT_ADMIN_REPLY',
        objectType:'SUPPORT_TICKET',objectId:id,
        payload:{statusAfter:internal?ticket.status:'WAITING_PARTNER'},
      }}),
    ]);
    return NextResponse.json({success:true},{status:201,headers:NO_STORE});
  }catch{
    return NextResponse.json({error:'Unable to save support reply'},{status:503});
  }
}

export async function PATCH(request: NextRequest, ctx:Context) {
  const admin=await supportActor(request,'ADMIN');
  if(!admin)return NextResponse.json({error:'Admin access required'},{status:403});
  if(!supportWritable(request))
    return NextResponse.json({error:'Support writes require the Production portal'},{status:403});
  const {id}=await ctx.params;
  try{
    const payload=await request.json();
    const status=payload?.status===undefined?undefined:supportStatus(payload.status);
    const priority=payload?.priority===undefined?undefined:supportPriority(payload.priority);
    if((status===undefined&&priority===undefined)||status===null||priority===null)
      return NextResponse.json({error:'Invalid ticket status or priority'},{status:422});
    const found=await prisma.supportTicket.findUnique({where:{id},select:{id:true}});
    if(!found)return NextResponse.json({error:'Ticket not found'},{status:404});
    const updated=await prisma.$transaction(async tx=>{
      const ticket=await tx.supportTicket.update({
        where:{id},data:{...(status?{status}:{}),...(priority?{priority}:{})},
      });
      await tx.auditLog.create({data:{actorId:admin.id,
        action:'SUPPORT_TICKET_UPDATED',objectType:'SUPPORT_TICKET',objectId:id,
        payload:{status:ticket.status,priority:ticket.priority},
      }});
      return ticket;
    });
    return NextResponse.json({success:true,status:updated.status,priority:updated.priority},
      {headers:NO_STORE});
  }catch{
    return NextResponse.json({error:'Unable to update ticket'},{status:503});
  }
}
