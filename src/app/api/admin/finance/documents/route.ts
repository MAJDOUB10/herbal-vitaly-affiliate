import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import {
  financeAdmin, financeDraftWriteAllowed, financeReadOnlyResponse,
  safeIntegerMoney, safeShortText, safeDocumentDate,
} from '@/lib/hv-finance-documents';

export const dynamic = 'force-dynamic';
const kinds = new Set(['SUPPLIER_BILL', 'CUSTOMER_INVOICE', 'EXPENSE', 'CREDIT_NOTE']);
type InputLine = { description: string; sku: string | null; net: number; tax: number; taxCode: string | null };

export async function GET(request: NextRequest) {
  try {
    if (!await financeAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const kindParam = request.nextUrl.searchParams.get('kind');
    const kind = kindParam && kinds.has(kindParam) ? kindParam : undefined;
    const docs = await prisma.hvFinanceDocument.findMany({
      where: kind ? { kind } : undefined,
      take: 100, orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      include: { counterparty: { select: { id: true, name: true } }, lines: { orderBy: { lineNumber: 'asc' } } },
    });
    return NextResponse.json({
      success: true, currency: 'EGP',
      documents: docs.map(d => ({
        id: d.id, number: d.number, kind: d.kind, status: d.status, description: d.description,
        documentDate: d.documentDate.toISOString().slice(0,10),
        dueDate: d.dueDate?.toISOString().slice(0,10) ?? null,
        counterparty: d.counterparty, externalRef: d.externalRef,
        subtotalPiasters: d.subtotalPiasters.toString(),
        taxPiasters: d.taxPiasters.toString(), totalPiasters: d.totalPiasters.toString(),
        lines: d.lines.map(l => ({
          lineNumber: l.lineNumber, description: l.description, sku: l.sku, taxCode: l.taxCode,
          netPiasters: l.netPiasters.toString(), taxPiasters: l.taxPiasters.toString(),
        })),
      })),
      limitations: 'Draft source documents only: not issued invoices, approved expense deductions or posted accounting entries.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Finance documents list unavailable', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Finance documents unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!financeDraftWriteAllowed(request)) return financeReadOnlyResponse();
  try {
    const actor = await financeAdmin(request);
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid financial document');
    const data = body as Record<string, unknown>;
    const kind = safeShortText(data.kind, 7, 32, 'Document kind');
    if (!kinds.has(kind)) throw new Error('Unsupported document kind');
    const description = safeShortText(data.description, 3, 500, 'Document description');
    const idempotencyKey = safeShortText(data.idempotencyKey, 10, 120, 'Idempotency key');
    if (!/^[A-Za-z0-9:_-]+$/.test(idempotencyKey)) throw new Error('Invalid idempotency key');
    const documentDate = safeDocumentDate(data.documentDate);
    const dueDate = data.dueDate == null || data.dueDate === '' ? null : safeDocumentDate(data.dueDate);
    if (dueDate && dueDate < documentDate) throw new Error('Due date precedes document date');
    const counterpartyId = data.counterpartyId == null || data.counterpartyId === ''
      ? null : safeShortText(data.counterpartyId, 8, 80, 'Counterparty ID');

    if (kind !== 'EXPENSE' && !counterpartyId) throw new Error('Supplier or customer is required for this document');
    if (counterpartyId) {
      const party = await prisma.hvFinanceParty.findUnique({
        where: { id: counterpartyId }, select: { kind: true, isActive: true },
      });
      if (!party?.isActive) throw new Error('Counterparty not active');
      if (kind === 'SUPPLIER_BILL' && !['SUPPLIER', 'BOTH'].includes(party.kind)) {
        throw new Error('Supplier bill requires supplier');
      }
      if ((kind === 'CUSTOMER_INVOICE' || kind === 'CREDIT_NOTE') &&
          !['CUSTOMER', 'BOTH'].includes(party.kind)) {
        throw new Error('Customer document requires customer');
      }
    }
    if (!Array.isArray(data.lines) || data.lines.length < 1 || data.lines.length > 100) {
      throw new Error('Document needs 1 to 100 lines');
    }
    const lines: InputLine[] = data.lines.map((raw: unknown) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid item line');
      const x = raw as Record<string, unknown>;
      const net = safeIntegerMoney(x.netPiasters, true), tax = safeIntegerMoney(x.taxPiasters ?? 0, true);
      if (net === 0 && tax === 0) throw new Error('Document line cannot be zero');
      const itemDesc = safeShortText(x.description, 2, 350, 'Item description');
      const sku = x.sku == null || x.sku === '' ? null : safeShortText(x.sku, 1, 120, 'SKU');
      const taxCode = x.taxCode == null || x.taxCode === '' ? null : safeShortText(x.taxCode, 1, 40, 'Tax code');
      return { description: itemDesc, sku, net, tax, taxCode };
    });
    const subtotal = lines.reduce((n, l) => n + BigInt(l.net), BigInt(0));
    const tax = lines.reduce((n, l) => n + BigInt(l.tax), BigInt(0));
    const total = subtotal + tax;
    if (total === BigInt(0)) throw new Error('Empty total is not allowed');
    // Store tax inputs as provisional, never calculate or submit ETA tax automatically.
    const externalRef = data.externalRef == null || data.externalRef === ''
      ? null : safeShortText(data.externalRef, 1, 160, 'External reference');
    const document = await prisma.hvFinanceDocument.create({
      data: {
        number: 'HV-DRAFT-' + randomUUID(), idempotencyKey, kind, status: 'DRAFT', description,
        counterpartyId, documentDate, dueDate, currency: 'EGP',
        subtotalPiasters: subtotal, taxPiasters: tax, totalPiasters: total,
        externalRef, source: 'MANUAL_DRAFT', createdBy: actor,
        lines: { create: lines.map((l, i) => ({
          lineNumber: i + 1, description: l.description, sku: l.sku, netPiasters: BigInt(l.net),
          taxPiasters: BigInt(l.tax), taxCode: l.taxCode,
        })) },
      },
      select: { id: true, number: true, kind: true, status: true },
    });
    return NextResponse.json({
      success: true, document, posted: false, submittedToETA: false, moneyMoved: false,
      note: 'Draft saved. Not an issued tax invoice, a booked expense, an approved purchase or a payment instruction.',
    }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'This document idempotency key was already used' }, { status: 409 });
    }
    const isValidation = error instanceof Error && (
      /Invalid|requires|must be|needs|Unsupported|cannot|precedes|not active|already used|is required|Empty|Supplier|Customer|Money|counterparty/i.test(error.message));
    if (!isValidation) {
      console.error('Finance draft document failed', error instanceof Error ? error.name : 'unknown');
    }
    return NextResponse.json({ error: isValidation && error instanceof Error ? error.message : 'Could not save document' }, {
      status: isValidation ? 422 : 500,
    });
  }
}
