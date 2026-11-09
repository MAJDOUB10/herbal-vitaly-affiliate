# Herbal Vitaly Partner Network — Phase 1

Status: feature branch; not live payouts.

## Included
- Admin Master Partner designation.
- One-level affiliate hierarchy with a parent relation.
- Expiring, one-time, SHA-256-hashed invitations, consumed atomically during signup.
- Existing password and email OTP verification are preserved.
- Master-scoped team roster, editable allocation rates, audit trail.
- Shopify COD commission previews, status and network analytics.
- Integer piastre allocation helper and new schema for a future settled split ledger.

## Financial controls and limitations
The existing order-commission field is a **preview**, not payable earnings.
The network APIs make no balance credits, payments, commission approvals or transfers.
The existing COD financial write lock remains unchanged.
Current rates shown in previews are illustrative only. A future approved settlement
must atomically snapshot the rate in the immutable split table and reconcile
any existing Commission / Payout credits to prevent duplicates.
Master Partners cannot move an already registered partner under themselves.
Direct children only, max 100 displayed; introduce pagination before expanding.
Invites are returned as secure links for manual sharing; no invite email sending yet.

## Preview-only rollout
1. Provision a separate, non-production Neon database.
2. Apply the additive migration there, run prisma generate and full tests.
3. Create an active, email-verified Affiliate.
4. Enable Master Partner in Admin / Partner Networks.
5. Copy a team invitation URL and register a new affiliate with the same email.
6. Complete OTP, sign in, check team ownership and percentage updates.
7. Verify unauthorized affiliates cannot list or edit another team.
8. Import/simulate attributed Shopify COD orders and inspect preview statuses.
9. Review accounting and refunds before enabling any real split settlement.

## API
GET/PATCH /api/admin/partner-networks
GET/PATCH /api/affiliate/team
POST /api/affiliate/team/invitations
GET /api/affiliate/team/commissions
