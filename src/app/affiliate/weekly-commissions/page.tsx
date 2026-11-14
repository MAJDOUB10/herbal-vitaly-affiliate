'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type Row = { id:string;sourceOrderName:string;beneficiaryRole:string;amountPiasters:number;
  status:string;reviewedAt:string|null;paidAt:string|null;
  batch:{weekStart:string;weekEnd:string} };
type Data = {lines:Row[];page:number;total:number;pages:number;notice:string};
const egp=(v:number)=>(v/100).toLocaleString('en-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' EGP';
export default function WeeklyCommissionStatements() {
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [data,setData]=useState<Data|null>(null);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const abort=new AbortController();
    setLoading(true);setError('');
    fetch('/api/affiliate/weekly-commissions?page='+page,{cache:'no-store',signal:abort.signal})
      .then(async res=>{const body=await res.json();if(!res.ok)throw new Error(body.error||'Unable to load statements');return body;})
      .then(body=>{if(!abort.signal.aborted)setData(body);})
      .catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Unable to load statements');})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return ()=>abort.abort();
  },[page,refresh]);
  return <main lang="en" className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#1F6B3A]">Herbal Vitaly Affiliate Finance</p>
        <h1 className="mt-1 text-2xl font-bold">Weekly commission statements</h1>
        <p className="mt-2 text-sm text-slate-500">Read-only report of your direct, sub-partner or Master commission allocation.</p>
      </div>
      <button type="button" disabled={loading} onClick={()=>setRefresh(v=>v+1)}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-40">
        <RefreshCw className="h-4 w-4"/>Refresh
      </button>
    </header>
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {data?.notice||'Statement figures are for reporting only and are not payable balances or confirmed bank transfers.'}
    </p>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">{error}</p>}
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="w-full min-w-[750px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>{['Week starting (UTC)','Order','Role','Commission','Status','Validated','Paid record'].map(h=>
            <th key={h} className="px-4 py-3">{h}</th>)}</tr>
        </thead>
        <tbody>{(data?.lines||[]).map(r=><tr key={r.id} className="border-t">
          <td className="px-4 py-3">{r.batch.weekStart.slice(0,10)}</td>
          <td className="px-4 py-3 font-medium">{r.sourceOrderName}</td>
          <td className="px-4 py-3 text-xs">{r.beneficiaryRole.replaceAll('_',' ')}</td>
          <td className="px-4 py-3 font-semibold">{egp(r.amountPiasters)}</td>
          <td className="px-4 py-3">{r.status}</td>
          <td className="px-4 py-3">{r.reviewedAt?r.reviewedAt.slice(0,10):'—'}</td>
          <td className="px-4 py-3">{r.paidAt?r.paidAt.slice(0,10):'—'}</td>
        </tr>)}</tbody>
      </table>
      {loading&&<p className="p-5 text-sm text-slate-500">Loading statements...</p>}
      {!loading&&!data?.lines.length&&<p className="p-5 text-sm text-slate-500">No weekly commission reports generated for your account yet.</p>}
    </div>
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">Page {page} of {Math.max(1,data?.pages||1)} · {data?.total||0} rows</span>
      <div className="flex gap-2">
        <button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>Previous</button>
        <button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={page>=Math.max(1,data?.pages||1)||loading} onClick={()=>setPage(p=>p+1)}>Next</button>
      </div>
    </div>
  </main>;
}
