'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight,
  BarChart3, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign,
  Clock3, Download, FileBarChart, FilterX, Headphones, Landmark,
  LayoutDashboard, Package, RefreshCw, RotateCcw, Search,
  ShieldCheck, ShoppingBag, TicketPercent, Truck, Users, Wallet,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const BRAND = '#1F6B3A';
const COLORS = ['#1F6B3A', '#C9A260', '#C35E64', '#8DA399'];
const DAY = 86_400_000;
type Range = 7 | 30 | 90;

type Order = {
  id: string; name: string; date: string; totalEGP: number | null; currency: string;
  code: string | null; referralCode: string | null; source: string; status: string;
  cod: boolean; collected: boolean; reconciled: boolean; bostaState: number | null;
  trackingNumber: string | null; partnerId: string | null; partner: string | null;
  shopifyOrderUrl: string | null;
};
type Insights = {
  success: boolean; days: Range; complete: boolean; activeCoupons: number;
  dataAsOf?: string; lastOrderUpdate: string | null; previousOrderValueEGP: number;
  totals: {
    trackedOrders: number; clicks: number; leads: number; orderValueEGP: number;
    deliveredOrders: number; pendingOrders: number; returnedOrders: number;
    cancelledOrders: number; settledOrders: number;
    deliveredValueEGP: number; reconciledCollectedEGP: number;
  };
  finance: { approvedEGP: number; pendingEGP: number; paidEGP: number };
  orders: Order[]; clicksByDay: string[];
  partners: Array<{ id: string; name: string; code: string }>;
};
type Finance = {
  success: boolean; days: Range; dataAsOf: string;
  operational: {
    trackedOrders: number; trackedOrderValuePiasters: number;
    deliveredOrders: number; cancelledOrders: number; refundedOrders: number;
    codReconciledOrders: number; codReconciledOrderValuePiasters: number;
    codAwaitingReconciliationOrders: number;
    codAwaitingReconciliationOrderValuePiasters: number;
    pendingCommissionsPiasters: number; approvedCommissionsPiasters: number;
    paidCommissionsPiasters: number;
  };
  accounting: { connected: boolean };
};
type Center = {
  success: boolean; days: Range; dataAsOf: string;
  liveQueues: {
    activePartners: number; pendingPartners: number; unverifiedPartners: number;
    openTickets: number; urgentTickets: number; pendingPayouts: number;
    pendingPayoutValueEGP: number; activeShopifyCoupons: number;
    couponSyncIssues: number; codWaiting: number;
  };
  period: { attributionIssues: number };
  newPartners: Array<{ id: string; name: string; status: string;
    createdAt: string; referralCode: string | null }>;
  supportQueue: Array<{ id: string; subject: string; status: string; priority: string;
    lastMessageAt: string; partner: string }>;
  leaderboard: Array<{ affiliateId: string | null; name: string; referralCode: string;
    orderCount: number; trackedOrderValueEGP: number }>;
};

