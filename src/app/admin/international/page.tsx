'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, FileText, FileCheck2, ShoppingBag, Wallet, Plus, RefreshCw, Printer, AlertTriangle, Globe2, BadgeDollarSign } from 'lucide-react';

type Client={id:string;display_name:string;legal_name:string;country:string;address:string;registration_no?:string;contact_email?:string};
type Product={sku:string;product_name:string;unit_price_cents:number;active:boolean};
type Contract={id:string;client_id:string;client_name:string;reference:string;title:string;effective_date:string;expiry_date:string;status:string;document_url?:string};
type Quote={id:string;client_id:string;client_name:string;reference:string;issued_at:string;valid_until:string;status:string;total_cents:number;notes?:string};
type QuoteLine={id:string;quote_id:string;sku:string;quantity:number;unit_price_cents:number;line_total_cents:number};
type Order={id:string;client_id:string;client_name:string;quote_id:string;reference:string;order_status:string;total_cents:number;paid_cents:number;created_at:string};
type Rule={id:string;client_name:string;client_id:string;agent_name:string;rate_cents:number;active:boolean};
type Commission={id:string;order_reference:string;agent_name:string;eligible_quantity:number;rate_cents:number;amount_cents:number;status:string;payout_reference?:string};
type Payment={id:string;order_id:string;amount_cents:number;reference:string;paid_at:string};
type Data={success:true;clients:Client[];products:Product[];contracts:Contract[];quotes:Quote[];quoteLines:QuoteLine[];orders:Order[];rules:Rule[];commissions:Commission[];payments:Payment[]};
type Tab='overview'|'clients'|'contracts'|'quotes'|'orders'|'commissions';

const price=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(n)||0)/100);
const isoDay=(d:string)=>d?.slice(0,10)||'';
const today=()=>new Date().toISOString().slice(0,10);
const inDays=(days:number)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
function formValues(form:HTMLFormElement){
 const d=new FormData(form),entries=Object.fromEntries(d.entries());
 return entries as Record<string,string>;
}
function usdCents(v:string){
 if(!/^\d+(?:\.\d{1,2})?$/.test(v.trim()))throw new Error('Enter USD with up to two decimal places');
 const [whole,fraction='']=v.trim().split('.');
 const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n<=0)throw new Error('Enter a positive valid USD amount');
 return n;
}
const tone=(status:string)=> status==='PAID'||status==='ACTIVE'||status==='ACCEPTED'
 ? 'bg-emerald-50 text-emerald-700'
 : status==='REJECTED'||status==='CANCELLED'||status==='VOID'||status==='TERMINATED'
 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700';
function Status({value}:{value:string}){return <span className={'rounded-full px-2 py-1 text-[11px] font-semibold '+tone(value)}>{value.replaceAll('_',' ')}</span>;}
const control='w-full rounded-xl border border-[#DCE8DF] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#1F6B3A]';
const button='inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F6B3A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#17532D] disabled:cursor-not-allowed disabled:opacity-50';
const light='inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#DCE8DF] bg-white px-3 py-2 text-xs font-semibold text-[#1F6B3A] hover:bg-[#F3F8F4] disabled:opacity-40';
const card='rounded-2xl border border-[#E3EBE5] bg-white p-5 shadow-sm';
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-1.5 text-xs font-semibold text-slate-600"><span>{label}</span>{children}</label>;}
function Empty({text}:{text:string}){return <div className="rounded-xl border border-dashed p-7 text-center text-sm text-slate-500">{text}</div>;}

