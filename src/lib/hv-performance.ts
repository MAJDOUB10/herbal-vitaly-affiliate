/** Financial scenario calculations. EGP amounts are integer piasters. */
export type PerformanceOrder = {
  orderName: string;
  subtotalPiasters: number;
  orderTotalPiasters: number;
  isCod: boolean;
  delivered: boolean;
  courierCollected: boolean;
  merchantReconciled: boolean;
  merchantSettlementReference: string | null;
  cancelled: boolean;
  refunded: boolean;
  affiliateId: string | null;
  attributionSource: string;
};
export type ScenarioCosts = {
  manufacturingPerDeliveredOrderPiasters: number;
  shippingPerTrackedOrderPiasters: number;
  metaSpendPiasters: number;
  platformFeesPiasters: number;
  otherVariablePiasters: number;
  affiliateRatePercent: number;
};
export const isVerifiedAffiliate = (o: PerformanceOrder): boolean =>
  Boolean(o.affiliateId) &&
  ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'].includes(o.attributionSource);

export function isSettledCod(o: PerformanceOrder): boolean {
  return o.isCod && o.delivered && o.courierCollected && o.merchantReconciled &&
    Boolean(o.merchantSettlementReference) && !o.cancelled && !o.refunded &&
    o.orderTotalPiasters > 0;
}
export function summarizeOrders(orders: PerformanceOrder[]) {
  const settled = orders.filter(isSettledCod);
  const total = (rows: PerformanceOrder[], key: 'orderTotalPiasters' | 'subtotalPiasters') =>
    rows.reduce((acc, row) => acc + row[key], 0);
  return {
    trackedOrders: orders.length,
    trackedOrderValuePiasters: total(orders, 'orderTotalPiasters'),
    deliveredOrders: orders.filter(x => x.delivered && !x.cancelled && !x.refunded).length,
    cancelledOrders: orders.filter(x => x.cancelled).length,
    refundedOrders: orders.filter(x => x.refunded).length,
    codReconciledOrders: settled.length,
    codReconciledValuePiasters: total(settled, 'orderTotalPiasters'),
    codCollectedAwaitingMerchantOrders: orders.filter(x =>
      x.isCod && x.delivered && x.courierCollected &&
      !x.merchantReconciled && !x.cancelled && !x.refunded).length,
    affiliateAttributedSettledOrders: settled.filter(isVerifiedAffiliate).length,
  };
}
export function calculatePerformanceScenario(orders: PerformanceOrder[], costs: ScenarioCosts) {
  const keys: Array<keyof Omit<ScenarioCosts, 'affiliateRatePercent'>> = [
    'manufacturingPerDeliveredOrderPiasters',
    'shippingPerTrackedOrderPiasters',
    'metaSpendPiasters',
    'platformFeesPiasters',
    'otherVariablePiasters',
  ];
  for (const key of keys) {
    if (!Number.isSafeInteger(costs[key]) || costs[key] < 0) {
      throw new Error('Invalid nonnegative piaster cost: ' + key);
    }
  }
  if (!Number.isFinite(costs.affiliateRatePercent) ||
    costs.affiliateRatePercent < 0 || costs.affiliateRatePercent > 100) {
    throw new Error('Invalid affiliate rate');
  }
  const settled = orders.filter(isSettledCod);
  const affiliateOrders = settled.filter(isVerifiedAffiliate);
  const reconciledOrderValuePiasters = settled.reduce((sum, x) => sum + x.orderTotalPiasters, 0);
  const estimatedAffiliateCostPiasters = affiliateOrders.reduce((sum, x) =>
    sum + Math.round(x.subtotalPiasters * costs.affiliateRatePercent / 100), 0);
  const manufacturingPiasters = settled.length * costs.manufacturingPerDeliveredOrderPiasters;
  const shippingPiasters = orders.length * costs.shippingPerTrackedOrderPiasters;
  const totalAssumedCostsPiasters = manufacturingPiasters + shippingPiasters +
    costs.metaSpendPiasters + costs.platformFeesPiasters +
    costs.otherVariablePiasters + estimatedAffiliateCostPiasters;
  const illustrativeBalancePiasters = reconciledOrderValuePiasters - totalAssumedCostsPiasters;
  return {
    reconciledOrderValuePiasters,
    includedOrders: settled.length,
    manufacturingPiasters,
    shippingPiasters,
    estimatedAffiliateCostPiasters,
    totalAssumedCostsPiasters,
    illustrativeBalancePiasters,
    illustrativeMarginPercent: reconciledOrderValuePiasters > 0
      ? illustrativeBalancePiasters / reconciledOrderValuePiasters * 100 : null,
    classification: 'SCENARIO_NOT_ACCOUNTING_PROFIT' as const,
  };
}
