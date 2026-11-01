import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export const SUPPORT_CATEGORIES = [
  'GENERAL','COUPON','ORDER','DELIVERY','RETURN','COMMISSION','PAYOUT','TECHNICAL',
] as const;
export const SUPPORT_STATUSES = ['OPEN','IN_PROGRESS','WAITING_PARTNER','RESOLVED','CLOSED'] as const;
export const SUPPORT_PRIORITIES = ['LOW','NORMAL','HIGH','URGENT'] as const;

export const NO_STORE = { 'Cache-Control': 'private, no-store' };

export function supportText(value: unknown, max: number, min = 1): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(trimmed))
    return null;
  return trimmed;
}
export function supportCategory(value: unknown): string | null {
  return typeof value === 'string' && SUPPORT_CATEGORIES.includes(value as typeof SUPPORT_CATEGORIES[number])
    ? value : null;
}
export function supportStatus(value: unknown): string | null {
  return typeof value === 'string' && SUPPORT_STATUSES.includes(value as typeof SUPPORT_STATUSES[number])
    ? value : null;
}
export function supportPriority(value: unknown): string | null {
  return typeof value === 'string' && SUPPORT_PRIORITIES.includes(value as typeof SUPPORT_PRIORITIES[number])
    ? value : null;
}

export async function supportActor(request: NextRequest, role: 'AFFILIATE' | 'ADMIN') {
  const id = request.headers.get('x-user-id');
  if (!id || request.headers.get('x-authenticated-role') !== role) return null;
  const user = await prisma.user.findUnique({
    where: { id }, select: { id: true, role: true, status: true, emailVerifiedAt: true, affiliate: { select: { id: true } } },
  });
  if (!user || user.role !== role || user.status !== 'ACTIVE') return null;
  if (role === 'AFFILIATE' && (!user.emailVerifiedAt || !user.affiliate)) return null;
  return user;
}

export function supportWritable(request: NextRequest): boolean {
  if (process.env.VERCEL_ENV !== 'production') return false;
  return request.headers.get('origin') === 'https://partner.herbalvitaly.com';
}

export async function supportRateLimit(userId: string, action: string, count: number): Promise<boolean> {
  const result = await checkRateLimit(userId, 'hv-support-' + action, count, 60 * 60_000);
  return result.allowed;
}

export function supportRecord(ticket: {
  id: string; userId: string; subject: string; category: string; status: string;
  priority: string; orderRef: string | null; createdAt: Date; updatedAt: Date;
  lastMessageAt: Date; user?: { name: string; email: string };
}) {
  return {
    id: ticket.id, userId: ticket.userId,
    subject: ticket.subject, category: ticket.category,
    status: ticket.status, priority: ticket.priority,
    orderRef: ticket.orderRef, createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt, lastMessageAt: ticket.lastMessageAt,
    ...(ticket.user ? { partner: ticket.user } : {}),
  };
}
