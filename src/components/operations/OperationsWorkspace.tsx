'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Area,AreaChart,Bar,BarChart,CartesianGrid,Cell,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {Activity,AlertCircle,ArrowDownToLine,ArrowRight,BarChart3,CheckCircle2,
 ChevronLeft,ChevronRight,Clock3,CreditCard,FileDown,FilterX,Package,
 RefreshCw,RotateCcw,Search,ShieldCheck,Truck,Wallet,X} from 'lucide-react';

type ModuleName='deliveries'|'returns';
type Order={
 id:string;order:string;updatedAt:string;currency:string;amountEGP:number|null;
 discountCode:string|null;attributionSource:string;payment:string;delivery:string;
 refunded:boolean;cancelled:boolean;delivered:boolean;tracking:string|null;
 shipmentRecorded:boolean;bostaState:number|null;bostaUpdatedAt:string|null;
 collected:boolean;reconciled:boolean;collectedEGP:number|null;
 merchantSettledAt:string|null;returnReason:null;refundAmountEGP:null;
 product:null;commissionAdjustmentEGP:null;
};
type Summary={
 total:number;orderValueEGP:number;shipmentsRecorded:number;
 delivered:number;pending:number;refunded:number;cancelled:number;
 reconciled:number;collected:number;deliveredValueEGP:number;
 collectedReconciledEGP:number;deliverySuccessRate:number|null;
 timePeriodRefundRate:number|null;inTransit:null;outForDelivery:null;
 failedDeliveries:null;physicalReturns:null;refundValueEGP:null;
 commissionAdjustmentsEGP:null;
};
type Trend={date:string;orders:number;egp:number;refunded:number;cancelled:number;delivered:number};
type ResponseData={success:boolean;module:ModuleName;rows:Order[];total:number;
 page:number;perPage:number;summary:Summary;latestOrderUpdate:string|null;
 latestProviderUpdate:string|null;trends:Trend[];trendsComplete:boolean;error?:string};
type Filters={period:string;search:string;status:string;payment:string;finance:string;
 coupon:string;source:string;from:string;to:string;perPage:number;sort:string};
const defaults:Filters={period:'30d',search:'',status:'',payment:'',finance:'',coupon:'',
 source:'',from:'',to:'',perPage:25,sort:'newest'};
const currency=(n:number|null|undefined,iso='EGP')=>n==null||iso!=='EGP'?'Unavailable':
 new Intl.NumberFormat('en-EG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' EGP';
const localDate=(iso:string|null)=>iso?new Intl.DateTimeFormat('en-GB',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short',
}).format(new Date(iso)):'Unavailable';
const deliveryLabel:Record<string,string>={
 DELIVERED:'Delivered',PENDING:'Pending confirmation',
 REFUNDED:'Refunded (Shopify)',CANCELLED:'Cancelled (Shopify)',
};
const attributionLabel:Record<string,string>={
 PROMO_CODE:'Promo code',AFFILIATE_LINK:'Affiliate link',LINK_AND_PROMO:'Link + promo',
};
const statusStyle=(o:Order)=>o.refunded||o.cancelled?'bg-rose-50 text-rose-700':
 o.delivered?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-800';
