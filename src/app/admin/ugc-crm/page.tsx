'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ClipboardCopy, Download, ExternalLink, FileSpreadsheet, FilterX, MessageCircle, Package, Plus, RefreshCw, Search, Star, Truck, Users, Video, Wallet } from 'lucide-react';

type Contact = {
  id:string; externalId:string|null; name:string; socialUrl:string|null; phone:string|null;
  contactStatus:string; acceptance:string; qualification:string; kind:string;
  priority:number; budgetEGP:number|null; contentUrl:string|null; product:string|null;
  videoConcept:string|null; contentStatus:string; notes:string|null;
  affiliateId:string|null; nextFollowUpAt:string|null; updatedAt:string;
  _count?:{shipments:number};
};
type Shipment = {
  id:string; contactId:string|null; trackingNumber:string|null; recipientName:string;
  phone:string|null; governorate:string|null; district:string|null; deliveryStatus:string;
  deliveryType:string|null; collectionType:string; amountEGP:number|null; capturedAt:string|null;
  source:string|null; notes:string|null; contact?:{id:string;externalId:string|null;name:string}|null;
};
type PartnerOption={id:string;name:string;code:string};
const status=['NEW','CONTACTED','IN_PROGRESS','PREPARING','VALIDATED','COMPLETED','DECLINED'];
const kinds=['UGC','AFFILIATE','BOTH'];
const qualifications=['UNREVIEWED','QUALIFIED','DISQUALIFIED'];
const acceptances=['PENDING','YES','NO'];
const contentStages=['IDEA','SCRIPT','FILMING','REVIEW','APPROVED','PUBLISHED'];
const shipmentStages=['UNKNOWN','PREPARING','SHIPPED','IN_TRANSIT','DELIVERED','FAILED','RETURNED','CANCELLED'];
const baseContact={
  externalId:'',name:'',socialUrl:'',phone:'',contactStatus:'NEW',
  acceptance:'PENDING',qualification:'UNREVIEWED',kind:'UGC',priority:3,
  budgetEGP:'',contentUrl:'',product:'',videoConcept:'',contentStatus:'IDEA',
  notes:'',affiliateId:'',nextFollowUpAt:'',
};
const baseShipment={
  contactId:'',trackingNumber:'',recipientName:'',phone:'',governorate:'',district:'',
  deliveryStatus:'UNKNOWN',deliveryType:'Small parcel',collectionType:'NO_COLLECTION',
  amountEGP:'',capturedAt:'',source:'',notes:'',
};
const control='mt-1 w-full rounded-lg border border-[#DCE8DF] bg-white px-3 py-2 text-sm text-[#173321] outline-none focus:border-[#1F6B3A]';
const smallButton='rounded-lg border border-[#DCE8DF] px-3 py-2 text-xs font-semibold text-[#1F6B3A] hover:bg-[#F1F8F3]';
const display = (v: string|null|undefined) => v || '—';
const date = (v:string|null|undefined) => v ? new Date(v).toLocaleDateString('en-GB') : '—';
const money=(v:number|null|undefined)=>v == null?'—':new Intl.NumberFormat('en-EG',{style:'currency',currency:'EGP',maximumFractionDigits:0}).format(v);
function csvSafe(x: unknown) {
  const s=String(x ?? '');
  const safe=/^[\s]*[=+@-]/.test(s)?"'"+s:s;
  return '"'+safe.replaceAll('"','""')+'"';
}
function exportCsv(filename:string, rows:(string|number|null|undefined)[][]) {
  const csv='\ufeff'+rows.map(r=>r.map(csvSafe).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
const slugLabel=(s:string)=>s.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const badge=(v:string) => ({
  QUALIFIED:'bg-green-50 text-green-700', YES:'bg-green-50 text-green-700', DELIVERED:'bg-green-50 text-green-700', PUBLISHED:'bg-green-50 text-green-700',
  DECLINED:'bg-rose-50 text-rose-700',DISQUALIFIED:'bg-rose-50 text-rose-700',FAILED:'bg-rose-50 text-rose-700',RETURNED:'bg-rose-50 text-rose-700',
  PREPARING:'bg-amber-50 text-amber-800',IN_PROGRESS:'bg-amber-50 text-amber-800',REVIEW:'bg-amber-50 text-amber-800',
}[v]||'bg-slate-100 text-slate-700');
function Input({label,value,onChange,type='text',placeholder='',span=false}:{
  label:string;value:string|number;onChange:(v:string)=>void;type?:string;placeholder?:string;span?:boolean;
}){return <label className={span?'md:col-span-2':''}><span className="text-xs font-semibold text-slate-600">{label}</span><input type={type} className={control} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>}
function Pick({label,value,values,onChange}:{
  label:string;value:string;values:string[];onChange:(v:string)=>void;
}){return <label><span className="text-xs font-semibold text-slate-600">{label}</span><select className={control} value={value} onChange={e=>onChange(e.target.value)}>{values.map(v=><option key={v} value={v}>{slugLabel(v)}</option>)}</select></label>}
function Kpi({title,value,icon:Icon}:{title:string;value:string;icon:typeof Users}){
  return <div className="rounded-xl border border-[#E5ECE8] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">{title}</p><Icon className="h-4 w-4 text-[#1F6B3A]"/></div><p className="mt-2 text-2xl font-bold text-[#193D25]">{value}</p></div>;
}
export default function PartnerCrmPage(){
  const [tab,setTab]=useState<'contacts'|'shipments'>('contacts');
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [shipments,setShipments]=useState<Shipment[]>([]);
  const [partners,setPartners]=useState<PartnerOption[]>([]);
  const [query,setQuery]=useState('');
  const [kindFilter,setKindFilter]=useState('ALL');
  const [statusFilter,setStatusFilter]=useState('ALL');
  const [productFilter,setProductFilter]=useState('ALL');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [editor,setEditor]=useState<'contact'|'shipment'|null>(null);
  const [cform,setCform]=useState({...baseContact});
  const [sform,setSform]=useState({...baseShipment});
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    Promise.all([
      fetch('/api/admin/ugc-crm',{cache:'no-store'}).then(r=>r.json().then(x=>({ok:r.ok,...x}))),
      fetch('/api/admin/ugc-crm/shipments',{cache:'no-store'}).then(r=>r.json().then(x=>({ok:r.ok,...x}))),
      fetch('/api/admin/affiliates',{cache:'no-store'}).then(r=>r.json().then(x=>({ok:r.ok,...x})))
    ]).then(([a,b,c])=>{
      if(!active)return;
      if(!a.ok||!b.ok){setError(a.error||b.error||'Creator CRM is not available yet.');return;}
      setContacts(a.contacts||[]);setShipments(b.shipments||[]);
      setPartners(c.ok?(c.affiliates||[]).filter((p:{user:{status:string;emailVerifiedAt?:string|null}})=>p.user.status==='ACTIVE'&&!!p.user.emailVerifiedAt)
        .map((p:{id:string;referralCode:string;user:{name:string}})=>({id:p.id,code:p.referralCode,name:p.user.name})):[]);
    }).catch(e=>{if(active)setError(e.message||'Unable to load CRM');}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[version]);
  const products=useMemo(()=>[...new Set(contacts.flatMap(c=>(c.product||'').split(',').map(s=>s.trim()).filter(Boolean)))].sort(),[contacts]);
  const filtered=useMemo(()=>contacts.filter(c=>(kindFilter==='ALL'||c.kind===kindFilter)&&
    (statusFilter==='ALL'||c.contactStatus===statusFilter)&&
    (productFilter==='ALL'||(c.product||'').toLowerCase().includes(productFilter.toLowerCase()))&&
    [c.externalId,c.name,c.socialUrl,c.phone,c.product,c.videoConcept,c.notes].some(x=>(x||'').toLowerCase().includes(query.toLowerCase()))),[contacts,query,kindFilter,statusFilter,productFilter]);
  const filteredShipments=useMemo(()=>shipments.filter(s=>[s.trackingNumber,s.recipientName,s.phone,s.governorate,s.district,s.contact?.name].some(v=>(v||'').toLowerCase().includes(query.toLowerCase()))),[shipments,query]);
  const stats={total:contacts.length,accepted:contacts.filter(x=>x.acceptance==='YES').length,
    qualified:contacts.filter(x=>x.qualification==='QUALIFIED').length,
    active:contacts.filter(x=>['IN_PROGRESS','PREPARING'].includes(x.contactStatus)).length,
    budget:contacts.reduce((n,x)=>n+(x.budgetEGP||0),0)};
  const openContact=(c?:Contact)=>{setEditing(c?.id||null);setCform(c?{
    externalId:c.externalId||'',name:c.name,socialUrl:c.socialUrl||'',phone:c.phone||'',
    contactStatus:c.contactStatus,acceptance:c.acceptance,qualification:c.qualification,kind:c.kind,priority:c.priority,
    budgetEGP:c.budgetEGP==null?'':String(c.budgetEGP),contentUrl:c.contentUrl||'',product:c.product||'',
    videoConcept:c.videoConcept||'',contentStatus:c.contentStatus,notes:c.notes||'',affiliateId:c.affiliateId||'',
    nextFollowUpAt:c.nextFollowUpAt?new Date(c.nextFollowUpAt).toISOString().slice(0,10):'',
  }:{...baseContact});setEditor('contact');setError('');setNotice('')};
  const openShipment=(s?:Shipment)=>{setEditing(s?.id||null);setSform(s?{
    contactId:s.contactId||'',trackingNumber:s.trackingNumber||'',recipientName:s.recipientName,phone:s.phone||'',
    governorate:s.governorate||'',district:s.district||'',deliveryStatus:s.deliveryStatus,
    deliveryType:s.deliveryType||'',collectionType:s.collectionType,amountEGP:s.amountEGP==null?'':String(s.amountEGP),
    capturedAt:s.capturedAt?new Date(s.capturedAt).toISOString().slice(0,10):'',source:s.source||'',notes:s.notes||'',
  }:{...baseShipment});setEditor('shipment');setError('');setNotice('')};
  const save=async()=>{
    if(!editor)return;
    setBusy(true);setError('');
    const path=editor==='contact'?'/api/admin/ugc-crm':'/api/admin/ugc-crm/shipments';
    const base=editor==='contact'?cform:sform;
    const body={...base,...(editing?{id:editing}:{}),
      ...(editor==='contact'?{budgetEGP:cform.budgetEGP===''?null:Number(cform.budgetEGP),
        priority:Number(cform.priority),affiliateId:cform.affiliateId||null,nextFollowUpAt:cform.nextFollowUpAt||null}
        :{amountEGP:sform.amountEGP===''?null:Number(sform.amountEGP),
          contactId:sform.contactId||null,capturedAt:sform.capturedAt||null})};
    try{
      const r=await fetch(path,{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await r.json();
      if(!r.ok||!data.success)throw new Error(data.error||'Cannot save record');
      setEditor(null);setNotice(editing?'Record updated successfully.':'Record created successfully.');setVersion(v=>v+1);
    }catch(e){setError(e instanceof Error?e.message:'Save failed')}finally{setBusy(false)}
  };
  const exportContacts=()=>exportCsv('herbal-vitaly-creator-crm.csv',[
    ['ID','Social Link','Partner Name','Phone','Contacted','Accepted','HV CC','Budget EGP','Importance','UGC / Affiliate','Qualified','Product','Video Concepts','Note','Content Status','Follow-up','Affiliate ID'],
    ...filtered.map(c=>[c.externalId,c.socialUrl,c.name,c.phone,c.contactStatus,c.acceptance,c.contentUrl,c.budgetEGP,c.priority,c.kind,c.qualification,c.product,c.videoConcept,c.notes,c.contentStatus,c.nextFollowUpAt,c.affiliateId])
  ]);
  const exportShipments=()=>exportCsv('herbal-vitaly-ugc-shipments.csv',[
    ['Bosta Tracking','Client','Phone','Governorate','Zone','Status','Delivery Type','Collection','Amount EGP','Capture Date','Source','Observations','CRM Contact ID'],
    ...filteredShipments.map(s=>[s.trackingNumber,s.recipientName,s.phone,s.governorate,s.district,s.deliveryStatus,s.deliveryType,s.collectionType,s.amountEGP,s.capturedAt,s.source,s.notes,s.contact?.externalId])
  ]);
  const copyLink=async(text:string)=>{try{await navigator.clipboard.writeText(text);setNotice('Link copied');}catch{setError('Copy failed')}};
  return <main className="space-y-5 pb-12">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#1F6B3A]">Herbal Vitaly · Creator Operations</p>
        <h1 className="mt-1 text-2xl font-bold text-[#193D25]">Partner CRM & UGC Management</h1>
        <p className="mt-1 text-sm text-slate-500">Track creators, affiliate prospects, video production and product samples. Separate from COD sales and payouts.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={smallButton} onClick={()=>setVersion(x=>x+1)}><RefreshCw className="mr-1 inline h-4 w-4"/>Refresh</button>
        <button type="button" className={smallButton} disabled={loading} onClick={()=>tab==='contacts'?exportContacts():exportShipments()}><Download className="mr-1 inline h-4 w-4"/>Export CSV</button>
        <button type="button" onClick={()=>tab==='contacts'?openContact():openShipment()} className="rounded-lg bg-[#1F6B3A] px-4 py-2 text-sm font-bold text-white"><Plus className="mr-1 inline h-4 w-4"/> {tab==='contacts'?'Add creator':'Add shipment'}</button>
      </div>
    </header>
    {notice&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {error&&!editor&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi title="Creator records" value={String(stats.total)} icon={Users}/>
      <Kpi title="Accepted" value={String(stats.accepted)} icon={Users}/>
      <Kpi title="Qualified" value={String(stats.qualified)} icon={Star}/>
      <Kpi title="In progress" value={String(stats.active)} icon={Video}/>
      <Kpi title="Budget estimate" value={money(stats.budget)} icon={Wallet}/>
    </div>
    <div className="rounded-2xl border border-[#E5ECE8] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" onClick={()=>setTab('contacts')} className={'rounded-lg px-4 py-2 text-sm font-semibold '+(tab==='contacts'?'bg-[#1F6B3A] text-white':'bg-[#F2F8F3] text-[#1F6B3A]')}><Users className="mr-1 inline h-4 w-4"/>Creator Pipeline ({contacts.length})</button>
          <button type="button" onClick={()=>setTab('shipments')} className={'rounded-lg px-4 py-2 text-sm font-semibold '+(tab==='shipments'?'bg-[#1F6B3A] text-white':'bg-[#F2F8F3] text-[#1F6B3A]')}><Truck className="mr-1 inline h-4 w-4"/>Sample Deliveries ({shipments.length})</button>
        </div>
        <span className="text-xs text-slate-500">Private admin workspace · EGP</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="relative min-w-[210px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tab==='contacts'?'Search name, phone, profile, product…':'Search tracking, recipient, district…'}/></label>
        {tab==='contacts'&&<>
          <select aria-label="Creator type filter" className="rounded-lg border bg-white px-3 py-2 text-sm" value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="ALL">All creator types</option>{kinds.map(x=><option key={x} value={x}>{slugLabel(x)}</option>)}</select>
          <select aria-label="Pipeline status filter" className="rounded-lg border bg-white px-3 py-2 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">All pipeline stages</option>{status.map(x=><option key={x} value={x}>{slugLabel(x)}</option>)}</select>
          <select aria-label="Product filter" className="rounded-lg border bg-white px-3 py-2 text-sm" value={productFilter} onChange={e=>setProductFilter(e.target.value)}><option value="ALL">All products</option>{products.map(x=><option key={x}>{x}</option>)}</select>
        </>}
        <button type="button" className={smallButton} onClick={()=>{setQuery('');setKindFilter('ALL');setStatusFilter('ALL');setProductFilter('ALL')}}><FilterX className="mr-1 inline h-4 w-4"/>Clear</button>
      </div>
      {loading?<p className="p-10 text-center text-sm text-slate-500">Loading CRM records…</p>:
      tab==='contacts'?<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="bg-[#F5FAF6] text-xs text-slate-600"><tr>{['ID / Partner','Social profile','Contact','Accepted','Type','Priority','Budget','Product / Concept','Content','Next follow-up','Actions'].map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#E6EBE7]">{filtered.map(c=><tr key={c.id} className="hover:bg-[#FAFCFB]">
          <td className="px-3 py-3"><p className="font-bold text-[#1B4328]">{c.name}</p><p className="font-mono text-xs text-slate-400">{display(c.externalId)}</p></td>
          <td className="px-3 py-3">{c.socialUrl?<a href={c.socialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex gap-1 text-[#1F6B3A] underline">Profile <ExternalLink className="h-3 w-3"/></a>:'—'}</td>
          <td className="px-3 py-3"><span className={'rounded-md px-2 py-1 text-xs '+badge(c.contactStatus)}>{slugLabel(c.contactStatus)}</span><p className="mt-1 text-xs text-slate-500">{display(c.phone)}</p></td>
          <td className="px-3 py-3"><span className={'rounded-md px-2 py-1 text-xs '+badge(c.acceptance)}>{slugLabel(c.acceptance)}</span><p className="mt-2 text-xs">{slugLabel(c.qualification)}</p></td>
          <td className="px-3 py-3">{slugLabel(c.kind)}</td>
          <td className="whitespace-nowrap px-3 py-3 text-amber-500">{'★'.repeat(c.priority)}<span className="text-slate-200">{'★'.repeat(5-c.priority)}</span></td>
          <td className="px-3 py-3">{money(c.budgetEGP)}</td>
          <td className="px-3 py-3"><p className="font-medium">{display(c.product)}</p><p className="max-w-[170px] truncate text-xs text-slate-500">{display(c.videoConcept)}</p></td>
          <td className="px-3 py-3"><span className={'rounded-md px-2 py-1 text-xs '+badge(c.contentStatus)}>{slugLabel(c.contentStatus)}</span>{c.contentUrl&&<a className="mt-2 block text-xs text-[#1F6B3A] underline" href={c.contentUrl} target="_blank" rel="noopener noreferrer">View content</a>}</td>
          <td className="whitespace-nowrap px-3 py-3 text-xs">{date(c.nextFollowUpAt)}</td>
          <td className="px-3 py-3"><div className="flex flex-wrap gap-1"><button type="button" className={smallButton} onClick={()=>openContact(c)}>Edit</button>{c.phone&&<a target="_blank" rel="noopener noreferrer" title="Open WhatsApp" href={'https://wa.me/'+c.phone.replace(/\D/g,'')} className={smallButton}><MessageCircle className="h-3.5 w-3.5"/></a>}{c.contentUrl&&<button type="button" title="Copy content URL" className={smallButton} onClick={()=>copyLink(c.contentUrl!)}><ClipboardCopy className="h-3.5 w-3.5"/></button>}</div></td>
        </tr>)}</tbody>
      </table>{!filtered.length&&<p className="p-8 text-center text-sm text-slate-500">No creators match these filters. Add a creator or adjust your search.</p>}
      <p className="mt-3 text-xs text-slate-400">{filtered.length} creator records · Original Excel columns preserved with additional content and follow-up tracking.</p></div>:
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-[#F5FAF6] text-xs text-slate-600"><tr>{['Bosta tracking','Creator / Recipient','Phone','Governorate / Area','Delivery status','Shipment type','Collection','Capture date','Source','Actions'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead>
        <tbody className="divide-y">{filteredShipments.map(s=><tr key={s.id}>
          <td className="p-3 font-mono text-xs">{display(s.trackingNumber)}</td>
          <td className="p-3"><p className="font-medium">{s.recipientName}</p><p className="text-xs text-slate-500">{s.contact?.name||'Unlinked creator'}</p></td>
          <td className="p-3 text-xs">{display(s.phone)}</td><td className="p-3 text-xs">{display(s.governorate)} · {display(s.district)}</td>
          <td className="p-3"><span className={'rounded-md px-2 py-1 text-xs '+badge(s.deliveryStatus)}>{slugLabel(s.deliveryStatus)}</span></td>
          <td className="p-3 text-xs">{display(s.deliveryType)}</td>
          <td className="p-3 text-xs">{slugLabel(s.collectionType)} {s.amountEGP!==null&&money(s.amountEGP)}</td>
          <td className="p-3 text-xs">{date(s.capturedAt)}</td><td className="p-3 text-xs">{display(s.source)}</td>
          <td className="p-3"><button type="button" onClick={()=>openShipment(s)} className={smallButton}>Edit</button></td>
        </tr>)}</tbody>
      </table>{!filteredShipments.length&&<p className="p-8 text-center text-sm text-slate-500">No delivery records yet. Add product sample shipments from Bosta.</p>}
      <p className="mt-3 text-xs text-slate-500">UGC sample shipments are tracked separately and do not validate orders, commissions or COD payments.</p></div>}
    </div>
    {editor&&<div className="fixed inset-0 z-[80] overflow-y-auto bg-black/45 p-3 md:p-8" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEditor(null)}}>
      <div role="dialog" aria-modal="true" aria-label={editor==='contact'?'Creator details':'Shipment details'} className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-[#1F6B3A]">{editor==='contact'?'Creator / Partner record':'UGC sample shipment'}</h2><p className="text-xs text-slate-500">{editing?'Edit existing record':'Create new record'}</p></div>
          <button type="button" disabled={busy} onClick={()=>setEditor(null)} className={smallButton}>Close</button></div>
        {error&&<p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {editor==='contact'?<div className="grid gap-3 md:grid-cols-2">
          <Input label="Excel ID (UGC01)" value={cform.externalId} onChange={v=>setCform({...cform,externalId:v})}/>
          <Input label="Partner name *" value={cform.name} onChange={v=>setCform({...cform,name:v})}/>
          <Input label="Social profile HTTPS URL" value={cform.socialUrl} onChange={v=>setCform({...cform,socialUrl:v})} span/>
          <Input label="Phone / WhatsApp" value={cform.phone} onChange={v=>setCform({...cform,phone:v})}/>
          <Pick label="Contact status" value={cform.contactStatus} values={status} onChange={v=>setCform({...cform,contactStatus:v})}/>
          <Pick label="Accepted?" value={cform.acceptance} values={acceptances} onChange={v=>setCform({...cform,acceptance:v})}/>
          <Pick label="Qualification" value={cform.qualification} values={qualifications} onChange={v=>setCform({...cform,qualification:v})}/>
          <Pick label="UGC / Affiliate" value={cform.kind} values={kinds} onChange={v=>setCform({...cform,kind:v})}/>
          <Pick label="Content production" value={cform.contentStatus} values={contentStages} onChange={v=>setCform({...cform,contentStatus:v})}/>
          <label><span className="text-xs font-semibold text-slate-600">Importance</span><select className={control} value={cform.priority} onChange={e=>setCform({...cform,priority:Number(e.target.value)})}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{'★'.repeat(n)} ({n}/5)</option>)}</select></label>
          <Input label="Budget (EGP)" type="number" value={cform.budgetEGP} onChange={v=>setCform({...cform,budgetEGP:v})}/>
          <Input label="Product(s)" value={cform.product} onChange={v=>setCform({...cform,product:v})} placeholder="Tiynefret, Ushabti"/>
          <Input label="Video concepts" value={cform.videoConcept} onChange={v=>setCform({...cform,videoConcept:v})}/>
          <Input label="HV CC — Content URL" value={cform.contentUrl} onChange={v=>setCform({...cform,contentUrl:v})}/>
          <Input label="Next follow-up" type="date" value={cform.nextFollowUpAt} onChange={v=>setCform({...cform,nextFollowUpAt:v})}/>
          <label><span className="text-xs font-semibold text-slate-600">Link to approved Refferq affiliate (optional)</span><select className={control} value={cform.affiliateId} onChange={e=>setCform({...cform,affiliateId:e.target.value})}><option value="">Not linked</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name} — {p.code}</option>)}</select></label>
          <label className="md:col-span-2"><span className="text-xs font-semibold text-slate-600">Internal notes</span><textarea className={control} rows={3} value={cform.notes} onChange={e=>setCform({...cform,notes:e.target.value})}/></label>
        </div>:<div className="grid gap-3 md:grid-cols-2">
          <Input label="Bosta tracking number" value={sform.trackingNumber} onChange={v=>setSform({...sform,trackingNumber:v})}/>
          <Input label="Recipient name *" value={sform.recipientName} onChange={v=>setSform({...sform,recipientName:v})}/>
          <label><span className="text-xs font-semibold text-slate-600">Link to creator record</span><select className={control} value={sform.contactId} onChange={e=>setSform({...sform,contactId:e.target.value})}><option value="">Not linked</option>{contacts.map(c=><option value={c.id} key={c.id}>{c.name} {c.externalId?'('+c.externalId+')':''}</option>)}</select></label>
          <Input label="Phone" value={sform.phone} onChange={v=>setSform({...sform,phone:v})}/>
          <Input label="Governorate" value={sform.governorate} onChange={v=>setSform({...sform,governorate:v})}/>
          <Input label="District / Area" value={sform.district} onChange={v=>setSform({...sform,district:v})}/>
          <Pick label="Delivery status" value={sform.deliveryStatus} values={shipmentStages} onChange={v=>setSform({...sform,deliveryStatus:v})}/>
          <Input label="Delivery type" value={sform.deliveryType} onChange={v=>setSform({...sform,deliveryType:v})}/>
          <Pick label="Collection" value={sform.collectionType} values={['NO_COLLECTION','COD','PREPAID']} onChange={v=>setSform({...sform,collectionType:v})}/>
          <Input label="Amount visible (EGP)" type="number" value={sform.amountEGP} onChange={v=>setSform({...sform,amountEGP:v})}/>
          <Input label="Capture date" type="date" value={sform.capturedAt} onChange={v=>setSform({...sform,capturedAt:v})}/>
          <Input label="Visual source" value={sform.source} onChange={v=>setSform({...sform,source:v})}/>
          <label className="md:col-span-2"><span className="text-xs font-semibold text-slate-600">Observations</span><textarea rows={3} className={control} value={sform.notes} onChange={e=>setSform({...sform,notes:e.target.value})}/></label>
        </div>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} className={smallButton} onClick={()=>setEditor(null)}>Cancel</button><button type="button" disabled={busy} onClick={save} className="rounded-lg bg-[#1F6B3A] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'Saving…':'Save record'}</button></div>
      </div>
    </div>}
  </main>;
}
