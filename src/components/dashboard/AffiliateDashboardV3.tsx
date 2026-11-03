'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowRight, ArrowUpRight, BarChart3, Check, CheckCircle2, Clipboard,
  Clock3, ExternalLink, FileDown, Link2, Package, RefreshCw, RotateCcw,
  ShoppingBag, TicketPercent, TrendingUp, Truck, Wallet,
} from 'lucide-react';

type Order = {
  id: string; name: string; date: string; totalEGP: number | null;
  currency: string; code: string | null; source: string; status: string;
  reconciled: boolean; collected: boolean; cod: boolean;
};
type Insights = {
  name: string; referralCode: string | null; days: number;
  complete: boolean; lastOrderUpdate: string | null;
  previousOrderValueEGP: number;
  totals: {
    trackedOrders: number; orderValueEGP: number; deliveredValueEGP: number;
    reconciledCollectedEGP: number; deliveredOrders: number; pendingOrders: number;
    cancelledOrders: number; returnedOrders: number; settledOrders: number;
    clicks: number; leads: number;
  };
  finance: { pendingEGP: number; approvedEGP: number; paidEGP: number };
  orders: Order[]; clicksByDay: string[];
};
type Product = {
  title: string; handle: string; productUrl: string;
  affiliateLink: string; trackedLink: string | null;
};
type Coupon = { id: string; code: string; products: Product[] };

const GREEN = '#1F6B3A';
const money = (n: number | null | undefined) => n == null ? 'Unavailable' :
  new Intl.NumberFormat('en-EG', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n) + ' EGP';
