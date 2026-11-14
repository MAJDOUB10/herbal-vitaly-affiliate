import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewTeamCommissionFromSalePiasters } from '../src/lib/team-network-math.ts';

test('1000 EGP sale at 4% child / 16% master totals 20%', () => {
  assert.deepEqual(previewTeamCommissionFromSalePiasters(100000, 2000), {
    childPiasters: 4000,
    masterPiasters: 16000,
    totalPiasters: 20000,
  });
});

test('never exceeds 20% budget, including 0% and 100% of pool bounds', () => {
  for (const sale of [0, 1, 33, 99999, 100000, 987654321]) {
    for (const share of [0, 1, 2000, 3333, 7500, 10000]) {
      const actual = previewTeamCommissionFromSalePiasters(sale, share);
      assert.equal(actual.childPiasters + actual.masterPiasters, actual.totalPiasters);
      assert.equal(actual.totalPiasters, Math.floor(sale * 0.2));
      assert.ok(actual.childPiasters >= 0 && actual.masterPiasters >= 0);
    }
  }
});

test('invalid sale or share is rejected before allocation', () => {
  for (const [sale, share] of [[-1, 2000], [NaN, 2000], [3.5, 2000],
    [Number.MAX_SAFE_INTEGER, 2000], [10000, -1], [10000, 10001]]) {
    assert.throws(() => previewTeamCommissionFromSalePiasters(sale, share));
  }
});


test('simulator is visible in Master and Admin and both use scoped rate APIs', () => {
  const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const masterUI = read('src/components/team/TeamWorkspace.tsx');
  const adminUI = read('src/app/admin/partner-networks/page.tsx');
  const adminAPI = read('src/app/api/admin/partner-networks/route.ts');
  const masterAPI = read('src/app/api/affiliate/team/route.ts');
  const simulator = read('src/components/team/CommissionSimulator.tsx');
  assert.match(masterUI, /<CommissionSimulator/);
  assert.match(adminUI, /<CommissionSimulator/);
  assert.match(adminAPI, /x-authenticated-role'\) !== 'ADMIN'/);
  assert.match(adminAPI, /parentAffiliateId: master\.id/);
  assert.match(masterAPI, /authenticatedMaster\(request\)/);
  assert.match(simulator, /previewTeamCommissionFromSalePiasters/);
  for (const api of [adminAPI, masterAPI]) {
    assert.doesNotMatch(api, /payout\.create|commission\.create|balanceCents:|balancePiasters:/);
  }
});
