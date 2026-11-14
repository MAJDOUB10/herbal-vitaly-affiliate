/** Split an already-authorized commission pool in integer Egyptian piastres.
 * This helper does not accrue a balance, create a payout, or approve an order.
 */
export function splitTeamCommissionPiasters(pool: number, shareBps: number) {
  if (!Number.isSafeInteger(pool) || pool < 0 || !Number.isInteger(shareBps) ||
      shareBps < 0 || shareBps > 10000 || !Number.isSafeInteger(pool * shareBps)) {
    throw new Error('Invalid team commission inputs');
  }
  const childPiasters = Math.floor(pool * shareBps / 10000);
  return { childPiasters, masterPiasters: pool - childPiasters, totalPiasters: pool };
}

/**
 * Simulate the standard Herbal Vitaly 20% commission budget on a sale in
 * Egyptian piastres. shareBps is a fraction of that budget (0-10000), not
 * a percentage of the whole sale. Pure calculation: no balance/payout writes.
 */
export function previewTeamCommissionFromSalePiasters(salePiasters: number, shareBps: number) {
  const poolRateBps = 2000;
  if (!Number.isSafeInteger(salePiasters) || salePiasters < 0 ||
      !Number.isSafeInteger(salePiasters * poolRateBps))
    throw new Error('Invalid eligible sale amount');
  const poolPiasters = Math.floor(salePiasters * poolRateBps / 10000);
  return splitTeamCommissionPiasters(poolPiasters, shareBps);
}
