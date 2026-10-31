'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { AreaChart, Area, BarChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, ClipboardCopy, ExternalLink, FilterX, Link2, Package, RefreshCw, RotateCcw, ShoppingBag, Ticket, Truck, Users, Wallet } from 'lucide-react';

type Order = {
  id: string; name: string; date: string; totalEGP: number | null; currency: string;
  code: string | null; referralCode: string | null; source: string; status: string;
  cod: boolean; collected: boolean; reconciled: boolean; bostaState: number | null;
  trackingNumber: string | null; returnReason: string | null; product: string | null;
  partnerId: string | null; partner: string | null; shopifyOrderUrl: string | null;
};
type Insights = {
  success: boolean; role: 'ADMIN' | 'AFFILIATE'; name: string; referralCode: string | null;
  days: number; complete: boolean; activeCoupons: number;
  totals: { trackedOrders: number; clicks: number; leads: number; orderValueEGP: number;
    deliveredOrders: number; pendingOrders: number; returnedOrders: number;
    cancelledOrders: number; settledOrders: number };
  finance: { approvedEGP: number; pendingEGP: number; paidEGP: number };
  orders: Order[]; clicksByDay: string[];
  partners: Array<{ id: string; name: string; code: string }>;
};
type Product = { id: string; handle: string; title: string; onlineStoreUrl?: string | null };
type Coupon = { id: string; code: string; products: Array<{
  handle: string; title: string; productUrl: string; affiliateLink: string;
}> };

const green = '#1F6B3A';
const formatMoney = (n: number | null) => n == null ? '—' :
  new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' EGP';
const dayLabel = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
const statusNames: Record<string, string> = {
  PENDING: 'Pending delivery', DELIVERED: 'Delivered', REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled', AFFILIATE_LINK: 'Affiliate link', PROMO_CODE: 'Discount code',
  LINK_AND_PROMO: 'Link + code', UNATTRIBUTED: 'Unattributed',
  UNVERIFIED: 'Unverified', CONFLICT: 'Attribution conflict',
};
const statusColor: Record<string, string> = {
  DELIVERED: 'bg-emerald-50 text-emerald-800', PENDING: 'bg-amber-50 text-amber-800',
  REFUNDED: 'bg-rose-50 text-rose-800', CANCELLED: 'bg-rose-50 text-rose-800',
};
const empty = 'No records match these filters';

