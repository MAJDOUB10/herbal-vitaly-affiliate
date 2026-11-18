'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, BarChart3, Copy, MousePointerClick, RefreshCw, ShoppingCart, Users } from 'lucide-react';

type Report = {
  success: boolean; days:number; from:string;
  clicks:number; sessions:number|null; activeSessions:number|null;
  pageViews:number|null; productViews:number|null; cartViews:number|null;
  cartUpdates:number|null; checkoutStarts:number|null;
  attributedOrders:number; validOrders:number; deliveredOrders:number; reconciledOrders:number;
  attributedRevenueEGP:number; conversionPerClick:number|null; eventsRecorded:number;
  trackingReady:boolean; sessionCountComplete:boolean; clickTrendComplete:boolean;
  clickTrend:Array<{date:string,count:number}>;
  products:Array<{handle:string,views:number}>;
  channels:Array<{name:string,events:number}>;
  funnel:Array<{stage:string,count:number|null,source:string}>;
  limitations:string[];
  referralCode?:string;
  team?:Array<{name:string,code:string,clicks:number,orders:number}>;
  teamListComplete?:boolean;
  partners?:Array<{id:string,name:string,code:string}>;
  selectedAffiliateId?:string|null;
  coverage?:string;
};
type Mode = 'partner'|'master'|'admin';
const n = (value:number|null|undefined) =>
  value == null ? '—' : new Intl.NumberFormat('en-US').format(value);
const money = (v:number) =>
  new Intl.NumberFormat('en-EG',{style:'currency',currency:'EGP',maximumFractionDigits:2}).format(v);

