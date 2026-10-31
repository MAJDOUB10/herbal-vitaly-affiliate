import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const UGC_STATUSES = ['NEW','CONTACTED','IN_PROGRESS','PREPARING','VALIDATED','COMPLETED','DECLINED'] as const;
export const UGC_ACCEPTANCE = ['PENDING','YES','NO'] as const;
export const UGC_QUALIFICATION = ['UNREVIEWED','QUALIFIED','DISQUALIFIED'] as const;
export const UGC_KINDS = ['UGC','AFFILIATE','BOTH'] as const;
export const UGC_CONTENT = ['IDEA','SCRIPT','FILMING','REVIEW','APPROVED','PUBLISHED'] as const;
export const UGC_DELIVERY = ['UNKNOWN','PREPARING','SHIPPED','IN_TRANSIT','DELIVERED','FAILED','RETURNED','CANCELLED'] as const;

export async function ugcAdmin(req: NextRequest): Promise<{ id: string } | null> {
  const userId = req.headers.get('x-user-id');
  if (!userId || req.headers.get('x-authenticated-role') !== 'ADMIN') return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } });
  return u && u.role === 'ADMIN' && u.status === 'ACTIVE' ? { id: u.id } : null;
}
export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
export const textField = (v: unknown, limit = 500): string | null => {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || v.length > limit) throw new Error('Invalid text field');
  return v.trim() || null;
};
export function enumField(value: unknown, allowed: readonly string[], fallback: string) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error('Invalid category');
  return value;
}
export function linkField(v: unknown): string | null {
  const x = textField(v, 2000);
  if (!x) return null;
  const u = new URL(x);
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password)
    throw new Error('Only public HTTPS links are allowed');
  return x;
}
export function dateField(v: unknown): Date | null {
  const x = textField(v, 40);
  if (!x) return null;
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return d;
}
export function budget(v: unknown, max = 10000000): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new Error('Invalid EGP budget');
  return n;
}
export function payloadObject(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid payload');
  return v as Record<string, unknown>;
}
