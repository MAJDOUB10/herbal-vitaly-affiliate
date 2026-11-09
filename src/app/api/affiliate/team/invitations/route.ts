import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedMaster } from '@/lib/team-network-auth';
import { checkRateLimit } from '@/lib/rate-limit';

const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  const master = await authenticatedMaster(request);
  if (!master) return NextResponse.json({ error: 'Master Partner access required' }, { status: 403, headers });
  const limit = await checkRateLimit(master.userId, 'team/invitations', 10, 24 * 60 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: 'Invitation limit reached' }, { status: 429, headers });
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const shareBps = body?.shareBps;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !Number.isInteger(shareBps) || shareBps < 0 || shareBps > 10000)
    return NextResponse.json({ error: 'Invalid email or commission share' }, { status: 400, headers });
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } }))
    return NextResponse.json({ error: 'This account already exists' }, { status: 409, headers });
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 86400_000);
  await prisma.$transaction(async tx => {
    await tx.teamInvitation.updateMany({ where: {
      masterAffiliateId: master.affiliateId, email, usedAt: null },
      data: { expiresAt: now } });
    await tx.teamInvitation.create({ data: {
      masterAffiliateId: master.affiliateId, email, shareBps, tokenHash, expiresAt } });
    await tx.auditLog.create({ data: {
      actorId: master.userId, action: 'INVITE_SUB_PARTNER',
      objectType: 'AFFILIATE', objectId: master.affiliateId,
      payload: { email, shareBps, expiresAt: expiresAt.toISOString() } } });
  });
  return NextResponse.json({ success: true, email, expiresAt,
    inviteUrl: request.nextUrl.origin + '/register?invite=' + token },
    { status: 201, headers });
}