export default function TrafficDashboard({mode}:{mode:Mode}) {
  const [days,setDays]=useState('30');
  const [partnerId,setPartnerId]=useState('');
  const [report,setReport]=useState<Report|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [copied,setCopied]=useState(false);
  const endpoint=mode==='admin'?'/api/admin/visitor-intelligence':
    mode==='master'?'/api/affiliate/team/traffic':'/api/affiliate/analytics';
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    const qs=new URLSearchParams({days});
    if(mode==='admin' && partnerId)qs.set('affiliateId',partnerId);
    fetch(endpoint+'?'+qs.toString(),{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok || !data.success)throw new Error(data.error || 'Traffic report unavailable');
        return data as Report;
      })
      .then(data=>{setReport(data);})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[days,partnerId,endpoint,mode,refresh]);
  const title=mode==='partner'?'My Traffic':mode==='master'?'Team Traffic':'Visitor Intelligence';
  const metrics=report?[
    ['Referral clicks',n(report.clicks)],
    ['Tracked sessions',n(report.sessions)],
    ['Live sessions (5 min)',n(report.activeSessions)],
    ['Page views',n(report.pageViews)],
    ['Product views',n(report.productViews)],
    ['Cart updates',n(report.cartUpdates)],
    ['Checkout starts',n(report.checkoutStarts)],
    ['Attributed orders',n(report.attributedOrders)],
    ['Delivered orders',n(report.deliveredOrders)],
    ['COD reconciled orders',n(report.reconciledOrders)],
    ['Order revenue',money(report.attributedRevenueEGP)],
    ['Orders per click',report.conversionPerClick==null?'—':report.conversionPerClick+'%']
  ]:[];
  const maxClicks=Math.max(1,...(report?.clickTrend.map(x=>x.count)||[1]));
  return <main className="mx-auto max-w-7xl space-y-6 p-3 md:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#1F6B3A]">Herbal Vitaly Analytics</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode==='partner'?'Only activity attributed to your partner account.':
            mode==='master'?'Your traffic and your directly authorized sub-partners.':
            'Attributed affiliate activity across Herbal Vitaly.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-600" htmlFor="hv-traffic-period">Period</label>
        <select id="hv-traffic-period" value={days} onChange={e=>setDays(e.target.value)}
          className="rounded-lg border bg-white px-3 py-2 text-sm">
          <option value="1">Last 24 hours</option><option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option><option value="90">Last 90 days</option>
        </select>
        <button type="button" onClick={()=>setRefresh(v=>v+1)}
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">
          <RefreshCw className="h-4 w-4"/> Refresh
        </button>
      </div>
    </header>
    {mode==='admin' && report?.partners && <section className="rounded-xl border bg-white p-4">
      <label htmlFor="hv-partner-filter" className="mr-3 text-sm font-semibold">Partner filter</label>
      <select id="hv-partner-filter" value={partnerId} onChange={e=>setPartnerId(e.target.value)}
        className="max-w-full rounded-lg border px-3 py-2 text-sm">
        <option value="">All attributed affiliates</option>
        {report.partners.map(p=><option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}
      </select>
      <p className="mt-2 text-xs text-slate-500">Global totals cover affiliate-attributed activity only, not every anonymous website visitor.</p>
    </section>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
    {loading && <p role="status" className="rounded-xl border bg-white p-5 text-slate-500">Loading verified traffic statistics…</p>}
    {report && !loading && <>
      {mode==='partner' && report.referralCode && <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#1F6B3A]">Your tracked referral link</p>
          <p className="mt-1 break-all font-mono text-sm text-slate-800">{'https://partner.herbalvitaly.com/r/'+report.referralCode}</p>
          <p className="mt-1 text-xs text-slate-500">Create campaign links with product destinations from your existing Product Links page.</p>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          onClick={()=>{void navigator.clipboard.writeText('https://partner.herbalvitaly.com/r/'+report.referralCode).then(()=>setCopied(true));}}>
          <Copy className="h-4 w-4"/>{copied?'Copied':'Copy link'}
        </button>
      </section>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label,value],index)=><section key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            {index===0?<MousePointerClick className="h-4 w-4"/>:index===1?<Users className="h-4 w-4"/>:
              index===7?<ShoppingCart className="h-4 w-4"/>:<Activity className="h-4 w-4"/>}
            <span>{label}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-[#1F6B3A]">{value}</p>
        </section>)}
      </div>
      {!report.trackingReady || report.eventsRecorded===0 ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Browser event tracking is not yet reporting data.</strong> Historical affiliate link clicks and verified Shopify orders remain visible.
        {!report.trackingReady?' The analytics database migration must be applied first.':' Shopify consent-aware instrumentation must be installed and verified.'}
      </div>:null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#1F6B3A]"/><h2 className="font-semibold">Referral clicks by day</h2></div>
          {report.clickTrend.length ? <div className="space-y-3">
            {report.clickTrend.map(row=><div key={row.date} className="grid grid-cols-[88px_1fr_40px] items-center gap-3 text-sm">
              <span className="font-mono text-xs text-slate-600">{row.date.slice(5)}</span>
              <div className="h-4 rounded-full bg-slate-100"><div className="h-4 rounded-full bg-[#1F6B3A]"
                style={{width:Math.round(100*row.count/maxClicks)+'%'}}/></div>
              <span className="text-right font-medium">{n(row.count)}</span>
            </div>)}
          </div>:<p className="text-sm text-slate-500">No referral clicks during this period.</p>}
          {!report.clickTrendComplete && <p className="mt-3 text-xs text-amber-700">Chart includes only the most recent 5,000 clicks.</p>}
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-4 font-semibold">Conversion path (different data sources)</h2>
          <div className="space-y-3">{report.funnel.map((step,i)=><div key={step.stage} className="flex items-center justify-between border-b pb-2 text-sm">
            <div><span className="mr-2 text-xs text-slate-400">{i+1}</span>
              <span className="font-medium">{step.stage}</span>
              <p className="pl-5 text-xs text-slate-500">{step.source}</p></div>
            <span className="font-semibold text-[#1F6B3A]">{n(step.count)}</span>
          </div>)}</div>
          <p className="mt-4 text-xs text-slate-500">These measures are not a strictly joined cohort. Browser events never create financial sales.</p>
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Top products viewed</h2>
          {report.products.length ? <table className="w-full text-left text-sm">
            <thead><tr className="text-slate-500"><th className="py-2">Product</th><th className="py-2 text-right">Views</th></tr></thead>
            <tbody>{report.products.map(p=><tr key={p.handle} className="border-t">
              <td className="py-2">{p.handle}</td><td className="py-2 text-right">{n(p.views)}</td>
            </tr>)}</tbody>
          </table>:<p className="text-sm text-slate-500">No consent-eligible product events yet.</p>}
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Campaign sources (tracked events)</h2>
          {report.channels.length ? <table className="w-full text-left text-sm">
            <thead><tr className="text-slate-500"><th className="py-2">UTM source</th><th className="py-2 text-right">Events</th></tr></thead>
            <tbody>{report.channels.map(p=><tr key={p.name} className="border-t">
              <td className="py-2">{p.name}</td><td className="py-2 text-right">{n(p.events)}</td>
            </tr>)}</tbody>
          </table>:<p className="text-sm text-slate-500">Traffic source is unknown until consented storefront instrumentation reports events.</p>}
        </section>
      </div>
      {mode==='master' && <section className="overflow-x-auto rounded-2xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Authorized sub-partners</h2>
        <table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="text-slate-500">
          <th className="py-2">Partner</th><th className="py-2">Code</th><th className="py-2 text-right">Clicks</th>
          <th className="py-2 text-right">Orders</th></tr></thead><tbody>
          {(report.team||[]).map(p=><tr key={p.code} className="border-t"><td className="py-2">{p.name}</td>
            <td className="py-2 font-mono">{p.code}</td><td className="py-2 text-right">{n(p.clicks)}</td>
            <td className="py-2 text-right">{n(p.orders)}</td></tr>)}
        </tbody></table>
        {!report.teamListComplete && <p className="mt-2 text-xs text-amber-700">Partner comparison limited to the first 50 members.</p>}
      </section>}
      <section className="rounded-xl border bg-slate-50 p-4 text-xs text-slate-600">
        <p className="mb-2 font-semibold text-slate-800">Measurement and privacy notes</p>
        <ul className="list-disc space-y-1 pl-5">{report.limitations.map(note=><li key={note}>{note}</li>)}</ul>
      </section>
      {mode==='partner' && <p className="text-sm"><Link className="font-semibold text-[#1F6B3A] hover:underline" href="/affiliate/product-links">Manage your product links</Link></p>}
    </>}
  </main>;
}
