import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NO_STORE, supportActor, supportRateLimit, supportRecord, supportText, supportWritable } from '@/lib/hv-support';

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, ctx: Context) {
  const actor = await supportActor(request, 'AFFILIATE');
  if (!actor) return NextResponse.json({ error: 'Verified partner required' }, { status: 403 });
  const { id } = await ctx.params;
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId: actor.id },
      include: { messages: { where: { internal: false },
        select: { id:true,body:true,createdAt:true,author: { select: { role:true,name:true } } },
        orderBy: { createdAt:'asc' }, take:300 } },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    return NextResponse.json({ success:true, ticket: {
      ...supportRecord(ticket), messages:ticket.messages,
    } }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Unable to load ticket' }, { status: 503 });
  }
}

export async function POST(request: NextRequest, ctx: Context) {
  const actor = await supportActor(request, 'AFFILIATE');
  if (!actor) return NextResponse.json({ error: 'Verified partner required' }, { status: 403 });
  if (!supportWritable(request))
    return NextResponse.json({ error: 'Support writes require the Production portal' }, { status: 403 });
  const { id } = await ctx.params;
  try {
    const message = supportText((await request.json())?.message, 4000, 2);
    if (!message) return NextResponse.json({ error: 'Message must contain 2–4000 characters' }, { status: 422 });
    if (!await supportRateLimit(actor.id, 'reply', 40))
      return NextResponse.json({ error: 'Too many messages. Try again later.' }, { status: 429 });
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId:actor.id }, select: { id:true,status:true },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (ticket.status === 'CLOSED')
      return NextResponse.json({ error: 'This ticket is closed. Open a new support request.' }, { status: 409 });

    await prisma.$transaction([
      prisma.supportMessage.create({ data: { ticketId:id, authorId:actor.id, body:message } }),
      prisma.supportTicket.update({ where: { id },
        data: { lastMessageAt:new Date(), status: 'OPEN' } }),
    ]);
    return NextResponse.json({ success:true }, { status:201,headers:NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Unable to send message' }, { status:503 });
  }
}