const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo',
});
const sourceNames: Record<string, string> = {
  AFFILIATE_LINK: 'Tracked link', PROMO_CODE: 'Shopify code',
  LINK_AND_PROMO: 'Link + code',
};
const statusNames: Record<string, string> = {
  PENDING: 'Awaiting delivery', DELIVERED: 'Delivered',
  REFUNDED: 'Refunded', CANCELLED: 'Cancelled',
};
function Section({ title, description, children, id, aside }: {
  title: string; description?: string; children: React.ReactNode; id?: string;
  aside?: React.ReactNode;
}) {
  return <section id={id} className="min-w-0 scroll-mt-24 overflow-hidden rounded-[20px] border border-[#E3EBE5] bg-white shadow-[0_3px_20px_rgba(20,60,35,.035)]">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAF0EB] px-5 py-5 sm:px-6">
      <div><h2 className="text-base font-semibold tracking-tight text-[#163D25] sm:text-lg">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{description}</p>}</div>
      {aside}
    </header>
    <div className="p-5 sm:p-6">{children}</div>
  </section>;
}
function Stat({ label, value, note, icon: Icon, emphasis }: {
  label: string; value: string; note?: string;
  icon: typeof ShoppingBag; emphasis?: boolean;
}) {
  return <div className={'relative min-w-0 overflow-hidden rounded-2xl border p-4 sm:p-5 ' +
    (emphasis ? 'border-[#C4DDCB] bg-[#F3F9F4]' : 'border-[#E4EBE6] bg-white')}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-medium text-slate-600 sm:text-sm">{label}</p>
      <div className="rounded-xl bg-white/85 p-2 text-[#1F6B3A]"><Icon className="h-4 w-4"/></div>
    </div>
    <p className="mt-3 break-words text-[21px] font-bold tracking-tight text-[#123923] sm:text-[25px]">{value}</p>
    {note && <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>}
  </div>;
}
function Pill({ text, status }: { text: string; status?: string }) {
  const color = status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-800' :
    status === 'REFUNDED' || status === 'CANCELLED' ? 'bg-rose-50 text-rose-700' :
    'bg-amber-50 text-amber-800';
  return <span className={'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ' + color}>{text}</span>;
}
export default function AffiliateDashboardV3() {
  const [days, setDays] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [couponError, setCouponError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch('/api/dashboard/insights?days=' + String(days), {
      cache: 'no-store', signal: controller.signal, credentials: 'include',
    }).then(async response => {
      const body = await response.json();
      if (!response.ok || !body.success || body.role !== 'AFFILIATE') {
        throw new Error(body.error || 'The dashboard cannot be loaded.');
      }
      if (!controller.signal.aborted) setInsights(body);
    }).catch(err => {
      if (!controller.signal.aborted) { setError(err.message || 'Dashboard unavailable'); setInsights(null); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [days, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    setCouponError('');
    fetch('/api/affiliate/shopify-coupons', {
      cache: 'no-store', signal: controller.signal, credentials: 'include',
    }).then(async response => {
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Shopify verification is unavailable');
      if (!controller.signal.aborted) setCoupons(body.coupons || []);
    }).catch(err => {
      if (!controller.signal.aborted) { setCoupons([]); setCouponError(err.message || 'Shopify unavailable'); }
    });
    return () => controller.abort();
  }, [refreshKey]);

  const chartDays = useMemo(() => {
    const buckets = new Map<string, { date: string; label: string; orders: number; value: number; clicks: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      buckets.set(date, { date, label: date.slice(5), orders: 0, value: 0, clicks: 0 });
    }
    (insights?.orders || []).forEach(order => {
      const bucket = buckets.get(order.date.slice(0, 10));
      if (bucket) { bucket.orders++; bucket.value += order.totalEGP || 0; }
    });
    (insights?.clicksByDay || []).forEach(date => {
      const bucket = buckets.get(date); if (bucket) bucket.clicks++;
    });
    return Array.from(buckets.values());
  }, [insights, days]);

  const statusChart = insights ? [
    { name: 'Delivered', value: insights.totals.deliveredOrders, color: GREEN },
    { name: 'Pending', value: insights.totals.pendingOrders, color: '#DFB65A' },
    { name: 'Refunded', value: insights.totals.returnedOrders, color: '#C65C68' },
    { name: 'Cancelled', value: insights.totals.cancelledOrders, color: '#97A6A0' },
  ].filter(v => v.value > 0) : [];

  const productLinks = coupons.flatMap(c => c.products.map(p => ({ ...p, code: c.code })));
  const activeCode = coupons.length ? coupons[0].code : null;
  const firstName = insights?.name?.trim().split(/\s+/)[0] || 'Partner';
  const currentValue = insights?.totals.orderValueEGP || 0;
  const previousValue = insights?.previousOrderValueEGP || 0;
  const change = previousValue > 0 && insights?.complete
    ? (100 * (currentValue - previousValue) / previousValue).toFixed(1) + '%' : null;
  const deliveryRate = insights && insights.totals.trackedOrders > 0
    ? (100 * insights.totals.deliveredOrders / insights.totals.trackedOrders).toFixed(1) + '%' : '—';
  const indicativeConversion = insights?.complete && insights.totals.clicks > 0
    ? (100 * insights.totals.trackedOrders / insights.totals.clicks).toFixed(1) + '%' : '—';

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch { setCopied(''); }
  };

  const exportOrders = () => {
    if (!insights || !insights.complete || !insights.orders.length) return;
    const data = [
      ['Order', 'Shopify updated date', 'Promo code', 'Source', 'Status', 'Value EGP', 'Reconciled'],
      ...insights.orders.map(o => [
        o.name, o.date, o.code || '', o.source, o.status,
        o.totalEGP == null ? '' : String(o.totalEGP), o.reconciled ? 'Yes' : 'No',
      ]),
    ];
    const csv = '\uFEFF' + data.map(line => line.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'herbal-vitaly-partner-orders.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return <main lang="en" className="mx-auto max-w-[1536px] space-y-5 pb-12 sm:space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#1F6B3A]">HERBAL VITALY / PARTNER PORTAL</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#173621] sm:text-3xl">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">Your growth, orders and earnings — all in one clear view.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-[#E4EBE6] bg-white px-3 py-2.5 text-xs font-medium text-slate-600">
          <span>Reporting period</span>
          <select aria-label="Reporting period" value={days} onChange={e => setDays(Number(e.target.value))}
            className="bg-transparent font-semibold text-[#173621] outline-none">
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
          </select>
        </label>
        <button type="button" onClick={() => setRefreshKey(v => v + 1)} aria-label="Refresh dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[#E4EBE6] bg-white px-3 py-2.5 text-xs font-semibold text-[#1F6B3A] hover:bg-[#EFF7F1]">
          <RefreshCw className="h-4 w-4"/> Refresh
        </button>
      </div>
    </div>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {loading && <div role="status" className="rounded-2xl border border-[#E4EBE6] bg-white p-10 text-center text-sm text-slate-600">Loading synchronized partner data…</div>}

    {insights && !loading && <>
      <section className="relative overflow-hidden rounded-[22px] bg-[#173F29] p-6 text-white sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-40 h-96 w-96 rounded-full border-[45px] border-white/5"/>
        <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
          <div className="max-w-xl">
            <span className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#C9E4CD]">Your personal partner space</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[32px]">Better visibility. Stronger partnerships.</h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-[#D3E4D8]">
              Share your verified product links, follow orders and understand exactly where commissions stand.
            </p>
            <p className="mt-4 text-xs text-[#BED7C4]">
              {insights.lastOrderUpdate ? 'Latest synchronized order update: ' + when(insights.lastOrderUpdate) : 'No synchronized orders yet'}
            </p>
          </div>
          <div className="w-full rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm md:max-w-[295px]">
            <p className="text-[11px] uppercase tracking-[.14em] text-[#D0E7D5]">Active Shopify promo code</p>
            <p className="mt-2 break-all font-mono text-2xl font-bold tracking-wider">
              {activeCode || (couponError ? 'Verification unavailable' : 'Not yet activated')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {activeCode && <button type="button" onClick={() => copy(activeCode)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#1F6B3A]">
                {copied === activeCode ? <Check className="h-3.5 w-3.5"/> : <Clipboard className="h-3.5 w-3.5"/>}
                {copied === activeCode ? 'Copied' : 'Copy code'}
              </button>}
              <Link href="/affiliate/coupons" className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold text-white">
                Manage codes <ArrowUpRight className="h-3.5 w-3.5"/>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-4">
        <Stat label="Attributed order value" value={money(insights.totals.orderValueEGP)}
          note={change ? 'Vs. previous period: ' + change : 'Orders updated in selected period'} icon={TrendingUp} emphasis/>
        <Stat label="Delivered order value" value={money(insights.totals.deliveredValueEGP)}
          note="Delivered, excluding refunded or cancelled" icon={Truck}/>
        <Stat label="Collected & reconciled" value={money(insights.totals.reconciledCollectedEGP)}
          note="Recorded collections, not total orders" icon={CheckCircle2}/>
        <Stat label="Tracked orders" value={String(insights.totals.trackedOrders)}
          note="Attributed Shopify orders" icon={ShoppingBag}/>
        <Stat label="Pending commissions" value={money(insights.finance.pendingEGP)}
          note="Recorded ledger entries" icon={Clock3}/>
        <Stat label="Approved commissions" value={money(insights.finance.approvedEGP)}
          note="Finance-approved ledger entries" icon={Wallet} emphasis/>
        <Stat label="Paid commissions" value={money(insights.finance.paidEGP)}
          note="Recorded as paid in the ledger" icon={CheckCircle2}/>
        <Stat label="Delivery success rate" value={deliveryRate}
          note="Delivered ÷ all attributed orders" icon={BarChart3}/>
      </div>

      {!insights.complete && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Exact summary totals are calculated across all matching orders. Trend charts, recent orders and CSV on this page are limited to recent sampled records. Use the paginated Orders page for older entries.
      </p>}

      {insights.totals.trackedOrders === 0 && <Section title="Start sharing with confidence"
        description="No attributed Shopify orders in this period. Begin with these practical steps.">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: '1. Choose a promo code', description: 'Activate a verified Shopify code for your audience.', href: '/affiliate/coupons' },
            { title: '2. Share a product link', description: 'Use the direct link assigned to your own code.', href: '/affiliate/coupons' },
            { title: '3. Follow your orders', description: 'Track purchases and confirmed commissions here.', href: '/affiliate/orders' },
          ].map(item => <Link key={item.title} href={item.href} className="rounded-xl border border-[#E2ECE4] bg-[#F7FBF8] p-4 hover:border-[#88B598]">
            <h3 className="text-sm font-semibold text-[#173621]">{item.title}</h3>
            <p className="mt-2 text-xs leading-6 text-slate-600">{item.description}</p>
            <ArrowRight className="mt-3 h-4 w-4 text-[#1F6B3A]"/>
          </Link>)}
        </div>
      </Section>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Section title="Order value over time" description="Shopify synchronized order updates — not collected revenue."
          aside={<span className="rounded-full bg-[#EAF5ED] px-3 py-1 text-[11px] font-semibold text-[#1F6B3A]">EGP</span>}>
          <div className="h-[275px] w-full" role="img" aria-label="Daily synchronized attributed order value">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDays}>
                <defs><linearGradient id="partnerV3Area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.19}/>
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0}/>
                </linearGradient></defs>
                <CartesianGrid stroke="#EBF0EB" vertical={false}/>
                <XAxis dataKey="label" tick={{ fill: '#75847A', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={20}/>
                <YAxis tick={{ fill: '#75847A', fontSize: 10 }} tickLine={false} axisLine={false} width={48}/>
                <Tooltip formatter={(value) => money(Number(value))}/>
                <Area dataKey="value" name="Order value" type="monotone" stroke={GREEN} strokeWidth={2.5} fill="url(#partnerV3Area)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-500">The chart uses the available synchronized order update dates.</p>
        </Section>
        <Section title="Delivery overview" description="Exact order counts across the selected period." id="delivery-status"
          aside={<Link href="/affiliate/deliveries" className="text-xs font-semibold text-[#1F6B3A]">Open Deliveries</Link>}>
          {statusChart.length ? <div className="h-[220px] w-full" role="img" aria-label="Order delivery status distribution">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={61} outerRadius={87} paddingAngle={2}>
                {statusChart.map(item => <Cell key={item.name} fill={item.color}/>)}
              </Pie><Tooltip/></PieChart>
            </ResponsiveContainer>
          </div> : <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">No delivery records for this period</div>}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
            {statusChart.map(item => <span key={item.name} className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}/>
              {item.name}: {item.value}
            </span>)}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Clicks and attributed orders"
          description="Recorded tracking activity; not Shopify's confirmed conversion rate.">
          <div className="h-[215px] w-full" role="img" aria-label="Daily tracked clicks and attributed orders">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDays} barGap={2}>
                <CartesianGrid stroke="#EBF0EB" vertical={false}/>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#75847A' }} tickLine={false} axisLine={false} minTickGap={21}/>
                <YAxis tick={{ fontSize: 10, fill: '#75847A' }} tickLine={false} axisLine={false} width={30}/>
                <Tooltip/>
                <Bar dataKey="clicks" name="Tracked clicks" fill="#A8C9B0" radius={[3,3,0,0]}/>
                <Bar dataKey="orders" name="Orders" fill={GREEN} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-600">
            <span>Recorded clicks: <strong>{insights.totals.clicks}</strong></span>
            <span>Orders / clicks: <strong>{indicativeConversion}</strong></span>
          </div>
        </Section>
        <Section title="Commission transparency" description="Amounts come only from recorded commission ledger entries." id="payout-overview">
          <div className="space-y-4">
            {[
              { title: 'Pending validation', amount: insights.finance.pendingEGP, color: '#D5A749' },
              { title: 'Finance approved', amount: insights.finance.approvedEGP, color: GREEN },
              { title: 'Paid', amount: insights.finance.paidEGP, color: '#6B9984' },
            ].map(item => {
              const all = insights.finance.pendingEGP + insights.finance.approvedEGP + insights.finance.paidEGP;
              const width = all > 0 ? 100 * item.amount / all : 0;
              return <div key={item.title}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600">{item.title}</span>
                  <strong className="text-[#173621]">{money(item.amount)}</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#EFF3EF]">
                  <div className="h-full rounded-full" style={{ width: String(width) + '%', backgroundColor: item.color }}/>
                </div>
              </div>;
            })}
          </div>
          <p className="mt-5 rounded-lg bg-[#F5F9F6] p-3 text-xs leading-6 text-slate-600">
            Orders are not payable commissions. Delivery, COD collection, reconciliation and financial approval must be verified under program terms.
          </p>
          <Link href="/affiliate/payouts" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F6B3A]">
            View payout history <ArrowRight className="h-4 w-4"/>
          </Link>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section title="My verified product links" id="shopify-products"
          description="Only Shopify-confirmed active codes and eligible products are shown."
          aside={<Link href="/affiliate/product-links" className="text-xs font-semibold text-[#1F6B3A]">Manage links</Link>}>
          {couponError && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{couponError}</p>}
          {productLinks.length ? <div className="space-y-2">
            {productLinks.slice(0, 6).map(item => <div key={item.code + item.handle}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7EEE8] p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#173621]">{item.title}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{item.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => copy(item.affiliateLink)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-[#1F6B3A]">
                  {copied === item.affiliateLink ? <Check className="h-3.5 w-3.5"/> : <Link2 className="h-3.5 w-3.5"/>}
                  {copied === item.affiliateLink ? 'Copied' : 'Copy link'}
                </button>
                <a href={item.affiliateLink} target="_blank" rel="noopener noreferrer"
                  aria-label={'Open ' + item.title + ' partner product page'} className="rounded-lg border p-2 text-[#1F6B3A]">
                  <ExternalLink className="h-4 w-4"/>
                </a>
              </div>
            </div>)}
          </div> : <div className="rounded-xl border border-dashed border-[#CBDDCF] bg-[#F8FBF8] p-6 text-sm text-slate-600">
            No verified partner product links are available yet. Activate an assigned Shopify code to get started.
          </div>}
          <Link href="/affiliate/product-links" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6B3A]">
            All codes and product links <ArrowRight className="h-4 w-4"/>
          </Link>
        </Section>
        <Section title="Delivery and returns" description="Verified statuses, without guessed return reasons." id="return-reasons"
          aside={<Link href="/affiliate/returns" className="text-xs font-semibold text-[#1F6B3A]">Open Returns</Link>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#F4F9F5] p-4"><Truck className="h-4 w-4 text-[#1F6B3A]"/>
              <strong className="mt-3 block text-xl text-[#173621]">{insights.totals.deliveredOrders}</strong>
              <span className="text-xs text-slate-600">Delivered</span>
            </div>
            <div className="rounded-xl bg-amber-50 p-4"><Clock3 className="h-4 w-4 text-amber-700"/>
              <strong className="mt-3 block text-xl text-[#173621]">{insights.totals.pendingOrders}</strong>
              <span className="text-xs text-slate-600">Pending</span>
            </div>
            <div className="rounded-xl bg-rose-50 p-4"><RotateCcw className="h-4 w-4 text-rose-600"/>
              <strong className="mt-3 block text-xl text-[#173621]">{insights.totals.returnedOrders}</strong>
              <span className="text-xs text-slate-600">Refunded</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-4"><Package className="h-4 w-4 text-slate-500"/>
              <strong className="mt-3 block text-xl text-[#173621]">{insights.totals.cancelledOrders}</strong>
              <span className="text-xs text-slate-600">Cancelled</span>
            </div>
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-500">Detailed return reasons and product line items are not yet stored in the order connector. No reasons are inferred.</p>
        </Section>
      </div>

      <Section title="Recent attributed Shopify orders"
        description="The most recent synchronized order updates. Use My Orders for server-paginated history."
        id="order-list"
        aside={<Link href="/affiliate/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B3A]">View all <ArrowUpRight className="h-3.5 w-3.5"/></Link>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead><tr className="border-b border-[#E7EEE9] text-xs text-slate-500">
              {['Order', 'Last updated', 'Coupon', 'Attribution', 'Delivery', 'Order value'].map(label =>
                <th key={label} className="pb-3 pr-4 font-semibold">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#EFF3EF]">
              {insights.orders.slice(0, 12).map(o => <tr key={o.id}>
                <td className="py-3 pr-4 font-semibold text-[#173621]">{o.name}</td>
                <td className="whitespace-nowrap py-3 pr-4 text-slate-500">{when(o.date)}</td>
                <td className="py-3 pr-4 font-mono text-xs">{o.code || '—'}</td>
                <td className="py-3 pr-4 text-xs text-slate-600">{sourceNames[o.source] || o.source}</td>
                <td className="py-3 pr-4"><Pill text={statusNames[o.status] || o.status} status={o.status}/></td>
                <td className="whitespace-nowrap py-3 font-semibold text-[#173621]">{money(o.totalEGP)}</td>
              </tr>)}
            </tbody>
          </table>
          {!insights.orders.length && <p className="py-10 text-center text-sm text-slate-500">No attributed orders for this period.</p>}
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-[#EEF2EE] pt-4">
          <Link href="/affiliate/orders" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6B3A]">
            Open complete order history <ArrowRight className="h-4 w-4"/>
          </Link>
          <button type="button" disabled={!insights.complete || !insights.orders.length}
            onClick={exportOrders} title={!insights.complete ? 'Use the server-paginated order history to access all records' : 'Export selected period'}
            className="inline-flex items-center gap-2 rounded-lg border border-[#CADCCF] px-3 py-2 text-xs font-semibold text-[#1F6B3A] disabled:opacity-40">
            <FileDown className="h-4 w-4"/> Export selected period
          </button>
        </div>
      </Section>
      <p className="px-1 text-xs leading-relaxed text-slate-500">Information comes from verified Refferq, Shopify and recorded commission data. All financial values are EGP. Payouts remain subject to the official program rules and financial review.</p>
    </>}
  </main>;
}
