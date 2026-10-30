import { createHash } from 'node:crypto';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function isAcceptablePassword(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

export function normalizeLoginEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidLoginEmail(email: string): boolean {
  return email.length > 0 && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Password reset invalidates all previously issued JWTs without schema changes. */
export function passwordSessionVersion(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 32);
}

/** Rate-limit both IP and normalized identity without storing cleartext emails. */
export function hashedLoginIdentifier(email: string, key: string): string {
  return createHash('sha256').update(key + ':credential:' + email).digest('hex');
}
