'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownToLine, ArrowRight, BarChart3, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, CreditCard,
  FilterX, Link2, PackageCheck, RefreshCw, RotateCcw,
  Search, ShoppingBag, SlidersHorizontal, Truck, Wallet, X,
} from 'lucide-react';

type Order = {
  id:string;orderName:string;totalEGP:string|null;subtotalEGP:string|null;
  currency:string;updatedAt:string;attributionSource:string;
  discountCode:string|null;status:string;delivered:boolean;
  cancelled:boolean;refunded:boolean;cod:boolean;courierCollected:boolean;
  reconciled:boolean;bostaState:number|null;trackingNumber:string|null;
  bostaUpdatedAt:string|null;merchantSettledAt:string|null;
  collectedEGP:string|null;product:null;returnReason:null;commissionStatus:null;
};
type Summary = {
  totalOrders:number;orderValueEGP:number;deliveredValueEGP:number;
  collectedReconciledEGP:number;deliveredOrders:number;pendingOrders:number;
  refundedOrders:number;cancelledOrders:number;reconciledOrders:number;
  collectedOrders:number;deliverySuccessPercent:number|null;
};
type Trend = {date:string;orders:number;valueEGP:number};
type Result = {
  success:boolean;orders:Order[];total:number;page:number;perPage:number;
  summary:Summary;trend:Trend[];trendComplete:boolean;
  latestUpdatedAt:string|null;error?:string;
};
type Filters = {
  period:string;search:string;status:string;source:string;payment:string;
  finance:string;coupon:string;from:string;to:string;sort:string;perPage:number;
};
const initial:Filters = {
  period:'30d',search:'',status:'',source:'',payment:'',finance:'',
  coupon:'',from:'',to:'',sort:'newest',perPage:25,
};
const statusNames:Record<string,string> = {
  PENDING_DELIVERY:'Pending delivery',
  AWAITING_COD_RECONCILIATION:'Awaiting COD reconciliation',
  PENDING_FINANCIAL_APPROVAL:'Awaiting financial approval',
  NON_COD_REVIEW:'Non-COD review', REFUNDED:'Refunded',
  CANCELLED:'Cancelled',DELIVERED:'Delivered',PENDING:'Pending',
};
const sources:Record<string,string> = {
  AFFILIATE_LINK:'Affiliate link',PROMO_CODE:'Promo code',LINK_AND_PROMO:'Link + promo',
};
const money = (v:number|string|null|undefined,cur='EGP') =>
  v==null || cur!=='EGP' ? 'Unavailable' :
    new Intl.NumberFormat('en-EG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v))+' EGP';
const localDate = (date:string|null) => date ? new Intl.DateTimeFormat('en-GB',{
  timeZone:'Africa/Cairo', dateStyle:'medium',timeStyle:'short',
}).format(new Date(date)) : 'Not available';
const badgeClass = (o:Order) => o.cancelled || o.refunded ? 'bg-rose-50 text-rose-700' :
  o.delivered ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800';
const labelDelivery = (o:Order) => o.refunded?'Refunded':o.cancelled?'Cancelled':o.delivered?'Delivered':'Pending delivery';

function DataCard({label,value,note,icon:Icon,active,onClick}:{
  label:string;value:string;note?:string;icon:typeof ShoppingBag;
  active?:boolean;onClick?:()=>void;
}) {
  const c='min-w-0 rounded-2xl border p-4 text-left transition-colors sm:p-5 '+
    (active?'border-[#1F6B3A] bg-[#EAF5ED]':'border-[#E4ECE6] bg-white hover:border-[#B7D3BF]');
  const child=<>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-slate-600 sm:text-sm">{label}</span>
      <span className="rounded-lg bg-[#EDF5EF] p-2 text-[#1F6B3A]"><Icon className="h-4 w-4"/></span>
    </div>
    <strong className="mt-3 block break-words text-xl font-semibold tracking-tight text-[#163D25] sm:text-2xl">{value}</strong>
    {note&&<p className="mt-1 text-xs text-slate-500">{note}</p>}
  </>;
  return onClick ?
    <button type="button" aria-pressed={active} className={c+' focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1F6B3A]'} onClick={onClick}>{child}</button> :
    <div className={c}>{child}</div>;
}
function Heading({title,description,children}:{
  title:string;description?:string;children?:React.ReactNode;
}) {
  return <div className="flex flex-wrap items-start justify-between gap-3">
    <div><h2 className="text-base font-semibold text-[#173621] sm:text-lg">{title}</h2>
      {description&&<p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}</div>{children}
  </div>;
}
function DetailRow({label,children}:{label:string;children:React.ReactNode}) {
  return <div className="flex flex-wrap justify-between gap-1 border-b border-[#EEF3EF] py-3 text-sm">
    <span className="text-slate-500">{label}</span><strong className="text-right font-medium text-[#173621]">{children}</strong>
  </div>;
}
function OrderDrawer({order,onClose}:{order:Order;onClose:()=>void}) {
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const prior=document.body.style.overflow;document.body.style.overflow='hidden';
    closeRef.current?.focus();
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',esc);
    return ()=>{document.body.style.overflow=prior;window.removeEventListener('keydown',esc);};
  },[onClose]);
  const events=[
    {label:'Shopify order last updated',date:order.updatedAt,detail:'Synchronized Shopify timestamp'},
    ...(order.bostaUpdatedAt?[{label:'Bosta status recorded',date:order.bostaUpdatedAt,detail:
      order.bostaState==null?'Code unavailable':'Provider code '+String(order.bostaState)+' (unmapped)'}]:[]),
    ...(order.courierCollected?[{label:'Courier collection recorded',date:null,detail:'Collection flag present; timestamp unavailable'}]:[]),
    ...(order.merchantSettledAt?[{label:'Merchant reconciliation recorded',date:order.merchantSettledAt,detail:'Settlement date recorded'}]:[]),
  ];
  return <div className="fixed inset-0 z-[80] flex justify-end">
    <button type="button" className="absolute inset-0 bg-[#092315]/45" onClick={onClose} aria-label="Close order details"/>
    <aside role="dialog" aria-modal="true" aria-label={'Order '+order.orderName+' details'}
      className="relative z-10 flex h-full w-full max-w-[565px] flex-col bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-[#E4ECE6] px-5 py-5 sm:px-7">
        <div><p className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#1F6B3A]">HERBAL VITALY / ORDER DETAILS</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#173621]">{order.orderName}</h2>
          <p className="mt-1 text-xs text-slate-500">This panel contains only your attributed order information.</p></div>
        <button ref={closeRef} onClick={onClose} type="button" aria-label="Close details" className="rounded-lg border p-2 text-[#173621]"><X className="h-5 w-5"/></button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
        <section>
          <Heading title="Order overview"/>
          <div className="mt-3">
            <DetailRow label="Last Shopify update">{localDate(order.updatedAt)}</DetailRow>
            <DetailRow label="Order value">{money(order.totalEGP,order.currency)}</DetailRow>
            <DetailRow label="Subtotal">{money(order.subtotalEGP,order.currency)}</DetailRow>
            <DetailRow label="Promo code">{order.discountCode||'—'}</DetailRow>
            <DetailRow label="Attribution">{sources[order.attributionSource]||order.attributionSource}</DetailRow>
            <DetailRow label="Payment">{order.cod?'Cash on delivery':'Non-COD (review)'}</DetailRow>
            <DetailRow label="Product details">Not yet synchronized</DetailRow>
          </div>
        </section>
        <section className="rounded-2xl border border-[#E0EBE3] bg-[#F8FBF9] p-5">
          <Heading title="Delivery & Bosta" description="Verified record flags; no assumed courier status mapping."/>
          <div className="mt-3">
            <DetailRow label="Delivery">{labelDelivery(order)}</DetailRow>
            <DetailRow label="Bosta tracking number">{order.trackingNumber||'Not available'}</DetailRow>
            <DetailRow label="Last Bosta update">{localDate(order.bostaUpdatedAt)}</DetailRow>
            <DetailRow label="Provider state">{order.bostaState==null?'Unavailable':String(order.bostaState)+' (not mapped)'}</DetailRow>
            <DetailRow label="Return reason">Not yet available from delivery provider</DetailRow>
          </div>
        </section>
        <section>
          <Heading title="Recorded event history"
            description="Only timestamps already stored in the database are displayed."/>
          <ol className="mt-4 space-y-4 border-l-2 border-[#DCEBE0] pl-5">
            {events.map(e=><li className="relative" key={e.label}>
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#1F6B3A]"/>
              <h3 className="text-sm font-semibold text-[#173621]">{e.label}</h3>
              <p className="mt-1 text-xs text-slate-500">{e.date?localDate(e.date):'Date unavailable'}</p>
              <p className="mt-1 text-xs text-slate-500">{e.detail}</p>
            </li>)}
          </ol>
          <p className="mt-4 text-xs text-slate-500">A full pickup / transit / out-for-delivery timeline is not stored in Refferq.</p>
        </section>
        <section>
          <Heading title="Collection & commission" description="Approval remains under finance-team control."/>
          <div className="mt-3">
            <DetailRow label="Courier collection">{order.courierCollected?'Recorded':'Not confirmed'}</DetailRow>
            <DetailRow label="Merchant reconciliation">{order.reconciled?'Recorded':'Not confirmed'}</DetailRow>
            <DetailRow label="Recorded collected value">{money(order.collectedEGP,order.currency)}</DetailRow>
            <DetailRow label="Settlement date">{localDate(order.merchantSettledAt)}</DetailRow>
            <DetailRow label="Per-order commission">Not linked in current order data</DetailRow>
          </div>
          <p className="mt-3 rounded-lg bg-[#FFF9EB] p-3 text-xs leading-6 text-amber-900">
            An order is not a payable commission. Delivery, collection, reconciliation and approval must be confirmed.
          </p>
        </section>
      </div>
      <footer className="border-t border-[#E4ECE6] p-4 sm:px-7">
        <Link href="/affiliate/payouts" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1F6B3A]">
          View recorded commissions and payouts <ArrowRight className="h-4 w-4"/>
        </Link>
      </footer>
    </aside>
  </div>;
}

