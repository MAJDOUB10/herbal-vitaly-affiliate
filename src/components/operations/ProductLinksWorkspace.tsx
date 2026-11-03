'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,BarChart3,Check,CheckCircle2,Copy,ExternalLink,Filter,
  Link2,Package,RefreshCw,Search,Share2,ShoppingCart,Tag,TrendingUp} from 'lucide-react';

type Product={handle:string;title:string;productUrl:string;affiliateLink:string;trackedLink:string|null};
type Coupon={id:string;code:string;discountType:string;discountValue:number;scope:string;products:Product[]};
type Insights={success:boolean;totals:{trackedOrders:number;clicks:number;orderValueEGP:number};complete:boolean;days:number};
const money=(n:number)=>new Intl.NumberFormat('en-EG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' EGP';

export default function ProductLinksWorkspace(){
  const [coupons,setCoupons]=useState<Coupon[]>([]);
  const [selected,setSelected]=useState('');
  const [search,setSearch]=useState('');
  const [insights,setInsights]=useState<Insights|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState('');
  const [notice,setNotice]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setError('');setLoading(true);
    Promise.all([
      fetch('/api/affiliate/shopify-coupons',{signal:controller.signal,cache:'no-store',credentials:'include'})
        .then(async r=>{const x=await r.json();if(!r.ok||!x.success)throw new Error(x.error||'Shopify eligibility verification unavailable');return x.coupons as Coupon[];}),
      fetch('/api/dashboard/insights?days=30',{signal:controller.signal,cache:'no-store',credentials:'include'})
        .then(async r=>{const x=await r.json();return r.ok&&x.success&&x.role==='AFFILIATE'?x as Insights:null;})
        .catch(()=>null),
    ]).then(([valid,data])=>{
      if(controller.signal.aborted)return;
      setCoupons(valid||[]);
      setSelected(prev=>(valid||[]).some(c=>c.code===prev)?prev:(valid||[])[0]?.code||'');
      setInsights(data);
    }).catch(e=>{if(!controller.signal.aborted){setError(e.message||'Product links are temporarily unavailable');setCoupons([]);}})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[refresh]);

  const products=useMemo(()=>{
    const codes=coupons.filter(c=>!selected||c.code===selected);
    return codes.flatMap(c=>c.products.map(p=>({...p,code:c.code,discountType:c.discountType,discountValue:c.discountValue})));
  },[coupons,selected]);
  const filtered=products.filter(p=>p.title.toLowerCase().includes(search.toLowerCase())||
    p.handle.toLowerCase().includes(search.toLowerCase()));
  const uniqueProducts=new Set(coupons.flatMap(c=>c.products.map(p=>p.handle))).size;
  const allLinks=products.reduce((n,p)=>n+1+(p.trackedLink?1:0),0);
  const trackingAvailable=products.some(p=>Boolean(p.trackedLink)||p.affiliateLink.startsWith('https://partner.herbalvitaly.com/r/'));
  const copy=async(value:string,label:string)=>{
    try{await navigator.clipboard.writeText(value);setCopied(value);setNotice(label+' copied to clipboard');}
    catch{setNotice('Clipboard permission unavailable; open the product link to copy it.');}
  };
  const share=async(p:Product)=>{
    try{
      if(navigator.share)await navigator.share({title:p.title,url:p.affiliateLink});
      else await copy(p.affiliateLink,'Product link');
    }catch{/* User dismissed the share sheet. */}
  };
  return <main lang="en" className="mx-auto max-w-[1510px] space-y-5 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#1F6B3A]">HERBAL VITALY / PARTNER OPERATIONS</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#173621] sm:text-3xl">My Product Links</h1>
        <p className="mt-1 text-sm text-slate-500">Find your verified Shopify products, manage your personal links and share them confidently.</p>
      </div>
      <button type="button" onClick={()=>setRefresh(v=>v+1)} disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-[#D9E6DC] bg-white px-4 py-2.5 text-xs font-semibold text-[#1F6B3A] disabled:opacity-50">
        <RefreshCw className="h-4 w-4"/>Refresh Shopify links
      </button>
    </header>
    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {notice&&<p role="status" className="flex items-center gap-2 rounded-lg bg-[#ECF6EF] p-3 text-sm text-[#1F6B3A]">
      <Check className="h-4 w-4"/>{notice}
      <button type="button" aria-label="Dismiss notification" className="ml-auto text-xs underline" onClick={()=>setNotice('')}>Dismiss</button>
    </p>}
    {loading&&<p role="status" className="rounded-xl border bg-white p-7 text-sm text-slate-500">Verifying assigned Shopify products and coupons…</p>}

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {[
        {label:'Active Shopify codes',value:loading?'—':String(coupons.length),icon:Tag},
        {label:'Assigned products',value:loading?'—':String(uniqueProducts),icon:Package},
        {label:'Available links',value:loading?'—':String(allLinks),icon:Link2},
        {label:'Recorded referral clicks',value:insights?String(insights.totals.clicks):'Unavailable',icon:TrendingUp},
        {label:'Attributed Shopify orders',value:insights?String(insights.totals.trackedOrders):'Unavailable',icon:ShoppingCart},
      ].map(item=><div key={item.label} className="rounded-2xl border border-[#E1ECE4] bg-white p-4">
        <div className="flex items-start justify-between gap-2"><span className="text-xs text-slate-600">{item.label}</span>
          <item.icon className="h-4 w-4 shrink-0 text-[#1F6B3A]"/></div>
        <p className="mt-3 text-xl font-semibold text-[#173621] sm:text-2xl">{item.value}</p>
      </div>)}
    </section>

    <section className="rounded-2xl border border-[#E1ECE4] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-[#173621]">Your product sharing kit</h2>
          <p className="mt-1 text-xs text-slate-500">Only verified, active Shopify discount assignments are shown.</p></div>
        <Link href="/affiliate/coupons" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B3A]">
          Manage my coupons <ArrowRight className="h-4 w-4"/></Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <label className="space-y-1 text-xs font-medium text-slate-600"><span>Choose your active promo code</span>
          <select value={selected} onChange={e=>setSelected(e.target.value)} disabled={!coupons.length}
            className="w-full rounded-xl border border-[#D8E6DD] bg-white px-3 py-3 text-sm font-semibold text-[#173621] disabled:opacity-50">
            {!coupons.length&&<option value="">No verified code assigned</option>}
            {coupons.map(c=><option key={c.id} value={c.code}>{c.code} — {c.discountValue}{c.discountType==='PERCENTAGE'?'%':' EGP'} discount</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600"><span>Find an assigned product</span>
          <span className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by product name"
              className="w-full rounded-xl border border-[#D8E6DD] px-3 py-3 pl-10 text-sm outline-[#1F6B3A]"/></span>
        </label>
      </div>
      {selected&&<div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-[#F3F9F5] p-3">
        <CheckCircle2 className="h-4 w-4 text-[#1F6B3A]"/>
        <span className="text-xs text-[#385F42]">Your verified assigned code</span>
        <strong className="font-mono text-sm text-[#173621]">{selected}</strong>
        <button type="button" onClick={()=>copy(selected,'Promo code')}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#C3DACB] bg-white px-3 py-2 text-xs font-semibold text-[#1F6B3A]">
          {copied===selected?<Check className="h-3.5 w-3.5"/>:<Copy className="h-3.5 w-3.5"/>} Copy code
        </button>
      </div>}
    </section>

    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-[#173621]">Eligible products <span className="ml-2 text-sm font-normal text-slate-400">({filtered.length})</span></h2>
      {trackingAvailable&&<span className="rounded-full bg-[#EAF5ED] px-3 py-1 text-xs font-medium text-[#1F6B3A]">Tracked links available</span>}
    </div>
    {filtered.length>0?<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map(p=>{
        const primaryTracked=p.affiliateLink.startsWith('https://partner.herbalvitaly.com/r/');
        return <article key={p.code+'-'+p.handle} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E0EBE4] bg-white shadow-[0_3px_17px_rgba(22,61,37,.03)]">
          <div className="flex h-36 items-center justify-center bg-[#F4F9F5]">
            <div className="flex flex-col items-center gap-2 text-[#1F6B3A]">
              <Package className="h-10 w-10" strokeWidth={1.5}/>
              <span className="text-[10px] uppercase tracking-[.14em]">Verified Shopify product</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <div><h3 className="text-lg font-semibold text-[#173621]">{p.title}</h3>
                <p className="mt-1 text-xs text-slate-500">Official Shopify handle: {p.handle}</p></div>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1F6B3A]"/>
            </div>
            <div className="rounded-xl bg-[#F5FAF6] px-4 py-3 text-xs text-[#486553]">
              <div className="flex items-center justify-between"><span>Personal code</span><strong className="font-mono text-[#173621]">{p.code}</strong></div>
              <div className="mt-2 flex items-center justify-between"><span>Discount</span>
                <strong className="text-[#173621]">{p.discountValue}{p.discountType==='PERCENTAGE'?'%':' EGP'}</strong></div>
              <div className="mt-2 flex items-center justify-between"><span>Shopify price</span><span>View on official store</span></div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#173621]">{primaryTracked?'Your tracked partner link':'Your direct Shopify link'}</p>
              <input type="text" readOnly aria-label={'Personal link for '+p.title} value={p.affiliateLink}
                onFocus={e=>e.target.select()} className="w-full rounded-lg border border-[#DCE9E0] bg-white p-2 text-xs text-slate-600"/>
              <button type="button" onClick={()=>copy(p.affiliateLink,'Product link')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F6B3A] px-4 py-3 text-xs font-semibold text-white">
                {copied===p.affiliateLink?<Check className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}
                {copied===p.affiliateLink?'Copied':'Copy personal product link'}
              </button>
              {p.trackedLink&&<button type="button" onClick={()=>copy(p.trackedLink!,'Tracked link')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#C5DBCB] px-4 py-2.5 text-xs font-semibold text-[#1F6B3A]">
                <Link2 className="h-4 w-4"/>{copied===p.trackedLink?'Tracked link copied':'Copy tracked Refferq link'}
              </button>}
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF2EE] pt-3">
              <a href={p.productUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B3A]">Official product page <ExternalLink className="h-3.5 w-3.5"/></a>
              <button onClick={()=>share(p)} type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B3A]">
                Share <Share2 className="h-3.5 w-3.5"/></button>
            </div>
          </div>
        </article>;
      })}
    </section>:!loading&&<div className="rounded-2xl border border-dashed border-[#C9DDCF] bg-[#F9FBF9] p-12 text-center">
      <Filter className="mx-auto h-9 w-9 text-[#8DAF98]"/>
      <h3 className="mt-3 font-semibold text-[#173621]">No eligible product links found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">If you have no active Shopify code, choose one in My Coupons. Product eligibility is verified before links appear.</p>
      <Link href="/affiliate/coupons" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1F6B3A]">View My Coupons <ArrowRight className="h-4 w-4"/></Link>
    </div>}

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#E0EBE4] bg-white p-5">
        <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#1F6B3A]"/>
          <h3 className="font-semibold text-[#173621]">Partner performance — 30 days</h3></div>
        <div className="mt-4 flex justify-between gap-3 text-sm"><span className="text-slate-600">Attributed order value</span>
          <strong className="text-[#173621]">{insights?money(insights.totals.orderValueEGP):'Unavailable'}</strong></div>
        <p className="mt-3 text-xs leading-6 text-slate-500">Overall partner totals, not product-specific statistics. Product-level clicks, conversions and prices are not provided by the verified coupon API.</p>
      </div>
      <div className="rounded-2xl border border-[#E0EBE4] bg-white p-5">
        <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-[#1F6B3A]"/>
          <h3 className="font-semibold text-[#173621]">How affiliate tracking works</h3></div>
        <p className="mt-3 text-sm leading-7 text-slate-600">Direct Shopify links can attribute a purchase through your verified discount code, but do not automatically record a Refferq click. Tracked Refferq redirects record clicks before the customer reaches Shopify.</p>
        <Link href="/affiliate/orders" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F6B3A]">Track attributed orders <ArrowRight className="h-4 w-4"/></Link>
      </div>
    </section>
  </main>;
}
