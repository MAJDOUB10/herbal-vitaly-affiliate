'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {
  Bar,BarChart,CartesianGrid,Cell,Pie,PieChart,
  ResponsiveContainer,Tooltip,XAxis,YAxis,
} from 'recharts';
import {
  ArrowDownToLine,ArrowRight,CheckCircle2,ChevronLeft,ChevronRight,
  Clock3,CreditCard,FileText,FilterX,Info,RefreshCw,Search,ShieldCheck,
  TrendingUp,Wallet,X,
} from 'lucide-react';

type Tab='commissions'|'payouts';
type CommissionStatus='PENDING'|'APPROVED'|'PAID'|'CANCELLED'|'CLAWBACK';
type PayoutStatus='PENDING'|'PROCESSING'|'COMPLETED'|'FAILED';
type Commission={
  id:string;amountCents:number;rate:number;status:CommissionStatus;
  currency:string;createdAt:string;approvedAt:string|null;
  paidAt:string|null;maturesAt:string|null;payoutId:string|null;
  payoutStatus:string|null;payoutProcessedAt:string|null;
};
type Payout={
  id:string;amountCents:number;status:PayoutStatus;method:string|null;
  commissionCount:number;createdAt:string;processedAt:string|null;
  linkedCommissions:Array<{id:string;amountCents:number;status:string;currency:string}>;
  hasMoreLinkedCommissions:boolean;
};
type Amount={amountCents:number;count:number};
type Trend={
  month:string;pending:number;approved:number;commissionPaidRecorded:number;
  completedPayouts:number;openPayouts:number;
};
type Finance={
  success:boolean;tab:Tab;total:number;page:number;perPage:number;
  recordedBalanceCents:number;ledgerCurrency:string;
  commissionTotals:Record<CommissionStatus,Amount>;
  payoutTotals:Record<PayoutStatus,Amount>;
  nonEgpCommissionCount:number;latestFinancialUpdate:string|null;
  commissions:Commission[];payouts:Payout[];
  trend:Trend[];trendComplete:boolean;error?:string;
};
type Filters={
  period:string;search:string;status:string;from:string;to:string;
  sort:string;perPage:number;
};
const fresh:Filters={period:'all',search:'',status:'',from:'',to:'',sort:'newest',perPage:25};
const commissionStatuses=['PENDING','APPROVED','PAID','CANCELLED','CLAWBACK'];
const payoutStatuses=['PENDING','PROCESSING','COMPLETED','FAILED'];
const money=(cents:number|string|null|undefined,currency='EGP')=>
  cents==null?'Unavailable':new Intl.NumberFormat('en-EG',{
    minimumFractionDigits:2,maximumFractionDigits:2,
  }).format(Number(cents)/100)+' '+currency;
const date=(stamp:string|null|undefined)=>stamp?new Intl.DateTimeFormat('en-GB',{
  timeZone:'Africa/Cairo',day:'2-digit',month:'short',year:'numeric',
}).format(new Date(stamp)):'Not recorded';
const stamp=(s:string|null|undefined)=>s?new Intl.DateTimeFormat('en-GB',{
  timeZone:'Africa/Cairo',day:'2-digit',month:'short',year:'numeric',
  hour:'2-digit',minute:'2-digit',
}).format(new Date(s)):'Not recorded';
const statusColor=(s:string)=>s==='COMPLETED'||s==='APPROVED'?
  'bg-emerald-50 text-emerald-800':
  s==='PAID'?'bg-[#E8F2EF] text-[#1C6246]':
  s==='CANCELLED'||s==='CLAWBACK'||s==='FAILED'?
    'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-800';
