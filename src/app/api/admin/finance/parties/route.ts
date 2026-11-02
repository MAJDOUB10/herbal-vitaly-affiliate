import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  financeAdmin, financeDraftWriteAllowed, financeReadOnlyResponse, safeShortText,
} from '@/lib/hv-finance-documents';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!await financeAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const parties = await prisma.hvFinanceParty.findMany({
      orderBy: { name: 'asc' }, take: 500,
      select: { id: true, name: true, kind: true, taxId: true, email: true, phone: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ success: true, parties, currency: 'EGP' }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Finance counterparties list error', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Finance counterparties are unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  if (!financeDraftWriteAllowed(req)) return financeReadOnlyResponse();
  try {
    const actor = await financeAdmin(req);
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const data: unknown = await req.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid party');
    const value = data as Record<string, unknown>;
    const name = safeShortText(value.name, 2, 200, 'Party name');
    const kind = safeShortText(value.kind, 4, 12, 'Party kind');
    if (!['SUPPLIER', 'CUSTOMER', 'BOTH'].includes(kind)) throw new Error('Invalid party kind');
    const taxId = value.taxId == null || value.taxId === '' ? null : safeShortText(value.taxId, 3, 50, 'Tax ID');
    const email = value.email == null || value.email === '' ? null : safeShortText(value.email, 3, 200, 'Email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email address');
    const phone = value.phone == null || value.phone === '' ? null : safeShortText(value.phone, 5, 80, 'Phone');
    const party = await prisma.hvFinanceParty.create({
      data: { name, kind, taxId, email, phone, createdBy: actor },
      select: { id: true, name: true, kind: true, createdAt: true },
    });
    return NextResponse.json({ success: true, party, note: 'Counterparty draft master created; tax identity is not verified.' }, {
      status: 201, headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid counterparty';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
