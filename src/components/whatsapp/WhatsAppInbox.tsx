'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, Link2,
  MessageCircle, RefreshCw, Search, Send, ShieldCheck, UserRound, UsersRound } from 'lucide-react';

type Partner={id:string;name:string;email:string;code:string};
type Chat={
  id:string;waId:string;maskedPhone:string;displayName:string|null;
  affiliateId:string|null;partner:{id:string;name:string;referralCode:string}|null;
  lastInboundAt:string|null;lastMessageAt:string;windowOpen:boolean;preview:string|null;
};
type Message={id:string;direction:string;messageType:string;body:string;status:string;createdAt:string};
type Thread={conversation:Chat;messages:Message[]};
type Inbox={success:boolean;configured:boolean;publicNumber:string|null;
  conversations:Chat[];partners:Partner[];partnersTruncated:boolean};

const time=(value:string|null|undefined)=> value?new Date(value).toLocaleString('en-GB',{
  month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo',
}):'—';

export default function WhatsAppInbox(){
  const [inbox,setInbox]=useState<Inbox|null>(null);
  const [selected,setSelected]=useState<string>('');
  const [thread,setThread]=useState<Thread|null>(null);
  const [search,setSearch]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState(false);
  const [loading,setLoading]=useState(true);

  const fetchInbox=useCallback(async()=>{
    try{
      const r=await fetch('/api/admin/whatsapp',{cache:'no-store'});
      const d=await r.json();
      if(!r.ok || !d.success)throw new Error(d.error||'Unable to load inbox');
      setInbox(d as Inbox);
      setSelected(old=>old||(d.conversations[0]?.id??''));
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'Could not connect to inbox');}
    finally{setLoading(false);}
  },[]);
  const fetchThread=useCallback(async(id:string)=>{
    try{
      const r=await fetch('/api/admin/whatsapp?conversationId='+encodeURIComponent(id),{cache:'no-store'});
      const d=await r.json();
      if(!r.ok||!d.success)throw new Error(d.error||'Could not load messages');
      setThread(d as Thread);
    }catch(e){setError(e instanceof Error?e.message:'Could not load messages');}
  },[]);

  useEffect(()=>{void fetchInbox();const interval=setInterval(()=>{void fetchInbox();},20000);
    return ()=>clearInterval(interval);},[fetchInbox]);
  useEffect(()=>{if(selected)void fetchThread(selected);else setThread(null);},[selected,fetchThread]);
  useEffect(()=>{if(!selected)return;const interval=setInterval(()=>{void fetchThread(selected);},20000);
    return ()=>clearInterval(interval);},[selected,fetchThread]);

  const filtered=useMemo(()=> (inbox?.conversations||[]).filter(c=>{
    const text=[c.waId,c.displayName,c.partner?.name,c.partner?.referralCode,c.preview].join(' ').toLowerCase();
    return text.includes(search.trim().toLowerCase());
  }),[inbox,search]);
  const assign=async(affiliateId:string|null)=>{
    if(!selected)return;
    setPending(true);setError('');setInfo('');
    try{
      const r=await fetch('/api/admin/whatsapp',{method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({conversationId:selected,affiliateId})});
      const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||'Assignment failed');
      setInfo(affiliateId?'Conversation linked to a verified affiliate.':'Partner link removed.');
      await Promise.all([fetchInbox(),fetchThread(selected)]);
    }catch(e){setError(e instanceof Error?e.message:'Assignment failed');}
    finally{setPending(false);}
  };
  const send=async()=>{
    if(!selected||!message.trim()||busy)return;
    setBusy(true);setError('');setInfo('');
    const requestId=crypto.randomUUID();
    try{
      const r=await fetch('/api/admin/whatsapp',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({conversationId:selected,message,requestId})});
      const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||'WhatsApp did not confirm the reply');
      setMessage('');setInfo('Message accepted by WhatsApp Business API.');
      await Promise.all([fetchThread(selected),fetchInbox()]);
    }catch(e){setError(e instanceof Error?e.message:'Unable to send reply');}
    finally{setBusy(false);}
  };
  const current=thread?.conversation||inbox?.conversations.find(c=>c.id===selected);
  const windowOpen=Boolean(current?.windowOpen);
  return <main className="mx-auto max-w-[1540px] space-y-5 pb-10" lang="en">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.17em] text-[#1F6B3A]">HERBAL VITALY · COMMUNICATIONS</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-[#1C3B28] sm:text-4xl">WhatsApp Partner Inbox</h1>
        <p className="mt-2 text-sm leading-6 text-[#728477]">Official Business API conversations. Only explicitly linked affiliates can view their thread.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-2 text-xs font-semibold ${inbox?.configured?'border-green-200 bg-green-50 text-green-800':'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {inbox?.configured?'Business API configured':'Meta Business setup required'}
        </span>
        <button onClick={()=>{void fetchInbox();if(selected)void fetchThread(selected);}} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-[#1F6B3A]"><RefreshCw size={16}/> Refresh</button>
      </div>
    </header>

    {!inbox?.configured&& <div className="rounded-xl border border-[#EDDAAD] bg-[#FFFAF0] p-4 text-sm text-[#68532E]">
      <p className="flex items-center gap-2 font-bold"><AlertCircle size={16}/> Connection required before receiving or sending messages</p>
      <p className="mt-2 leading-6">Connect a WhatsApp Business Platform number, configure the Vercel secret variables and subscribe to the <strong>messages</strong> webhook in Meta Business.
        Callback: <code className="break-all font-mono">https://partner.herbalvitaly.com/api/whatsapp/webhook</code>.
        Existing WhatsApp app message history cannot be imported automatically.</p>
      <a className="mt-2 inline-flex items-center gap-1 font-semibold underline" href="https://developers.facebook.com/docs/whatsapp/cloud-api/" target="_blank" rel="noopener noreferrer">Meta setup documentation <ExternalLink size={14}/></a>
    </div>}
    {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {info&&<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{info}</p>}
    <div className="grid min-h-[580px] overflow-hidden rounded-2xl border border-[#DDE8E0] bg-white shadow-sm lg:grid-cols-[345px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-[#DFEBE2] lg:border-b-0 lg:border-r">
        <div className="border-b border-[#E6EFE8] p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#1D3F29]">Conversations</h2>
            <span className="rounded-full bg-[#EDF6F0] px-2 py-1 text-xs font-bold text-[#1F6B3A]">{inbox?.conversations.length??0}</span>
          </div>
          <label className="relative mt-3 block"><Search size={16} className="absolute left-3 top-3 text-[#92A394]"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search partner, number, code..."
              className="w-full rounded-lg border border-[#DAE7DD] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#1F6B3A]"/>
          </label>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {filtered.map(c=><button key={c.id} type="button" onClick={()=>{setSelected(c.id);setInfo('');}}
            className={`flex w-full gap-3 border-b border-[#EDF2EE] px-4 py-3 text-left hover:bg-[#F5FAF6] ${selected===c.id?'bg-[#EDF6F0]':''}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E0F1E5] text-[#1F6B3A]"><MessageCircle size={18}/></span>
            <span className="min-w-0 flex-1">
              <span className="flex justify-between gap-2"><strong className="truncate text-sm text-[#203C29]">{c.partner?.name||c.displayName||c.maskedPhone}</strong>
                <small className="whitespace-nowrap text-[10px] text-[#83988A]">{time(c.lastMessageAt)}</small></span>
              <span className="block truncate text-xs text-[#7B9180]">{c.partner?.referralCode||'Unassigned conversation'} · {c.maskedPhone}</span>
              <span className="mt-1 block truncate text-xs text-[#7D8E80]">{c.preview||'No messages yet'}</span>
            </span>
          </button>)}
          {!filtered.length&&<p className="p-7 text-center text-sm text-[#8B9D8E]">{loading?'Loading conversations...':'No conversations match your search.'}</p>}
        </div>
      </aside>
      <section className="flex min-h-[560px] min-w-0 flex-col">
        {current?<>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2EDE5] px-5 py-4">
            <div>
              <p className="font-bold text-[#1E3A27]">{current.partner?.name||current.displayName||current.maskedPhone}</p>
              <p className="mt-1 text-xs text-[#728675]">{current.waId?('+'+current.waId):current.maskedPhone} {current.partner?'· '+current.partner.referralCode:'· Not linked to an affiliate'}</p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${windowOpen?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}>
              <Clock3 size={13}/>{windowOpen?'24-hour reply window open':'24-hour reply window closed'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-b border-[#E6EEE8] bg-[#FAFCFA] px-5 py-3">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#456B50]"><Link2 size={14}/> Link to partner</span>
            <select disabled={pending||!inbox} value={current.affiliateId||''}
              onChange={e=>void assign(e.target.value||null)}
              className="min-w-[200px] max-w-full rounded-lg border border-[#D7E6DB] bg-white px-3 py-2 text-xs">
              <option value="">Unassigned (Admin only)</option>
              {inbox?.partners.map(a=><option key={a.id} value={a.id}>{a.name} · {a.code}</option>)}
            </select>
            {inbox?.partnersTruncated&&<span className="text-xs text-amber-700">Partner selection limited to 1,000 newest verified accounts.</span>}
          </div>
          <div className="min-h-[270px] flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(140deg,#F9FCF9,#F0F6F1)] p-5">
            {(thread?.messages||[]).map(m=><div key={m.id} className={`flex ${m.direction==='OUTBOUND'?'justify-end':'justify-start'}`}>
              <div className={`max-w-[86%] whitespace-pre-wrap break-words rounded-xl px-4 py-2.5 shadow-sm sm:max-w-[72%] ${m.direction==='OUTBOUND'?'bg-[#DBF0DE] text-[#234C31]':'bg-white text-[#263D2D]'}`}>
                <p className="text-sm leading-6">{m.body}</p>
                <p className="mt-1 text-right text-[10px] text-[#78917D]">{time(m.createdAt)} · {m.status.toLowerCase()}</p>
              </div>
            </div>)}
            {!(thread?.messages.length)&&<p className="py-16 text-center text-sm text-[#819588]">Select a conversation to see new incoming WhatsApp messages.</p>}
          </div>
          <div className="border-t border-[#E1ECE4] p-4">
            <label htmlFor="hv-wa-compose" className="mb-2 block text-xs font-semibold text-[#52765B]">Reply as Herbal Vitaly Business</label>
            <div className="flex items-end gap-3">
              <textarea id="hv-wa-compose" value={message} onChange={e=>setMessage(e.target.value)}
                maxLength={4096} rows={2} placeholder={windowOpen?'Write a reply to this partner...':'A WhatsApp-approved message template is required after 24 hours.'}
                disabled={!windowOpen||!inbox?.configured||busy}
                className="min-h-[70px] flex-1 resize-y rounded-xl border border-[#D5E6DA] p-3 text-sm outline-none focus:border-[#1F6B3A] disabled:bg-[#F5F7F5]"/>
              <button type="button" onClick={()=>void send()} disabled={!windowOpen||!inbox?.configured||busy||!message.trim()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1F6B3A] px-4 text-sm font-bold text-white hover:bg-[#17552F] disabled:opacity-40"><Send size={16}/>Send</button>
            </div>
            <p className="mt-2 flex items-center gap-2 text-[11px] text-[#789181]"><ShieldCheck size={13}/>Manual replies only within Meta's 24-hour service window; outbound campaigns and templates are not enabled here.</p>
          </div>
        </>:<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <UsersRound className="h-10 w-10 text-[#7EA98A]"/>
          <h2 className="font-serif text-xl text-[#21412B]">Partner conversations will appear here</h2>
          <p className="max-w-sm text-sm text-[#819588]">Connect Meta Business, receive the first message from a contact, then link that phone number to a verified partner.</p>
        </div>}
      </section>
    </div>
    <p className="flex items-center gap-2 text-xs leading-5 text-[#869A89]"><CheckCircle2 size={15}/> New webhook events are displayed here; this inbox does not import historical chats or bypass WhatsApp's approved-template requirements.</p>
  </main>;
}
