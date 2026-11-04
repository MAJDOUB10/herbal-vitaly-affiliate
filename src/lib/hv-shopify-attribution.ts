import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed, tamper-evident click attribution that can travel from
 * partner.herbalvitaly.com to the Shopify storefront without sharing
 * session cookies. Financial approval still requires COD/Bosta review.
 */
export const HV_ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/;
const KEY_PATTERN = /^attr_[A-Za-z0-9_]{8,80}$/;

export interface HvAttribution {
  referralCode: string;
  attributionKey: string;
  issuedAt: number;
}

function signature(body: string, secret: string): string {
  return createHmac('sha256', secret).update('HV_SHOPIFY_ATTRIBUTION_V1:' + body).digest('base64url');
}

export function signHvAttribution(input: HvAttribution, secret: string): string {
  if (!secret || !CODE_PATTERN.test(input.referralCode) ||
      !KEY_PATTERN.test(input.attributionKey) || !Number.isSafeInteger(input.issuedAt) ||
      input.issuedAt <= 0) throw new Error('Invalid attribution input');
  const body = ['hv1', input.referralCode, input.attributionKey, String(input.issuedAt)].join('.');
  return body + '.' + signature(body, secret);
}

export function verifyHvAttribution(
  token: unknown,
  secret: string,
  now = Date.now(),
): HvAttribution | null {
  if (typeof token !== 'string' || token.length > 320 || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'hv1') return null;
  const [version, referralCode, attributionKey, timeText, suppliedSignature] = parts;
  if (!CODE_PATTERN.test(referralCode) || !KEY_PATTERN.test(attributionKey) ||
      !/^\d{12,15}$/.test(timeText) || !/^[a-zA-Z0-9_-]{43}$/.test(suppliedSignature)) return null;
  const issuedAt = Number(timeText);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 5 * 60_000 ||
      now - issuedAt > HV_ATTRIBUTION_TTL_MS) return null;
  const expected = Buffer.from(signature([version, referralCode, attributionKey, timeText].join('.'), secret));
  const actual = Buffer.from(suppliedSignature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { referralCode, attributionKey, issuedAt };
}

type ShopifyNoteAttribute = { name?: string; value?: string };
export function verifiedShopifyOrderAttribution(
  order: { note_attributes?: ShopifyNoteAttribute[] },
  secret: string,
  now = Date.now(),
): HvAttribution | null {
  const attributes = new Map((order.note_attributes || [])
    .filter(a => typeof a.name === 'string' && typeof a.value === 'string')
    .map(a => [a.name!, a.value!]));
  const attribution = verifyHvAttribution(attributes.get('hv_affiliate_token'), secret, now);
  if (!attribution) return null;
  if (attributes.get('hv_affiliate_code') !== attribution.referralCode) return null;
  if (attributes.get('hv_attribution_key') !== attribution.attributionKey) return null;
  return attribution;
}

export function shopifyAffiliateDestination(target: string | null): URL {
  // Explicit allowlist; a configured external URL must never become an open redirect.
  const defaultUrl = new URL('https://herbalvitaly.com/');
  if (!target) return defaultUrl;
  try {
    const candidate = new URL(target);
    return candidate.protocol === 'https:' &&
      ['herbalvitaly.com', 'www.herbalvitaly.com'].includes(candidate.hostname)
      ? candidate : defaultUrl;
  } catch {
    return defaultUrl;
  }
}
