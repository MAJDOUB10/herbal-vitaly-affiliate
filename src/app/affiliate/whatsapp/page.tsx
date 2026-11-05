'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3, Headphones, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';

type Message={id:string;direction:string;body:string;messageType:string;status:string;createdAt:string};
type Chat={id:string;lastMessageAt:string;replyWindowOpen:boolean;messages:Message[]};
type Data={success:boolean;referralCode:string;businessNumber:string|null;conversations:Chat[]};
const time=(stamp:string)=>new Date(stamp).toLocaleString('en-GB',{
  day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo',
});

export default function PartnerWhatsAppPage(){
  const [data,setData]=useState<Data|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/affiliate/whatsapp',{cache:'no-store',signal:controller.signal})
      .then(async r=>{const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||'Unavailable');return d as Data;})
      .then(setData).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load conversation');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[revision]);
  const link=data?.businessNumber
    ? 'https://wa.me/'+data.businessNumber+'?text='+encodeURIComponent(
      'Hello Herbal Vitaly, I am an affiliate. My referral code is '+data.referralCode+'.')
    : null;
  return <main lang="en" className="mx-auto max-w-[1050px] space-y-6 pb-10">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.17em] text-[#1F6B3A]">HERBAL VITALY AFFILIATE HUB</p>
        <h1 className="mt-2 font-serif text-3xl text-[#193D27]">WhatsApp Conversations</h1>
        <p className="mt-2 text-sm text-[#76897B]">Your private chat history with Herbal Vitaly, once your WhatsApp number has been linked to your account.</p></div>
      <button onClick={()=>{setRevision(n=>n+1);setLoading(true);setError('');}}
        className="inline-flex items-center gap-2 rounded-lg border border-[#DBE8DF] bg-white px-3 py-2 text-sm font-semibold text-[#1F6B3A]"><RefreshCw size={16}/>Refresh</button>
    </div>
    <div className="rounded-2xl border border-[#DDEADF] bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="flex items-center gap-2 font-semibold text-[#20462C]"><MessageCircle className="h-5 w-5"/>Message our partner team</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#7B8F7E]">Use your own WhatsApp app to send a message. For privacy, the Admin team must link your WhatsApp phone number to your verified Herbal Vitaly partner account.</p></div>
        {link?<a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3A] px-4 py-3 text-sm font-bold text-white">
          Open WhatsApp <ArrowUpRight size={15}/></a>
        :<Link href="/affiliate/support" className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3A] px-4 py-3 text-sm font-bold text-white">
          Contact Support <Headphones size={15}/></Link>}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-[#799080]"><ShieldCheck className="h-4 w-4"/>Only chats explicitly associated with your own affiliate account are shown.</p>
    </div>
    {error&&<div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {loading&&<div role="status" className="rounded-xl border bg-white p-4 text-sm text-[#779080]">Loading linked WhatsApp history…</div>}
    {!loading&&data?.conversations.length===0&&<div className="rounded-2xl border border-[#DCE8DE] bg-[#F8FBF8] p-8 text-center">
      <MessageCircle className="mx-auto h-10 w-10 text-[#8FB69B]"/>
      <h2 className="mt-3 text-lg font-semibold text-[#21462E]">No linked WhatsApp conversations yet</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#758B7B]">Start a conversation on WhatsApp, then ask Herbal Vitaly Support to associate your phone number with your affiliate account. Older WhatsApp chats cannot be imported automatically.</p>
    </div>}
    {(data?.conversations||[]).map(thread=><section key={thread.id} className="overflow-hidden rounded-2xl border border-[#DBE7DE] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-[#F7FBF8] px-5 py-4">
        <h2 className="font-semibold text-[#234B32]">Herbal Vitaly Business</h2>
        <span className="flex items-center gap-2 text-xs text-[#789080]"><Clock3 size={14}/>Last message: {time(thread.lastMessageAt)}</span>
      </div>
      <div className="max-h-[500px] min-h-[160px] space-y-3 overflow-y-auto bg-[#F7FBF8] p-5">
        {thread.messages.map(m=><div key={m.id} className={`flex ${m.direction==='INBOUND'?'justify-end':'justify-start'}`}>
          <div className={`max-w-[83%] rounded-xl px-4 py-2.5 text-sm shadow-sm ${m.direction==='INBOUND'?'bg-[#D8EFD9]':'bg-white'}`}>
            <p className="whitespace-pre-wrap break-words leading-6">{m.body}</p>
            <p className="mt-1 text-right text-[10px] text-[#849A88]">{time(m.createdAt)} · {m.status.toLowerCase()}</p>
          </div>
        </div>)}
      </div>
      <p className="border-t px-5 py-3 text-xs text-[#849787]">To reply, use the WhatsApp application. This page is a private read-only mirror, not a second WhatsApp account.</p>
    </section>)}
  </main>;
}
