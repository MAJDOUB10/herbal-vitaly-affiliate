import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTeamCommissionPiasters } from '../src/lib/team-network-math.ts';

test('a sub-partner is paid only out of the existing commission pool', () => {
  assert.deepEqual(splitTeamCommissionPiasters(20000, 6000), {
    childPiasters: 12000, masterPiasters: 8000, totalPiasters: 20000,
  });
});
test('conserves piastres and respects 0/100 percent bounds', () => {
  for (const pool of [0, 1, 7, 101, 9999, 2147483647]) {
    for (const share of [0, 1, 3333, 5000, 9999, 10000]) {
      const s = splitTeamCommissionPiasters(pool, share);
      assert.equal(s.childPiasters + s.masterPiasters, pool);
      assert.ok(s.childPiasters >= 0 && s.masterPiasters >= 0);
    }
  }
});
test('rejects invalid commission inputs', () => {
  for (const [pool, share] of [[-1,100],[3,10001],[3,-1],[3,1.1],[NaN,100],[Number.MAX_SAFE_INTEGER,10000]]) {
    assert.throws(() => splitTeamCommissionPiasters(pool, share));
  }
});