const money = (amount: number | null | undefined) =>
  amount == null ? '—' : new Intl.NumberFormat('en-EG',
    { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(amount) + ' EGP';
const compact = (amount: number) =>
  new Intl.NumberFormat('en-EG', { maximumFractionDigits: 1, notation: 'compact' }).format(amount);
const number = (amount: number) => new Intl.NumberFormat('en-EG').format(amount);
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }) + ' Cairo' : 'No recent records';
const escapeCsv = (v: unknown) => {
  const raw = String(v ?? '');
  // Prevent spreadsheet formula execution from attacker-controlled name/code strings.
  const clean = /^[=+@\-\t\r]/.test(raw.trimStart()) ? "'" + raw : raw;
  return '"' + clean.replace(/"/g, '""') + '"';
};

function Heading({ eyebrow, title, description, right }: {
  eyebrow: string; title: string; description?: string; right?: React.ReactNode;
}) {
  return <div className="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#1F6B3A]">{eyebrow}</p>
      <h2 className="mt-1 font-serif text-[26px] font-medium tracking-tight text-[#173322] sm:text-[31px]">{title}</h2>
      {description && <p className="mt-1 text-xs leading-6 text-[#7A8A80]">{description}</p>}
    </div>
    {right}
  </div>;
}

function KPI({ title, value, note, icon: Icon, featured = false, href, alert = false }: {
  title: string; value: string; note: string; icon: typeof ShoppingBag;
  featured?: boolean; href?: string; alert?: boolean;
}) {
  const body = <div className={`relative flex h-full min-h-[156px] flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-shadow hover:shadow-md ${featured
    ? 'border-[#1F6B3A] bg-[#1F6B3A] text-white'
    : 'border-[#DFE9E2] bg-white text-[#1C3527]'}`}>
    <div className="flex items-start justify-between gap-3">
      <span className={`text-xs font-semibold ${featured ? 'text-white/80' : 'text-[#637D6A]'}`}>{title}</span>
      <span className={`rounded-lg p-2 ${featured ? 'bg-white/15 text-white' : alert ? 'bg-amber-50 text-amber-700' : 'bg-[#EEF6F0] text-[#1F6B3A]'}`}><Icon className="h-5 w-5"/></span>
    </div>
    <div className="mt-4">
      <p className="break-words text-[clamp(21px,2.1vw,30px)] font-bold tracking-tight tabular-nums">{value}</p>
      <p className={`mt-1.5 text-[11px] leading-5 ${featured ? 'text-white/75' : 'text-[#819287]'}`}>{note}</p>
    </div>
    {href && <ArrowUpRight className={`absolute bottom-4 right-4 h-4 w-4 ${featured ? 'text-white/65' : 'text-[#8CAB93]'}`}/>}
  </div>;
  return href ? <Link href={href} className="block h-full" aria-label={`Open ${title}`}>{body}</Link> : body;
}

function Panel({ title, subtitle, children, action, id }: {
  title: string; subtitle?: string; children: React.ReactNode;
  action?: React.ReactNode; id?: string;
}) {
  return <section id={id} className="min-w-0 scroll-mt-24 rounded-2xl border border-[#DFE9E2] bg-white p-5 shadow-[0_3px_16px_rgba(28,64,36,.025)]">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold text-[#1C3827]">{title}</h3>
        {subtitle && <p className="mt-1 text-xs leading-5 text-[#819287]">{subtitle}</p>}</div>
      {action}
    </div>{children}
  </section>;
}

function Action({ icon: Icon, label, detail, count, url, emphasis = false }: {
  icon: typeof ShoppingBag; label: string; detail: string; count: number; url: string; emphasis?: boolean;
}) {
  return <Link href={url}
    className="group flex items-center gap-3 border-b border-[#E9F0EB] py-4 last:border-b-0 hover:bg-[#FAFCFA]">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${emphasis && count > 0
      ? 'bg-[#FBF0E4] text-[#AA702A]' : 'bg-[#EDF6EF] text-[#1F6B3A]'}`}>
      <Icon className="h-[19px] w-[19px]"/>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-[#203D2C]">{label}</span>
      <span className="mt-0.5 block text-xs leading-5 text-[#7A8C80]">{detail}</span>
    </span>
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${emphasis && count > 0
      ? 'bg-[#FFF2DD] text-[#976522]' : 'bg-[#EFF5F0] text-[#346045]'}`}>{number(count)}</span>
    <ArrowUpRight className="h-4 w-4 text-[#8CAC95] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"/>
  </Link>;
}

export default function AdminCommandCenter() {
  const [days, setDays] = useState<Range>(30);
  const [revision, setRevision] = useState(0);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [center, setCenter] = useState<Center | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [updated, setUpdated] = useState('');
  const [query, setQuery] = useState('');
  const [partner, setPartner] = useState('');
  const [status, setStatus] = useState('');
  const [code, setCode] = useState('');
  const [tableCount, setTableCount] = useState(15);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setProblems([]);
    const urls = [
      '/api/dashboard/insights?days=' + days,
      '/api/admin/finance/overview?days=' + days,
      '/api/admin/command-center?days=' + days,
    ];
    const load = (url: string) => fetch(url, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || 'Service unavailable');
        return body;
      });
    Promise.allSettled(urls.map(load)).then(results => {
      if (controller.signal.aborted) return;
      const messages: string[] = [];
      const labels = ['Order analytics', 'Operational finance', 'Action queues'];
      results.forEach((result, index) => {
        if (result.status === 'rejected') messages.push(labels[index] + ' could not load');
      });
      setInsights(results[0].status === 'fulfilled' ? results[0].value as Insights : null);
      setFinance(results[1].status === 'fulfilled' ? results[1].value as Finance : null);
      setCenter(results[2].status === 'fulfilled' ? results[2].value as Center : null);
      setProblems(messages);
      setUpdated(new Date().toISOString());
      setBusy(false);
    });
    return () => controller.abort();
  }, [days, revision]);

  const allOrders = insights?.orders ?? [];
  const codes = useMemo(() =>
    [...new Set(allOrders.map(o => o.code).filter((x): x is string => !!x))].sort(), [allOrders]);
  const visible = useMemo(() => allOrders.filter(o => {
    const haystack = [o.name, o.partner, o.referralCode, o.code].join(' ').toLowerCase();
    return (!query || haystack.includes(query.trim().toLowerCase())) &&
      (!partner || o.partnerId === partner) &&
      (!status || o.status === status) &&
      (!code || o.code === code);
  }), [allOrders,query,partner,status,code]);
  const limited = visible.slice(0, tableCount);
  const filteredValue = visible.reduce((v, o) => v + (o.totalEGP ?? 0), 0);
  const trend = useMemo(() => {
    const map = new Map<string,{ date: string; label: string; value: number; orders: number; clicks: number }>();
    for(let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * DAY).toISOString().slice(0,10);
      map.set(date, {date,label:day(date+'T00:00:00Z'),value:0,orders:0,clicks:0});
    }
    for(const o of visible) {
      const bucket = map.get(o.date.slice(0,10));
      if(bucket){ bucket.value += o.totalEGP || 0; bucket.orders += 1; }
    }
    // Clicks are global to the reporting period. Do not display them as
    // partner-filtered because the click endpoint does not return a partner ID.
    if (!partner && !query && !code && !status) {
      for(const value of insights?.clicksByDay ?? []) {
        const bucket=map.get(value); if(bucket)bucket.clicks++;
      }
    }
    return [...map.values()];
  }, [visible,days,partner,query,code,status,insights]);
  const chart = useMemo(() => [
    {name:'Delivered',value:visible.filter(o=>o.status==='DELIVERED').length,color:COLORS[0]},
    {name:'In progress',value:visible.filter(o=>o.status==='PENDING').length,color:COLORS[1]},
    {name:'Refunded',value:visible.filter(o=>o.status==='REFUNDED').length,color:COLORS[2]},
    {name:'Cancelled',value:visible.filter(o=>o.status==='CANCELLED').length,color:COLORS[3]},
  ],[visible]).filter(s=>s.value>0);
  const filtersActive = Boolean(query || partner || status || code);

  const exportCsv = () => {
    const csv = [
      ['Order','Updated at','Partner','Code','Attribution','Delivery status','COD collected','Reconciled','Tracked value EGP'],
      ...visible.map(o => [o.name,o.date,o.partner??'',o.code??'',o.source,o.status,
        o.collected?'yes':'no',o.reconciled?'yes':'no',o.totalEGP??'']),
    ].map(row=>row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='herbal-vitaly-admin-orders-'+days+'d.csv';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const selectedRange = 'Last '+days+' days';
  const current = insights?.totals.orderValueEGP ?? 0;
  const prior = insights?.previousOrderValueEGP ?? 0;
  const delta = prior > 0 ? ((current-prior)/prior)*100 : null;
  const counts = center?.liveQueues;
  return <main lang="en" className="mx-auto max-w-[1680px] space-y-6 pb-12 text-[#1E3928]">
    <div className="relative overflow-hidden rounded-[22px] border border-[#DCE8DF] bg-white px-5 py-7 sm:px-7">
      <div className="pointer-events-none absolute -right-20 -top-36 h-[300px] w-[300px] rounded-full border-[55px] border-[#EDF5EF]"/>
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#1F6B3A]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1F6B3A]"/>HERBAL VITALY · OPERATIONS DESK
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-[#183B26] sm:text-[46px]">Executive overview</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[#708778]">
            One operating view across partners, Shopify orders, Bosta delivery and commission controls.
            Based on synchronized records, not estimated profit.
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs text-[#8AA08F]">
            <Clock3 className="h-3.5 w-3.5"/> Last refreshed: {updated?stamp(updated):'Loading'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#DCE8E0] bg-white px-3">
            <CalendarDays className="h-4 w-4 text-[#1F6B3A]"/>
            <span className="sr-only">Reporting period</span>
            <select value={days} onChange={e=>setDays(Number(e.target.value) as Range)}
              className="bg-transparent pr-1 text-sm font-semibold outline-none" aria-label="Reporting period">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-[#879B8C]"/>
          </label>
          <button onClick={()=>setRevision(n=>n+1)} type="button" disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCE8E0] bg-white px-4 text-sm font-semibold text-[#1F6B3A] hover:bg-[#F3F9F4] disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/>Refresh
          </button>
          <Link href="/admin/reports" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1F6B3A] px-4 text-sm font-bold text-white hover:bg-[#16532D]">
            <FileBarChart className="h-4 w-4"/>Reports <ArrowUpRight className="h-3.5 w-3.5"/>
          </Link>
        </div>
      </div>
    </div>

    {problems.length>0 && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#EAD5A9] bg-[#FFFAF0] p-4 text-sm text-[#845A25]">
      <AlertCircle className="h-5 w-5"/>{problems.join(' · ')}. Unavailable figures are shown as dashes, never fabricated.
    </div>}
    {busy && <div role="status" className="rounded-xl border border-[#E0EBE4] bg-white p-4 text-sm text-[#63806B]">Refreshing live business records…</div>}
    {!busy && !insights && !finance && !center && <div role="alert" className="rounded-xl border bg-white p-7 text-sm">Dashboard services are temporarily unavailable. <button onClick={()=>setRevision(n=>n+1)} className="font-semibold text-[#1F6B3A] underline">Retry</button></div>}
    {insights && !insights.complete && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      More than 2,000 orders or clicks exist in this range: summary KPIs are exact, but charts and order tables include only the latest 2,000 records.
    </div>}

    <section aria-label="Business performance" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#1F6B3A]">01 / COMMERCIAL SNAPSHOT</p>
          <h2 className="mt-1 font-serif text-2xl">Performance in focus</h2></div>
        <span className="text-xs text-[#839789]">{selectedRange} · synchronized Shopify records</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI title="Tracked order value" value={insights?money(insights.totals.orderValueEGP):'—'}
          note="Shopify order value · not collected revenue" icon={ShoppingBag} featured/>
        <KPI title="Tracked orders" value={insights?number(insights.totals.trackedOrders):'—'}
          note="All attribution states · selected period" icon={BarChart3} href="/admin/orders"/>
        <KPI title="Delivered orders" value={insights?number(insights.totals.deliveredOrders):'—'}
          note="Reported delivered · excluding returns" icon={Truck} href="/admin/orders"/>
        <KPI title="Reconciled collection records" value={insights?money(insights.totals.reconciledCollectedEGP):'—'}
          note="Recorded COD/merchant collections · not bank balance" icon={Landmark} href="/admin/cod"/>
        <KPI title="Active verified partners" value={counts?number(counts.activePartners):'—'}
          note="Live across the program" icon={Users} href="/admin/partners"/>
        <KPI title="Live Shopify promo codes" value={counts?number(counts.activeShopifyCoupons):'—'}
          note="Local active Shopify mappings" icon={TicketPercent} href="/admin/coupons"/>
        <KPI title="COD reconciliation queue" value={counts?number(counts.codWaiting):'—'}
          note="Delivered and courier-collected, not merchant reconciled" icon={Clock3} href="/admin/cod" alert/>
        <KPI title="Open support tickets" value={counts?number(counts.openTickets):'—'}
          note="Live queue · all reporting periods" icon={Headphones} href="/admin/support" alert/>
      </div>
    </section>

    <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <Panel title="Order value movement" subtitle="Synchronized Shopify order value by Shopify update date; not accounting revenue."
        action={<span className="rounded-full bg-[#F0F7F1] px-3 py-1 text-xs font-semibold text-[#1F6B3A]">{selectedRange}</span>}>
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <p className="text-2xl font-bold tabular-nums">{insights?money(insights.totals.orderValueEGP):'—'}</p>
          {delta!=null && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${delta>=0?'bg-[#EAF6EC] text-[#27673D]':'bg-[#FAEDEF] text-[#A13B4A]'}`}>
            {delta>=0?<ArrowUpRight className="h-3.5 w-3.5"/>:<ArrowDownRight className="h-3.5 w-3.5"/>}
            {Math.abs(delta).toFixed(1)}% vs previous {days} days
          </span>}
        </div>
        {insights && trend.some(x=>x.orders>0) ? <div className="h-[270px]" role="img" aria-label="Daily Shopify order value graph">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}><defs><linearGradient id="hvAdminArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND} stopOpacity=".20"/><stop offset="100%" stopColor={BRAND} stopOpacity="0"/></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#EDF2EE"/><XAxis dataKey="label" tick={{fontSize:10,fill:'#829588'}} tickLine={false} axisLine={false} minTickGap={28}/>
              <YAxis tick={{fontSize:10,fill:'#829588'}} tickLine={false} axisLine={false} width={50} tickFormatter={compact}/>
              <Tooltip formatter={v=>money(Number(v))} labelStyle={{color:'#173B26'}}/>
              <Area dataKey="value" name="Order value" stroke={BRAND} strokeWidth={2.5} fill="url(#hvAdminArea)" type="monotone" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div> : <div className="flex h-[270px] items-center justify-center rounded-xl bg-[#FBFDFB] text-sm text-[#809487]">No synchronized orders for this selection.</div>}
      </Panel>
      <Panel title="Order fulfillment mix" subtitle="Delivery outcomes for the displayed order records.">
        {chart.length>0 ? <>
          <div className="relative h-[228px]" role="img" aria-label="Order delivery status breakdown">
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart} dataKey="value" nameKey="name" innerRadius={64} outerRadius={90} paddingAngle={3} strokeWidth={0}>
              {chart.map(s=><Cell key={s.name} fill={s.color}/>)}
            </Pie><Tooltip formatter={v=>number(Number(v))}/></PieChart></ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold tabular-nums text-[#183F28]">{number(visible.length)}</p>
              <p className="text-[11px] text-[#819488]">displayed orders</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">{chart.map(item=>
            <div key={item.name} className="flex items-center gap-2 text-xs text-[#637F6B]"><span className="h-2 w-2 rounded-full" style={{background:item.color}}/>
              <span className="min-w-0 flex-1">{item.name}</span><strong className="tabular-nums text-[#243F2D]">{number(item.value)}</strong></div>)}</div>
        </> : <p className="flex h-[250px] items-center justify-center text-sm text-[#8A9E8E]">No fulfillment data in the selected range.</p>}
      </Panel>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1fr_1.12fr]">
      <Panel title="Operations requiring attention" subtitle="Live queues across all periods · select an item to open its module.">
        <div>
          <Action label="Pending partner registrations" detail={`${counts?.unverifiedPartners??'—'} awaiting email verification`}
            count={counts?.pendingPartners??0} url="/admin/partners" icon={Users} emphasis/>
          <Action label="Urgent support requests" detail="HIGH and URGENT open tickets"
            count={counts?.urgentTickets??0} url="/admin/support" icon={Headphones} emphasis/>
          <Action label="COD settlement review" detail="Courier-collected orders lacking merchant reconciliation"
            count={counts?.codWaiting??0} url="/admin/cod" icon={Landmark} emphasis/>
          <Action label="Shopify coupon synchronization" detail="Local discount mappings requiring review"
            count={counts?.couponSyncIssues??0} url="/admin/coupons" icon={TicketPercent}/>
          <Action label="Payout processing queue" detail="Recorded pending/processing payouts · not automatically approved"
            count={counts?.pendingPayouts??0} url="/admin/payouts" icon={Wallet}/>
        </div>
      </Panel>
      <Panel title="Partners driving tracked order value" subtitle="Ranked by EGP Shopify order value, not confirmed collected revenue."
        action={<Link href="/admin/partners" className="flex items-center gap-1 text-xs font-bold text-[#1F6B3A]">All partners <ArrowRight className="h-3.5 w-3.5"/></Link>}>
        {center?.leaderboard.length ? <div className="space-y-1">
          {center.leaderboard.slice(0,6).map((p,i)=>{
            const max=center.leaderboard[0]?.trackedOrderValueEGP || 1;
            return <div key={p.affiliateId??String(i)} className="rounded-xl p-2.5 transition-colors hover:bg-[#FAFCFB]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF6F0] text-xs font-bold text-[#1F6B3A]">{String(i+1).padStart(2,'0')}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-[10px] text-[#87998C]">{p.referralCode} · {p.orderCount} orders</p></div>
                </div><p className="text-sm font-semibold tabular-nums">{money(p.trackedOrderValueEGP)}</p>
              </div>
              <div className="ml-11 mt-2 h-1.5 overflow-hidden rounded-full bg-[#E9F1EA]"><div className="h-full rounded-full bg-[#1F6B3A]" style={{width:(100*p.trackedOrderValueEGP/max)+'%'}}/></div>
            </div>;
          })}
        </div> : <div className="flex min-h-[280px] items-center justify-center text-sm text-[#819387]">No attributed partner orders in the selected period.</div>}
      </Panel>
    </div>

    <section className="space-y-4">
      <Heading eyebrow="02 / ORDER INTELLIGENCE" title="Orders & attribution"
        description="Search, filter and export synchronized orders. All numbers below reflect the available records." right={
        <button onClick={exportCsv} type="button" disabled={!insights} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D8E6DB] bg-white px-4 text-xs font-semibold text-[#1F6B3A] hover:bg-[#F5FAF6] disabled:opacity-50">
          <Download className="h-4 w-4"/>Export CSV</button>}/>
      <Panel title="Find an order" subtitle="Search orders by ID, partner name, referral code or discount code.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative"><span className="sr-only">Search order or partner</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-[#8DA392]"/>
            <input value={query} onChange={e=>{setQuery(e.target.value);setTableCount(15);}} placeholder="Order, partner, promo…"
              className="min-h-11 w-full rounded-xl border border-[#DEE9E1] bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-[#1F6B3A]"/></label>
          <label><span className="sr-only">Filter partner</span>
            <select value={partner} onChange={e=>{setPartner(e.target.value);setTableCount(15);}} className="min-h-11 w-full rounded-xl border border-[#DEE9E1] bg-white px-3 text-sm">
              <option value="">All partners</option>{(insights?.partners??[]).map(p=><option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}</select></label>
          <label><span className="sr-only">Filter status</span>
            <select value={status} onChange={e=>{setStatus(e.target.value);setTableCount(15);}} className="min-h-11 w-full rounded-xl border border-[#DEE9E1] bg-white px-3 text-sm">
              <option value="">All delivery statuses</option>{['PENDING','DELIVERED','REFUNDED','CANCELLED'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
          <label><span className="sr-only">Filter discount</span>
            <select value={code} onChange={e=>{setCode(e.target.value);setTableCount(15);}} className="min-h-11 w-full rounded-xl border border-[#DEE9E1] bg-white px-3 text-sm">
              <option value="">All promo codes</option>{codes.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF2ED] pt-3 text-xs text-[#7D9183]">
          <p>{number(visible.length)} displayed orders · {money(filteredValue)} tracked value
            {filtersActive && <span className="font-semibold text-[#1F6B3A]"> · filters applied to chart and table only</span>}</p>
          <button type="button" onClick={()=>{setQuery('');setPartner('');setStatus('');setCode('');setTableCount(15);}}
            className="inline-flex items-center gap-1.5 font-bold text-[#1F6B3A]"><FilterX className="h-4 w-4"/>Reset filters</button>
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Latest tracked orders" subtitle="Shopify updates; amounts in EGP when available."
          action={<Link href="/admin/orders" className="text-xs font-semibold text-[#1F6B3A]">Open Orders <ArrowUpRight className="inline h-3.5 w-3.5"/></Link>}>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-xs">
              <thead className="bg-[#F6FAF7] text-[#748777]"><tr>
                {['Shopify order','Partner / code','Delivery','Attribution','Tracked value','Updated'].map(h=>
                  <th key={h} scope="col" className="px-3 py-3 font-bold">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[#EAF1EB]">{limited.map(o=>
                <tr key={o.id} className="transition-colors hover:bg-[#FAFDFB]">
                  <td className="whitespace-nowrap px-3 py-3 font-bold text-[#275E39]">
                    {o.shopifyOrderUrl?<a href={o.shopifyOrderUrl} target="_blank" rel="noopener noreferrer">{o.name} ↗</a>:o.name}
                  </td><td className="px-3 py-3"><p className="max-w-[140px] truncate font-medium">{o.partner||'Unassigned'}</p><span className="font-mono text-[10px] text-[#8A9D8E]">{o.code||'—'}</span></td>
                  <td className="px-3 py-3"><span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${o.status==='DELIVERED'?'bg-[#E8F5EB] text-[#216D3A]':o.status==='PENDING'?'bg-amber-50 text-[#9D6A2A]':'bg-rose-50 text-rose-700'}`}>{o.status}</span></td>
                  <td className="max-w-[130px] truncate px-3 py-3 text-[10px] text-[#718675]">{o.source.replaceAll('_',' ')}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums">{money(o.totalEGP)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#809386]">{day(o.date)}</td>
                </tr>)}</tbody>
            </table>
            {!visible.length && <p className="py-12 text-center text-sm text-[#839588]">No orders match your filters.</p>}
          </div>
          {visible.length>tableCount && <div className="mt-4 text-center">
            <button type="button" onClick={()=>setTableCount(n=>n+15)} className="rounded-lg border border-[#DDE9DF] px-4 py-2 text-xs font-semibold text-[#1F6B3A] hover:bg-[#F5FBF6]">Show 15 more</button>
          </div>}
        </Panel>
        <Panel title="Order & click activity" subtitle="Daily data from synchronized records; clicks only when no row filters are selected.">
          {insights && (trend.some(x=>x.orders>0)||trend.some(x=>x.clicks>0)) ?
            <div className="h-[250px]" role="img" aria-label="Clicks and orders by day"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}><CartesianGrid stroke="#EDF2ED" vertical={false}/>
                <XAxis dataKey="label" tick={{fontSize:10}} minTickGap={27}/><YAxis allowDecimals={false} tick={{fontSize:10}}/>
                <Tooltip/><Bar dataKey="orders" name="Orders" fill={BRAND} radius={[3,3,0,0]}/>
                {!filtersActive && <Bar dataKey="clicks" name="Recorded clicks" fill="#A7D1B4" radius={[3,3,0,0]}/>}
              </BarChart>
            </ResponsiveContainer></div> : <div className="flex h-[250px] items-center justify-center text-sm text-[#87998C]">No chart data available.</div>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#F5F9F6] p-3"><p className="text-xs text-[#738A77]">Recorded clicks</p><p className="mt-1 text-xl font-bold">{insights?number(insights.totals.clicks):'—'}</p></div>
            <div className="rounded-xl bg-[#F5F9F6] p-3"><p className="text-xs text-[#738A77]">Attribution exceptions</p><p className="mt-1 text-xl font-bold">{center?number(center.period.attributionIssues):'—'}</p></div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[#8B998F]">Direct Shopify links do not create Refferq /r click events automatically. Click counts can therefore be incomplete.</p>
        </Panel>
      </div>
    </section>

    <section className="space-y-4">
      <Heading eyebrow="03 / FINANCIAL CONTROL" title="Reconciliation, not assumptions"
        description="The Refferq operational ledger does not yet replace formal accounting or bank statements."/>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI title="COD reconciled orders" value={finance?number(finance.operational.codReconciledOrders):'—'}
          note="Orders with authenticated merchant settlement reference" icon={CheckCircle2} href="/admin/cod"/>
        <KPI title="COD awaiting reconciliation" value={finance?number(finance.operational.codAwaitingReconciliationOrders):'—'}
          note="Delivered and courier-collected but not reconciled" icon={Clock3} href="/admin/cod" alert/>
        <KPI title="Recorded pending commissions" value={finance?money(finance.operational.pendingCommissionsPiasters/100):'—'}
          note="Ledger pending · not approved for payment" icon={Wallet} href="/admin/payouts"/>
        <KPI title="Recorded paid commissions" value={finance?money(finance.operational.paidCommissionsPiasters/100):'—'}
          note="Refferq PAID status · verify bank independently" icon={CircleDollarSign} href="/admin/finance"/>
      </div>
      <div className="rounded-2xl border border-[#DCE8DF] bg-[#F6FAF7] px-5 py-4 text-xs leading-6 text-[#597761]">
        <ShieldCheck className="mr-2 inline h-4 w-4 text-[#1F6B3A]"/>
        <strong className="text-[#244D33]">Financial integrity:</strong> Shopify order value is not net sales, delivered is not collected,
        courier collection is not merchant settlement, and commission preview is not a payable balance.
        <Link href="/admin/finance" className="ml-2 font-bold text-[#1F6B3A] underline">Open financial controls</Link>
      </div>
    </section>

    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Recent partners" subtitle="New registrations in the selected period."
        action={<Link href="/admin/partners" className="text-xs font-bold text-[#1F6B3A]">Manage partners ↗</Link>}>
        {center?.newPartners.length ? <div className="space-y-1">{center.newPartners.map(p=>
          <div key={p.id} className="flex items-center gap-3 border-b border-[#EDF2EE] py-3 last:border-b-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5EE] text-sm font-bold text-[#1F6B3A]">{p.name.slice(0,1).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-[11px] text-[#89998C]">{p.referralCode||'No partner code yet'} · {day(p.createdAt)}</p></div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${p.status==='ACTIVE'?'bg-[#E8F5EA] text-[#1F6B3A]':'bg-amber-50 text-amber-700'}`}>{p.status}</span>
          </div>)}</div> : <p className="py-12 text-center text-sm text-[#8B9A8D]">No new partner registrations in this period.</p>}
      </Panel>
      <Panel title="Support inbox" subtitle="Latest unresolved conversations, by most recent message."
        action={<Link href="/admin/support" className="text-xs font-bold text-[#1F6B3A]">Open support ↗</Link>}>
        {center?.supportQueue.length ? <div className="space-y-1">{center.supportQueue.map(t=>
          <Link href="/admin/support" key={t.id} className="flex items-start gap-3 border-b border-[#EDF2EE] py-3 last:border-b-0 hover:bg-[#FAFCFA]">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${['URGENT','HIGH'].includes(t.priority)?'bg-amber-50 text-amber-700':'bg-[#EDF6EF] text-[#1F6B3A]'}`}><Headphones className="h-4 w-4"/></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.subject}</p><p className="mt-1 text-[11px] text-[#87998A]">{t.partner} · {stamp(t.lastMessageAt)}</p></div>
            <span className="text-[10px] font-bold text-[#6B8370]">{t.priority}</span>
          </Link>)}</div> : <p className="py-12 text-center text-sm text-[#8B9A8D]">No unresolved support requests.</p>}
      </Panel>
    </div>

    <section id="shopify-products" className="scroll-mt-20 space-y-4">
      <Heading eyebrow="04 / SHORTCUTS" title="Go straight to the work"
        description="Operational modules remain separate from the executive reporting dashboard."/>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          {label:'Partners',url:'/admin/partners',icon:Users,detail:'Applications & codes'},
          {label:'Shopify orders',url:'/admin/orders',icon:ShoppingBag,detail:'Attribution & delivery'},
          {label:'Product catalog',url:'/admin/coupons',icon:Package,detail:'Promos & products'},
          {label:'COD & Bosta',url:'/admin/cod',icon:Truck,detail:'Collections review'},
          {label:'Finance',url:'/admin/finance',icon:Landmark,detail:'Ledger & controls'},
          {label:'Support',url:'/admin/support',icon:Headphones,detail:'Partner inquiries'},
        ].map(a=><Link href={a.url} key={a.url} className="group min-w-0 rounded-2xl border border-[#DFE9E2] bg-white p-4 hover:border-[#B2D0BB] hover:shadow-sm">
          <a.icon className="h-5 w-5 text-[#1F6B3A]"/><p className="mt-5 flex items-center justify-between gap-1 text-sm font-bold">{a.label}<ArrowUpRight className="h-3.5 w-3.5 text-[#6A9B75]"/></p>
          <p className="mt-1 text-[11px] leading-5 text-[#819486]">{a.detail}</p>
        </Link>)}
      </div>
    </section>
    <div id="return-reasons" className="scroll-mt-20 border-t border-[#DEE9DF] pt-4 text-xs leading-6 text-[#8A9A8B]">
      <RotateCcw className="mr-1 inline h-4 w-4"/> Refund and cancellation totals are visible; detailed return reasons and Shopify product line-items are not yet available from the current synchronized order table. No reasons are inferred.
      <span className="ml-2">All dates in the selected period use Shopify update timestamps; dashboard timestamps are shown in Cairo time.</span>
    </div>
  </main>;
}
