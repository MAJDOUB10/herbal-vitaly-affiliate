import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { classifyTeamInvitation } from '@/lib/team-network-invitation-status';

const headers = { 'Cache-Control': 'private, no-store' };
async function admin(request: NextRequest) {
  if (request.headers.get('x-authenticated-role') !== 'ADMIN') return null;
  const uid = request.headers.get('x-user-id');
  if (!uid) return null;
  const user = await prisma.user.findUnique({ where: { id: uid },
    select: { id: true, role: true, status: true } });
  return user?.role === 'ADMIN' && user.status === 'ACTIVE' ? user.id : null;
}

export async function GET(request: NextRequest) {
  if (!await admin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const masterId = request.nextUrl.searchParams.get('masterId');
  if (masterId !== null) {
    if (!masterId || masterId.length > 100)
      return NextResponse.json({ error: 'Invalid masterId' }, { status: 400, headers });
    const master = await prisma.affiliate.findFirst({
      where: { id: masterId, isMasterPartner: true, parentAffiliateId: null },
      select: { id: true },
    });
    if (!master) return NextResponse.json({ error: 'Master Partner not found' }, { status: 404, headers });
    const children = await prisma.affiliate.findMany({
      where: { parentAffiliateId: masterId }, take: 100, orderBy: { createdAt: 'desc' },
      select: { id: true, teamShareBps: true, user: { select: { name: true } } },
    });
    // Admin-only reconciliation for invited partners who registered outside the
    // original invitation flow, including Google sign-in.
    const invitations = await prisma.teamInvitation.findMany({
      where: { masterAffiliateId: masterId }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, email: true, shareBps: true, expiresAt: true, usedAt: true },
    });
    const emails = [...new Set(invitations.map(i => i.email.trim().toLowerCase()))];
    const users = emails.length ? await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true, role: true, status: true, emailVerifiedAt: true,
        affiliate: { select: { parentAffiliateId: true, isMasterPartner: true } } },
    }) : [];
    const usersByEmail = new Map(users.map(user => [user.email.toLowerCase(), user]));
    const now = new Date();
    return NextResponse.json({ subPartners: children.map(child => ({
      id: child.id, name: child.user.name, shareBps: child.teamShareBps ?? 0,
    })), invitations: invitations.map(invite => {
      const user = usersByEmail.get(invite.email.trim().toLowerCase());
      const status = classifyTeamInvitation(invite, user, masterId, now);
      const eligible = status === 'READY_TO_LINK';
      return { id: invite.id, email: invite.email, shareBps: invite.shareBps,
        expiresAt: invite.expiresAt, status, eligible };
    }) }, { headers });
  }
  const partners = await prisma.affiliate.findMany({
    where: { parentAffiliateId: null }, take: 200, orderBy: { createdAt: 'desc' },
    select: { id: true, isMasterPartner: true, referralCode: true,
      user: { select: { name: true, email: true, status: true, emailVerifiedAt: true } },
      _count: { select: { subPartners: true } } },
  });
  return NextResponse.json({ partners }, { headers });
}

