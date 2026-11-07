import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeWaId, verifyMetaSignature } from '@/lib/hv-whatsapp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// This is a PUBLIC callback for Meta, not a browser-authenticated private API.
// Never place it under /api/admin or /api/affiliate (the session proxy blocks it).
// All POST events MUST pass HMAC-SHA256 verification using the Meta App Secret.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams;
  const token = process.env.HV_WHATSAPP_VERIFY_TOKEN;
  const challenge = url.get('hub.challenge');
  if (process.env.HV_WHATSAPP_ENABLED !== 'true' || !token ||
      url.get('hub.mode') !== 'subscribe' || url.get('hub.verify_token') !== token ||
      !challenge || !/^\d{1,40}$/.test(challenge)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type':'text/plain', 'Cache-Control':'no-store' } });
}

type WaChange = {
  field?: string;
  value?: {
    metadata?: { phone_number_id?: string };
    contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
    messages?: Array<{ id?: string; from?: string; type?: string; timestamp?: string;
      text?: { body?: string } }>;
    message_echoes?: Array<{ id?: string; from?: string; to?: string;
      type?: string; timestamp?: string; text?: { body?: string } }>;
    statuses?: Array<{ id?: string; status?: string }>;
  };
};
type MetaEvent = { object?: string; entry?: Array<{ changes?: WaChange[] }> };

export async function POST(request: NextRequest) {
  if (process.env.HV_WHATSAPP_ENABLED !== 'true' ||
      !process.env.HV_WHATSAPP_APP_SECRET || !process.env.HV_WHATSAPP_PHONE_NUMBER_ID) {
    return NextResponse.json({ error:'WhatsApp webhook not configured' }, { status:503 });
  }
  // Raw body is essential for verifying Meta's message signature.
  const raw = await request.text();
  if (raw.length > 1_000_000)
    return NextResponse.json({ error:'Payload too large' }, { status:413 });
  if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'),
    process.env.HV_WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ error:'Invalid Meta signature' }, { status:401 });
  }
  let event: MetaEvent;
  try { event = JSON.parse(raw) as MetaEvent; }
  catch { return NextResponse.json({ error:'Invalid JSON' }, { status:400 }); }
  if (event.object !== 'whatsapp_business_account') {
    return NextResponse.json({ received:true }, { headers:{'Cache-Control':'no-store'} });
  }
  try {
    for (const entry of (event.entry || []).slice(0,15)) {
      for (const change of (entry.changes || []).slice(0,15)) {
        const value = change.value;
        if (!value || value.metadata?.phone_number_id !== process.env.HV_WHATSAPP_PHONE_NUMBER_ID ||
            (change.field !== 'messages' && change.field !== 'smb_message_echoes')) continue;
        // Coexistence: an SMB app echo is an OUTBOUND message, not an inbound
        // customer message. It must never open or extend the 24h reply window.
        if (change.field === 'smb_message_echoes') {
          for (const echo of (value.message_echoes || []).slice(0, 100)) {
            if (!echo.id || !/^wamid\./.test(echo.id)) continue;
            const waId = normalizeWaId(echo.to);
            if (!waId) continue;
            const stamp = Number(echo.timestamp);
            const sentAt = Number.isFinite(stamp) && stamp > 0 &&
              stamp * 1000 <= Date.now() + 60_000
              ? new Date(stamp * 1000) : new Date();
            const kind = typeof echo.type === 'string' ? echo.type.slice(0, 32) : 'unknown';
            const body = kind === 'text' && typeof echo.text?.body === 'string'
              ? echo.text.body.slice(0, 4096)
              : '[WhatsApp Business app ' + kind + ' message — open WhatsApp to view]';
            const conversation = await prisma.waConversation.upsert({
              where: { waId }, update: {},
              create: { waId, lastMessageAt: sentAt }, select: { id: true },
            });
            const inserted = await prisma.waMessage.createMany({
              data: [{
                conversationId: conversation.id, waMessageId: echo.id,
                direction: 'OUTBOUND', messageType: kind, body,
                status: 'SENT', createdAt: sentAt,
              }],
              skipDuplicates: true,
            });
            if (inserted.count > 0) {
              await prisma.waConversation.updateMany({
                where: { id: conversation.id, lastMessageAt: { lt: sentAt } },
                data: { lastMessageAt: sentAt },
              });
            }
          }
          continue;
        }
        const contactNames = new Map((value.contacts||[]).map(c=>[c.wa_id||'',
          typeof c.profile?.name==='string'?c.profile.name.trim().slice(0,90):'']));
        for(const msg of (value.messages||[]).slice(0,100)) {
          if (!msg.id || !/^wamid\./.test(msg.id)) continue;
          const waId = normalizeWaId(msg.from);
          if (!waId) continue;
          const dateStamp = Number(msg.timestamp);
          const receivedAt = Number.isFinite(dateStamp) && dateStamp > 0 &&
            dateStamp * 1000 <= Date.now() + 60_000
            ? new Date(dateStamp * 1000) : new Date();
          const displayName = contactNames.get(waId) || null;
          const kind = typeof msg.type==='string' ? msg.type.slice(0,32) : 'unknown';
          const text = kind==='text' && typeof msg.text?.body==='string'
            ? msg.text.body.slice(0,4096) : '[WhatsApp ' + kind + ' message — open in WhatsApp to view media]';
          const conversation = await prisma.waConversation.upsert({
            where: { waId },
            update: displayName ? { displayName } : {},
            create: { waId, displayName, lastMessageAt:receivedAt },
            select: { id: true },
          });
          // Meta may resend the same webhook. Only NEW messages update
          // the 24-hour reply window. Never extend it on duplicate retries.
          const inserted = await prisma.waMessage.createMany({
            data: [{ conversationId:conversation.id, waMessageId:msg.id, direction:'INBOUND',
              messageType:kind, body:text, status:'RECEIVED', createdAt:receivedAt }],
            skipDuplicates: true,
          });
          if (inserted.count > 0) {
            await prisma.waConversation.updateMany({
              where: { id:conversation.id, OR: [
                { lastInboundAt:null }, { lastInboundAt:{lt:receivedAt} },
              ] },
              data: { lastInboundAt:receivedAt },
            });
            await prisma.waConversation.updateMany({
              where: { id:conversation.id, lastMessageAt:{lt:receivedAt} },
              data: { lastMessageAt:receivedAt },
            });
          }
        }
        for(const status of (value.statuses||[]).slice(0,100)) {
          if (!status.id || !/^wamid\./.test(status.id)) continue;
          const state = String(status.status||'').toUpperCase();
          if (!['SENT','DELIVERED','READ','FAILED'].includes(state)) continue;
          await prisma.waMessage.updateMany({
            where: { waMessageId:status.id, direction:'OUTBOUND' },
            data: { status:state },
          });
        }
      }
    }
    return NextResponse.json({ received:true }, { headers:{'Cache-Control':'no-store'} });
  } catch (error) {
    console.error('WhatsApp webhook processing failed:',error instanceof Error?error.name:'unknown');
    // Meta retries transient failures, unique waMessageId prevents duplicate writes.
    return NextResponse.json({ error:'Temporary webhook processing failure' }, { status:503 });
  }
}
