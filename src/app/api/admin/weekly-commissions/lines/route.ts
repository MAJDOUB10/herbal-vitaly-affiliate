import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCodFinanceWriteEnabled } from '@/lib/hv-egypt-finance';
import { isWeeklyEligible, isWeeklyTransitionAllowed } from '@/lib/hv-weekly-commissions';

const headers = { 'Cache-Control': 'private, no-store' };
const actions = ['VALIDATE', 'EDIT', 'CANCEL', 'MARK_PAID'] as const;
const shortReason = (s: unknown) => typeof s === 'string' && s.trim().length >= 8 && s.trim().length <= 300;

export async function PATCH(request: NextRequest) {
  if (request.headers.get('x-authenticated-role') !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const actor = request.headers.get('x-user-id');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const user = await prisma.user.findUnique({
    where: { id: actor }, select: { role: true, status: true },
  });
  if (user?.role !== 'ADMIN' || user.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (typeof body?.lineId !== 'string' || body.lineId.length > 100 || !body.lineId ||
      !actions.includes(action))
    return NextResponse.json({ error: 'Invalid line or action' }, { status: 400, headers });
  if (action === 'EDIT' && (
    !Number.isSafeInteger(body.amountPiasters) || body.amountPiasters <= 0 || !shortReason(body.reason)))
    return NextResponse.json({ error: 'Edit requires integer piastres and reason (8–300 chars)' },
      { status: 422, headers });
  if (action === 'CANCEL' && !shortReason(body.reason))
    return NextResponse.json({ error: 'Cancellation reason required (8–300 chars)' }, { status: 422, headers });
  if (action === 'MARK_PAID') {
    // Critical: never bypass the existing COD financial lock or create a fake paid record.
    if (!isCodFinanceWriteEnabled())
      return NextResponse.json({
        error: 'Paid confirmation is locked until the independent COD finance ledger, receipts, and transfer checks are audited.',
        code: 'COD_FINANCE_NOT_VERIFIED',
      }, { status: 423, headers });
    if (!shortReason(body.paymentReference))
      return NextResponse.json({ error: 'External transfer receipt/reference required (8–300 chars)' },
        { status: 422, headers });
  }

  try {
    const changed = await prisma.$transaction(async tx => {
      const line = await tx.hvWeeklyCommissionLine.findUnique({
        where: { id: body.lineId }, include: { batch: { select: { weekStart: true, weekEnd: true } } },
      });
      if (!line) return { error: 'Commission line not found', status: 404 };
      if (!isWeeklyTransitionAllowed(line.status, action))
        return { error: 'Invalid state transition: ' + line.status + ' → ' + action, status: 409 };

      if (action === 'EDIT' && body.amountPiasters > line.originalPiasters)
        return { error: 'Manual adjustments can only reduce the original commission; never increase the 20% pool', status: 422 };

      if (action === 'VALIDATE' || action === 'MARK_PAID') {
        const order = await tx.hvCodOrder.findUnique({ where: { shopifyOrderId: line.sourceOrderId } });
        if (!order || !isWeeklyEligible(order, line.batch.weekStart, line.batch.weekEnd) ||
            order.commissionPreviewPiasters !== line.poolPiasters || order.subtotalPiasters !== line.salePiasters) {
          return { error: 'Original COD order is no longer fully reconciled or amounts changed', status: 409 };
        }
        const linked = await tx.teamCommissionSplit.count({ where: { sourceId: line.sourceOrderId } });
        if (linked) return { error: 'Order already allocated in a separate team split ledger', status: 409 };
        const sourceAffiliate = order.affiliateId ? await tx.affiliate.findUnique({
          where: { id: order.affiliateId }, select: { id: true, parentAffiliateId: true,
            user: { select: { status: true, emailVerifiedAt: true } },
            parentAffiliate: { select: { isMasterPartner: true, user: { select: { status: true } } } } },
        }) : null;
        if (!sourceAffiliate || sourceAffiliate.user.status !== 'ACTIVE' ||
            !sourceAffiliate.user.emailVerifiedAt ||
            (line.beneficiaryRole === 'MASTER_PARTNER' ?
              line.beneficiaryAffiliateId !== sourceAffiliate.parentAffiliateId ||
              !sourceAffiliate.parentAffiliate?.isMasterPartner ||
              sourceAffiliate.parentAffiliate.user.status !== 'ACTIVE' :
              line.beneficiaryAffiliateId !== sourceAffiliate.id))
          return { error: 'Affiliate entitlement changed; requires financial review', status: 409 };
      }

      const update = action === 'EDIT'
        ? { amountPiasters: body.amountPiasters as number, notes: body.reason.trim() as string }
        : action === 'VALIDATE'
          ? { status: 'VALIDATED', reviewedAt: new Date(), reviewedBy: actor }
          : action === 'CANCEL'
            ? { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: actor,
                cancellationReason: body.reason.trim() as string }
            : { status: 'PAID', paidAt: new Date(), paidBy: actor,
                paymentReference: body.paymentReference.trim() as string };
      const updated = await tx.hvWeeklyCommissionLine.updateMany({
        where: { id: line.id, status: line.status, amountPiasters: line.amountPiasters },
        data: update,
      });
      if (updated.count !== 1) return { error: 'This commission was changed concurrently; refresh before retrying', status: 409 };
      await tx.auditLog.create({
        data: { actorId: actor, action: 'HV_WEEKLY_COMMISSION_' + action,
          objectType: 'HV_WEEKLY_COMMISSION_LINE', objectId: line.id,
          payload: { batchId: line.batchId, sourceOrderId: line.sourceOrderId,
            beneficiaryAffiliateId: line.beneficiaryAffiliateId,
            previousStatus: line.status, previousAmountPiasters: line.amountPiasters,
            newStatus: 'status' in update ? update.status : line.status,
            newAmountPiasters: 'amountPiasters' in update ? update.amountPiasters : line.amountPiasters,
            reason: typeof body.reason === 'string' ? body.reason.trim() : null,
            paymentReference: action === 'MARK_PAID' ? body.paymentReference.trim() : null,
            note: 'This separate weekly report does not credit affiliate balances or issue transfers' } },
      });
      return { success: true, status: action === 'VALIDATE' ? 'VALIDATED' :
        action === 'CANCEL' ? 'CANCELLED' : action === 'MARK_PAID' ? 'PAID' : 'DRAFT',
        financialStatus: 'REPORT_ONLY_NOT_PAYABLE' };
    });
    if ('error' in changed) return NextResponse.json({ error: changed.error }, {
      status: typeof changed.status === 'number' ? changed.status : 409, headers,
    });
    return NextResponse.json(changed, { headers });
  } catch (e) {
    console.error('Weekly commission action failed', e);
    return NextResponse.json({ error: 'Commission operation failed; verify report migration and audit log' },
      { status: 500, headers });
  }
}
