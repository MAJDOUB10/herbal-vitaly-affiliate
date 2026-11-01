'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Clock3, Headphones, MessageCircle, Plus, RefreshCw,
  Search, Send, ShieldCheck, Ticket, X,
} from 'lucide-react';

type Category = 'GENERAL'|'COUPON'|'ORDER'|'DELIVERY'|'RETURN'|'COMMISSION'|'PAYOUT'|'TECHNICAL';
type Status = 'OPEN'|'IN_PROGRESS'|'WAITING_PARTNER'|'RESOLVED'|'CLOSED';
type Priority = 'LOW'|'NORMAL'|'HIGH'|'URGENT';
type TicketItem = {
  id:string;userId:string;subject:string;category:Category;status:Status;
  priority:Priority;orderRef:string|null;createdAt:string;updatedAt:string;lastMessageAt:string;
  messageCount?:number;partner?:{name:string;email:string};
};
type MessageItem = {
  id:string;body:string;internal?:boolean;createdAt:string;
  author:{name:string;role:string};
};
type TicketDetails = TicketItem & {messages:MessageItem[]};
const CATEGORIES:Category[]=['GENERAL','COUPON','ORDER','DELIVERY','RETURN','COMMISSION','PAYOUT','TECHNICAL'];
const STATUSES:Status[]=['OPEN','IN_PROGRESS','WAITING_PARTNER','RESOLVED','CLOSED'];
const PRIORITIES:Priority[]=['LOW','NORMAL','HIGH','URGENT'];
const STATUS_STYLE:Record<string,string>={
  OPEN:'bg-amber-50 text-amber-800',IN_PROGRESS:'bg-blue-50 text-blue-700',
  WAITING_PARTNER:'bg-violet-50 text-violet-700',
  RESOLVED:'bg-green-50 text-green-700',CLOSED:'bg-gray-100 text-gray-700',
};
const field='w-full rounded-lg border border-[#D5E4D9] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1F6B3A] focus:ring-1 focus:ring-[#1F6B3A]/20';
const action='inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F6B3A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15512B] disabled:cursor-not-allowed disabled:opacity-50';
const secondary='inline-flex items-center justify-center gap-2 rounded-lg border border-[#D5E4D9] px-3 py-2 text-sm font-medium text-[#1F6B3A] hover:bg-[#F2F8F4] disabled:opacity-50';
function fmt(date:string){return new Date(date).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function label(s:string){return s.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());}
async function json(path:string,options?:RequestInit){
  const res=await fetch(path,{cache:'no-store',...options});
  const data=await res.json();
  if(!res.ok||!data.success)throw Error(data.error||'Support service unavailable.');
  return data;
}
export default function SupportDesk({mode}:{mode:'admin'|'affiliate'}){
  const admin=mode==='admin';
  const base='/api/'+mode+'/support';
  const [tickets,setTickets]=useState<TicketItem[]>([]);
  const [ticket,setTicket]=useState<TicketDetails|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [statusFilter,setStatusFilter]=useState('ALL');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [newTicket,setNewTicket]=useState(false);
  const [subject,setSubject]=useState('');
  const [category,setCategory]=useState<Category>('GENERAL');
  const [orderRef,setOrderRef]=useState('');
  const [description,setDescription]=useState('');
  const [reply,setReply]=useState('');
  const [internal,setInternal]=useState(false);
  const [counts,setCounts]=useState<Record<string,number>>({});
  const loadList=useCallback(async()=>{
    const data=await json(base);
    setTickets(data.tickets||[]);
    if(admin)setCounts(data.counts||{});
  },[base,admin]);
  const loadTicket=useCallback(async(id:string)=>{
    const data=await json(base+'/'+encodeURIComponent(id));
    setTicket(data.ticket);
  },[base]);
  useEffect(()=>{
    let active=true;
    setLoading(true);
    loadList().catch(e=>{if(active)setError(e.message);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[loadList]);
  useEffect(()=>{
    if(!selected){setTicket(null);return;}
    loadTicket(selected).catch(e=>setError(e.message));
  },[selected,loadTicket]);
  const refresh=async()=>{
    setError('');try{await loadList();if(selected)await loadTicket(selected);}
    catch(e){setError(e instanceof Error?e.message:'Could not refresh support.');}
  };
  const create=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const data=await json(base,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({subject,category,orderRef:orderRef.trim(),message:description})});
      setSubject('');setCategory('GENERAL');setOrderRef('');setDescription('');setNewTicket(false);
      setNotice('Your support request has been created.');
      await loadList();setSelected(data.id);
    }catch(err){setError(err instanceof Error?err.message:'Could not create ticket.');}
    finally{setBusy(false);}
  };
  const sendReply=async(e:React.FormEvent)=>{
    e.preventDefault();if(!selected)return;setBusy(true);setError('');setNotice('');
    try{
      await json(base+'/'+encodeURIComponent(selected),{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(admin?{message:reply,internal}:{message:reply})});
      setReply('');setInternal(false);setNotice('Message sent.');
      await Promise.all([loadList(),loadTicket(selected)]);
    }catch(err){setError(err instanceof Error?err.message:'Could not send message.');}
    finally{setBusy(false);}
  };
  const changeTicket=async(patch:Record<string,string>)=>{
    if(!selected)return;setBusy(true);setError('');
    try{
      await json(base+'/'+encodeURIComponent(selected),{method:'PATCH',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
      await Promise.all([loadList(),loadTicket(selected)]);
    }catch(err){setError(err instanceof Error?err.message:'Could not update ticket.');}
    finally{setBusy(false);}
  };
  const visible=tickets.filter(t=>{
    if(statusFilter!=='ALL'&&t.status!==statusFilter)return false;
    const query=search.trim().toLowerCase();
    return !query || [t.subject,t.category,t.orderRef,t.partner?.name,t.partner?.email,t.id]
      .some(v=>v?.toLowerCase().includes(query));
  });
  const open=tickets.filter(t=>!['RESOLVED','CLOSED'].includes(t.status)).length;
  return <div className="mx-auto max-w-7xl space-y-5 text-[#173321]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#1F6B3A]">Herbal Vitaly Affiliate Hub</p>
        <h1 className="text-2xl font-bold">{admin?'Support Center — Admin':'Partner Support Center'}</h1>
        <p className="text-sm text-slate-600">{admin
          ? 'Track and resolve partner questions, support cases and payout inquiries.'
          : 'Ask about promo codes, orders, deliveries, returns, commissions and payments.'}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={refresh} className={secondary}><RefreshCw className="h-4 w-4"/> Refresh</button>
        {!admin&&<button type="button" className={action} onClick={()=>{setNewTicket(true);setSelected(null);setError('');}}>
          <Plus className="h-4 w-4"/> New ticket
        </button>}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Total tickets</p><p className="mt-1 text-2xl font-bold">{tickets.length}</p></div>
      <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Need attention</p><p className="mt-1 text-2xl font-bold text-[#1F6B3A]">{open}</p></div>
      <div className="col-span-2 rounded-xl border bg-white p-4 shadow-sm sm:col-span-1"><p className="text-xs text-slate-500">{admin?'Waiting for partner':'Resolved or closed'}</p>
        <p className="mt-1 text-2xl font-bold">{admin?(counts.WAITING_PARTNER||0):tickets.length-open}</p></div>
    </div>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
    {newTicket&&!admin&&<section className="rounded-xl border border-[#C8E1CE] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Create a support ticket</h2>
        <button type="button" className={secondary} onClick={()=>setNewTicket(false)} aria-label="Close form"><X className="h-4 w-4"/></button></div>
      <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="font-semibold">Subject</span>
          <input className={field} required minLength={5} maxLength={140} value={subject}
            onChange={e=>setSubject(e.target.value)} placeholder="e.g. Problem with my Shopify promo code"/></label>
        <label className="space-y-1 text-sm"><span className="font-semibold">Category</span>
          <select className={field} value={category} onChange={e=>setCategory(e.target.value as Category)}>
            {CATEGORIES.map(c=><option key={c} value={c}>{label(c)}</option>)}</select></label>
        <label className="space-y-1 text-sm md:col-span-2"><span className="font-semibold">Order / delivery reference (optional)</span>
          <input className={field} value={orderRef} maxLength={80} onChange={e=>setOrderRef(e.target.value)}
            placeholder="Order or tracking reference"/></label>
        <label className="space-y-1 text-sm md:col-span-2"><span className="font-semibold">Describe your request</span>
          <textarea className={field} required minLength={10} maxLength={4000} rows={4} value={description}
            onChange={e=>setDescription(e.target.value)} placeholder="Tell us how we can help…"/></label>
        <div className="md:col-span-2"><button disabled={busy} type="submit" className={action}>
          <Ticket className="h-4 w-4"/>{busy?'Submitting…':'Submit support ticket'}</button></div>
      </form>
    </section>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4"><h2 className="flex items-center gap-2 font-semibold"><Headphones className="h-4 w-4 text-[#1F6B3A]"/> {admin?'Support queue':'My requests'}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
              <input className={field+' pl-9'} placeholder="Search tickets…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
            <select className={field} value={statusFilter} aria-label="Filter by status" onChange={e=>setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>{STATUSES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select>
          </div>
        </div>
        <div className="max-h-[650px] divide-y overflow-y-auto">
          {loading?<p className="p-5 text-sm text-slate-500">Loading support tickets…</p>
            :!visible.length?<div className="p-8 text-center"><MessageCircle className="mx-auto h-7 w-7 text-slate-400"/>
              <p className="mt-3 text-sm text-slate-600">No support tickets found.</p></div>
            :visible.map(t=><button type="button" key={t.id} onClick={()=>{setSelected(t.id);setNewTicket(false);setNotice('');}}
              className={'w-full p-4 text-left transition hover:bg-[#F2F8F4] '+(selected===t.id?'bg-[#EEF8F0]':'')}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{t.subject}</span>
                <span className={'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold '+STATUS_STYLE[t.status]}>{label(t.status)}</span>
              </div>
              {admin&&<p className="mt-1 truncate text-xs text-[#1F6B3A]">{t.partner?.name} · {t.partner?.email}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{label(t.category)}</span><span>•</span><span>{fmt(t.lastMessageAt)}</span>
                {t.orderRef&&<span>• {t.orderRef}</span>}
              </div>
            </button>)}
        </div>
      </section>
      <section className="min-h-[430px] overflow-hidden rounded-xl border bg-white shadow-sm">
        {!ticket?<div className="flex min-h-[430px] flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
          <MessageCircle className="h-10 w-10 text-[#1F6B3A]/60"/>
          <p className="text-sm">{newTicket?'Complete your support request above.':'Choose a ticket to view the conversation.'}</p>
        </div>:<div className="flex h-full flex-col">
          <div className="border-b p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{ticket.subject}</h2>
              <span className={'rounded-full px-2 py-1 text-xs font-semibold '+STATUS_STYLE[ticket.status]}>{label(ticket.status)}</span></div>
            <p className="mt-1 text-xs text-slate-500">Created {fmt(ticket.createdAt)} · {label(ticket.category)}{ticket.orderRef?' · Order '+ticket.orderRef:''}</p>
            {admin&&<div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold">Status
                <select className={field} value={ticket.status} disabled={busy} onChange={e=>changeTicket({status:e.target.value})}>
                  {STATUSES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label>
              <label className="space-y-1 text-xs font-semibold">Priority
                <select className={field} value={ticket.priority} disabled={busy} onChange={e=>changeTicket({priority:e.target.value})}>
                  {PRIORITIES.map(p=><option key={p} value={p}>{label(p)}</option>)}</select></label>
            </div>}
          </div>
          <div className="max-h-[480px] flex-1 space-y-3 overflow-y-auto bg-[#FBFDFC] p-4">
            {ticket.messages.map(m=><div key={m.id} className={'rounded-xl border p-3 '+(m.internal?'border-amber-200 bg-amber-50':'border-[#E2EBE5] bg-white')}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#1F6B3A]">{m.author.name} · {label(m.author.role)}
                  {m.internal&&<span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">Internal note</span>}</span>
                <span className="text-slate-500">{fmt(m.createdAt)}</span></div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
            </div>)}
          </div>
          {ticket.status==='CLOSED'&&!admin?<p className="border-t p-4 text-sm text-slate-500">
            <CheckCircle2 className="mr-1 inline h-4 w-4"/> This ticket is closed. Create a new request if you need further assistance.
          </p>:<form className="space-y-3 border-t p-4" onSubmit={sendReply}>
            <label className="block text-sm font-semibold" htmlFor="support-reply">Message</label>
            <textarea id="support-reply" required minLength={2} maxLength={4000} rows={3}
              className={field} placeholder={admin?'Write a response to the partner…':'Write your reply…'}
              value={reply} onChange={e=>setReply(e.target.value)}/>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {admin?<label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)} />
                <ShieldCheck className="h-4 w-4"/> Internal note (not visible to partner)
              </label>:<p className="text-xs text-slate-500"><Clock3 className="mr-1 inline h-3 w-3"/> Our support team will reply here.</p>}
              <button type="submit" className={action} disabled={busy||reply.trim().length<2}>
                <Send className="h-4 w-4"/> {busy?'Sending…':'Send reply'}</button>
            </div>
          </form>}
        </div>}
      </section>
    </div>
    <p className="text-xs text-slate-500">Support messages are stored in the portal. Orders, commissions and payouts are never altered by ticket actions.</p>
  </div>;
}
