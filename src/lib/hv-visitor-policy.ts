/** Non-sensitive, explicit event vocabulary and storefront validation. */
export const STORE_ORIGINS = ['https://herbalvitaly.com', 'https://www.herbalvitaly.com'] as const;
export const EVENT_TYPES = ['PAGE_VIEWED','PRODUCT_VIEWED','CART_VIEWED','CART_UPDATED','CHECKOUT_STARTED'] as const;
export type VisitorEventType = (typeof EVENT_TYPES)[number];
export const allowedStorefrontOrigin = (value: string | null): boolean =>
  value !== null && STORE_ORIGINS.some(origin => origin === value);

export function safeStorefrontPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 400) return null;
  try {
    const url = new URL(value);
    if (!allowedStorefrontOrigin(url.origin) || !/^\/[a-zA-Z0-9_\/-]*$/.test(url.pathname)) return null;
    return url.pathname.slice(0, 180); // never retain search parameters or fragments
  } catch { return null; }
}
export function safeTrafficChannel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const channel = value.toLowerCase().trim();
  return /^[a-z0-9_-]{1,40}$/.test(channel) ? channel : null;
}
export type SafeVisitorEvent = {
  eventId: string; sessionId: string; eventType: VisitorEventType; pagePath: string;
  productHandle: string | null; channel: string | null; token: string;
};
export function validateVisitorEvent(value: unknown): SafeVisitorEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.consent !== true ||
      typeof v.token !== 'string' || v.token.length > 320 ||
      typeof v.eventId !== 'string' || !/^[a-f0-9]{32}$/.test(v.eventId) ||
      typeof v.sessionId !== 'string' || !/^[a-f0-9]{32}$/.test(v.sessionId) ||
      typeof v.eventType !== 'string' ||
      !EVENT_TYPES.includes(v.eventType as VisitorEventType)) return null;
  const pagePath = safeStorefrontPath(v.pageUrl);
  if (!pagePath) return null;
  const productHandle = /^\/products\/([a-z0-9-]{1,80})\/?$/.exec(pagePath)?.[1] || null;
  return { eventId: v.eventId, sessionId: v.sessionId,
    eventType: v.eventType as VisitorEventType, pagePath, productHandle,
    channel: safeTrafficChannel(v.channel), token: v.token };
}
