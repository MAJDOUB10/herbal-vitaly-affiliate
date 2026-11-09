import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function authenticatedMaster(request: NextRequest) {
  const uid = request.headers.get('x-user-id');
  if (!uid || request.headers.get('x-authenticated-role') !== 'AFFILIATE') return null;
  const user = await prisma.user.findUnique({
    where: { id: uid }, select: { id: true, role: true, status: true, emailVerifiedAt: true,
      affiliate: { select: { id: true, isMasterPartner: true, parentAffiliateId: true } } },
  });
  if (user?.role !== 'AFFILIATE' || user.status !== 'ACTIVE' ||
      !user.emailVerifiedAt || !user.affiliate?.isMasterPartner ||
      user.affiliate.parentAffiliateId) return null;
  return { userId: user.id, affiliateId: user.affiliate.id };
}