const statusLabel=(s:string)=>({
  PENDING:'Pending',APPROVED:'Approved',PAID:'Marked paid',
  CANCELLED:'Cancelled',CLAWBACK:'Clawback',PROCESSING:'Processing',
  COMPLETED:'Completed',FAILED:'Failed',
} as Record<string,string>)[s]||s;
function AmountCard({label,value,note,icon:Icon}:{
  label:string;value:string;note:string;icon:typeof Wallet;
}){
  return <div className="min-w-0 rounded-2xl border border-[#E0EBE3] bg-white p-4 sm:p-5">
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <span className="rounded-xl bg-[#EEF6F0] p-2 text-[#1F6B3A]"><Icon className="h-4 w-4"/></span>
    </div>
    <strong className="mt-3 block break-words text-[21px] font-semibold tracking-tight text-[#173621] sm:text-2xl">{value}</strong>
    <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
  </div>;
}
function DetailRow({label,children}:{label:string;children:React.ReactNode}){
  return <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAF0EC] py-3 text-sm">
    <span className="text-slate-500">{label}</span>
    <strong className="max-w-[65%] break-all text-right font-medium text-[#173621]">{children}</strong>
  </div>;
}
function DetailDrawer({entry,onClose}:{
  entry:{type:'commissions';item:Commission}|{type:'payouts';item:Payout};
  onClose:()=>void;
}){
  useEffect(()=>{
    const prev=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    window.addEventListener('keydown',key);
    return ()=>{document.body.style.overflow=prev;window.removeEventListener('keydown',key);};
  },[onClose]);
  const isCommission=entry.type==='commissions';
  return <div className="fixed inset-0 z-[90] flex justify-end">
    <button type="button" className="absolute inset-0 bg-[#092414]/50"
      aria-label="Close finance details" onClick={onClose}/>
    <aside role="dialog" aria-modal="true"
      aria-label={(isCommission?'Commission':'Payout')+' details'}
      className="relative z-10 flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-[#E1ECE4] p-5 sm:px-7">
        <div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#1F6B3A]">HERBAL VITALY / FINANCE LEDGER</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#173621]">
            {isCommission?'Commission details':'Payout details'}
          </h2>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">{entry.item.id}</p>
        </div>
        <button type="button" autoFocus onClick={onClose} aria-label="Close details"
          className="rounded-lg border border-[#DDE8E0] p-2 text-[#173621]">
          <X className="h-4 w-4"/>
        </button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:px-7">
        <section>
          <h3 className="font-semibold text-[#173621]">Recorded financial information</h3>
          <div className="mt-3">
            <DetailRow label="Created">{stamp(entry.item.createdAt)}</DetailRow>
            <DetailRow label="Current status">
              <span className={'rounded-full px-2.5 py-1 text-xs '+statusColor(entry.item.status)}>
                {statusLabel(entry.item.status)}</span>
            </DetailRow>
            <DetailRow label="Amount">
              {isCommission?
                money((entry.item as Commission).amountCents,(entry.item as Commission).currency):
                money(entry.item.amountCents)+'*'}
            </DetailRow>
            {isCommission?<>
              <DetailRow label="Commission rate">{Number((entry.item as Commission).rate*100).toFixed(2)}% recorded</DetailRow>
              <DetailRow label="Approved on">{stamp((entry.item as Commission).approvedAt)}</DetailRow>
              <DetailRow label="Matures on">{date((entry.item as Commission).maturesAt)}</DetailRow>
              <DetailRow label="Marked paid on">{stamp((entry.item as Commission).paidAt)}</DetailRow>
              <DetailRow label="Linked payout">{(entry.item as Commission).payoutId||'Not linked'}</DetailRow>
              <DetailRow label="Linked payout status">{(entry.item as Commission).payoutStatus||'Not recorded'}</DetailRow>
              <DetailRow label="Payout processed on">{stamp((entry.item as Commission).payoutProcessedAt)}</DetailRow>
            </>:<>
              <DetailRow label="Payment method">{(entry.item as Payout).method||'Not recorded'}</DetailRow>
              <DetailRow label="Commission count">{(entry.item as Payout).commissionCount}</DetailRow>
              <DetailRow label="Processed on">{stamp((entry.item as Payout).processedAt)}</DetailRow>
            </>}
          </div>
        </section>
        {!isCommission&&<section>
          <h3 className="font-semibold text-[#173621]">Linked commissions</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Only commissions explicitly associated with this payout record are listed.</p>
          {(entry.item as Payout).linkedCommissions.length?
            <div className="mt-3 space-y-2">
              {(entry.item as Payout).linkedCommissions.map(x=>
                <div key={x.id} className="rounded-xl border border-[#E4ECE6] p-3">
                  <p className="break-all font-mono text-xs text-slate-500">{x.id}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <strong className="text-[#173621]">{money(x.amountCents,x.currency)}</strong>
                    <span className={'rounded-full px-2 py-1 text-xs '+statusColor(x.status)}>{statusLabel(x.status)}</span>
                  </div>
                </div>)}
            </div>:<p className="mt-3 text-sm text-slate-500">No linked commission details recorded.</p>}
          {(entry.item as Payout).hasMoreLinkedCommissions&&
            <p className="mt-2 text-xs text-amber-800">Only the latest 30 linked commissions are shown in this detail view.</p>}
        </section>}
        <section className="rounded-xl border border-[#DDE9E0] bg-[#F6FAF7] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#173621]">
            <ShieldCheck className="h-4 w-4 text-[#1F6B3A]"/> Financial reporting notes
          </h3>
          <p className="mt-2 text-xs leading-6 text-slate-600">
            {isCommission?
              'A commission marked PAID does not by itself confirm that the money reached a bank account. Completion is tracked separately in the payout ledger.':
              'Only a payout recorded COMPLETED counts as a completed payout record. The historical payout schema does not store currency or independent bank transfer confirmation.'}
          </p>
        </section>
      </div>
      <footer className="border-t border-[#E1ECE4] p-4 sm:px-7">
        <Link href="/affiliate/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F6B3A]">
          Ask the finance support team <ArrowRight className="h-4 w-4"/>
        </Link>
      </footer>
    </aside>
  </div>;
}
export default function PartnerPayoutsV4(){
  const [tab,setTab]=useState<Tab>('commissions');
  const [filters,setFilters]=useState<Filters>(fresh);
  const [page,setPage]=useState(1);
  const [debouncedSearch,setDebouncedSearch]=useState('');
  const [ready,setReady]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [data,setData]=useState<Finance|null>(null);
  const [exporting,setExporting]=useState(false);
  const [selected,setSelected]=useState<
    {type:'commissions';item:Commission}|{type:'payouts';item:Payout}|null>(null);
  const [showAnalytics,setShowAnalytics]=useState(true);

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    const t=q.get('tab');if(t==='payouts')setTab('payouts');
    const f={...fresh};
    for(const k of ['period','search','status','from','to','sort'] as const){
      const v=q.get(k);if(v!==null)f[k]=v.slice(0,80);
    }
    const pp=Number(q.get('perPage'));if([10,25,50].includes(pp))f.perPage=pp;
    const pg=Number(q.get('page'));if(Number.isInteger(pg)&&pg>0&&pg<=1000)setPage(pg);
    setDebouncedSearch(f.search);setFilters(f);setReady(true);
  },[]);
  useEffect(()=>{
    const id=window.setTimeout(()=>setDebouncedSearch(filters.search),300);
    return ()=>window.clearTimeout(id);
  },[filters.search]);
  const update=(key:keyof Filters,value:string|number)=>{
    setFilters(prev=>({...prev,[key]:value}));setPage(1);
  };
  const switchTab=(v:Tab)=>{
    setTab(v);setPage(1);setFilters(prev=>({...prev,status:'',search:''}));
    setDebouncedSearch('');setSelected(null);
  };
  const query=useMemo(()=>{
    const p=new URLSearchParams({tab,period:filters.period,page:String(page),
      perPage:String(filters.perPage),sort:filters.sort});
    if(filters.status)p.set('status',filters.status);
    if(debouncedSearch)p.set('search',debouncedSearch);
    if(filters.period==='custom'){
      if(filters.from)p.set('from',filters.from);
      if(filters.to)p.set('to',filters.to);
    }
    return p.toString();
  },[tab,filters,page,debouncedSearch]);
  useEffect(()=>{
    if(!ready)return;
    window.history.replaceState(window.history.state,'',window.location.pathname+'?'+query);
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch('/api/affiliate/finance?'+query,{
      credentials:'include',cache:'no-store',signal:controller.signal,
    }).then(async response=>{
      const body=await response.json();
      if(!response.ok||!body.success)throw new Error(body.error||'Unable to retrieve finance records');
      if(!controller.signal.aborted)setData(body);
    }).catch(e=>{
      if(!controller.signal.aborted){setError(e.message||'Finance data unavailable');setData(null);}
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[ready,query,refresh]);
  const closeDrawer=useCallback(()=>setSelected(null),[]);
  const sumC=data?.commissionTotals;
  const sumP=data?.payoutTotals;
  const cards=[
    {label:'Pending commissions',value:sumC?money(sumC.PENDING.amountCents):'—',
      note:'EGP-source commission records',icon:Clock3},
    {label:'Approved commissions',value:sumC?money(sumC.APPROVED.amountCents):'—',
      note:'Approved in the commission ledger',icon:CheckCircle2},
    {label:'Commissions marked PAID',value:sumC?money(sumC.PAID.amountCents):'—',
      note:'Not independent bank confirmation',icon:FileText},
    {label:'Completed payout records',value:sumP?money(sumP.COMPLETED.amountCents)+'*':'—',
      note:'Payout ledger status COMPLETED',icon:Wallet},
    {label:'Pending / processing payouts',value:sumP?
      money(sumP.PENDING.amountCents+sumP.PROCESSING.amountCents)+'*':'—',
      note:'Not yet marked completed',icon:CreditCard},
    {label:'Recorded affiliate balance',value:data?money(data.recordedBalanceCents)+'*':'—',
      note:'Stored balance; not a payout guarantee',icon:TrendingUp},
  ];
  const statusAmounts=tab==='commissions'?[
    {name:'Pending',status:'PENDING',value:sumC?.PENDING.count||0,color:'#D8AA47'},
    {name:'Approved',status:'APPROVED',value:sumC?.APPROVED.count||0,color:'#1F6B3A'},
    {name:'Marked paid',status:'PAID',value:sumC?.PAID.count||0,color:'#79A78A'},
    {name:'Cancelled',status:'CANCELLED',value:sumC?.CANCELLED.count||0,color:'#C56C76'},
    {name:'Clawback',status:'CLAWBACK',value:sumC?.CLAWBACK.count||0,color:'#A7858A'},
  ]:[
    {name:'Pending',status:'PENDING',value:sumP?.PENDING.count||0,color:'#D8AA47'},
    {name:'Processing',status:'PROCESSING',value:sumP?.PROCESSING.count||0,color:'#7899B9'},
    {name:'Completed',status:'COMPLETED',value:sumP?.COMPLETED.count||0,color:'#1F6B3A'},
    {name:'Failed',status:'FAILED',value:sumP?.FAILED.count||0,color:'#C56C76'},
  ];
  const pie=statusAmounts.filter(x=>x.value>0);
  const maxPage=Math.max(1,Math.ceil((data?.total||0)/(data?.perPage||25)));
  const rows=tab==='commissions'?data?.commissions:data?.payouts;
  const exportCsv=async()=>{
    if(exporting)return;setExporting(true);setError('');
    try{
      const q=new URLSearchParams(query);q.set('export','csv');
      const res=await fetch('/api/affiliate/finance?'+q.toString(),{
        credentials:'include',cache:'no-store',
      });
      if(!res.ok){
        const body=await res.json().catch(()=>({}));
        throw Error(body.error||'Financial export unavailable');
      }
      const blob=await res.blob(),url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download='HerbalVitaly_'+tab+'_'+new Date().toISOString().slice(0,10)+'.csv';
      a.click();URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:'Export failed');}
    finally{setExporting(false);}
  };

  return <main lang="en" className="mx-auto max-w-[1536px] space-y-5 pb-12">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#1F6B3A]">
          HERBAL VITALY / PARTNER FINANCE</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#173621] sm:text-3xl">
          Commissions & Payouts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Understand your recorded commissions, approval stages and payout history.</p>
        {data?.latestFinancialUpdate&&<p className="mt-2 text-xs text-slate-500">
          Latest recorded financial update: {stamp(data.latestFinancialUpdate)}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>setRefresh(v=>v+1)} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[#D9E6DE] bg-white px-3 py-2.5 text-xs font-semibold text-[#1F6B3A] disabled:opacity-40">
          <RefreshCw className="h-4 w-4"/> Refresh</button>
        <button type="button" disabled={loading||exporting||!data?.total} onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3A] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40">
          <ArrowDownToLine className="h-4 w-4"/>{exporting?'Exporting…':'Export CSV'}</button>
      </div>
    </header>
    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {loading&&!data&&<p role="status" className="rounded-xl border border-[#E4ECE6] bg-white p-8 text-sm text-slate-600">
      Loading verified partner finance ledger…</p>}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(card=><AmountCard key={card.label} {...card}/>)}
    </section>
    <div className="rounded-2xl border border-[#D6E6DB] bg-[#F6FAF7] p-4">
      <p className="flex items-start gap-2 text-xs leading-6 text-[#3E6250]">
        <Info className="mt-1 h-4 w-4 shrink-0"/>
        <span><strong>Financial reporting notice.</strong> EGP commission totals include only commissions
          linked to conversions explicitly recorded in EGP. Payout and balance records have no currency
          field; amounts marked * use the configured Egypt EGP ledger denomination.
          Completed payout records are distinct from commissions marked PAID.
          {data?.nonEgpCommissionCount?
            ' '+String(data.nonEgpCommissionCount)+' non-EGP commission records are excluded from EGP totals.':''}
        </span>
      </p>
    </div>
    <section className="rounded-2xl border border-[#E0EBE4] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#173621]">Financial records</h2>
          <p className="mt-1 text-xs text-slate-500">Select a ledger and narrow the reporting period.</p>
        </div>
        <div role="tablist" aria-label="Financial ledger" className="inline-flex gap-1 rounded-xl bg-[#F1F6F2] p-1">
          {([{id:'commissions',name:'Commissions'},{id:'payouts',name:'Payout history'}] as const).map(item=>
            <button type="button" key={item.id} role="tab"
              aria-selected={tab===item.id} onClick={()=>switchTab(item.id)}
              className={'rounded-lg px-3 py-2 text-xs font-semibold '+
                (tab===item.id?'bg-white text-[#1F6B3A] shadow-sm':'text-slate-600')}>
              {item.name}</button>)}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Search reference / method</span>
          <span className="relative block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
            <input value={filters.search} onChange={e=>update('search',e.target.value)}
              placeholder={tab==='commissions'?'Commission or payout ID':'Payout reference or method'}
              className="w-full rounded-lg border border-[#DAE7DE] py-2.5 pl-9 pr-3 text-sm outline-[#1F6B3A]"/>
          </span>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Reporting period (Cairo)</span>
          <select value={filters.period} onChange={e=>update('period',e.target.value)}
            className="w-full rounded-lg border border-[#DAE7DE] bg-white p-2.5 text-sm text-[#173621]">
            <option value="all">All time</option><option value="today">Today</option>
            <option value="yesterday">Yesterday</option><option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option><option value="90d">Last 90 days</option>
            <option value="this-month">This month</option><option value="last-month">Last month</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Ledger status</span>
          <select value={filters.status} onChange={e=>update('status',e.target.value)}
            className="w-full rounded-lg border border-[#DAE7DE] bg-white p-2.5 text-sm text-[#173621]">
            <option value="">All statuses</option>
            {(tab==='commissions'?commissionStatuses:payoutStatuses).map(v=>
              <option key={v} value={v}>{statusLabel(v)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Sort records</span>
          <select value={filters.sort} onChange={e=>update('sort',e.target.value)}
            className="w-full rounded-lg border border-[#DAE7DE] bg-white p-2.5 text-sm text-[#173621]">
            <option value="newest">Newest recorded</option><option value="oldest">Oldest recorded</option>
            <option value="highest">Highest amount</option><option value="lowest">Lowest amount</option>
          </select>
        </label>
        {filters.period==='custom'&&<>
          <label className="space-y-1 text-xs font-medium text-slate-600"><span>From · Cairo date</span>
            <input type="date" value={filters.from} max={filters.to||undefined}
              onChange={e=>update('from',e.target.value)}
              className="w-full rounded-lg border border-[#DAE7DE] p-2 text-sm"/></label>
          <label className="space-y-1 text-xs font-medium text-slate-600"><span>To · Cairo date</span>
            <input type="date" value={filters.to} min={filters.from||undefined}
              onChange={e=>update('to',e.target.value)}
              className="w-full rounded-lg border border-[#DAE7DE] p-2 text-sm"/></label>
        </>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF1ED] pt-3">
        <p className="text-xs text-slate-500">The date and status controls affect the current ledger, its totals, charts and export.</p>
        <button type="button" onClick={()=>{setFilters(fresh);setDebouncedSearch('');setPage(1);}}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#1F6B3A]">
          <FilterX className="h-4 w-4"/> Clear filters</button>
      </div>
    </section>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-[#173621]">Financial analytics</h2>
      <button type="button" onClick={()=>setShowAnalytics(v=>!v)} aria-expanded={showAnalytics}
        className="text-xs font-semibold text-[#1F6B3A]">{showAnalytics?'Hide charts':'Show charts'}</button>
    </div>
    {showAnalytics&&<div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-2xl border border-[#E2EBE5] bg-white p-5">
        <h3 className="font-semibold text-[#173621]">Recorded financial activity</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Monthly records grouped by creation date and current status — not date of bank transfer.</p>
        <div className="mt-5 h-60" role="img" aria-label="Monthly recorded commission and payout amounts">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.trend||[]}>
              <CartesianGrid vertical={false} stroke="#EDF2EE"/>
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{fontSize:10}} minTickGap={20}/>
              <YAxis tickLine={false} axisLine={false} tick={{fontSize:10}} width={49}/>
              <Tooltip formatter={v=>new Intl.NumberFormat('en-EG',{maximumFractionDigits:2}).format(Number(v))+' EGP'}/>
              {tab==='commissions'?<>
                <Bar dataKey="pending" name="Pending commissions" fill="#D8AA47" stackId="finance"/>
                <Bar dataKey="approved" name="Approved commissions" fill="#1F6B3A" stackId="finance"/>
                <Bar dataKey="commissionPaidRecorded" name="Marked paid" fill="#79A78A" stackId="finance"/>
              </>:<>
                <Bar dataKey="completedPayouts" name="Completed payout records" fill="#1F6B3A" stackId="finance"/>
                <Bar dataKey="openPayouts" name="Other payout records" fill="#D8AA47" stackId="finance"/>
              </>}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {data&&!data.trendComplete&&<p className="mt-2 text-xs text-amber-800">
          Charts use up to 1,200 recent records per ledger. Financial total cards use full-dataset aggregates.</p>}
      </section>
      <section className="min-w-0 rounded-2xl border border-[#E2EBE5] bg-white p-5">
        <h3 className="font-semibold text-[#173621]">Recorded status distribution</h3>
        <p className="mt-1 text-xs text-slate-500">Exact counts for {tab==='commissions'?'EGP-source commissions':'payout records'}.</p>
        {pie.length?<div className="mt-4 h-48" role="img" aria-label="Financial status distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={56} outerRadius={76}>
              {pie.map(x=><Cell key={x.name} fill={x.color}/>)}
            </Pie><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div>:<p className="flex h-48 items-center justify-center text-sm text-slate-500">
          No recorded entries for these filters.</p>}
        <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-600">
          {pie.map(x=><span key={x.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{backgroundColor:x.color}}/>{x.name}: {x.value}</span>)}
        </div>
      </section>
    </div>}

    <section className="overflow-hidden rounded-2xl border border-[#E0EBE4] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0EC] p-5">
        <div>
          <h2 className="font-semibold text-[#173621]">
            {tab==='commissions'?'Commission ledger':'Payout history'}</h2>
          <p className="mt-1 text-xs text-slate-500">{data?.total??0} matching records — read-only financial reporting.</p>
        </div>
        <select aria-label="Rows per page" value={filters.perPage}
          onChange={e=>update('perPage',Number(e.target.value))}
          className="rounded-lg border border-[#DCE8E0] bg-white p-2 text-xs text-[#173621]">
          <option value={10}>10 / page</option><option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </header>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[970px] text-left text-sm">
          <thead className="bg-[#F5FAF6] text-xs font-semibold text-[#546B5C]">
            <tr>{(tab==='commissions'?
              ['Reference','Created','Amount','Rate','Status','Approved','Linked payout','Details']:
              ['Reference','Created','Amount*','Method','Commissions','Status','Processed','Details']).map(h=>
                <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#E9F0EA]">
            {tab==='commissions'?(data?.commissions||[]).map(c=><tr key={c.id} className="hover:bg-[#F9FCFA]">
              <td className="max-w-[170px] truncate px-4 py-3 font-mono text-xs text-slate-600" title={c.id}>{c.id}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs">{date(c.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#173621]">{money(c.amountCents,c.currency)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs">{(c.rate*100).toFixed(2)}%</td>
              <td className="px-4 py-3"><span className={'rounded-full px-2.5 py-1 text-xs '+statusColor(c.status)}>{statusLabel(c.status)}</span></td>
              <td className="whitespace-nowrap px-4 py-3 text-xs">{date(c.approvedAt)}</td>
              <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs" title={c.payoutId||''}>{c.payoutId||'—'}</td>
              <td className="px-4 py-3"><button type="button" onClick={()=>setSelected({type:'commissions',item:c})}
                className="rounded-lg border border-[#C7DBCD] px-3 py-2 text-xs font-semibold text-[#1F6B3A]">Details</button></td>
            </tr>):(data?.payouts||[]).map(p=><tr key={p.id} className="hover:bg-[#F9FCFA]">
              <td className="max-w-[170px] truncate px-4 py-3 font-mono text-xs" title={p.id}>{p.id}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs">{date(p.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#173621]">{money(p.amountCents)}*</td>
              <td className="px-4 py-3 text-xs">{p.method||'Not recorded'}</td>
              <td className="px-4 py-3 text-xs">{p.commissionCount}</td>
              <td className="px-4 py-3"><span className={'rounded-full px-2.5 py-1 text-xs '+statusColor(p.status)}>{statusLabel(p.status)}</span></td>
              <td className="whitespace-nowrap px-4 py-3 text-xs">{date(p.processedAt)}</td>
              <td className="px-4 py-3"><button type="button" onClick={()=>setSelected({type:'payouts',item:p})}
                className="rounded-lg border border-[#C7DBCD] px-3 py-2 text-xs font-semibold text-[#1F6B3A]">Details</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-4 lg:hidden">
        {tab==='commissions'?(data?.commissions||[]).map(c=><article key={c.id}
          className="rounded-xl border border-[#E1EBE4] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#173621]">{money(c.amountCents,c.currency)}</p>
            <span className={'rounded-full px-2.5 py-1 text-xs '+statusColor(c.status)}>{statusLabel(c.status)}</span>
          </div>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">{c.id}</p>
          <p className="mt-2 text-xs text-slate-600">{date(c.createdAt)} · {(c.rate*100).toFixed(2)}% recorded</p>
          <button onClick={()=>setSelected({type:'commissions',item:c})} type="button"
            className="mt-4 w-full rounded-lg border border-[#C7DBCD] py-2.5 text-xs font-semibold text-[#1F6B3A]">
            View commission details</button>
        </article>):(data?.payouts||[]).map(p=><article key={p.id}
          className="rounded-xl border border-[#E1EBE4] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#173621]">{money(p.amountCents)}*</p>
            <span className={'rounded-full px-2.5 py-1 text-xs '+statusColor(p.status)}>{statusLabel(p.status)}</span>
          </div>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">{p.id}</p>
          <p className="mt-2 text-xs text-slate-600">{date(p.createdAt)} · {p.commissionCount} commissions</p>
          <button onClick={()=>setSelected({type:'payouts',item:p})} type="button"
            className="mt-4 w-full rounded-lg border border-[#C7DBCD] py-2.5 text-xs font-semibold text-[#1F6B3A]">
            View payout details</button>
        </article>)}
      </div>
      {loading&&<p role="status" className="p-4 text-center text-xs text-slate-600">Loading financial records…</p>}
      {!loading&&!(rows?.length)&&<div className="px-5 py-14 text-center">
        <Wallet className="mx-auto h-10 w-10 text-[#97B6A1]"/>
        <h3 className="mt-3 font-semibold text-[#173621]">
          {tab==='commissions'?'No commission records found':'No payout records found'}</h3>
        <p className="mt-2 text-sm text-slate-500">Try a different reporting period, status or reference.</p>
        <Link href="/affiliate/orders" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6B3A]">
          View attributed orders <ArrowRight className="h-4 w-4"/></Link>
      </div>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9F0EB] px-5 py-4">
        <p className="text-xs text-slate-600">Page {page} of {maxPage} · {data?.total??0} matching records</p>
        <div className="flex gap-2">
          <button type="button" disabled={page<=1||loading} aria-label="Previous page"
            onClick={()=>setPage(p=>Math.max(1,p-1))}
            className="rounded-lg border border-[#DCE7DF] p-2 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4"/></button>
          <button type="button" disabled={page>=maxPage||loading} aria-label="Next page"
            onClick={()=>setPage(p=>Math.min(maxPage,p+1))}
            className="rounded-lg border border-[#DCE7DF] p-2 disabled:opacity-40">
            <ChevronRight className="h-4 w-4"/></button>
        </div>
      </footer>
    </section>
    <section className="rounded-2xl border border-[#DFE9E2] bg-white p-5">
      <h2 className="font-semibold text-[#173621]">From commission to payout</h2>
      <p className="mt-1 text-xs text-slate-500">Illustrative workflow, not a promise of transfer timing or automatic eligibility.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ['01','Commission recorded','A conversion creates a commission ledger entry.'],
          ['02','Financial approval','Eligibility depends on COD, delivery and finance review.'],
          ['03','Payout processing','A separate payout record tracks processing.'],
          ['04','Completed status','Only COMPLETED payout records count as completed.'],
        ].map(x=><div className="rounded-xl bg-[#F5FAF6] p-4" key={x[0]}>
          <span className="text-xs font-bold text-[#1F6B3A]">{x[0]}</span>
          <h3 className="mt-2 text-sm font-semibold text-[#173621]">{x[1]}</h3>
          <p className="mt-2 text-xs leading-5 text-slate-600">{x[2]}</p>
        </div>)}
      </div>
      <Link href="/affiliate/support" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6B3A]">
        Contact support about a payment <ArrowRight className="h-4 w-4"/></Link>
    </section>
    <p className="text-xs leading-6 text-slate-500">
      Data is sourced from your authenticated commission, payout and affiliate records.
      These reports do not initiate payments, approve commissions or adjust account balances.
      Financial totals use stored minor units divided by 100, without currency conversion.
    </p>
    {selected&&<DetailDrawer entry={selected} onClose={closeDrawer}/>}
  </main>;
}