function Metric({ title, value, note, icon: Icon, accent = green }: {
  title: string; value: string; note?: string; icon: typeof ShoppingBag; accent?: string;
}) {
  return <div className="rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs font-medium text-slate-500">{title}</span>
      <span className="rounded-xl p-2" style={{ color: accent, backgroundColor: accent + '13' }}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-2 break-words text-xl font-bold tracking-tight text-[#18291E]">{value}</p>
    {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
  </div>;
}
function Panel({ title, subtitle, children, id }: {
  title: string; subtitle?: string; children: ReactNode; id?: string;
}) {
  return <section id={id} className="scroll-mt-24 min-w-0 rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm">
    <h2 className="font-semibold text-[#173621]">{title}</h2>
    {subtitle && <p className="mb-3 mt-1 text-xs text-slate-500">{subtitle}</p>}
    {children}
  </section>;
}

export default function HvDashboard({ role }: { role: 'ADMIN' | 'AFFILIATE' }) {
  const admin = role === 'ADMIN';
  const [days, setDays] = useState(30);
  const [partner, setPartner] = useState('');
  const [data, setData] = useState<Insights | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [delivery, setDelivery] = useState('');
  const [source, setSource] = useState('');
  const [couponFilter, setCouponFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ days: String(days) });
    if (admin && partner) params.set('affiliateId', partner);
    fetch('/api/dashboard/insights?' + params.toString(), { cache: 'no-store' })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Dashboard data unavailable');
        if (active) setData(json);
      }).catch(err => { if (active) { setError(err.message); setData(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, days, partner, refresh]);

  useEffect(() => {
    let active = true;
    setCatalogError('');
    const endpoint = admin ? '/api/admin/coupons/products' : '/api/affiliate/shopify-coupons';
    fetch(endpoint, { cache: 'no-store' })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Shopify catalog unavailable');
        if (!active) return;
        if (admin) setProducts((json.products || []).filter((p: Product) =>
          typeof p.onlineStoreUrl === 'string' && p.onlineStoreUrl.startsWith('https://herbalvitaly.com/')));
        else setCoupons(json.coupons || []);
      }).catch(err => { if (active) setCatalogError(err.message); });
    return () => { active = false; };
  }, [admin, refresh]);

  const rows = useMemo(() => (data?.orders || []).filter(o => {
    const text = [o.name, o.code, o.referralCode, o.partner].join(' ').toLowerCase();
    return (!query || text.includes(query.toLowerCase())) &&
      (!delivery || o.status === delivery) && (!source || o.source === source) &&
      (!couponFilter || (o.code || '') === couponFilter);
  }), [data, query, delivery, source, couponFilter]);

  const totals = useMemo(() => ({
    value: rows.reduce((n, o) => n + (o.totalEGP || 0), 0),
    delivered: rows.filter(o => o.status === 'DELIVERED').length,
    returned: rows.filter(o => o.status === 'REFUNDED').length,
    cancelled: rows.filter(o => o.status === 'CANCELLED').length,
    pending: rows.filter(o => o.status === 'PENDING').length,
    settled: rows.filter(o => o.reconciled).length,
  }), [rows]);

  const chartDays = useMemo(() => {
    const daily = new Map<string, { date: string; label: string; orders: number; value: number; clicks: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      daily.set(d, { date: d, label: dayLabel(d), orders: 0, value: 0, clicks: 0 });
    }
    rows.forEach(o => {
      const key = o.date.slice(0, 10), bucket = daily.get(key);
      if (bucket) { bucket.orders++; bucket.value += o.totalEGP || 0; }
    });
    (data?.clicksByDay || []).forEach(d => {
      const bucket = daily.get(d); if (bucket) bucket.clicks++;
    });
    return Array.from(daily.values());
  }, [rows, data, days]);

  const statusChart = [
    { name: 'Delivered', value: totals.delivered, color: green },
    { name: 'Pending', value: totals.pending, color: '#E7A43F' },
    { name: 'Refunded', value: totals.returned, color: '#DE6676' },
    { name: 'Cancelled', value: totals.cancelled, color: '#9BABB0' },
  ].filter(x => x.value > 0);
  const promoOptions = [...new Set((data?.orders || []).map(o => o.code).filter((x): x is string => Boolean(x)))].sort();
  const partnerRank = useMemo(() => {
    const map = new Map<string, { id: string; name: string; orders: number; delivered: number; returns: number; revenue: number }>();
    rows.forEach(o => {
      if (!o.partnerId) return;
      const t = map.get(o.partnerId) || { id: o.partnerId, name: o.partner || 'Partner', orders: 0, delivered: 0, returns: 0, revenue: 0 };
      t.orders++; t.revenue += o.totalEGP || 0;
      if (o.status === 'DELIVERED') t.delivered++;
      if (o.status === 'REFUNDED') t.returns++;
      map.set(o.partnerId, t);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [rows]);
  const productLinks = !admin ? coupons.flatMap(c => c.products.map(p => ({ ...p, code: c.code })))
    .filter(p => !productFilter || p.handle === productFilter) : [];

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value); setCopied(value);
    } catch { setCopied(''); }
  };
  const exportCsv = () => {
    const header = ['Order', 'Date', 'Partner', 'Promo', 'Attribution', 'Delivery status', 'COD reconciled', 'Total EGP'];
    const items = rows.map(o => [o.name, o.date, o.partner || '', o.code || '', o.source, o.status,
      o.reconciled ? 'yes' : 'no', o.totalEGP == null ? '' : String(o.totalEGP)]);
    const csv = [header, ...items].map(r => r.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = 'herbal-vitaly-' + (admin ? 'admin' : 'partner') + '-orders.csv';
    anchor.click(); URL.revokeObjectURL(url);
  };

  return <main lang="en" className="space-y-5 pb-10">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1F6B3A]">Herbal Vitaly Affiliate Hub</p>
        <h1 className="mt-1 text-2xl font-bold text-[#172D20]">
          {admin ? 'Admin Dashboard' : 'Partner Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Synchronized orders, attribution, deliveries, and verified performance.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
          <CalendarDays className="h-4 w-4 text-[#1F6B3A]"/>
          <select aria-label="Date range" value={days} onChange={e => setDays(Number(e.target.value))} className="bg-white outline-none">
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
        </label>
        <button type="button" onClick={exportCsv} disabled={!data} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-[#1F6B3A] disabled:opacity-50">Export CSV</button>
        <button type="button" onClick={() => setRefresh(n => n + 1)} className="flex items-center gap-2 rounded-lg bg-[#1F6B3A] px-3 py-2 text-sm font-medium text-white">
          <RefreshCw className="h-4 w-4"/> Refresh
        </button>
      </div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {loading && <p role="status" className="rounded-xl border bg-white p-4 text-sm text-slate-500">Loading verified dashboard data…</p>}
    {data && <>
      {!data.complete && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">More than 2,000 events found: charts and tables cover only the records shown.</p>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 2xl:grid-cols-8">
        <Metric title="Tracked orders" value={String(data.totals.trackedOrders)} icon={ShoppingBag} note="Selected period"/>
        <Metric title="Order value" value={formatMoney(data.totals.orderValueEGP)} icon={Wallet} note="Not the same as collected revenue"/>
        <Metric title="Delivered orders" value={String(data.totals.deliveredOrders)} icon={Truck}/>
        <Metric title="Refunded / cancelled" value={String(data.totals.returnedOrders + data.totals.cancelledOrders)} icon={RotateCcw} accent="#D64B68"/>
        <Metric title="Tracked clicks" value={String(data.totals.clicks)} icon={Activity}/>
        <Metric title="Leads" value={String(data.totals.leads)} icon={Users}/>
        <Metric title={admin ? 'Active Shopify codes' : 'Pending commissions'} value={admin ? String(data.activeCoupons) : formatMoney(data.finance.pendingEGP)} icon={Ticket}/>
        <Metric title="Attributed orders / clicks" value={data.totals.clicks && data.complete ?
          (100 * data.orders.filter(o => ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'].includes(o.source)).length / data.totals.clicks).toFixed(1) + '%' : '—'}
          icon={BarChart3} note="Tracking indicator, not Shopify's confirmed conversion rate"/>
      </div>

      <Panel title="Shopify · Herbal Vitaly" subtitle="Official Shopify store and product catalog — Refferq figures are independent of COD/Bosta reconciliation.">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-slate-600">Latest synchronized order: {data.orders[0] ? new Date(data.orders[0].date).toLocaleString('en-GB') : 'none'}</span>
          <div className="flex flex-wrap gap-2">
            <a href="https://herbalvitaly.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 font-medium text-[#1F6B3A]"><ExternalLink className="h-4 w-4"/> Shopify store</a>
            <Link href={admin ? '/admin/coupons' : '/affiliate/coupons'} className="rounded-lg border px-3 py-2 font-medium text-[#1F6B3A]">{admin ? 'Coupons & products' : 'My coupons & products'}</Link>
            {admin && <Link href="/admin/orders" className="rounded-lg bg-[#E9F4EC] px-3 py-2 font-medium text-[#1F6B3A]">Order synchronization</Link>}
          </div>
        </div>
      </Panel>

      <Panel title="Analysis filters" subtitle="Summary KPIs cover the selected period; charts and order rows below also reflect your filters.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {admin && <label className="text-xs text-slate-500">Partner
            <select className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-slate-800" value={partner} onChange={e => setPartner(e.target.value)}>
              <option value="">All partners</option>{data.partners.map(p => <option value={p.id} key={p.id}>{p.name} · {p.code}</option>)}
            </select>
          </label>}
          <label className="text-xs text-slate-500">Search orders / partners
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={query} onChange={e => setQuery(e.target.value)} placeholder="#2064, T15, partner…" />
          </label>
          <label className="text-xs text-slate-500">Delivery status
            <select className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-slate-800" value={delivery} onChange={e => setDelivery(e.target.value)}>
              <option value="">All statuses</option>
              {['PENDING','DELIVERED','REFUNDED','CANCELLED'].map(k => <option key={k} value={k}>{statusNames[k]}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500">Attribution source
            <select className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-slate-800" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">All sources</option>
              {['AFFILIATE_LINK','PROMO_CODE','LINK_AND_PROMO','UNATTRIBUTED','UNVERIFIED','CONFLICT'].map(k => <option key={k} value={k}>{statusNames[k]}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500">Discount code
            <select className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-slate-800" value={couponFilter} onChange={e => setCouponFilter(e.target.value)}>
              <option value="">All discount codes</option>
              {promoOptions.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{rows.length} orders displayed · {formatMoney(totals.value)} · {totals.settled} marked as financially reconciled</span>
          <button type="button" onClick={() => { setQuery(''); setDelivery(''); setSource(''); setCouponFilter(''); setPartner(''); }} className="inline-flex items-center gap-1 font-medium text-[#1F6B3A]"><FilterX className="h-3.5 w-3.5"/> Reset filters</button>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Order trends" subtitle="Synchronized order value (EGP) · per day">
          <div className="h-56" role="img" aria-label="Daily order value chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDays}><CartesianGrid vertical={false} stroke="#E4EBE6"/>
                <XAxis dataKey="label" tick={{fontSize:10}} minTickGap={25}/>
                <YAxis tick={{fontSize:10}} width={45}/><Tooltip formatter={(v) => formatMoney(Number(v))}/>
                <Area type="monotone" dataKey="value" stroke={green} fill="#E9F4EC" strokeWidth={2} name="Orders" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel id="delivery-status" title="Delivery statuses" subtitle="Delivered, pending, refunded, and cancelled">
          {statusChart.length ? <div className="h-56" role="img" aria-label="Delivery status breakdown">
            <ResponsiveContainer width="100%" height="100%"><PieChart>
              <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={76}>
                {statusChart.map(c => <Cell key={c.name} fill={c.color}/>)}
              </Pie><Tooltip />
            </PieChart></ResponsiveContainer>
          </div> : <p className="py-14 text-center text-sm text-slate-500">{empty}</p>}
          <div className="flex flex-wrap gap-3 text-xs">{statusChart.map(s => <span key={s.name}><span style={{color:s.color}}>●</span> {s.name}: {s.value}</span>)}</div>
        </Panel>
        <Panel title="Clicks and orders" subtitle="Recorded clicks and attributed orders">
          <div className="h-56" role="img" aria-label="Daily clicks and orders chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDays}><CartesianGrid vertical={false} stroke="#E4EBE6"/>
                <XAxis dataKey="label" tick={{fontSize:10}} minTickGap={25}/><YAxis allowDecimals={false} tick={{fontSize:10}} width={25}/>
                <Tooltip/><Bar name="Clicks" dataKey="clicks" fill="#A2D0B0" radius={[3,3,0,0]}/>
                <Bar name="Orders" dataKey="orders" fill={green} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="return-reasons" title="Return reasons" subtitle="Bosta / Shopify data availability">
          <div className="flex min-h-28 items-center gap-3 rounded-xl bg-slate-50 p-4">
            <RotateCcw className="h-7 w-7 text-slate-400"/>
            <p className="text-sm text-slate-600">Detailed return reasons are not yet available in Refferq order records. <strong>{totals.returned} refunded</strong> et <strong>{totals.cancelled} cancelled</strong> within the selection. No reasons are inferred.</p>
          </div>
        </Panel>
        <Panel id="payout-overview" title="Recorded commissions" subtitle="Amounts from the commission ledger — not automatic estimates on COD orders">
          <div className="grid grid-cols-3 gap-3">
            {[['Pending',data.finance.pendingEGP],['Approved',data.finance.approvedEGP],['Paid',data.finance.paidEGP]].map(([label,value]) =>
              <div key={String(label)} className="rounded-xl bg-[#F5F9F6] p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-2 break-words text-sm font-bold">{formatMoney(Number(value))}</p>
              </div>)}
          </div>
          <p className="mt-3 text-xs text-amber-800">Payouts only after delivery, COD/Bosta collection, and financial approval.</p>
        </Panel>
      </div>

      {!admin && <Panel title="My affiliate link" subtitle="Share a link to the store or to a specific product.">
        <div className="grid gap-3 md:grid-cols-2">
          {[['Store link','https://partner.herbalvitaly.com/r/' + (data.referralCode || '')],['Referral code',data.referralCode || '—']].map(([label,value]) =>
            <div key={label}><p className="mb-1 text-xs text-slate-500">{label}</p>
              <div className="flex items-center gap-2"><input readOnly value={value} onFocus={e=>e.currentTarget.select()} className="w-full min-w-0 rounded-lg border p-2 text-xs"/>
                <button type="button" onClick={()=>copy(value)} title="Copy" className="rounded-lg border p-2 text-[#1F6B3A]"><ClipboardCopy className="h-4 w-4"/></button>
              </div>
            </div>)}
        </div>
      </Panel>}

      <Panel id="shopify-products" title={admin ? 'Shopify catalog' : 'My Shopify product links'}
        subtitle={admin ? 'Published products on herbalvitaly.com with direct links to product pages.' :
          'Product links assigned to your account; only active, verified Shopify coupons are shown.'}>
        {catalogError && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Catalog unavailable: {catalogError}</p>}
        {!admin && <label className="mb-3 block text-xs text-slate-500">Filter product links
          <select className="mt-1 w-full rounded-lg border bg-white p-2 text-sm sm:w-72" value={productFilter} onChange={e=>setProductFilter(e.target.value)}>
            <option value="">All products</option>
            {[...new Map(coupons.flatMap(c=>c.products).map(p=>[p.handle,p.title] as const)).entries()].map(([handle,title])=><option key={handle} value={handle}>{title}</option>)}
          </select></label>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F6FAF7] text-xs text-slate-500"><tr><th className="px-3 py-3">Product</th><th className="px-3 py-3">Shopify page</th><th className="px-3 py-3">{admin ? 'Catalog' : 'Discount code'}</th>{!admin && <th className="px-3 py-3">Affiliate link</th>}</tr></thead>
            <tbody className="divide-y divide-[#E4EBE6]">
              {admin ? products.map(p => <tr key={p.id}><td className="px-3 py-3 font-medium">{p.title}</td>
                <td className="px-3 py-3"><a className="inline-flex items-center gap-1 text-[#1F6B3A] underline" href={p.onlineStoreUrl!} target="_blank" rel="noopener noreferrer">View product <ExternalLink className="h-3.5 w-3.5"/></a></td>
                <td className="px-3 py-3"><Link className="text-[#1F6B3A] underline" href="/admin/coupons">View discounts</Link></td></tr>)
                : productLinks.map(p => <tr key={p.code+'-'+p.handle}><td className="px-3 py-3 font-medium">{p.title}</td>
                  <td className="px-3 py-3"><a className="inline-flex items-center gap-1 text-[#1F6B3A] underline" href={p.productUrl} target="_blank" rel="noopener noreferrer">Open <ExternalLink className="h-3.5 w-3.5"/></a></td>
                  <td className="px-3 py-3"><span className="rounded-md bg-[#EAF4ED] px-2 py-1 font-mono text-xs">{p.code}</span></td>
                  <td className="px-3 py-3"><button onClick={()=>copy(p.affiliateLink)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B3A]"><ClipboardCopy className="h-3.5 w-3.5"/>{copied===p.affiliateLink?'Copied':'Copy link'}</button></td></tr>)}
            </tbody>
          </table>
          {(admin ? products.length === 0 : productLinks.length === 0) && !catalogError && <p className="p-5 text-sm text-slate-500">No products or coupons available for this account.</p>}
        </div>
      </Panel>

      <Panel id="order-list" title={admin ? 'Shopify orders · All partners' : 'My attributed orders'}
        subtitle="Orders do not create payable commissions before COD/Bosta reconciliation. Return reasons and order line items are not yet synchronized.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F6FAF7] text-xs text-slate-500">
              <tr><th className="p-3">Order</th><th className="p-3">Date</th>{admin && <th className="p-3">Partner</th>}
                <th className="p-3">Code</th><th className="p-3">Source</th><th className="p-3">Delivery</th>
                <th className="p-3">Return</th><th className="p-3">Reconciliation</th><th className="p-3 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-[#E4EBE6]">
              {rows.slice(0, 60).map(o => <tr key={o.id} className="hover:bg-[#FBFDFB]">
                <td className="p-3 font-semibold">{o.shopifyOrderUrl ?
                  <a href={o.shopifyOrderUrl} target="_blank" rel="noopener noreferrer" className="text-[#1F6B3A] underline">#{o.name}</a> : '#'+o.name}</td>
                <td className="whitespace-nowrap p-3 text-xs text-slate-600">{new Date(o.date).toLocaleDateString('en-GB')}</td>
                {admin && <td className="p-3 text-xs">{o.partner || '—'}</td>}
                <td className="p-3 font-mono text-xs">{o.code || '—'}</td>
                <td className="p-3 text-xs">{statusNames[o.source] || o.source}</td>
                <td className="p-3"><span className={'rounded-md px-2 py-1 text-xs ' + (statusColor[o.status]||'bg-slate-50 text-slate-700')}>{statusNames[o.status]||o.status}</span></td>
                <td className="p-3 text-xs text-slate-500">{o.returnReason || 'Not provided'}</td>
                <td className="p-3 text-xs">{o.reconciled ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3"/> Yes</span> : 'Pending'}</td>
                <td className="whitespace-nowrap p-3 text-right font-semibold">{formatMoney(o.totalEGP)}</td>
              </tr>)}
            </tbody>
          </table>
          {!rows.length && <p className="p-5 text-center text-sm text-slate-500">{empty}</p>}
        </div>
        {rows.length>60 && <p className="mt-3 text-xs text-slate-500">Showing the first 60 orders. Filter the table or export CSV for the full selection.</p>}
      </Panel>
      {admin && <Panel title="Partner performance" subtitle="Value of attributed synchronized orders (not collected revenue).">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-[#F6FAF7] text-xs text-slate-500"><tr><th className="p-3">Partner</th><th className="p-3">Orders</th><th className="p-3">Delivered</th><th className="p-3">Refunded</th><th className="p-3 text-right">Order value</th></tr></thead>
          <tbody className="divide-y">{partnerRank.map(p=><tr key={p.id}><td className="p-3">{p.name}</td><td className="p-3">{p.orders}</td><td className="p-3">{p.delivered}</td><td className="p-3">{p.returns}</td><td className="p-3 text-right">{formatMoney(p.revenue)}</td></tr>)}</tbody>
        </table>{!partnerRank.length && <p className="p-3 text-sm text-slate-500">No attributed orders.</p>}</div>
      </Panel>}
      <p className="text-xs text-slate-500">Data sources: Refferq orders, tracked clicks, and commission ledger. All amounts in EGP. Per-order products and detailed return reasons require additional Shopify/Bosta synchronization.</p>
    </>}
  </main>;
}
