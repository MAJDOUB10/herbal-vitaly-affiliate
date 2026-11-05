import { createHmac, timingSafeEqual } from 'node:crypto';

export const NO_WHATSAPP_CACHE = { 'Cache-Control': 'private, no-store' } as const;
export const GRAPH_VERSION = 'v26.0';
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function normalizeWaId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/^\+/, '').replace(/[\s()-]/g, '');
  return /^\d{7,15}$/.test(digits) ? digits : null;
}

export function validateWhatsAppText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) return null;
  return s;
}

export function verifyMetaSignature(raw: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  const provided = Buffer.from(signature, 'utf8');
  const digest = Buffer.from(expected, 'utf8');
  return provided.length === digest.length && timingSafeEqual(provided, digest);
}

export function inServiceWindow(lastInboundAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastInboundAt) return false;
  const stamp = new Date(lastInboundAt).getTime();
  return Number.isFinite(stamp) && stamp <= now && now - stamp < WHATSAPP_WINDOW_MS;
}

export function whatsAppReady(): boolean {
  return process.env.HV_WHATSAPP_ENABLED === 'true' &&
    Boolean(process.env.HV_WHATSAPP_ACCESS_TOKEN && process.env.HV_WHATSAPP_PHONE_NUMBER_ID &&
      process.env.HV_WHATSAPP_APP_SECRET && process.env.HV_WHATSAPP_VERIFY_TOKEN);
}

export function whatsAppBusinessNumber(): string | null {
  return normalizeWaId(process.env.HV_WHATSAPP_PUBLIC_NUMBER);
}

export async function sendWhatsAppText(waId: string, body: string): Promise<string> {
  if (process.env.VERCEL_ENV !== 'production' || !whatsAppReady()) {
    throw new Error('WhatsApp Business API not configured in Production');
  }
  if (!normalizeWaId(waId) || !validateWhatsAppText(body)) throw new Error('Invalid WhatsApp message');
  const phoneNumberId = process.env.HV_WHATSAPP_PHONE_NUMBER_ID!;
  if (!/^\d{5,30}$/.test(phoneNumberId)) throw new Error('Invalid WhatsApp phone number ID');
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HV_WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: waId,
      type: 'text',
      text: { preview_url: false, body },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  // Never log an upstream response verbatim, as it can contain contact details.
  if (!response.ok) throw new Error('WhatsApp Cloud API rejected the message (' + response.status + ')');
  const data = await response.json() as { messages?: Array<{ id?: string }> };
  const id = data.messages?.[0]?.id;
  if (!id || typeof id !== 'string' || !/^wamid\./.test(id)) {
    throw new Error('WhatsApp Cloud API did not confirm a message ID');
  }
  return id;
}

export const maskedWhatsAppPhone = (waId: string): string =>
  waId.length > 4 ? '+' + '•'.repeat(Math.min(waId.length - 4, 8)) + waId.slice(-4) : '—';
