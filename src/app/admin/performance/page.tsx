'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowRight, BarChart3, Calculator, CircleAlert, CreditCard,
  Database, Megaphone, Package, RefreshCcw, ShieldCheck, ShoppingBag, Truck, Users,
} from 'lucide-react';

type Summary = {
  trackedOrders: number; trackedOrderValuePiasters: number; deliveredOrders: number;
  cancelledOrders: number; refundedOrders: number; codReconciledOrders: number;
  codReconciledValuePiasters: number; codCollectedAwaitingMerchantOrders: number;
  affiliateAttributedSettledOrders: number;
};
type Order = {
  orderName: string; updatedAt: string; amountPiasters: number;
  verifiedAffiliate: boolean; discountCode: string | null; status: string;
};
type Overview = {
  success: true; currency: 'EGP'; days: number; dataAsOf: string;
  sourceHealth: {
    shopify: { state: string; records: number };
    vondera: { state: string; orders?: number; importedOrderValuePiasters?: number; lastSync?: string | null };
    meta: { state: string };
    bostaFees: { state: string };
    productCosts: { state: string };
  };
  summary: Summary | null; affiliateBasisSubtotalPiasters: number | null;
  commissions: { pendingPiasters: number; approvedPiasters: number; paidPiasters: number };
  orders: Order[]; limitations: string[];
};
type CostField = 'manufacturing' | 'shipping' | 'advertising' | 'otherFees';
const currency = (p: number) => new Intl.NumberFormat('en-EG', {
  style: 'currency', currency: 'EGP', maximumFractionDigits: 2,
}).format(p / 100);
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));
const piasters = (raw: string): number | null => {
  const value = raw.trim();
  if (!/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : null;
};

function Stat({ name, value, note, Icon }: {
  name: string; value: string; note: string; Icon: typeof Activity;
}) {
  return (
    <div className="rounded-2xl border border-[#e1eae2] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{name}</span>
        <Icon className="h-4 w-4 text-[#1F6B3A]" />
      </div>
      <div className="mt-3 break-words text-2xl font-bold text-[#173621]">{value}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
    </div>
  );
}
const statusLabel: Record<string, string> = {
  COD_RECONCILED: 'COD reconciled',
  AWAITING_MERCHANT_SETTLEMENT: 'Awaiting COD settlement',
  DELIVERED_UNRECONCILED: 'Delivered / unresolved',
  UNCONFIRMED: 'Unconfirmed',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};

export default function PerformanceCenterPage() {
  const [days, setDays] = useState(30);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inputs, setInputs] = useState<Record<CostField, string>>({
    manufacturing: '', shipping: '', advertising: '', otherFees: '',
  });
  const [affiliateRate, setAffiliateRate] = useState('20');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/admin/performance?days=' + days, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || json.success !== true) throw new Error(json.error || 'Performance data unavailable');
        setResult(json as Overview);
      }).catch(err => {
        if (!controller.signal.aborted) { setResult(null); setError(err.message); }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [days, refresh]);

  const simulation = useMemo(() => {
    const s = result?.summary;
    if (!s || result?.affiliateBasisSubtotalPiasters === null || !result ||
      s.codReconciledOrders === 0) return null;
    const m = piasters(inputs.manufacturing);
    const sh = piasters(inputs.shipping);
    const a = piasters(inputs.advertising);
    const f = piasters(inputs.otherFees);
    const rate = Number(affiliateRate);
    if ([m, sh, a, f].some(x => x === null) ||
      !affiliateRate.trim() || !Number.isFinite(rate) || rate < 0 || rate > 100) return null;
    const manufacturing = (m as number) * s.codReconciledOrders;
    const logistics = (sh as number) * s.trackedOrders;
    const affiliate = Math.round((result.affiliateBasisSubtotalPiasters || 0) * rate / 100);
    const total = manufacturing + logistics + (a as number) + (f as number) + affiliate;
    const balance = s.codReconciledValuePiasters - total;
    return {
      manufacturing, logistics, advertising: a as number, fees: f as number,
      affiliate, total, balance,
      percentage: 100 * balance / s.codReconciledValuePiasters,
    };
  }, [result, inputs, affiliateRate]);

  const s = result?.summary;
  return (
    <main lang="en" className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#1F6B3A]">Herbal Vitaly · Intelligence</p>
          <h1 className="text-3xl font-bold tracking-tight text-[#173621]">E-commerce Performance Center</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Shopify · Vondera · Meta Ads · Bosta · Affiliate commissions. Transparent operational reporting and a
            scenario calculator. Financial profit is unavailable until real costs and reconciled revenue are connected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Reporting period" value={days} onChange={e => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
          <button type="button" onClick={() => setRefresh(x => x + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F6B3A] px-4 py-2 text-sm font-semibold text-white">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <strong>Operational figures ≠ audited profit.</strong> COD reconciliation, tracked orders,
          ad-attributed purchases and cash received are different metrics. A Vondera order may also
          exist in Shopify; their values are never blindly added together.
        </div>
      </div>

      {loading && <div className="rounded-xl border bg-white p-7 text-sm text-slate-600">Loading performance data...</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {result && (
        <>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Database className="h-4 w-4" /> Last report: {dateLabel(result.dataAsOf)} · EGP
          </div>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat name="Tracked Shopify orders" value={String(result.sourceHealth.shopify.records)}
              note="Records updated during selected period; not recognized sales" Icon={ShoppingBag} />
            <Stat name="Tracked order value" value={s ? currency(s.trackedOrderValuePiasters) : 'Unavailable'}
              note="Gross operational snapshot, not cash collected" Icon={BarChart3} />
            <Stat name="COD merchant-reconciled value" value={s ? currency(s.codReconciledValuePiasters) : 'Unavailable'}
              note="System settlement references; bank confirmation not independently checked" Icon={CreditCard} />
            <Stat name="Actual net profit" value="Not available"
              note="Manufacturing, Meta, shipping fees and taxes are missing" Icon={CircleAlert} />
            <Stat name="Delivered Shopify orders" value={s ? String(s.deliveredOrders) : '—'}
              note="Excludes cancelled and refunded" Icon={Package} />
            <Stat name="Awaiting merchant settlement" value={s ? String(s.codCollectedAwaitingMerchantOrders) : '—'}
              note="Delivered and courier-collected but not reconciled" Icon={Truck} />
            <Stat name="EGP affiliate commissions pending" value={currency(result.commissions.pendingPiasters)}
              note="Recorded pending commission status, not necessarily payable" Icon={Users} />
            <Stat name="EGP affiliate commissions paid" value={currency(result.commissions.paidPiasters)}
              note="Recorded paid status; not independently bank-audited" Icon={ShieldCheck} />
          </section>

          <section className="rounded-2xl border border-[#e1eae2] bg-white p-5">
            <h2 className="text-lg font-bold text-[#173621]">Source integrations & data coverage</h2>
            <p className="mt-1 text-xs text-slate-500">A connected account is not the same as a complete cost integration.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: 'Shopify', icon: ShoppingBag, value: result.sourceHealth.shopify.state, detail: String(result.sourceHealth.shopify.records) + ' recorded' },
                { label: 'Vondera', icon: Package, value: result.sourceHealth.vondera.state, detail: String(result.sourceHealth.vondera.orders ?? '—') + ' imported; not combined' },
                { label: 'Meta Ads', icon: Megaphone, value: result.sourceHealth.meta.state, detail: 'Actual spending not imported' },
                { label: 'Bosta', icon: Truck, value: result.sourceHealth.bostaFees.state, detail: 'COD state only; delivery fees missing' },
                { label: 'Product costs', icon: Calculator, value: result.sourceHealth.productCosts.state, detail: 'COGS / SKU not uploaded' },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <item.icon className="mb-3 h-5 w-5 text-[#1F6B3A]" />
                  <p className="font-semibold text-[#173621]">{item.label}</p>
                  <p className="mt-1 break-words text-[11px] font-semibold uppercase text-slate-600">{item.value.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#e1eae2] bg-white p-5">
              <h2 className="text-lg font-bold text-[#173621]">Order health · Shopify</h2>
              <p className="mt-1 text-xs text-slate-500">Counts can overlap: refunded and cancelled are lifecycle classifications.</p>
              <div className="mt-5 space-y-4">
                {[
                  ['Delivered (not cancelled/refunded)', s?.deliveredOrders ?? 0],
                  ['COD reconciled', s?.codReconciledOrders ?? 0],
                  ['COD collected / awaiting settlement', s?.codCollectedAwaitingMerchantOrders ?? 0],
                  ['Cancelled', s?.cancelledOrders ?? 0],
                  ['Refunded', s?.refundedOrders ?? 0],
                ].map(([name, count]) => (
                  <div key={String(name)}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span className="text-slate-600">{name}</span><strong>{count}</strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#1F6B3A]" style={{
                        width: String(s?.trackedOrders ? Math.min(100, Number(count) / s.trackedOrders * 100) : 0) + '%',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <Link href="/admin/cod" className="inline-flex items-center gap-1 text-sm font-semibold text-[#1F6B3A]">
                  COD reconciliation <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e1eae2] bg-white p-5">
              <h2 className="text-lg font-bold text-[#173621]">Cost–profit simulator</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Enter hypothetical costs in EGP. None of these inputs are saved or posted to accounting.
                Uses COD-reconciled order totals as a provisional gross basis, NOT net revenue.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  ['manufacturing', 'Manufacturing per reconciled order'],
                  ['shipping', 'Bosta/shipping per tracked order'],
                  ['advertising', 'Total Meta Ads spend for period'],
                  ['otherFees', 'Total other variable fees for period'],
                ] as [CostField, string][]).map(([key, label]) => (
                  <label className="block text-xs font-medium text-slate-600" key={key}>
                    {label} (EGP)
                    <input type="text" inputMode="decimal" value={inputs[key]} placeholder="Enter amount"
                      onChange={e => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
                  </label>
                ))}
                <label className="block text-xs font-medium text-slate-600">
                  Affiliate commission rate (%)
                  <input type="number" min="0" max="100" step="0.01" value={affiliateRate}
                    onChange={e => setAffiliateRate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
                </label>
              </div>
              {simulation ? (
                <div className="mt-5 rounded-xl border border-[#cbded0] bg-[#f5faf6] p-4">
                  <p className="text-xs font-bold uppercase text-[#1F6B3A]">Illustrative contribution balance · Not net profit</p>
                  <p className="mt-2 text-2xl font-bold text-[#173621]">{currency(simulation.balance)}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Assumed costs: {currency(simulation.total)} · Illustrative rate {simulation.percentage.toFixed(1)}%
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Includes modeled affiliate cost of {currency(simulation.affiliate)}.
                    Does not validate VAT, net sales, SKU mix, actual courier fees or bank settlements.
                  </p>
                </div>
              ) : (
                <p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  {s?.codReconciledOrders
                    ? 'Fill in every cost field, including 0 where confirmed, to calculate a scenario.'
                    : 'No fully COD-reconciled orders in this period; scenario cannot be computed.'}
                </p>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#e1eae2] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h2 className="text-lg font-bold text-[#173621]">Recent Shopify orders</h2>
                <p className="text-xs text-slate-500">Latest 200 records at most. No customer personal information displayed.</p>
              </div>
              <Link href="/admin/orders" className="text-sm font-semibold text-[#1F6B3A]">All orders</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Last updated</th>
                    <th className="px-5 py-3">Tracked total</th><th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Affiliate</th></tr>
                </thead>
                <tbody>
                  {result.orders.map(o => (
                    <tr key={o.orderName} className="border-t border-slate-100">
                      <td className="px-5 py-3 font-semibold text-[#173621]">{o.orderName}</td>
                      <td className="px-5 py-3 text-slate-600">{dateLabel(o.updatedAt)}</td>
                      <td className="px-5 py-3">{currency(o.amountPiasters)}</td>
                      <td className="px-5 py-3 text-xs">{statusLabel[o.status] || o.status}</td>
                      <td className="px-5 py-3 text-xs">{o.verifiedAffiliate ? 'Verified attribution' : 'Not verified'}</td>
                    </tr>
                  ))}
                  {result.orders.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No tracked Shopify orders for the selected period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
            <h2 className="mb-2 text-sm font-bold text-[#173621]">Data quality and financial scope</h2>
            <ul className="list-disc space-y-1 pl-5">
              {result.limitations.map(item => <li key={item}>{item}</li>)}
            </ul>
            <Link href="/admin/finance" className="mt-3 inline-flex items-center gap-1 font-semibold text-[#1F6B3A]">
              Finance & Accounting <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </>
      )}
    </main>
  );
}