export default function InternationalSalesPage(){
 const [data,setData]=useState<Data|null>(null);
 const [tab,setTab]=useState<Tab>('overview');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const [quoteClient,setQuoteClient]=useState('');
 const [contractClient,setContractClient]=useState('');
 const [ruleClient,setRuleClient]=useState('');
 const [paymentOrder,setPaymentOrder]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/admin/international',{cache:'no-store'});
   const body=await response.json();
   if(!response.ok||!body.success)throw new Error(body.error||'Unable to load International Sales');
   setData(body);
  }catch(e){setData(null);setError(e instanceof Error?e.message:'Unable to load module');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const submit=async(action:string,payload:Record<string,unknown>)=>{
  setBusy(true);setMessage('');setError('');
  try{
   const response=await fetch('/api/admin/international',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
   const result=await response.json();
   if(!response.ok||!result.success)throw new Error(result.error||'Operation failed');
   setMessage('Saved successfully'+(result.reference?' · '+result.reference:''));
   await load();
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Unable to save');return false;}
  finally{setBusy(false);}
 };
 const quotes=data?.quotes||[],orders=data?.orders||[],commissions=data?.commissions||[];
 const totalQuoted=quotes.reduce((s,q)=>s+q.total_cents,0);
 const collected=orders.reduce((s,o)=>s+o.paid_cents,0);
 const pendingCommissions=commissions.filter(c=>c.status==='PENDING').reduce((s,c)=>s+c.amount_cents,0);
 const quoteRows=useMemo(()=>data?.products.filter(p=>p.active).map(p=>({...p,quantity:quantities[p.sku]||0})).filter(p=>p.quantity>0)||[],[data?.products,quantities]);
 const quoteTotal=quoteRows.reduce((s,p)=>s+p.quantity*p.unit_price_cents,0);
 const nav:Array<{key:Tab;label:string;icon:typeof Globe2}>= [
  {key:'overview',label:'Overview',icon:Globe2},{key:'clients',label:'Distributors',icon:Building2},
  {key:'contracts',label:'Contracts',icon:FileCheck2},{key:'quotes',label:'Quotations',icon:FileText},
  {key:'orders',label:'Orders & payments',icon:ShoppingBag},{key:'commissions',label:'Commissions',icon:BadgeDollarSign},
 ];
 function printQuote(q:Quote){
  if(!data)return;
  const client=data.clients.find(c=>c.id===q.client_id);
  const lines=data.quoteLines.filter(l=>l.quote_id===q.id);
  const html='<!doctype html><html><head><meta charset="utf-8"/><title>'+esc(q.reference)+'</title>'+
   '<style>@page{size:A4;margin:18mm 16mm}body{font-family:Arial,sans-serif;color:#193524;margin:0;font-size:12px}h1{font-size:23px;margin:28px 0 6px;color:#1F6B3A}.head{text-align:center;border-bottom:2px solid #1F6B3A;padding-bottom:18px}.brand{font-size:29px;font-weight:bold;color:#1F6B3A}.small{color:#64796A;font-size:11px}.grid{display:flex;justify-content:space-between;gap:25px;margin:22px 0}.grid>div{width:48%}.section{border-top:1px solid #B9D1C0;padding-top:9px}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#1F6B3A;color:#fff;text-align:left;padding:11px}td{padding:11px;border-bottom:1px solid #E4EBE6}.total{font-size:18px;text-align:right;margin-top:20px;font-weight:700}.foot{position:fixed;bottom:0;width:100%;border-top:1px solid #1F6B3A;padding-top:9px;text-align:center;color:#56705D;font-size:10px}.stamp{margin-top:65px;color:#718276}.no-print{position:fixed;top:8px;right:8px;background:#1F6B3A;color:white;border:0;border-radius:7px;padding:10px 16px;font-weight:700;cursor:pointer}@media print{.no-print{display:none}}</style>'+
   '</head><body><button class="no-print" onclick="window.print()">Print / Save as PDF</button>'+
   '<div class="head"><img src="https://cdn.shopify.com/s/files/1/1003/9420/5506/files/herbal-vitaly-affiliate-official-logo.png?v=1793365508" alt="Herbal Vitaly" style="display:block;width:145px;max-height:74px;object-fit:contain;margin:0 auto 6px" /><div class="brand">Herbal Vitaly</div><div class="small">Let nature be your medicine</div></div>'+
   '<h1>COMMERCIAL QUOTATION</h1><div class="small">Reference: '+esc(q.reference)+' &nbsp; | &nbsp; Date: '+esc(isoDay(q.issued_at))+' &nbsp; | &nbsp; Valid until: '+esc(isoDay(q.valid_until))+'</div>'+
   '<div class="grid"><div><b>ISSUED BY / SUPPLIER</b><p>HERBAL VITALY<br/>53 Capital Mall, Behind the Court<br/>New Cairo, Egypt<br/>Tax ID: 761-271-945<br/>contact@herbalvitaly.com</p></div>'+
   '<div><b>PREPARED FOR / CLIENT</b><p>'+esc(client?.legal_name||q.client_name)+'<br/>'+esc(client?.address||'').replace(/\n/g,'<br/>')+'<br/>'+esc(client?.country||'')+'</p></div></div>'+
   '<div class="section">We are pleased to present our commercial quotation for your review and consideration. Prices in USD.</div>'+
   '<table><thead><tr><th>No.</th><th>Product</th><th>Quantity</th><th>Unit price</th><th>Total (USD)</th></tr></thead><tbody>'+
   lines.map((l,i)=>'<tr><td>'+String(i+1)+'</td><td>'+esc(data.products.find(p=>p.sku===l.sku)?.product_name||l.sku)+'</td><td>'+String(l.quantity)+'</td><td>'+price(l.unit_price_cents)+'</td><td>'+price(l.line_total_cents)+'</td></tr>').join('')+'</tbody></table>'+
   '<div class="total">TOTAL: '+price(q.total_cents)+'</div>'+
   '<p style="margin-top:30px">Currency: USD. Incoterms, delivery, payment and export documents shall be confirmed in the accepted purchase order. This is a quotation, not an invoice or proof of payment.</p>'+
   '<div class="stamp">For and on behalf of Herbal Vitaly &nbsp;&nbsp;&nbsp;&nbsp; Authorized signature / company stamp: __________________</div>'+
   '<div class="foot">Herbal Vitaly &nbsp; • &nbsp; www.herbalvitaly.com &nbsp; • &nbsp; contact@herbalvitaly.com &nbsp; • &nbsp; +20 10 08518148</div></body></html>';
  const win=window.open('','_blank','width=850,height=1100');
  if(!win){setError('Allow popups to print the quotation');return;}
  win.document.open();win.document.write(html);win.document.close();
 }
 return <main lang="en" className="space-y-5 pb-12">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B3A]">Herbal Vitaly · Export operations</p>
    <h1 className="mt-1 text-2xl font-bold text-[#173621]">International Sales</h1>
    <p className="mt-1 max-w-3xl text-sm text-slate-500">Distributors, contracts, automatic USD quotations, confirmed orders, verified receipts and commission control — separate from Shopify affiliate accounting.</p>
   </div>
   <button className={light} onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>Refresh</button>
  </header>
  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
   <AlertTriangle className="mr-2 inline h-4 w-4"/> International commissions are not affiliate commissions. Only fully paid orders accrue commissions, subject to manual approval and payment evidence. No bank transfer is automated.
  </div>
  {message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
  {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
  {loading&&<p role="status" className={card}>Loading International Sales records...</p>}
  {!data&&!loading&&<section className={card}><h2 className="font-semibold">Module setup required</h2><p className="mt-2 text-sm text-slate-600">The preview database must have the isolated international sales SQL migration installed before this module can be used. No production data has been changed.</p></section>}
  {data&&<>
   <nav aria-label="International sales modules" className="flex flex-wrap gap-1.5 rounded-2xl border bg-white p-2">
    {nav.map(n=><button type="button" key={n.key} onClick={()=>setTab(n.key)} className={'flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition '+(tab===n.key?'bg-[#1F6B3A] text-white':'text-slate-600 hover:bg-[#EEF5F0]')}>
     <n.icon size={15}/>{n.label}</button>)}
   </nav>
   {tab==='overview'&&<div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
     {[
      ['Distributors',String(data.clients.length),'Active B2B customer records'],
      ['Quotations',price(totalQuoted),String(quotes.length)+' quotations · not booked revenue'],
      ['Collected receipts',price(collected),'Verified entries; not a bank balance'],
      ['Pending commissions',price(pendingCommissions),'Require approval before payout'],
     ].map(([label,value,hint])=><div className={card} key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-[#173621]">{value}</p><p className="mt-1 text-xs text-slate-400">{hint}</p></div>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
     <section className={card}><h2 className="font-bold">Recent quotations</h2><div className="mt-3 space-y-2">{quotes.slice(0,6).map(q=><div key={q.id} className="flex items-center justify-between gap-2 border-b py-2 text-sm"><div><b>{q.reference}</b><p className="text-xs text-slate-500">{q.client_name}</p></div><div className="text-right"><b>{price(q.total_cents)}</b><div><Status value={q.status}/></div></div></div>)}{!quotes.length&&<Empty text="Create a distributor, then prepare the first quotation."/>}</div></section>
     <section className={card}><h2 className="font-bold">International commission controls</h2><div className="mt-3 space-y-3 text-sm text-slate-600">
      <p>1. Define a beneficiary and a per-unit rule for the distributor.</p><p>2. Issue a USD quotation and obtain customer acceptance.</p>
      <p>3. Convert to an order and record customer receipts.</p><p>4. When fully paid, accrued commissions enter Pending.</p><p>5. Approve and record a bank payout reference manually.</p>
      <p className="rounded-lg bg-[#F2F8F3] p-3 text-xs text-[#1F6B3A]"><b>Gulf Generic reference:</b> Mahmoud Alam · USD 0.40 per eligible unit. This is a suggested rule to register, not an automatic payment.</p>
     </div></section>
    </div>
   </div>}
   {tab==='clients'&&<div className="grid gap-4 xl:grid-cols-[380px_1fr]">
    <form className={card+' space-y-3'} onSubmit={async e=>{e.preventDefault();const f=e.currentTarget;const ok=await submit('client',formValues(f));if(ok)f.reset();}}>
     <h2 className="font-semibold text-[#173621]">Add distributor / client</h2>
     <Field label="Registered legal name"><input required name="legalName" className={control} placeholder="Gulf Generic Company for General Trading"/></Field>
     <Field label="Display name"><input required name="displayName" className={control} placeholder="Gulf Generic Company"/></Field>
     <Field label="Country"><input required name="country" className={control} defaultValue="Kuwait"/></Field>
     <Field label="Registered / correspondence address"><textarea name="address" rows={3} className={control} placeholder="Al Mirqab, Block 3..."/></Field>
     <div className="grid grid-cols-2 gap-2"><Field label="Commercial register"><input name="registrationNo" className={control}/></Field><Field label="Tax ID"><input name="taxNo" className={control}/></Field></div>
     <Field label="Contact person"><input name="contactName" className={control}/></Field><Field label="Contact email"><input name="contactEmail" type="email" className={control}/></Field>
     <button disabled={busy} className={button+' w-full'}><Plus size={15}/>Save distributor</button>
    </form>
    <section className={card}><h2 className="font-bold">Distributors ({data.clients.length})</h2>
     <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[490px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Company</th><th>Country</th><th>Registration</th></tr></thead><tbody>{data.clients.map(c=><tr className="border-b" key={c.id}><td className="py-3"><b>{c.display_name}</b><p className="text-xs text-slate-500">{c.legal_name}</p></td><td>{c.country}</td><td>{c.registration_no||'—'}</td></tr>)}</tbody></table></div>
     {!data.clients.length&&<Empty text="No international distributors registered yet."/>}
    </section>
   </div>}
   {tab==='contracts'&&<div className="grid gap-4 xl:grid-cols-[380px_1fr]">
    <form className={card+' space-y-3'} onSubmit={async e=>{e.preventDefault();const f=e.currentTarget;const ok=await submit('contract',{...formValues(f),clientId:contractClient});if(ok)f.reset();}}>
     <h2 className="font-semibold text-[#173621]">Register contract</h2>
     <Field label="Distributor"><select required value={contractClient} onChange={e=>setContractClient(e.target.value)} className={control}><option value="">Choose client</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></Field>
     <Field label="Contract title"><input required name="title" defaultValue="Exclusive Distribution and Business Development Agreement" className={control}/></Field>
     <div className="grid grid-cols-2 gap-2"><Field label="Effective date"><input required type="date" name="effectiveDate" defaultValue="2026-11-01" className={control}/></Field><Field label="Expiry"><input required type="date" name="expiryDate" defaultValue="2029-10-31" className={control}/></Field></div>
     <Field label="Status"><select name="status" className={control}><option value="DRAFT">Draft</option><option value="ACTIVE">Active — signed / validated</option></select></Field>
     <Field label="Official document URL (Google Drive)"><input name="documentUrl" type="url" className={control} placeholder="https://drive.google.com/..."/></Field>
     <Field label="Conditions / notes"><textarea name="termsNotes" rows={2} className={control} placeholder="MOQ 2,000/SKU; FCA factory, Egypt; 36 months"/></Field>
     <button disabled={busy||!contractClient} className={button+' w-full'}><Plus size={15}/>Save contract</button>
    </form>
    <section className={card}><h2 className="font-bold">Contracts ({data.contracts.length})</h2><div className="mt-3 space-y-3">{data.contracts.map(c=><div className="rounded-xl border p-3" key={c.id}>
     <div className="flex items-center justify-between gap-2"><b className="text-sm">{c.reference}</b><Status value={c.status}/></div>
     <p className="mt-1 text-sm">{c.title}</p><p className="mt-1 text-xs text-slate-500">{c.client_name} · {isoDay(c.effective_date)} → {isoDay(c.expiry_date)}</p>
     {c.document_url&&<a href={c.document_url} rel="noopener noreferrer" target="_blank" className="mt-2 inline-block text-xs font-semibold text-[#1F6B3A] underline">Open signed contract</a>}
    </div>)}{!data.contracts.length&&<Empty text="No contract metadata yet. Attach signed documents by Google Drive URL."/>}</div></section>
   </div>}
   {tab==='quotes'&&<div className="space-y-4">
    <form className={card+' space-y-4'} onSubmit={async e=>{e.preventDefault();const f=e.currentTarget;const values=formValues(f);const ok=await submit('quote',{clientId:quoteClient,contractId:values.contractId||null,validUntil:values.validUntil,notes:values.notes,lines:quoteRows.map(l=>({sku:l.sku,quantity:l.quantity}))});if(ok)setQuantities({});}}>
     <div><h2 className="font-bold">Generate automatic USD quotation</h2><p className="mt-1 text-xs text-slate-500">The quotation reference, line amounts and total are generated automatically from the approved catalogue.</p></div>
     <div className="grid gap-3 md:grid-cols-3">
      <Field label="Distributor"><select required value={quoteClient} onChange={e=>setQuoteClient(e.target.value)} className={control}><option value="">Choose client</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></Field>
      <Field label="Contract (optional)"><select name="contractId" className={control}><option value="">No attached contract</option>{data.contracts.filter(c=>c.client_id===quoteClient).map(c=><option key={c.id} value={c.id}>{c.reference}</option>)}</select></Field>
      <Field label="Valid until"><input required name="validUntil" type="date" min={today()} defaultValue={inDays(30)} className={control}/></Field>
     </div>
     <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[450px] text-left text-sm"><thead className="bg-[#EEF6F0] text-xs text-[#1F6B3A]"><tr><th className="p-3">Product</th><th>USD / unit</th><th>Quantity</th><th className="text-right pr-3">Line total</th></tr></thead><tbody>{data.products.filter(p=>p.active).map(p=><tr key={p.sku} className="border-t"><td className="p-3 font-semibold">{p.product_name}</td><td>{price(p.unit_price_cents)}</td><td><input type="number" min="0" max="1000000" value={quantities[p.sku]||0} onChange={e=>setQuantities(old=>({...old,[p.sku]:Math.max(0,Number(e.target.value)||0)}))} className={control+' max-w-28'}/></td><td className="pr-3 text-right font-semibold">{price((quantities[p.sku]||0)*p.unit_price_cents)}</td></tr>)}</tbody></table></div>
     <Field label="Notes"><textarea name="notes" rows={2} className={control} placeholder="Currency: USD; shipping and Incoterms to be confirmed in accepted purchase order"/></Field>
     <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-slate-500">Automatic quotation total</p><p className="text-2xl font-bold text-[#1F6B3A]">{price(quoteTotal)}</p></div><button disabled={busy||!quoteClient||!quoteRows.length||quoteRows.some(p=>!Number.isInteger(p.quantity))} className={button}><Plus size={15}/>Generate quotation</button></div>
    </form>
    <section className={card}><h2 className="font-bold">Quotation register</h2>{!quotes.length?<Empty text="Generate a quotation to view, print or accept it."/>:<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Reference / client</th><th>Valid until</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead><tbody>{quotes.map(q=><tr key={q.id} className="border-b"><td className="py-3"><b>{q.reference}</b><p className="text-xs text-slate-500">{q.client_name}</p></td><td>{isoDay(q.valid_until)}</td><td className="font-semibold">{price(q.total_cents)}</td><td><Status value={q.status}/></td><td><div className="flex flex-wrap gap-1"><button type="button" className={light} onClick={()=>printQuote(q)}><Printer size={13}/>PDF / Print</button>
     {q.status==='DRAFT'&&<button disabled={busy} className={light} onClick={()=>void submit('quote_status',{quoteId:q.id,status:'SENT'})}>Mark sent</button>}
     {q.status==='SENT'&&<button disabled={busy} className={light} onClick={()=>void submit('quote_status',{quoteId:q.id,status:'ACCEPTED'})}>Accept</button>}
    </div></td></tr>)}</tbody></table></div>}</section>
   </div>}
   {tab==='orders'&&<div className="space-y-4">
    <section className={card}><h2 className="font-bold">Convert accepted quotation to order</h2>
     <div className="mt-3 flex flex-wrap gap-2">{quotes.filter(q=>q.status==='ACCEPTED'&&!orders.some(o=>o.quote_id===q.id)).map(q=><button key={q.id} disabled={busy} className={light} onClick={()=>void submit('order',{quoteId:q.id})}><Plus size={14}/>{q.reference} · {price(q.total_cents)}</button>)}</div>
     {!quotes.some(q=>q.status==='ACCEPTED'&&!orders.some(o=>o.quote_id===q.id))&&<p className="mt-2 text-sm text-slate-500">No accepted quotations awaiting conversion.</p>}
    </section>
    <form className={card+' space-y-3'} onSubmit={async e=>{e.preventDefault();const f=e.currentTarget,values=formValues(f);try{const ok=await submit('payment',{orderId:paymentOrder,amountCents:usdCents(values.amountUSD),paymentReference:values.paymentReference,paidAt:values.paidAt});if(ok)f.reset();}catch(e){setError(e instanceof Error?e.message:'Invalid amount');}}}>
     <h2 className="font-bold">Record verified customer receipt</h2>
     <p className="text-xs text-slate-500">Manual bank evidence required. Commissions accrue only when the full amount of the international order is recorded as paid.</p>
     <div className="grid gap-3 md:grid-cols-4">
      <Field label="Order"><select required value={paymentOrder} onChange={e=>setPaymentOrder(e.target.value)} className={control}><option value="">Select order</option>{orders.filter(o=>o.paid_cents<o.total_cents&&o.order_status!=='CANCELLED').map(o=><option key={o.id} value={o.id}>{o.reference} · due {price(o.total_cents-o.paid_cents)}</option>)}</select></Field>
      <Field label="Amount USD"><input required name="amountUSD" inputMode="decimal" placeholder="1000.00" className={control}/></Field>
      <Field label="Bank / payment reference"><input required name="paymentReference" placeholder="Wire reference" className={control}/></Field>
      <Field label="Received on"><input required name="paidAt" type="date" defaultValue={today()} className={control}/></Field>
     </div>
     <button disabled={busy||!paymentOrder} className={button}>Record receipt</button>
    </form>
    <section className={card}><h2 className="font-bold">International orders</h2>
     {!orders.length?<Empty text="Accepted quotations become orders here."/>:<div className="overflow-x-auto"><table className="mt-3 w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Order</th><th>Customer</th><th>Total</th><th>Collected</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{orders.map(o=><tr className="border-b" key={o.id}><td className="py-3 font-semibold">{o.reference}</td><td>{o.client_name}</td><td>{price(o.total_cents)}</td><td>{price(o.paid_cents)}</td><td className="font-semibold">{price(o.total_cents-o.paid_cents)}</td><td><div className="space-y-1"><Status value={o.paid_cents===o.total_cents?"PAID":o.order_status}/><div className="flex gap-1">{o.order_status==="CONFIRMED"&&<button disabled={busy} className={light} onClick={()=>void submit("order_status",{orderId:o.id,status:"SHIPPED"})}>Ship</button>}{o.order_status==="SHIPPED"&&<button disabled={busy} className={light} onClick={()=>void submit("order_status",{orderId:o.id,status:"DELIVERED"})}>Delivered</button>}{o.order_status==="CONFIRMED"&&o.paid_cents===0&&<button disabled={busy} className={light} onClick={()=>void submit("order_status",{orderId:o.id,status:"CANCELLED"})}>Cancel</button>}</div></div></td></tr>)}</tbody></table></div>}</section>
   </div>}
   {tab==='commissions'&&<div className="space-y-4">
    <form className={card+' space-y-3'} onSubmit={async e=>{e.preventDefault();const f=e.currentTarget,values=formValues(f);try{const ok=await submit('rule',{clientId:ruleClient,agentName:values.agentName,rateCents:usdCents(values.rateUSD)});if(ok)f.reset();}catch(e){setError(e instanceof Error?e.message:'Invalid commission rate');}}}>
     <h2 className="font-bold">Commission rule per international client</h2><p className="text-xs text-slate-500">Fixed USD amount per eligible unit. Changes apply to future accruals only, never retroactively to existing commissions.</p>
     <div className="grid gap-3 md:grid-cols-3">
      <Field label="Distributor"><select required value={ruleClient} onChange={e=>setRuleClient(e.target.value)} className={control}><option value="">Select distributor</option>{data.clients.map(c=><option value={c.id} key={c.id}>{c.display_name}</option>)}</select></Field>
      <Field label="Commission beneficiary"><input required name="agentName" className={control} defaultValue="Mahmoud Alam"/></Field>
      <Field label="Commission USD / unit"><input required name="rateUSD" inputMode="decimal" defaultValue="0.40" className={control}/></Field>
     </div><button disabled={busy||!ruleClient} className={button}>Save commission rule</button>
    </form>
    <section className={card}><h2 className="font-bold">Active rules</h2>{!data.rules.length?<Empty text="Register a beneficiary and a commission rate for a distributor."/>:<div className="mt-3 space-y-2">{data.rules.map(r=><div key={r.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm"><div><b>{r.agent_name}</b><p className="text-xs text-slate-500">{r.client_name}</p></div><b className="text-[#1F6B3A]">{price(r.rate_cents)} / unit</b></div>)}</div>}</section>
    <section className={card}><h2 className="font-bold">Commission ledger</h2><p className="mt-1 text-xs text-slate-500">Accrued after full receipt · pending → approved → paid with reference; not included in affiliate payouts.</p>
     {!commissions.length?<Empty text="Commissions appear after a qualifying international order has been paid in full."/>:<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Beneficiary / order</th><th>Units</th><th>Rate</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{commissions.map(c=><tr key={c.id} className="border-b"><td className="py-3"><b>{c.agent_name}</b><p className="text-xs text-slate-500">{c.order_reference}</p></td><td>{c.eligible_quantity}</td><td>{price(c.rate_cents)}</td><td className="font-semibold">{price(c.amount_cents)}</td><td><Status value={c.status}/></td><td className="space-x-1">{c.status==='PENDING'&&<><button disabled={busy} className={light} onClick={()=>void submit('commission_status',{commissionId:c.id,status:'APPROVED'})}>Approve</button><button disabled={busy} className={light} onClick={()=>void submit('commission_status',{commissionId:c.id,status:'VOID'})}>Void</button></>}
     {c.status==='APPROVED'&&<button disabled={busy} className={light} onClick={()=>{const reference=window.prompt('Enter confirmed transfer / payment reference:');if(reference?.trim())void submit('commission_status',{commissionId:c.id,status:'PAID',payoutReference:reference.trim()});}}>Mark paid</button>}</td></tr>)}</tbody></table></div>}
    </section>
   </div>}
  </>}
 </main>;
}
