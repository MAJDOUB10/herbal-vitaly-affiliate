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