export default function PartnerOrdersV4() {
  const [filters,setFilters]=useState<Filters>(initial);
  const [hydrated,setHydrated]=useState(false);
  const [page,setPage]=useState(1);
  const [refresh,setRefresh]=useState(0);
  const [data,setData]=useState<Result|null>(null);
  const [loading,setLoading]=useState(true);
  const [exporting,setExporting]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<Order|null>(null);
  const [showAnalytics,setShowAnalytics]=useState(false);
  const [showFilters,setShowFilters]=useState(true);
  const [debouncedSearch,setDebouncedSearch]=useState('');
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    const search=new URLSearchParams(window.location.search);
    const safeKeys=['period','search','status','source','payment','finance','coupon','from','to','sort'];
    const next={...initial};
    for (const key of safeKeys) {
      const v=search.get(key);
      if (v!==null) (next as unknown as Record<string,string>)[key]=v.slice(0,80);
    }
    if (['10','25','50'].includes(search.get('perPage')||'')) next.perPage=Number(search.get('perPage'));
    const initialPage=Number(search.get('page'));
    if (Number.isInteger(initialPage)&&initialPage>=1&&initialPage<=1000) setPage(initialPage);
    setFilters(next);
    setDebouncedSearch(next.search);
    setHydrated(true);
  },[]);
  useEffect(()=>{
    const id=window.setTimeout(()=>setDebouncedSearch(filters.search),300);
    return ()=>window.clearTimeout(id);
  },[filters.search]);

  const update = (key:keyof Filters,value:string|number) => {
    setFilters(prev=>({...prev,[key]:value}));
    setPage(1);
  };
  const params=useMemo(()=>{
    const p=new URLSearchParams();
    p.set('page',String(page));p.set('perPage',String(filters.perPage));
    p.set('period',filters.period);p.set('sort',filters.sort);
    for(const key of ['status','source','payment','finance','coupon'] as const)
      if(filters[key])p.set(key,filters[key]);
    if(debouncedSearch)p.set('search',debouncedSearch);
    if(filters.period==='custom'){
      if(filters.from)p.set('from',filters.from);
      if(filters.to)p.set('to',filters.to);
    }
    return p.toString();
  },[filters,debouncedSearch,page]);

  useEffect(()=>{
    if(!hydrated)return;
    window.history.replaceState(window.history.state,'',window.location.pathname+'?'+params);
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch('/api/affiliate/shopify-orders?'+params,{
      cache:'no-store',credentials:'include',signal:controller.signal,
    }).then(async r=>{
      const body=await r.json();
      if(!r.ok||!body.success)throw new Error(body.error||'Cannot load orders');
      if(!controller.signal.aborted)setData(body);
    }).catch(err=>{
      if(!controller.signal.aborted){setError(err.message||'Order synchronization unavailable');setData(null);}
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[params,hydrated,refresh]);

  const closeDetails=useCallback(()=>setSelected(null),[]);
  const summary=data?.summary;
  const statusData=summary?[
    {name:'Delivered',value:summary.deliveredOrders,color:'#1F6B3A'},
    {name:'Pending',value:summary.pendingOrders,color:'#D9A742'},
    {name:'Refunded',value:summary.refundedOrders,color:'#D06B78'},
    {name:'Cancelled',value:summary.cancelledOrders,color:'#95A5A0'},
  ].filter(x=>x.value>0):[];
  const trends=data?.trend||[];
  const activeFilters=[
    ...(filters.status?[{key:'status',name:statusNames[filters.status]||filters.status}]:[]),
    ...(filters.source?[{key:'source',name:sources[filters.source]||filters.source}]:[]),
    ...(filters.payment?[{key:'payment',name:filters.payment}]:[]),
    ...(filters.finance?[{key:'finance',name:filters.finance}]:[]),
    ...(filters.coupon?[{key:'coupon',name:'Code: '+filters.coupon}]:[]),
    ...(filters.search?[{key:'search',name:'Search: '+filters.search}]:[]),
  ];
  const reset=()=>{setFilters(initial);setDebouncedSearch('');setPage(1);};
  const maxPage=Math.max(1,Math.ceil((data?.total||0)/(data?.perPage||25)));
  const handleExport=async()=>{
    if(exporting)return;
    setExporting(true);setError('');
    try{
      const p=new URLSearchParams(params);p.set('export','csv');
      const res=await fetch('/api/affiliate/shopify-orders?'+p.toString(),{credentials:'include',cache:'no-store'});
      if(!res.ok){
        const e=await res.json().catch(()=>({}));
        throw new Error(e.error||'CSV export unavailable');
      }
      const blob=await res.blob();const u=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=u;
      a.download='HerbalVitaly_Partner_Orders_'+new Date().toISOString().slice(0,10)+'.csv';
      a.click();URL.revokeObjectURL(u);
      setCopied(true);
    }catch(err){setError(err instanceof Error?err.message:'Could not export');}
    finally{setExporting(false);}
  };

  return <main lang="en" className="mx-auto max-w-[1580px] space-y-5 pb-12">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#1F6B3A]">HERBAL VITALY / PARTNER OPERATIONS</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#173621] sm:text-3xl">Order Management</h1>
        <p className="mt-1.5 text-sm text-slate-500">Track Shopify orders, Bosta delivery progress and financial reconciliation.</p>
        {data?.latestUpdatedAt&&<p className="mt-2 text-xs text-slate-500">
          Latest synchronized Shopify order update: {localDate(data.latestUpdatedAt)}
        </p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={()=>setShowAnalytics(v=>!v)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#DCE8E0] bg-white px-3 py-2.5 text-xs font-semibold text-[#1F6B3A]">
          <BarChart3 className="h-4 w-4"/>{showAnalytics?'Hide analytics':'View analytics'}
        </button>
        <button type="button" onClick={()=>setRefresh(v=>v+1)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#DCE8E0] bg-white px-3 py-2.5 text-xs font-semibold text-[#1F6B3A]">
          <RefreshCw className="h-4 w-4"/>Refresh
        </button>
        <button type="button" disabled={exporting||loading||!data?.total} onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3A] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
          <ArrowDownToLine className="h-4 w-4"/>{exporting?'Exporting…':copied?'Export again':'Export CSV'}
        </button>
      </div>
    </div>

    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {loading&&!data&&<div role="status" className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading verified Shopify records…</div>}

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <DataCard label="Total Orders" value={summary?String(summary.totalOrders):'—'} note="Attributed, matching filters" icon={ShoppingBag}/>
      <DataCard label="Total Order Value" value={summary?money(summary.orderValueEGP):'—'} note="Not the same as collected revenue" icon={Wallet}/>
      <DataCard label="Delivered Orders" value={summary?String(summary.deliveredOrders):'—'} note="Confirmed delivered" icon={CheckCircle2}
        active={filters.status==='DELIVERED'} onClick={()=>update('status',filters.status==='DELIVERED'?'':'DELIVERED')}/>
      <DataCard label="Pending Delivery" value={summary?String(summary.pendingOrders):'—'} note="Not confirmed delivered" icon={Clock3}
        active={filters.status==='PENDING'} onClick={()=>update('status',filters.status==='PENDING'?'':'PENDING')}/>
      <DataCard label="Cancelled Orders" value={summary?String(summary.cancelledOrders):'—'} icon={PackageCheck}
        active={filters.status==='CANCELLED'} onClick={()=>update('status',filters.status==='CANCELLED'?'':'CANCELLED')}/>
      <DataCard label="Returned / Refunded" value={summary?String(summary.refundedOrders):'—'} icon={RotateCcw}
        active={filters.status==='REFUNDED'} onClick={()=>update('status',filters.status==='REFUNDED'?'':'REFUNDED')}/>
      <DataCard label="Delivery Success Rate"
        value={summary?.deliverySuccessPercent==null?'—':String(summary.deliverySuccessPercent)+'%'}
        note="Delivered ÷ all matching orders" icon={Truck}/>
      <DataCard label="Financially Reconciled" value={summary?String(summary.reconciledOrders):'—'}
        note="Merchant reconciliation recorded" icon={CreditCard}
        active={filters.finance==='RECONCILED'} onClick={()=>update('finance',filters.finance==='RECONCILED'?'':'RECONCILED')}/>
    </section>

    <section className="rounded-2xl border border-[#E4ECE6] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading title="Search & filters" description="The order list, KPIs, charts and export share your selected filters."/>
        <button onClick={()=>setShowFilters(v=>!v)} type="button" aria-expanded={showFilters}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#1F6B3A]">
          <SlidersHorizontal className="h-4 w-4"/>{showFilters?'Hide filters':'Show filters'}
        </button>
      </div>
      {showFilters&&<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-[#496152]"><span>Search order / promo</span>
          <span className="relative block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
            <input value={filters.search} onChange={e=>update('search',e.target.value)} placeholder="Order # or code"
              className="w-full rounded-lg border border-[#DCE7DF] py-2 pl-9 pr-3 text-sm text-[#173621] outline-[#1F6B3A]"/>
          </span>
        </label>
        <label className="space-y-1 text-xs font-medium text-[#496152]"><span>Date range</span>
          <select aria-label="Reporting period" value={filters.period} onChange={e=>update('period',e.target.value)}
            className="w-full rounded-lg border border-[#DCE7DF] bg-white p-2 text-sm text-[#173621]">
            <option value="today">Today</option><option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option><option value="this-month">This month</option>
            <option value="last-month">Last month</option><option value="custom">Custom range</option>
            <option value="all">All time</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-[#496152]"><span>Delivery status</span>
          <select value={filters.status} onChange={e=>update('status',e.target.value)}
            className="w-full rounded-lg border border-[#DCE7DF] bg-white p-2 text-sm text-[#173621]">
            <option value="">All statuses</option>
            <option value="DELIVERED">Delivered</option><option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option><option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-[#496152]"><span>Payment method</span>
          <select value={filters.payment} onChange={e=>update('payment',e.target.value)}
            className="w-full rounded-lg border border-[#DCE7DF] bg-white p-2 text-sm text-[#173621]">
            <option value="">All payments</option><option value="COD">Cash on delivery</option>
            <option value="NON_COD">Non-COD (review)</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-[#496152]"><span>Attribution source</span>
          <select value={filters.source} onChange={e=>update('source',e.target.value)}
            className="w-full rounded-lg border border-[#DCE7DF] bg-white p-2 text-sm text-[#173621]">
            <option value="">All sources</option><option value="PROMO_CODE">Promo code</option>
            <option value="AFFILIATE_LINK">Referral link</option><option value="LINK_AND_PROMO">Link + promo</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-[#496152]"><span>Financial reconciliation</span>
          <select value={filters.finance} onChange={e=>update('finance',e.target.value)}
            className="w-full rounded-lg border border-[#DCE7DF] bg-white p-2 text-sm text-[#173621]">
            <option value="">All records</option><option value="RECONCILED">Reconciled</option>
            <option value="NOT_RECONCILED">Not yet reconciled</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-[#496152]"><span>Promo code</span>
          <input value={filters.coupon} onChange={e=>update('coupon',e.target.value)} placeholder="Exact Shopify code"
            className="w-full rounded-lg border border-[#DCE7DF] px-3 py-2 text-sm text-[#173621]"/>
        </label>
        <label className="space-y-1 text-xs font-medium text-[#496152]"><span>Sort</span>
          <select value={filters.sort} onChange={e=>update('sort',e.target.value)}
            className="w-full rounded-lg border border-[#DCE7DF] bg-white p-2 text-sm text-[#173621]">
            <option value="newest">Latest updated</option><option value="oldest">Oldest updated</option>
            <option value="highest">Highest order value</option><option value="lowest">Lowest order value</option>
          </select>
        </label>
        {filters.period==='custom'&&<>
          <label className="space-y-1 text-xs font-medium text-[#496152]"><span>From · Cairo date</span>
            <input type="date" value={filters.from} max={filters.to||undefined}
              onChange={e=>update('from',e.target.value)} className="w-full rounded-lg border border-[#DCE7DF] p-2 text-sm"/></label>
          <label className="space-y-1 text-xs font-medium text-[#496152]"><span>To · Cairo date</span>
            <input type="date" value={filters.to} min={filters.from||undefined}
              onChange={e=>update('to',e.target.value)} className="w-full rounded-lg border border-[#DCE7DF] p-2 text-sm"/></label>
        </>}
      </div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {activeFilters.map(item=><button type="button" key={item.key}
            onClick={()=>update(item.key as keyof Filters,'')} title="Remove filter"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#ECF5EE] px-3 py-1.5 text-xs font-medium text-[#1F6B3A]">
            {item.name}<X className="h-3 w-3"/>
          </button>)}
          {!activeFilters.length&&<span className="text-xs text-slate-400">No additional filters applied</span>}
        </div>
        <button type="button" onClick={reset} className="inline-flex items-center gap-2 text-xs font-semibold text-[#1F6B3A]">
          <FilterX className="h-3.5 w-3.5"/>Clear all filters
        </button>
      </div>
    </section>

    {showAnalytics&&<div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-[#E4ECE6] bg-white p-5">
        <Heading title="Daily order performance" description="Shopify synchronized order updates, Cairo calendar dates."/>
        <div className="mt-4 h-64 w-full" role="img" aria-label="Daily attributed order value in Egyptian pounds">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends}>
              <CartesianGrid vertical={false} stroke="#EEF2EF"/>
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize:10}} minTickGap={24}/>
              <YAxis tickLine={false} axisLine={false} tick={{fontSize:10}} width={45}/>
              <Tooltip formatter={v=>money(Number(v))}/>
              <Area dataKey="valueEGP" name="Order value" type="monotone"
                stroke="#1F6B3A" strokeWidth={2.4} fill="#E6F2E9"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {data&&!data.trendComplete&&<p className="mt-2 text-xs text-amber-800">
          Trends reflect the 5,000 most recently updated records. Summary KPIs and exported orders are not sampled.
        </p>}
      </section>
      <section className="rounded-2xl border border-[#E4ECE6] bg-white p-5">
        <Heading title="Delivery outcomes" description="Exact filtered order counts."/>
        {statusData.length?<div className="mt-4 h-52 w-full" role="img" aria-label="Distribution of delivery outcomes">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={75}>
              {statusData.map(item=><Cell key={item.name} fill={item.color}/>)}
            </Pie><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div>:<p className="flex h-52 items-center justify-center text-sm text-slate-500">No records for this selection.</p>}
        <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-600">
          {statusData.map(item=><span key={item.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{background:item.color}}/>{item.name}: {item.value}
          </span>)}
        </div>
      </section>
      <section className="rounded-2xl border border-[#E4ECE6] bg-white p-5">
        <Heading title="Daily order volume" description="Order count from the synchronized records in this selection."/>
        <div className="mt-4 h-56 w-full" role="img" aria-label="Daily number of attributed orders">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trends}>
              <CartesianGrid vertical={false} stroke="#EEF2EF"/>
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize:10}} minTickGap={24}/>
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{fontSize:10}} width={35}/>
              <Tooltip/>
              <Bar dataKey="orders" name="Daily orders" fill="#1F6B3A" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {data&&!data.trendComplete&&<p className="text-xs text-amber-800">Daily chart sampled; use exact summary cards for totals.</p>}
      </section>
      <section className="rounded-2xl border border-[#E4ECE6] bg-white p-5">
        <Heading title="Payment reconciliation" description="Financially reconciled vs other orders in this selection."/>
        <div className="mt-6 grid gap-5">
          <div>
            <div className="mb-2 flex justify-between text-xs"><span>Reconciled orders</span><strong>{summary?.reconciledOrders??'—'}</strong></div>
            <div className="h-3 overflow-hidden rounded-full bg-[#E7EDE8]">
              <div className="h-full rounded-full bg-[#1F6B3A]" style={{width:summary?.totalOrders?String(100*summary.reconciledOrders/summary.totalOrders)+'%':'0%'}}/>
            </div>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs"><span>Collection recorded</span><strong>{summary?.collectedOrders??'—'}</strong></div>
            <div className="h-3 overflow-hidden rounded-full bg-[#E7EDE8]">
              <div className="h-full rounded-full bg-[#8BB69A]" style={{width:summary?.totalOrders?String(100*summary.collectedOrders/summary.totalOrders)+'%':'0%'}}/>
            </div>
          </div>
        </div>
        <p className="mt-5 text-xs leading-6 text-slate-500">Collections and reconciliation are separate recorded flags. Neither means commission approval.</p>
      </section>
      <section className="rounded-2xl border border-[#E4ECE6] bg-white p-5 xl:col-span-2">
        <Heading title="Order value vs collection" description="Distinct financial concepts; not equivalent to commissions."/>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-[#F5F9F6] p-4"><p className="text-xs text-slate-500">Attributed order value</p><strong className="mt-2 block text-lg text-[#173621]">{summary?money(summary.orderValueEGP):'—'}</strong></div>
          <div className="rounded-xl bg-[#F5F9F6] p-4"><p className="text-xs text-slate-500">Delivered order value</p><strong className="mt-2 block text-lg text-[#173621]">{summary?money(summary.deliveredValueEGP):'—'}</strong></div>
          <div className="rounded-xl bg-[#F5F9F6] p-4"><p className="text-xs text-slate-500">Collected & reconciled value</p><strong className="mt-2 block text-lg text-[#173621]">{summary?money(summary.collectedReconciledEGP):'—'}</strong></div>
        </div>
      </section>
    </div>}

    <section className="overflow-hidden rounded-2xl border border-[#E4ECE6] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4ECE6] p-5">
        <Heading title="Attributed Shopify Orders" description="Private, server-paginated orders associated with your account."/>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>{data?.total??0} matching orders</span>
          <select aria-label="Rows per page" value={filters.perPage} onChange={e=>update('perPage',Number(e.target.value))}
            className="rounded-lg border border-[#DCE7DF] bg-white p-2 text-xs text-[#173621]">
            <option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option>
          </select>
        </div>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-[#F5FAF6] text-xs font-semibold text-[#5B7061]">
            <tr>{['Order','Last updated','Promo code','Order value','Attribution','Payment','Delivery','Collection','Reconciliation','Details']
              .map(h=><th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3EF]">
            {(data?.orders||[]).map(o=><tr key={o.id} className="hover:bg-[#F9FCF9]">
              <td className="px-4 py-3 font-semibold text-[#173621]">{o.orderName}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{localDate(o.updatedAt)}</td>
              <td className="px-4 py-3 font-mono text-xs">{o.discountCode||'—'}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#173621]">{money(o.totalEGP,o.currency)}</td>
              <td className="px-4 py-3 text-xs text-slate-600">{sources[o.attributionSource]||o.attributionSource}</td>
              <td className="px-4 py-3 text-xs">{o.cod?'COD':'Non-COD'}</td>
              <td className="px-4 py-3"><span className={'rounded-full px-2.5 py-1 text-[11px] font-medium '+badgeClass(o)}>{labelDelivery(o)}</span></td>
              <td className="px-4 py-3 text-xs">{o.courierCollected?'Recorded':'Pending'}</td>
              <td className="px-4 py-3 text-xs">{o.reconciled?'Recorded':'Pending'}</td>
              <td className="px-4 py-3"><button type="button" onClick={()=>setSelected(o)}
                className="rounded-lg border border-[#CFE1D4] px-3 py-1.5 text-xs font-semibold text-[#1F6B3A] hover:bg-[#F0F8F2]">View details</button></td>
            </tr>)}
            {!(data?.orders||[]).length&&<tr><td colSpan={10} className="p-12 text-center text-sm text-slate-500">
              {loading?'Loading orders…':'No orders found. Try another period or clear filters.'}
            </td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-4 lg:hidden">
        {(data?.orders||[]).map(o=><article key={o.id} className="rounded-xl border border-[#E1EBE4] p-4">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="font-semibold text-[#173621]">{o.orderName}</h3>
              <p className="mt-1 text-xs text-slate-500">{localDate(o.updatedAt)}</p></div>
            <span className={'rounded-full px-2.5 py-1 text-[11px] font-medium '+badgeClass(o)}>{labelDelivery(o)}</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-[#173621]">{money(o.totalEGP,o.currency)}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
            <span>Code: <strong className="font-mono text-[#173621]">{o.discountCode||'—'}</strong></span>
            <span>{sources[o.attributionSource]||o.attributionSource}</span>
            <span>Payment: {o.cod?'COD':'Non-COD'}</span>
          </div>
          <button type="button" onClick={()=>setSelected(o)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#CEE0D3] py-2 text-xs font-semibold text-[#1F6B3A]">
            View order details <ArrowRight className="h-4 w-4"/>
          </button>
        </article>)}
        {!(data?.orders||[]).length&&<p className="py-12 text-center text-sm text-slate-500">
          {loading?'Loading orders…':'No orders match these filters.'}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4ECE6] px-4 py-4 text-xs text-slate-600 sm:px-5">
        <span>Page {page} of {maxPage} · {data?.total??0} matching orders</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={()=>setPage(v=>Math.max(1,v-1))} disabled={page<=1||loading}
            aria-label="Previous page" className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4"/></button>
          <button type="button" onClick={()=>setPage(v=>Math.min(maxPage,v+1))} disabled={page>=maxPage||loading}
            aria-label="Next page" className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4"/></button>
        </div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-[#E4ECE6] bg-white p-5">
        <Heading title="Order & commission journey"
          description="What must be verified before a commission can become payable."/>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600 sm:grid-cols-6">
          {['Shopify order','Delivery','Collection','Reconciliation','Approval','Payout'].map((step,i)=>
            <div key={step} className="rounded-xl bg-[#F3F8F4] p-3">
              <span className="block font-bold text-[#1F6B3A]">{String(i+1).padStart(2,'0')}</span>
              <span className="mt-2 block">{step}</span>
            </div>)}
        </div>
        <p className="mt-4 text-xs leading-6 text-slate-500">
          The sequence explains eligibility rules; it is not an individual order timeline. Per-order commissions are not currently linked in synchronized order data.
        </p>
        <Link href="/affiliate/payouts" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#1F6B3A]">
          View recorded commissions <ArrowRight className="h-4 w-4"/>
        </Link>
      </div>
      <div className="rounded-2xl border border-[#E4ECE6] bg-white p-5">
        <Heading title="Performance insights" description="Verified operational counts only."/>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          <div className="flex justify-between"><span>Awaiting delivery</span><strong>{summary?.pendingOrders??'—'}</strong></div>
          <div className="flex justify-between"><span>Cancelled</span><strong>{summary?.cancelledOrders??'—'}</strong></div>
          <div className="flex justify-between"><span>Refunded</span><strong>{summary?.refundedOrders??'—'}</strong></div>
          <div className="flex justify-between"><span>Reconciled</span><strong>{summary?.reconciledOrders??'—'}</strong></div>
          <div className="flex justify-between"><span>Delivered value</span><strong>{summary?money(summary.deliveredValueEGP):'—'}</strong></div>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-slate-500"><CircleHelp className="mt-1 h-4 w-4 shrink-0"/>
          Individual product line items and detailed return reasons are not yet synchronized. No missing data is invented.</p>
      </div>
    </section>
    <p className="text-xs leading-6 text-slate-500">
      Data: synchronized Herbal Vitaly Shopify orders, recorded Bosta flags and financial reconciliation.
      Date filters use Cairo calendar dates on Shopify update timestamps. EGP values are not guaranteed collected revenue.
      Detailed return reasons and order-level commission approval are unavailable in the current connector.
    </p>
    {selected&&<OrderDrawer order={selected} onClose={closeDetails}/>}
  </main>;
}
