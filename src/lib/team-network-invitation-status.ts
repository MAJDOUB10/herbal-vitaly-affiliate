// Pure classifier shared by Master and Admin dashboards. A registered account
// is not necessarily linked to the invitation's Master Partner.
export type TeamInvitationState =
  | 'LINKED'
  | 'NEEDS_REVIEW'
  | 'EXPIRED'
  | 'AWAITING_REGISTRATION'
  | 'AWAITING_VERIFICATION'
  | 'READY_TO_LINK'
  | 'NOT_ELIGIBLE';

export type InvitedAffiliateAccount = {
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
  affiliate: { parentAffiliateId: string | null; isMasterPartner: boolean } | null;
} | null | undefined;

export function classifyTeamInvitation(
  invitation: { usedAt: Date | null; expiresAt: Date },
  account: InvitedAffiliateAccount,
  masterAffiliateId: string,
  now: Date = new Date(),
): TeamInvitationState {
  // A historical invitation may be unconsumed despite an already linked account.
  if (account?.affiliate?.parentAffiliateId === masterAffiliateId) return 'LINKED';
  if (invitation.usedAt) return 'NEEDS_REVIEW';
  if (invitation.expiresAt <= now) return 'EXPIRED';
  if (!account) return 'AWAITING_REGISTRATION';
  if (account.role !== 'AFFILIATE' || !account.affiliate ||
      account.affiliate.isMasterPartner || account.affiliate.parentAffiliateId)
    return 'NOT_ELIGIBLE';
  if (account.status !== 'ACTIVE' || !account.emailVerifiedAt)
    return 'AWAITING_VERIFICATION';
  return 'READY_TO_LINK';
}
