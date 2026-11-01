import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  NO_STORE, supportActor, supportCategory, supportRateLimit, supportRecord,
  supportText, supportWritable,
} from '@/lib/hv-support';

export async function GET(request: NextRequest) {
  const actor = await supportActor(request, 'AFFILIATE');
  if (!actor) return NextResponse.json({ error: 'Verified partner required' }, { status: 403 });
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: actor.id },
      select: { id:true,userId:true,subject:true,category:true,status:true,priority:true,
        orderRef:true,createdAt:true,updatedAt:true,lastMessageAt:true,
        _count: { select: { messages: true } } },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ success:true, tickets: tickets.map(t => ({
      ...supportRecord(t), messageCount:t._count.messages,
    })) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Unable to load support tickets' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await supportActor(request, 'AFFILIATE');
  if (!actor) return NextResponse.json({ error: 'Verified partner required' }, { status: 403 });
  if (!supportWritable(request))
    return NextResponse.json({ error: 'Support writes require the Production portal' }, { status: 403 });
  try {
    if (!await supportRateLimit(actor.id, 'create', 8))
      return NextResponse.json({ error: 'Too many support requests. Try again later.' }, { status: 429 });
    const input = await request.json();
    const subject = supportText(input?.subject, 140, 5);
    const body = supportText(input?.message, 4000, 10);
    const category = supportCategory(input?.category);
    const orderRef = input?.orderRef ? supportText(input.orderRef, 80) : null;
    if (!subject || !body || !category || (input?.orderRef && !orderRef))
      return NextResponse.json({ error: 'Enter a valid subject, category and message' }, { status: 422 });
    const created = await prisma.supportTicket.create({
      data: { userId: actor.id, subject, category, orderRef,
        messages: { create: { authorId: actor.id, body } },
      }, select: { id:true },
    });
    return NextResponse.json({ success:true, id:created.id }, { status: 201, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Unable to create support request' }, { status: 503 });
  }
}