function Metric({label,value,note,icon:Icon,onClick,active}:{
 label:string;value:string;note?:string;icon:typeof Package;
 onClick?:()=>void;active?:boolean;
}){
 const cls='min-w-0 rounded-2xl border p-4 text-left transition-colors '+
 (active?'border-[#1F6B3A] bg-[#EAF5EE]':'border-[#E4EBE6] bg-white hover:border-[#B8D4C0]');
 const content=<><div className="flex items-start justify-between gap-2">
  <p className="text-xs font-medium text-slate-600">{label}</p>
  <Icon className="h-4 w-4 shrink-0 text-[#1F6B3A]"/></div>
  <strong className="mt-3 block break-words text-xl font-semibold text-[#173621] sm:text-2xl">{value}</strong>
  {note&&<p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>}</>;
 return onClick?<button type="button" aria-pressed={active} className={cls}
   onClick={onClick}>{content}</button>:<div className={cls}>{content}</div>;
}
function Section({title,description,children,action}:{
 title:string;description?:string;children:React.ReactNode;action?:React.ReactNode;
}){
 return <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E4EBE6] bg-white">
  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EDF1EE] p-5">
    <div><h2 className="font-semibold text-[#173621]">{title}</h2>
      {description&&<p className="mt-1 text-xs leading-6 text-slate-500">{description}</p>}</div>{action}
  </header>
  <div className="p-5">{children}</div>
 </section>;
}
function RowDetail({label,children}:{label:string;children:React.ReactNode}){
 return <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#EEF3EF] py-3 text-xs">
  <span className="text-slate-500">{label}</span><strong className="max-w-[65%] break-all text-right font-semibold text-[#173621]">{children}</strong>
 </div>;
}
function OrderDetails({value,module,onClose}:{value:Order;module:ModuleName;onClose:()=>void}){
 useEffect(()=>{
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
  window.addEventListener('keydown',close);
  return ()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',close);};
 },[onClose]);
 const events=[
  {label:'Shopify order synchronized',at:value.updatedAt,extra:'Latest known Shopify update'},
  ...(value.bostaUpdatedAt?[{label:'Bosta status update',at:value.bostaUpdatedAt,
   extra:value.bostaState==null?'Raw status not available':'Raw provider state '+value.bostaState+' (unmapped)'}]:[]),
  ...(value.merchantSettledAt?[{label:'Merchant settlement recorded',at:value.merchantSettledAt,
   extra:'Recorded reconciliation timestamp'}]:[]),
 ];
 return <div className="fixed inset-0 z-[90] flex justify-end">
  <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 bg-[#0E2818]/50"/>
  <aside role="dialog" aria-modal="true" aria-label={value.order+' operations details'}
    className="relative z-10 flex h-full w-full max-w-[560px] flex-col bg-white shadow-xl">
   <header className="flex items-start justify-between border-b border-[#E4ECE6] px-5 py-5 sm:px-7">
    <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#1F6B3A]">HERBAL VITALY / {module.toUpperCase()}</p>
     <h2 className="mt-2 text-2xl font-semibold text-[#173621]">{value.order}</h2>
     <p className="mt-1 text-xs text-slate-500">Read-only, partner-scoped order record</p></div>
    <button autoFocus onClick={onClose} type="button" aria-label="Close details" className="rounded-lg border p-2">
     <X className="h-4 w-4"/></button>
   </header>
   <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
    <section><h3 className="font-semibold text-[#173621]">Shopify order</h3>
     <div className="mt-2">
      <RowDetail label="Last Shopify update">{localDate(value.updatedAt)}</RowDetail>
      <RowDetail label="Order value">{currency(value.amountEGP,value.currency)}</RowDetail>
      <RowDetail label="Partner code">{value.discountCode||'—'}</RowDetail>
      <RowDetail label="Attribution">{attributionLabel[value.attributionSource]||value.attributionSource}</RowDetail>
      <RowDetail label="Payment">{value.payment==='COD'?'Cash on delivery':'Non-COD review'}</RowDetail>
      <RowDetail label="Product line items">Not currently synchronized</RowDetail>
     </div>
    </section>
    <section className="rounded-xl border border-[#DEE9E1] bg-[#F7FAF8] p-4">
     <h3 className="font-semibold text-[#173621]">Bosta & shipment</h3>
     <div className="mt-2">
      <RowDetail label="Shipment record">{value.shipmentRecorded?'Recorded':'Not available'}</RowDetail>
      <RowDetail label="Tracking number">{value.tracking||'Not available'}</RowDetail>
      <RowDetail label="Last provider update">{localDate(value.bostaUpdatedAt)}</RowDetail>
      <RowDetail label="Raw Bosta code">{value.bostaState==null?'Not available':String(value.bostaState)+' (unmapped)'}</RowDetail>
      <RowDetail label="Delivery">{deliveryLabel[value.delivery]||value.delivery}</RowDetail>
      {module==='returns'&&<>
       <RowDetail label="Physical shipment return">Not verified by current connector</RowDetail>
       <RowDetail label="Detailed return reason">Not yet provided by Shopify/Bosta</RowDetail>
       <RowDetail label="Actual refund amount">Unavailable</RowDetail>
      </>}
     </div>
    </section>
    <section><h3 className="font-semibold text-[#173621]">Recorded updates</h3>
     <p className="mt-1 text-xs text-slate-500">No intermediate courier stages are inferred.</p>
     <ol className="mt-4 space-y-4 border-l-2 border-[#D7E7DB] pl-5">
      {events.map(e=><li key={e.label} className="relative">
       <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#1F6B3A]"/>
       <p className="text-sm font-semibold text-[#173621]">{e.label}</p>
       <p className="text-xs text-slate-600">{localDate(e.at)}</p>
       <p className="text-xs text-slate-500">{e.extra}</p></li>)}
     </ol>
     <p className="mt-4 text-xs text-slate-500">A complete pickup, transit and delivery-attempt timeline requires verified provider events not currently stored here.</p>
    </section>
    <section><h3 className="font-semibold text-[#173621]">COD & commission review</h3>
     <div className="mt-2">
      <RowDetail label="Courier collection">{value.collected?'Recorded':'Not confirmed'}</RowDetail>
      <RowDetail label="Financial reconciliation">{value.reconciled?'Recorded':'Pending / unverified'}</RowDetail>
      <RowDetail label="Recorded collection">{currency(value.collectedEGP,value.currency)}</RowDetail>
      <RowDetail label="Merchant settlement">{localDate(value.merchantSettledAt)}</RowDetail>
      <RowDetail label="Commission adjustment">Not linked to this order record</RowDetail>
     </div>
     <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-900">
       Delivery, collection, merchant settlement and commission approval are distinct stages. None authorizes an automatic payout.
     </p>
    </section>
   </div>
   <footer className="border-t border-[#E4ECE6] p-4 sm:px-7">
    <Link href="/affiliate/payouts" className="inline-flex items-center gap-2 text-xs font-semibold text-[#1F6B3A]">
      View commission ledger <ArrowRight className="h-4 w-4"/></Link>
   </footer>
  </aside>
 </div>;
}
export default function OperationsWorkspace({module}:{module:ModuleName}){
 const isDelivery=module==='deliveries';
 const [filters,setFilters]=useState<Filters>(defaults);
 const [page,setPage]=useState(1);
 const [refresh,setRefresh]=useState(0);
 const [data,setData]=useState<ResponseData|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [exporting,setExporting]=useState(false);
 const [searchDebounced,setSearchDebounced]=useState('');
 const [details,setDetails]=useState<Order|null>(null);
 const [showAnalytics,setShowAnalytics]=useState(true);
 const [showFilters,setShowFilters]=useState(true);
 const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);const f={...defaults};
  for(const key of ['period','search','status','payment','finance','coupon','source','from','to','sort'] as const){
   const v=p.get(key);if(v!==null)f[key]=v.slice(0,80);
  }
  if(['10','25','50'].includes(p.get('perPage')||''))f.perPage=Number(p.get('perPage'));
  const pageNum=Number(p.get('page'));
  if(Number.isInteger(pageNum)&&pageNum>0&&pageNum<=1000)setPage(pageNum);
  setFilters(f);setSearchDebounced(f.search);setHydrated(true);
 },[]);
 useEffect(()=>{
  const id=window.setTimeout(()=>setSearchDebounced(filters.search),280);
  return ()=>window.clearTimeout(id);
 },[filters.search]);
 const update=(key:keyof Filters,value:string|number)=>{
  setFilters(f=>({...f,[key]:value}));setPage(1);
 };
 const reset=()=>{setFilters(defaults);setSearchDebounced('');setPage(1);};
 const params=useMemo(()=>{
  const p=new URLSearchParams({module,period:filters.period,page:String(page),
   perPage:String(filters.perPage),sort:filters.sort});
  for(const key of ['status','payment','finance','coupon','source'] as const)
   if(filters[key])p.set(key,filters[key]);
  if(searchDebounced)p.set('search',searchDebounced);
  if(filters.period==='custom'){
   if(filters.from)p.set('from',filters.from);
   if(filters.to)p.set('to',filters.to);
  }
  return p.toString();
 },[filters,page,module,searchDebounced]);
 useEffect(()=>{
  if(!hydrated)return;
  const displayParams=new URLSearchParams(params);displayParams.delete('module');
  window.history.replaceState(window.history.state,'',window.location.pathname+'?'+displayParams.toString());
  const controller=new AbortController();setLoading(true);setError('');
  fetch('/api/affiliate/operations?'+params,{credentials:'include',cache:'no-store',signal:controller.signal})
   .then(async r=>{const body=await r.json();if(!r.ok||!body.success||body.module!==module)throw new Error(body.error||'Cannot load records');
    if(!controller.signal.aborted)setData(body);})
   .catch(e=>{if(!controller.signal.aborted){setError(e.message||'Operation records unavailable');setData(null);}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[params,hydrated,refresh,module]);
 const exportData=async()=>{
  if(exporting)return;setExporting(true);setError('');
  try{
   const u=new URLSearchParams(params);u.set('export','csv');
   const r=await fetch('/api/affiliate/operations?'+u.toString(),{cache:'no-store',credentials:'include'});
   if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'Export unavailable');}
   const blob=await r.blob();const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;
   a.download='HerbalVitaly_Partner_'+module+'_'+new Date().toISOString().slice(0,10)+'.csv';
   a.click();URL.revokeObjectURL(url);
  }catch(e){setError(e instanceof Error?e.message:'Export unavailable');}
  finally{setExporting(false);}
 };
 const cards=isDelivery?[
  {label:'Orders in selection',value:data?String(data.summary.total):'—',icon:Package,note:'Attributed Shopify orders'},
  {label:'Recorded shipments',value:data?String(data.summary.shipmentsRecorded):'—',icon:Truck,note:'Bosta reference or shipment ID'},
  {label:'Pending delivery',value:data?String(data.summary.pending):'—',icon:Clock3,status:'PENDING'},
  {label:'In transit',value:'Unavailable',icon:Truck,note:'Verified provider mapping needed'},
  {label:'Out for delivery',value:'Unavailable',icon:Activity,note:'Verified provider mapping needed'},
  {label:'Delivered',value:data?String(data.summary.delivered):'—',icon:CheckCircle2,status:'DELIVERED'},
  {label:'Failed deliveries',value:'Unavailable',icon:AlertCircle,note:'Verified provider mapping needed'},
  {label:'Delivery success',value:data?.summary.deliverySuccessRate!=null?data.summary.deliverySuccessRate+'%':'—',
   icon:BarChart3,note:'Delivered / selected orders'},
 ]:[
  {label:'Physical shipment returns',value:'Unavailable',icon:RotateCcw,note:'Requires verified Bosta events'},
  {label:'Refunded orders',value:data?String(data.summary.refunded):'—',icon:RotateCcw,status:'REFUNDED'},
  {label:'Cancelled orders',value:data?String(data.summary.cancelled):'—',icon:AlertCircle,status:'CANCELLED'},
  {label:'Period refund rate',value:data?.summary.timePeriodRefundRate!=null?data.summary.timePeriodRefundRate+'%':'—',
   icon:BarChart3,note:'Refunded selection / all partner orders in period'},
  {label:'Refund amount',value:'Unavailable',icon:Wallet,note:'Only order total is stored'},
  {label:'Under review',value:'Unavailable',icon:Clock3,note:'Provider workflow not synchronized'},
  {label:'Verified return reasons',value:'Unavailable',icon:Package,note:'No provider reason fields'},
  {label:'Commission adjustments',value:'Unavailable',icon:CreditCard,note:'Not linked to these orders'},
 ];
 const statusData=data?isDelivery?[
  {name:'Delivered',value:data.summary.delivered,color:'#1F6B3A'},
  {name:'Pending',value:data.summary.pending,color:'#DEAE50'},
  {name:'Refunded',value:data.summary.refunded,color:'#C66570'},
  {name:'Cancelled',value:data.summary.cancelled,color:'#96A6A0'},
 ]:[
  {name:'Refunded',value:data.summary.refunded,color:'#C66570'},
  {name:'Cancelled',value:data.summary.cancelled,color:'#96A6A0'},
 ]:[];const pieData=statusData.filter(x=>x.value>0);
 const trends=data?.trends||[];
 const numPages=Math.max(1,Math.ceil((data?.total||0)/(data?.perPage||25)));
 const panelTitle=isDelivery?'Delivery Management':'Returns & Refunds';
 const summaryText=isDelivery?'Monitor verified Shopify delivery outcomes, shipment records and COD reconciliation.':
  'Understand confirmed Shopify refunds and cancellations without confusing them with physical parcel returns.';
 const closeDetails=useCallback(()=>setDetails(null),[]);
 return <main lang="en" className="mx-auto max-w-[1550px] space-y-5 pb-12">
  <div className="flex flex-wrap items-end justify-between gap-4">
   <div><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#1F6B3A]">
     HERBAL VITALY / PARTNER OPERATIONS</p>
    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#173621] sm:text-3xl">{panelTitle}</h1>
    <p className="mt-1 text-sm text-slate-500">{summaryText}</p>
    {data?.latestOrderUpdate&&<p className="mt-2 text-xs text-slate-500">Latest Shopify record update: {localDate(data.latestOrderUpdate)}</p>}
   </div>
   <div className="flex flex-wrap gap-2">
    <button type="button" onClick={()=>setShowAnalytics(v=>!v)}
     className="inline-flex items-center gap-2 rounded-xl border border-[#DBE8DE] bg-white px-3 py-2.5 text-xs font-semibold text-[#1F6B3A]">
     <BarChart3 className="h-4 w-4"/>{showAnalytics?'Hide analytics':'View analytics'}</button>
    <button type="button" onClick={()=>setRefresh(v=>v+1)} disabled={loading}
     className="inline-flex items-center gap-2 rounded-xl border border-[#DBE8DE] bg-white px-3 py-2.5 text-xs font-semibold text-[#1F6B3A] disabled:opacity-50">
     <RefreshCw className="h-4 w-4"/>Refresh</button>
    <button type="button" onClick={exportData} disabled={loading||exporting||!data?.total}
     className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3A] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
     <ArrowDownToLine className="h-4 w-4"/>{exporting?'Exporting…':'Export CSV'}</button>
   </div>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
  {loading&&!data&&<p role="status" className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading verified partner records…</p>}

  <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
   {cards.map(card=><Metric key={card.label} label={card.label} value={card.value} icon={card.icon}
    note={card.note} active={'status'in card&&filters.status===card.status}
    onClick={'status'in card?()=>update('status',filters.status===card.status?'':card.status||''):undefined}/>)}
  </section>

  <Section title={isDelivery?'Shipment search & filters':'Returns & refunds filters'}
   description="Server-scoped filters apply to the visible orders, aggregate cards, charts and CSV."
   action={<button type="button" aria-expanded={showFilters} onClick={()=>setShowFilters(v=>!v)}
    className="text-xs font-semibold text-[#1F6B3A]">{showFilters?'Hide filters':'Show filters'}</button>}>
   {showFilters&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <label className="space-y-1 text-xs font-medium text-slate-600"><span>Order / tracking / code</span>
     <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
     <input value={filters.search} onChange={e=>update('search',e.target.value)}
      placeholder="Order, promo or Bosta number" className="w-full rounded-lg border border-[#DAE6DE] py-2 pl-9 pr-3 text-sm outline-[#1F6B3A]"/></div></label>
    <label className="space-y-1 text-xs font-medium text-slate-600"><span>Cairo reporting period</span>
     <select value={filters.period} onChange={e=>update('period',e.target.value)}
      className="w-full rounded-lg border border-[#DAE6DE] bg-white p-2 text-sm text-[#173621]">
      <option value="today">Today</option><option value="yesterday">Yesterday</option>
      <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option><option value="this-month">This month</option>
      <option value="last-month">Last month</option><option value="custom">Custom range</option>
      <option value="all">All time</option>
     </select></label>
    <label className="space-y-1 text-xs font-medium text-slate-600"><span>{isDelivery?'Delivery status':'Refund or cancellation'}</span>
     <select value={filters.status} onChange={e=>update('status',e.target.value)}
      className="w-full rounded-lg border border-[#DAE6DE] bg-white p-2 text-sm text-[#173621]">
      <option value="">All relevant statuses</option>
      {isDelivery?<><option value="DELIVERED">Delivered</option>
       <option value="PENDING">Pending delivery</option>
       <option value="SHIPMENT_RECORDED">Shipment recorded</option>
       <option value="NO_TRACKING">No tracking available</option>
       <option value="REFUNDED">Refunded</option><option value="CANCELLED">Cancelled</option></>:
       <><option value="REFUNDED">Refunded</option><option value="CANCELLED">Cancelled</option></>}
     </select></label>
    <label className="space-y-1 text-xs font-medium text-slate-600"><span>Payment</span>
     <select value={filters.payment} onChange={e=>update('payment',e.target.value)}
      className="w-full rounded-lg border border-[#DAE6DE] bg-white p-2 text-sm text-[#173621]">
      <option value="">All payments</option><option value="COD">Cash on delivery</option>
      <option value="NON_COD">Non-COD review</option></select></label>
    <label className="space-y-1 text-xs font-medium text-slate-600"><span>Financial reconciliation</span>
     <select value={filters.finance} onChange={e=>update('finance',e.target.value)}
      className="w-full rounded-lg border border-[#DAE6DE] bg-white p-2 text-sm text-[#173621]">
      <option value="">All records</option><option value="RECONCILED">Reconciled</option>
      <option value="PENDING">Not yet reconciled</option></select></label>
    <label className="space-y-1 text-xs font-medium text-slate-600"><span>Attribution source</span>
     <select value={filters.source} onChange={e=>update('source',e.target.value)}
      className="w-full rounded-lg border border-[#DAE6DE] bg-white p-2 text-sm text-[#173621]">
      <option value="">All attribution sources</option><option value="AFFILIATE_LINK">Affiliate link</option>
      <option value="PROMO_CODE">Promo code</option><option value="LINK_AND_PROMO">Link + promo</option></select></label>
    <label className="space-y-1 text-xs font-medium text-slate-600"><span>Promo code</span>
     <input value={filters.coupon} onChange={e=>update('coupon',e.target.value)} placeholder="Assigned code"
      className="w-full rounded-lg border border-[#DAE6DE] p-2 text-sm outline-[#1F6B3A]"/></label>
    <label className="space-y-1 text-xs font-medium text-slate-600"><span>Sort orders</span>
     <select value={filters.sort} onChange={e=>update('sort',e.target.value)}
      className="w-full rounded-lg border border-[#DAE6DE] bg-white p-2 text-sm text-[#173621]">
      <option value="newest">Most recently updated</option><option value="oldest">Oldest update</option>
      <option value="highest">Highest value</option><option value="lowest">Lowest value</option></select></label>
    {filters.period==='custom'&&<>
     <label className="space-y-1 text-xs font-medium text-slate-600"><span>From · Cairo</span>
      <input type="date" value={filters.from} max={filters.to||undefined} onChange={e=>update('from',e.target.value)}
       className="w-full rounded-lg border border-[#DAE6DE] p-2 text-sm"/></label>
     <label className="space-y-1 text-xs font-medium text-slate-600"><span>To · Cairo</span>
      <input type="date" value={filters.to} min={filters.from||undefined} onChange={e=>update('to',e.target.value)}
       className="w-full rounded-lg border border-[#DAE6DE] p-2 text-sm"/></label>
    </>}
   </div>}
   <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#EEF2EE] pt-3">
    <button type="button" onClick={reset}
     className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#1F6B3A]">
     <FilterX className="h-4 w-4"/> Clear all filters</button>
   </div>
  </Section>
  {showAnalytics&&<div className="grid gap-4 lg:grid-cols-2">
   <Section title={isDelivery?'Delivery outcome breakdown':'Refund and cancellation breakdown'}
     description="These counts come from verified Shopify order flags.">
    {pieData.length?<div className="h-56" role="img" aria-label="Order outcomes breakdown">
     <ResponsiveContainer width="100%" height="100%">
      <PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={85}>
       {pieData.map(v=><Cell key={v.name} fill={v.color}/>)}</Pie><Tooltip/></PieChart>
     </ResponsiveContainer></div>:<p className="py-16 text-center text-sm text-slate-500">No recorded outcomes in this period</p>}
    <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-600">
     {pieData.map(v=><span key={v.name} className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{background:v.color}}/>{v.name}: {v.value}</span>)}
    </div>
   </Section>
   <Section title={isDelivery?'Daily delivery record updates':'Daily refunded / cancelled order updates'}
    description="Grouped by Shopify update date, not courier event date.">
    <div className="h-56" role="img" aria-label="Daily order updates">
     <ResponsiveContainer width="100%" height="100%">
      <BarChart data={trends}><CartesianGrid vertical={false} stroke="#EEF3EF"/>
       <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize:10}} minTickGap={23}/>
       <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{fontSize:10}} width={31}/>
       <Tooltip/>
       {isDelivery?<Bar dataKey="delivered" name="Delivered records" fill="#1F6B3A" radius={[3,3,0,0]}/>:
        <><Bar dataKey="refunded" name="Refunded" fill="#C66570" radius={[3,3,0,0]}/>
         <Bar dataKey="cancelled" name="Cancelled" fill="#9AABA3" radius={[3,3,0,0]}/></>}
      </BarChart>
     </ResponsiveContainer></div>
    {data&&!data.trendsComplete&&<p className="text-xs text-amber-800">Trend sampled from 2,000 recent records; summary KPIs are not sampled.</p>}
   </Section>
   <Section title="Order value over time" description="Synchronized EGP order total, not collected revenue.">
    <div className="h-52" role="img" aria-label="Order value chart">
     <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={trends}><CartesianGrid vertical={false} stroke="#EEF3EF"/>
       <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize:10}} minTickGap={25}/>
       <YAxis tickLine={false} axisLine={false} tick={{fontSize:10}} width={48}/>
       <Tooltip formatter={v=>currency(Number(v))}/>
       <Area dataKey="egp" name="Order value" type="monotone" stroke="#1F6B3A" strokeWidth={2}
         fill="#E6F4E9"/></AreaChart>
     </ResponsiveContainer></div>
   </Section>
   <Section title={isDelivery?'COD & merchant reconciliation':'Refund reasons & financial adjustments'}
    description={isDelivery?'Collection and settlement flags come from synchronized records.':
     'Refund amounts, physical return reasons and commission adjustments are not in the current order connector.'}>
    {isDelivery?<div className="grid gap-3 sm:grid-cols-2">
     <div className="rounded-xl bg-[#F5F9F6] p-4">
      <p className="text-xs text-slate-500">Courier collection recorded</p>
      <strong className="mt-2 block text-xl text-[#173621]">{data?.summary.collected??'—'}</strong></div>
     <div className="rounded-xl bg-[#F5F9F6] p-4">
      <p className="text-xs text-slate-500">Merchant reconciliation recorded</p>
      <strong className="mt-2 block text-xl text-[#173621]">{data?.summary.reconciled??'—'}</strong></div>
     <div className="rounded-xl bg-[#F5F9F6] p-4 sm:col-span-2">
      <p className="text-xs text-slate-500">Reconciled collected amount, EGP</p>
      <strong className="mt-2 block text-xl text-[#173621]">{data?currency(data.summary.collectedReconciledEGP):'—'}</strong></div>
    </div>:<div className="rounded-xl bg-[#F5F9F6] p-5">
     <p className="text-sm font-medium text-[#173621]">Detailed return reasons are not yet synchronized from Shopify or Bosta.</p>
     <p className="mt-3 text-xs leading-6 text-slate-600">No return-reason distribution or refund amount is presented until source events and verified mappings are available. A refunded order is not automatically a physically returned parcel.</p>
     <p className="mt-3 text-xs font-semibold text-[#1F6B3A]">Actual refund amount: unavailable · Financial adjustments: unavailable</p>
    </div>}
   </Section>
  </div>}

  <Section title={isDelivery?'Delivery tracking records':'Refunded and cancelled orders'}
   description="Partner-only, server-paginated orders. No customer addresses or phone numbers."
   action={<div className="flex items-center gap-2 text-xs text-slate-600">
    <span>{data?.total??0} records</span>
    <select aria-label="Rows per page" value={filters.perPage} onChange={e=>update('perPage',Number(e.target.value))}
     className="rounded-lg border border-[#DDE8E0] bg-white p-2 text-xs">
     <option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option>
    </select>
   </div>}>
   <div className="hidden overflow-x-auto lg:block">
    <table className="w-full min-w-[1010px] text-left text-sm">
     <thead className="bg-[#F4F9F5] text-xs font-semibold text-[#526757]">
      <tr>{(isDelivery?['Order','Updated','Bosta tracking','Order value','Promo','Delivery','COD','Collection','Reconciliation','Details']:
       ['Order','Updated','Order value','Promo','Shopify outcome','Reason','Refund amount','Commission impact','Details'])
       .map(h=><th key={h} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>
     <tbody className="divide-y divide-[#EAF0EC]">
      {(data?.rows||[]).map(o=><tr key={o.id} className="hover:bg-[#F8FBF9]">
       <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#173621]">{o.order}</td>
       <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{localDate(o.updatedAt)}</td>
       {isDelivery&&<td className="max-w-[130px] truncate px-3 py-3 font-mono text-xs">{o.tracking||'Not available'}</td>}
       <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#173621]">{currency(o.amountEGP,o.currency)}</td>
       <td className="px-3 py-3 font-mono text-xs">{o.discountCode||'—'}</td>
       <td className="px-3 py-3"><span className={'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold '+statusStyle(o)}>
        {deliveryLabel[o.delivery]||o.delivery}</span></td>
       {isDelivery?<><td className="px-3 py-3 text-xs">{o.payment==='COD'?'COD':'Non-COD'}</td>
        <td className="px-3 py-3 text-xs">{o.collected?'Recorded':'Not confirmed'}</td>
        <td className="px-3 py-3 text-xs">{o.reconciled?'Recorded':'Pending'}</td></>:
        <><td className="px-3 py-3 text-xs">Unavailable</td>
         <td className="px-3 py-3 text-xs">Unavailable</td>
         <td className="px-3 py-3 text-xs">Not linked</td></>}
       <td className="px-3 py-3"><button type="button" onClick={()=>setDetails(o)}
        className="whitespace-nowrap rounded-lg border border-[#C7DDCD] px-3 py-2 text-xs font-semibold text-[#1F6B3A]">
        View details</button></td>
      </tr>)}
     </tbody>
    </table>
   </div>
   <div className="space-y-3 lg:hidden">
    {(data?.rows||[]).map(o=><article key={o.id} className="rounded-xl border border-[#DCE9E0] p-4">
     <div className="flex items-start justify-between gap-2">
      <div><h3 className="font-semibold text-[#173621]">{o.order}</h3>
       <p className="mt-1 text-xs text-slate-500">{localDate(o.updatedAt)}</p></div>
      <span className={'rounded-full px-2 py-1 text-[11px] font-semibold '+statusStyle(o)}>
       {deliveryLabel[o.delivery]||o.delivery}</span></div>
     <p className="mt-3 text-lg font-semibold text-[#173621]">{currency(o.amountEGP,o.currency)}</p>
     <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
      {isDelivery&&<span>Bosta: {o.tracking||'Unavailable'}</span>}
      <span>Promo: {o.discountCode||'—'}</span>
      <span>{o.payment==='COD'?'COD':'Non-COD'}</span>
     </div>
     <button type="button" onClick={()=>setDetails(o)}
      className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#CCE1D0] py-2.5 text-xs font-semibold text-[#1F6B3A]">
      View details <ArrowRight className="h-4 w-4"/></button>
    </article>)}
   </div>
   {!loading&&!(data?.rows||[]).length&&<p className="py-12 text-center text-sm text-slate-500">
    No matching records. Change the filters or reporting period.</p>}
   {loading&&<p role="status" className="p-4 text-center text-xs text-slate-500">Refreshing records…</p>}
   <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4EBE6] pt-4 text-xs text-slate-600">
    <span>Page {page} of {numPages} · {data?.total??0} matching records</span>
    <div className="flex gap-2">
     <button type="button" aria-label="Previous page" disabled={page<=1||loading}
      onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border p-2 disabled:opacity-40">
      <ChevronLeft className="h-4 w-4"/></button>
     <button type="button" aria-label="Next page" disabled={page>=numPages||loading}
      onClick={()=>setPage(p=>Math.min(numPages,p+1))} className="rounded-lg border p-2 disabled:opacity-40">
      <ChevronRight className="h-4 w-4"/></button>
    </div>
   </div>
  </Section>

  <Section title={isDelivery?'Operational visibility':'Returns and refunds — data quality'}
   description="Verified totals and explicit integration limitations prevent misleading earnings or return claims.">
   <div className="grid gap-3 sm:grid-cols-3">
    {(isDelivery?[
     {title:'Awaiting delivery',text:String(data?.summary.pending??'—')},
     {title:'Confirmed collection',text:String(data?.summary.collected??'—')},
     {title:'Awaiting settlement',text:'Use collection and reconciliation flags in order details'},
    ]:[
     {title:'Physical parcel returns',text:'Unavailable until Bosta event mapping'},
     {title:'Refunded order records',text:String(data?.summary.refunded??'—')},
     {title:'Return reasons',text:'Unavailable until source reasons are synchronized'},
    ]).map(x=><div key={x.title} className="rounded-xl bg-[#F5F9F6] p-4">
     <h3 className="text-sm font-semibold text-[#173621]">{x.title}</h3>
     <p className="mt-2 text-xs leading-6 text-slate-600">{x.text}</p>
    </div>)}
   </div>
   <p className="mt-4 text-xs leading-6 text-slate-500">This is read-only operational reporting. Shopify orders, merchant settlements and affiliate commission approvals remain under their existing separate controls.</p>
   <Link href="/affiliate/orders" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#1F6B3A]">
    Open complete Order Management <ArrowRight className="h-4 w-4"/></Link>
  </Section>
  {details&&<OrderDetails value={details} module={module} onClose={closeDetails}/>}
 </main>;
}
