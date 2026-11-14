'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleX, Download, Pencil, RefreshCw, ShieldAlert, Wallet } from 'lucide-react';

type Batch = { id: string; weekStart: string; weekEnd: string; lineCount: number };
type Status = 'DRAFT' | 'VALIDATED' | 'PAID' | 'CANCELLED';
type Line = {
  id: string; sourceOrderId: string; sourceOrderName: string; beneficiaryAffiliateId: string;
  partnerName: string; referralCode: string | null; beneficiaryRole: string; amountPiasters: number;
  originalPiasters: number; salePiasters: number; poolPiasters: number; shareBps: number;
  status: Status; notes: string | null; paymentReference: string | null;
  reviewedAt: string | null; paidAt: string | null; cancellationReason: string | null;
};
type Result = {
  batches: Batch[]; selectedWeek: string | null; lines: Line[]; page: number;
  pages: number; total: number; paymentRecordingEnabled: boolean;
  totals: { status: Status; count: number; amountPiasters: number }[];
};
type Action = 'EDIT' | 'CANCEL' | 'MARK_PAID';
const money = (piasters: number) => (piasters / 100).toLocaleString('en-EG', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' EGP';
const iso = (date: string) => date.slice(0, 10);
function previousMondayUtc() {
  const today = new Date();
  const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7 - 7);
  return monday.toISOString().slice(0,10);
}
function amountToPiasters(raw: string) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole,decimals=''] = raw.split('.');
  const value = Number(whole) * 100 + Number(decimals.padEnd(2,'0'));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export default function WeeklyCommissionsAdminPage() {
  const [data, setData] = useState<Result | null>(null);
  const [week, setWeek] = useState(previousMondayUtc);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<{ line: Line; action: Action } | null>(null);
  const [amountEgp, setAmountEgp] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({weekStart:week,page:String(page)});
      const res = await fetch('/api/admin/weekly-commissions?' + qs.toString(), {cache:'no-store'});
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to retrieve weekly commissions');
      setData(body as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loading failed');
    } finally { setLoading(false); }
  },[week,page]);
  useEffect(() => { void load(); },[load]);

  async function generate() {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/admin/weekly-commissions', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({weekStart:week}),
      });
      const result=await res.json();
      if (!res.ok) throw new Error(result.error || 'Generation failed');
      setNotice('Relevé généré : ' + result.inserted + ' lignes ajoutées, ' +
        result.duplicatesSkipped + ' doublons évités, ' + result.excluded + ' commandes exclues.');
      setPage(1);
      await load();
    } catch(e) {setError(e instanceof Error ? e.message : 'Generation failed');}
    finally{setBusy(false);}
  }

  async function validate(line: Line) {
    if (busy || !window.confirm('Valider ce relevé ? Cela NE valide PAS un paiement bancaire.')) return;
    await mutate({lineId:line.id,action:'VALIDATE'});
  }
  async function mutate(body: Record<string,unknown>) {
    setBusy(true);setError('');setNotice('');
    try{
      const res=await fetch('/api/admin/weekly-commissions/lines',{
        method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
      });
      const data=await res.json();
      if(!res.ok)throw Error(data.error||'Action failed');
      setModal(null);setNotice('Action enregistrée dans le journal d’audit. Aucun virement effectué.');
      await load();
    }catch(e){setError(e instanceof Error?e.message:'Action failed');}
    finally{setBusy(false);}
  }
  function openModal(line:Line,action:Action) {
    setAmountEgp((line.amountPiasters/100).toFixed(2));setReason('');
    setModal({line,action});setError('');
  }
  async function confirmModal() {
    if(!modal)return;
    const body:Record<string,unknown>={lineId:modal.line.id,action:modal.action};
    if(modal.action==='EDIT') {
      const amount=amountToPiasters(amountEgp);
      if(amount === null || amount > modal.line.originalPiasters) {
        setError('Le montant doit être positif et ne peut pas dépasser la commission initiale.');return;
      }
      body.amountPiasters=amount;body.reason=reason;
    } else if(modal.action==='CANCEL'){body.reason=reason;}
    else{body.paymentReference=reason;}
    await mutate(body);
  }

  const filtered=useMemo(()=>{
    const needle=search.trim().toLowerCase();
    return (data?.lines||[]).filter(l=>(filter==='ALL'||l.status===filter) &&
      (!needle || [l.partnerName,l.referralCode,l.sourceOrderName,l.sourceOrderId].some(v=>v?.toLowerCase().includes(needle))));
  },[data,search,filter]);
  const stats=useMemo(()=>({
    draft:data?.totals.find(x=>x.status==='DRAFT')?.count||0,
    validated:data?.totals.find(x=>x.status==='VALIDATED')?.count||0,
    paid:data?.totals.find(x=>x.status==='PAID')?.count||0,
    cancelled:data?.totals.find(x=>x.status==='CANCELLED')?.count||0,
  }),[data]);
  const buttonStyle='rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#1F6B3A] disabled:opacity-40';

  async function exportCsv(){
    setError('');
    try{
      const params = new URLSearchParams({weekStart:week,format:'csv'});
      const res=await fetch('/api/admin/weekly-commissions/export?'+params.toString(),{cache:'no-store'});
      if(!res.ok)throw Error((await res.json()).error||'CSV export failed');
      const blob=await res.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='HV-Weekly-Commissions-'+week+'.csv';a.click();
      URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:'Export failed');}
  }

  return <main className="mx-auto max-w-7xl space-y-5 pb-12">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-[#1F6B3A]">Herbal Vitaly / Finance Control</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Weekly Commissions</h1>
      <p className="mt-1 text-sm text-slate-600">Generate, review and manage weekly COD commission reports for direct, Master and sub-partners.</p>
    </header>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex items-start gap-2">
        <ShieldAlert className="h-5 w-5 shrink-0"/>
        <p><strong>Finance protection.</strong> These are order-backed reporting lines, not payable balances.
          Validate only confirms administrative review. <strong>Mark as Paid remains locked</strong>
          until the COD settlement ledger and external bank confirmation are independently audited.
          No automatic payments or affiliate balance changes occur here.</p>
      </div>
    </div>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">
          Week starting (Monday · UTC)
          <input aria-label="Week starting Monday UTC" type="date" value={week}
            onChange={e=>{setWeek(e.target.value);setPage(1);}}
            className="mt-1 block rounded-lg border px-3 py-2.5"/>
        </label>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3A] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          disabled={busy||loading||!week} onClick={()=>void generate()}>
          <CalendarDays className="h-4 w-4"/> {busy?'Working...':'Generate weekly report'}
        </button>
        <button type="button" className={buttonStyle} onClick={()=>void load()} disabled={busy||loading}>
          <RefreshCw className="mr-1 inline h-4 w-4"/>Refresh
        </button>
        <button type="button" className={buttonStyle} disabled={busy||!data?.total} onClick={()=>void exportCsv()}>
          <Download className="mr-1 inline h-4 w-4"/>Export complete CSV
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Automatic draft generation: Monday 06:00 UTC, only after the database migration and cron secret are configured. Re-run any closed week safely to include late-reconciled orders.</p>
    </section>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {([
        ['Draft',stats.draft,'bg-slate-50'],
        ['Validated',stats.validated,'bg-green-50'],
        ['Paid record',stats.paid,'bg-blue-50'],
        ['Cancelled',stats.cancelled,'bg-rose-50'],
      ] as const).map(([title,count,bg])=><div key={title} className={'rounded-xl border p-4 '+bg}>
        <p className="text-sm text-slate-600">{title}</p>
        <p className="mt-2 text-2xl font-bold">{count}</p>
      </div>)}
    </div>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div><h2 className="font-semibold">Weekly commission lines</h2>
          <p className="text-xs text-slate-500">{data?.total||0} lines · {week} to next Monday (exclusive)</p></div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Search orders or partners" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Partner / order search..." className="rounded-lg border px-3 py-2 text-sm"/>
          <select aria-label="Filter status" value={filter} onChange={e=>setFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm">
            {['ALL','DRAFT','VALIDATED','PAID','CANCELLED'].map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr>
            {['Order','Beneficiary','Role','Sale','Commission','Status','Actions'].map(c=>
              <th key={c} className="px-4 py-3 font-semibold">{c}</th>)}
          </tr></thead>
          <tbody>{filtered.map(line=><tr key={line.id} className="border-t align-top">
            <td className="px-4 py-3"><span className="font-medium">{line.sourceOrderName}</span>
              <p className="mt-1 text-xs text-slate-500">{line.sourceOrderId}</p></td>
            <td className="px-4 py-3"><strong>{line.partnerName}</strong>
              <p className="text-xs text-slate-500">{line.referralCode||'No code'}</p></td>
            <td className="px-4 py-3 text-xs">{line.beneficiaryRole.replaceAll('_',' ')}</td>
            <td className="px-4 py-3">{money(line.salePiasters)}</td>
            <td className="px-4 py-3 font-semibold">{money(line.amountPiasters)}
              {line.amountPiasters!==line.originalPiasters&&<p className="text-xs text-amber-700">Adjusted</p>}</td>
            <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{line.status}</span></td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {line.status==='DRAFT'&&<>
                  <button disabled={busy} onClick={()=>void validate(line)} className={buttonStyle} title="Validate report review">
                    <CheckCircle2 className="mr-1 inline h-3.5 w-3.5"/>Validate</button>
                  <button disabled={busy} onClick={()=>openModal(line,'EDIT')} className={buttonStyle}>
                    <Pencil className="mr-1 inline h-3.5 w-3.5"/>Edit</button>
                </>}
                {(line.status==='DRAFT'||line.status==='VALIDATED')&&
                  <button disabled={busy} onClick={()=>openModal(line,'CANCEL')} className={buttonStyle}>
                    <CircleX className="mr-1 inline h-3.5 w-3.5"/>Cancel</button>}
                {line.status==='VALIDATED'&&
                  <button disabled={!data?.paymentRecordingEnabled || busy}
                    onClick={()=>openModal(line,'MARK_PAID')} className={buttonStyle}
                    title="Blocked pending independently audited COD payment controls">
                    <Wallet className="mr-1 inline h-3.5 w-3.5"/>Paid (locked)</button>}
              </div>
            </td>
          </tr>)}</tbody>
        </table>
        {loading&&<p className="p-5 text-sm text-slate-500">Loading weekly report...</p>}
        {!loading&&!filtered.length&&<p className="p-6 text-sm text-slate-500">No rows for this week or filter. Generate a closed week or check COD reconciliation status.</p>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t p-4 text-sm">
        <span className="text-slate-500">Page {data?.page||1} / {Math.max(1,data?.pages||1)} · Search applies to displayed page</span>
        <div className="flex gap-2">
          <button className={buttonStyle} disabled={page<=1||busy} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
          <button className={buttonStyle} disabled={busy||page>=(data?.pages||1)} onClick={()=>setPage(p=>p+1)}>Next</button>
        </div>
      </div>
    </section>

    {modal&&<div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="Edit weekly commission" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{modal.action==='EDIT'?'Edit commission':modal.action==='CANCEL'?'Cancel commission':'Record external payment'}</h2>
        <p className="mt-1 text-sm text-slate-600">{modal.line.partnerName} · {modal.line.sourceOrderName}</p>
        {modal.action==='EDIT'&&<label className="mt-4 block text-sm font-medium">
          New amount (EGP)
          <input type="text" inputMode="decimal" value={amountEgp} onChange={e=>setAmountEgp(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2"/>
          <span className="mt-1 block text-xs text-slate-500">Original maximum: {money(modal.line.originalPiasters)}</span>
        </label>}
        <label className="mt-4 block text-sm font-medium">
          {modal.action==='MARK_PAID'?'External transfer reference':'Mandatory justification (min 8 characters)'}
          <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={300} rows={3}
            className="mt-1 block w-full rounded-lg border px-3 py-2"/>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={buttonStyle} onClick={()=>setModal(null)} disabled={busy}>Close</button>
          <button type="button" className="rounded-lg bg-[#1F6B3A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={busy||reason.trim().length<8} onClick={()=>void confirmModal()}>
            {busy?'Saving...':'Confirm'}
          </button>
        </div>
      </div>
    </div>}
  </main>;
}
