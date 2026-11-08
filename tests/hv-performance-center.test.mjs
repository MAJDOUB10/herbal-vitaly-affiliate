import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSettledCod, isVerifiedAffiliate, summarizeOrders, calculatePerformanceScenario,
} from '../src/lib/hv-performance.ts';

const settled = {
  orderName: '#HV-001', subtotalPiasters: 10000, orderTotalPiasters: 12000,
  isCod: true, delivered: true, courierCollected: true, merchantReconciled: true,
  merchantSettlementReference: 'settlement-evidence-123',
  cancelled: false, refunded: false, affiliateId: 'verified-affiliate',
  attributionSource: 'PROMO_CODE',
};
const awaiting = {
  ...settled, orderName: '#HV-002', merchantReconciled: false,
  merchantSettlementReference: null,
};
test('eligible COD requires delivery, collection, merchant settlement and no refund', () => {
  assert.equal(isSettledCod(settled), true);
  assert.equal(isSettledCod(awaiting), false);
  assert.equal(isSettledCod({ ...settled, refunded: true }), false);
  assert.equal(isSettledCod({ ...settled, isCod: false }), false);
  assert.equal(isSettledCod({ ...settled, merchantSettlementReference: null }), false);
});
test('affiliate attribution is restricted to verified source categories', () => {
  assert.equal(isVerifiedAffiliate(settled), true);
  assert.equal(isVerifiedAffiliate({ ...settled, attributionSource: 'CONFLICT' }), false);
});
test('summary never treats awaiting COD remittance as settled value', () => {
  const s = summarizeOrders([settled, awaiting]);
  assert.equal(s.trackedOrders, 2);
  assert.equal(s.codReconciledOrders, 1);
  assert.equal(s.codReconciledValuePiasters, 12000);
  assert.equal(s.codCollectedAwaitingMerchantOrders, 1);
});
test('scenario clearly remains hypothetical and uses integer piasters', () => {
  const scenario = calculatePerformanceScenario([settled, awaiting], {
    manufacturingPerDeliveredOrderPiasters: 2000,
    shippingPerTrackedOrderPiasters: 500,
    metaSpendPiasters: 1500,
    platformFeesPiasters: 300,
    otherVariablePiasters: 200,
    affiliateRatePercent: 20,
  });
  assert.equal(scenario.estimatedAffiliateCostPiasters, 2000);
  assert.equal(scenario.manufacturingPiasters, 2000);
  assert.equal(scenario.shippingPiasters, 1000);
  assert.equal(scenario.totalAssumedCostsPiasters, 7000);
  assert.equal(scenario.illustrativeBalancePiasters, 5000);
  assert.equal(scenario.classification, 'SCENARIO_NOT_ACCOUNTING_PROFIT');
});
test('scenario rejects negative or fractional money and impossible rates', () => {
  const base = {
    manufacturingPerDeliveredOrderPiasters: 2000,
    shippingPerTrackedOrderPiasters: 500,
    metaSpendPiasters: 1500,
    platformFeesPiasters: 300,
    otherVariablePiasters: 200,
    affiliateRatePercent: 20,
  };
  assert.throws(() => calculatePerformanceScenario([settled], { ...base, metaSpendPiasters: -1 }));
  assert.throws(() => calculatePerformanceScenario([settled], { ...base, metaSpendPiasters: 10.5 }));
  assert.throws(() => calculatePerformanceScenario([settled], { ...base, affiliateRatePercent: 120 }));
});