export async function PATCH(request: NextRequest) {
  const actorId = await admin(request);
  if (!actorId) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const body = await request.json().catch(() => null);
  // Explicit, audited admin reconciliation of a previously invited, already
  // registered and verified affiliate. Never force a child out of another team.
  if (body && Object.prototype.hasOwnProperty.call(body, 'invitationId')) {
    if (typeof body.masterId !== 'string' || !body.masterId || body.masterId.length > 100 ||
        typeof body.invitationId !== 'string' || !body.invitationId || body.invitationId.length > 100)
      return NextResponse.json({ error: 'Invalid Master or invitation' }, { status: 400, headers });
    try {
      const result = await prisma.$transaction(async tx => {
        const invite = await tx.teamInvitation.findUnique({
          where: { id: body.invitationId },
          include: { master: { include: { user: true } } },
        });
        const now = new Date();
        if (!invite || invite.masterAffiliateId !== body.masterId || invite.usedAt ||
            invite.expiresAt <= now || !invite.master.isMasterPartner ||
            invite.master.parentAffiliateId || invite.master.user.role !== 'AFFILIATE' ||
            invite.master.user.status !== 'ACTIVE' || !invite.master.user.emailVerifiedAt)
          return 'INVALID_INVITATION';
        const user = await tx.user.findUnique({
          where: { email: invite.email.trim().toLowerCase() },
          include: { affiliate: true },
        });
        if (!user || user.role !== 'AFFILIATE' || user.status !== 'ACTIVE' ||
            !user.emailVerifiedAt || !user.affiliate || user.affiliate.isMasterPartner ||
            user.affiliate.parentAffiliateId)
          return 'ACCOUNT_NOT_ELIGIBLE';
        // Guard both rows inside the same transaction. A concurrent attachment
        // or invitation redemption rolls back instead of producing split ownership.
        const linked = await tx.affiliate.updateMany({
          where: { id: user.affiliate.id, parentAffiliateId: null, isMasterPartner: false },
          data: { parentAffiliateId: invite.masterAffiliateId, teamShareBps: invite.shareBps },
        });
        if (linked.count !== 1) throw new Error('LINK_CONFLICT');
        const consumed = await tx.teamInvitation.updateMany({
          where: { id: invite.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) throw new Error('INVITATION_CONFLICT');
        await tx.auditLog.create({ data: {
          actorId, action: 'ADMIN_LINK_EXISTING_INVITED_PARTNER',
          objectType: 'AFFILIATE', objectId: user.affiliate.id,
          payload: { masterAffiliateId: invite.masterAffiliateId,
            invitationId: invite.id, shareBps: invite.shareBps, previousParentAffiliateId: null,
            effectiveFor: 'future_settlements_only' },
        } });
        return 'LINKED';
      });
      return NextResponse.json(result === 'LINKED' ? { success: true } :
        { error: result === 'INVALID_INVITATION' ? 'Invitation not available' :
          'Account not eligible; check verification and team membership' },
        { status: result === 'LINKED' ? 200 : 409, headers });
    } catch (error) {
      console.error('Admin invitation linking conflict', error instanceof Error ? error.name : 'unknown');
      return NextResponse.json({ error: 'Linking conflict; refresh and retry' }, { status: 409, headers });
    }
  }
  // Admin may adjust future sharing rules for a member of a verified Master network.
  // This path never changes order snapshots, accrues earnings, or issues a payout.
  if (body && Object.prototype.hasOwnProperty.call(body, 'partnerId')) {
    if (typeof body.masterId !== 'string' || !body.masterId || body.masterId.length > 100 ||
        typeof body.partnerId !== 'string' || !body.partnerId || body.partnerId.length > 100 ||
        !Number.isInteger(body.shareBps) || body.shareBps < 0 || body.shareBps > 10000)
      return NextResponse.json({ error: 'Invalid Master, sub-partner or share' }, { status: 400, headers });
    const updated = await prisma.$transaction(async tx => {
      const master = await tx.affiliate.findFirst({
        where: { id: body.masterId, isMasterPartner: true, parentAffiliateId: null },
        select: { id: true },
      });
      if (!master) return false;
      const child = await tx.affiliate.findFirst({
        where: { id: body.partnerId, parentAffiliateId: master.id },
        select: { id: true, teamShareBps: true },
      });
      if (!child) return false;
      await tx.affiliate.update({ where: { id: child.id }, data: { teamShareBps: body.shareBps } });
      await tx.auditLog.create({ data: {
        actorId, action: 'ADMIN_SET_SUB_PARTNER_SHARE',
        objectType: 'AFFILIATE', objectId: child.id,
        payload: { masterAffiliateId: master.id, previousBps: child.teamShareBps,
          newBps: body.shareBps, effectiveFor: 'future_settlements_only' },
      } });
      return true;
    });
    return NextResponse.json(updated ? { success: true } : { error: 'Master or sub-partner not found' },
      { status: updated ? 200 : 404, headers });
  }
  if (!body || typeof body.affiliateId !== 'string' || body.affiliateId.length > 100 ||
      typeof body.enabled !== 'boolean')
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers });
  const partner = await prisma.affiliate.findUnique({ where: { id: body.affiliateId },
    select: { id: true, parentAffiliateId: true,
      user: { select: { role: true, status: true, emailVerifiedAt: true } } } });
  if (!partner || partner.parentAffiliateId || partner.user.role !== 'AFFILIATE' ||
      (body.enabled && (partner.user.status !== 'ACTIVE' || !partner.user.emailVerifiedAt)))
    return NextResponse.json({ error: 'Partner not eligible' }, { status: 409, headers });
  await prisma.$transaction(async tx => {
    await tx.affiliate.update({ where: { id: body.affiliateId },
      data: { isMasterPartner: body.enabled } });
    await tx.auditLog.create({ data: { actorId, action: 'SET_MASTER_PARTNER',
      objectType: 'AFFILIATE', objectId: body.affiliateId, payload: { enabled: body.enabled } } });
  });
  return NextResponse.json({ success: true }, { headers });
}
