import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyTeamInvitation } from '../src/lib/team-network-invitation-status.ts';

const now = new Date('2026-11-18T12:00:00Z');
const pending = { usedAt: null, expiresAt: new Date('2026-11-20T12:00:00Z') };
const verified = { role: 'AFFILIATE', status: 'ACTIVE',
  emailVerifiedAt: new Date('2026-11-18T11:00:00Z'),
  affiliate: { parentAffiliateId: null, isMasterPartner: false } };

test('new affiliate signed up outside invitation flow is not shown as awaiting registration', () => {
  assert.equal(classifyTeamInvitation(pending, verified, 'master-1', now), 'READY_TO_LINK');
  assert.equal(classifyTeamInvitation(pending, null, 'master-1', now), 'AWAITING_REGISTRATION');
  assert.equal(classifyTeamInvitation(pending, { ...verified,
    emailVerifiedAt: null, status: 'PENDING' }, 'master-1', now), 'AWAITING_VERIFICATION');
});

test('never offer to reparent another Master or another team child', () => {
  assert.equal(classifyTeamInvitation(pending, { ...verified,
    affiliate: { parentAffiliateId: 'other-master', isMasterPartner: false } },
    'master-1', now), 'NOT_ELIGIBLE');
  assert.equal(classifyTeamInvitation(pending, { ...verified,
    affiliate: { parentAffiliateId: null, isMasterPartner: true } },
    'master-1', now), 'NOT_ELIGIBLE');
  assert.equal(classifyTeamInvitation(pending, { ...verified, role: 'ADMIN' },
    'master-1', now), 'NOT_ELIGIBLE');
});

test('linked account takes precedence over stale invitation flags', () => {
  const linked = { ...verified,
    affiliate: { parentAffiliateId: 'master-1', isMasterPartner: false } };
  assert.equal(classifyTeamInvitation(pending, linked, 'master-1', now), 'LINKED');
  assert.equal(classifyTeamInvitation({ ...pending, usedAt: now }, verified,
    'master-1', now), 'NEEDS_REVIEW');
  assert.equal(classifyTeamInvitation({ ...pending,
    expiresAt: new Date('2026-11-17T12:00:00Z') }, verified,
    'master-1', now), 'EXPIRED');
});

test('admin linking is transactional, scoped, verified, and audited', () => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const api = read('src/app/api/admin/partner-networks/route.ts');
  const team = read('src/app/api/affiliate/team/route.ts');
  const adminUi = read('src/app/admin/partner-networks/page.tsx');
  const masterUi = read('src/components/team/TeamWorkspace.tsx');
  assert.match(api, /actorId = await admin\(request\)/);
  assert.match(api, /invite\.masterAffiliateId !== body\.masterId/);
  assert.match(api, /user\.role !== 'AFFILIATE'/);
  assert.match(api, /!user\.emailVerifiedAt/);
  assert.match(api, /user\.affiliate\.parentAffiliateId/);
  assert.match(api, /tx\.affiliate\.updateMany/);
  assert.match(api, /tx\.teamInvitation\.updateMany/);
  assert.match(api, /ADMIN_LINK_EXISTING_INVITED_PARTNER/);
  assert.match(api, /effectiveFor: 'future_settlements_only'/);
  assert.match(team, /classifyTeamInvitation/);
  assert.match(masterUi, /Account created · awaiting admin team link/);
  assert.match(adminUi, /Link existing account/);
  assert.doesNotMatch(api, /tx\.commission\.create|tx\.payout\.create/);
});
