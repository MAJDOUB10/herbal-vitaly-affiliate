import { createHmac, randomBytes } from 'node:crypto';

// A short, legible 3-character Shopify coupon, without ambiguous 0/O and 1/I.
// Exactly 32 symbols -> 32^3 = 32,768 possibilities.
export const SHORT_COUPON_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SHORT_COUPON_LENGTH = 3;
export const SHORT_COUPON_SPACE = SHORT_COUPON_ALPHABET.length ** SHORT_COUPON_LENGTH;

function encodeShortCode(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= SHORT_COUPON_SPACE)
    throw new Error('Invalid short coupon value');
  let n = value;
  let code = '';
  for (let i = 0; i < SHORT_COUPON_LENGTH; i++) {
    code = SHORT_COUPON_ALPHABET[n % SHORT_COUPON_ALPHABET.length] + code;
    n = Math.floor(n / SHORT_COUPON_ALPHABET.length);
  }
  return code;
}

/** Repeated onboarding requests for the same partner produce the same candidate.
 * Attempts 1+ provide deterministic alternatives for collisions. Never log the secret.
 */
export function automaticShortCouponCode(affiliateId: string, attempt: number, secret: string): string {
  if (!affiliateId || !secret || !Number.isSafeInteger(attempt) || attempt < 0 || attempt >= 512)
    throw new Error('Invalid short coupon generation input');
  const digest = createHmac('sha256', secret)
    .update('HV_SHORT_PARTNER_CODE_V1:' + affiliateId + ':' + attempt)
    .digest();
  return encodeShortCode(digest.readUInt16BE(0) % SHORT_COUPON_SPACE);
}

/** Secure random candidate for a manually created Shopify coupon. */
export function randomShortCouponCode(): string {
  return encodeShortCode(randomBytes(2).readUInt16BE(0) % SHORT_COUPON_SPACE);
}
