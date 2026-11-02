'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, BookOpen, RefreshCw, ShieldAlert } from 'lucide-react';

type TrialRow = {
  code: string; name: string; type: string;
  debitPiasters: string; creditPiasters: string; netDebitPiasters: string;
};
type Result = {
  success: boolean; status: string; certified: boolean; asOf: string;
  postedJournalCount: number; accountsCount: number; trialBalanceBalanced: boolean;
  journalDebitsPiasters: string; journalCreditsPiasters: string;
  trialBalance: TrialRow[];
  indicative: null | {
    assetsPiasters: string; liabilitiesPiasters: string; equityPiasters: string;
    revenueToDatePiasters: string; expensesToDatePiasters: string;
    profitToDatePiasters: string; balanceSheetDifferencePiasters: string;
  };
  limitations: string[];
};
const egp = (raw: string) =>
  new Intl.NumberFormat('en-EG', { style:'currency', currency:'EGP' }).format(Number(raw) / 100);

export default function NativeFinancialStatementsPage() {
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0,10));
  const [state, setState] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [serial, setSerial] = useState(0);
  const refresh = useCallback(() => setSerial(x=>x+1),[]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);setError('');
    fetch('/api/admin/finance/reports?asOf='+encodeURIComponent(asOf),{
      cache:'no-store',signal:controller.signal,
    }).then(async r => {
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Financial reporting unavailable');
      if(!controller.signal.aborted)setState(data);
    }).catch(e=>{if(!controller.signal.aborted){setError(e.message);setState(null);}})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[asOf,serial]);

  const summary = state?.indicative;
  const rows = [
    ['Assets',summary?.assetsPiasters],
    ['Liabilities',summary?.liabilitiesPiasters],
    ['Equity before current earnings',summary?.equityPiasters],
    ['Revenue since GL inception',summary?.revenueToDatePiasters],
    ['Expenses since GL inception',summary?.expensesToDatePiasters],
    ['Indicative earnings since GL inception',summary?.profitToDatePiasters],
  ];
  return <main lang="en" className="space-y-5 pb-12">
    <Link href="/admin/finance" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1F6B3A]"><ArrowLeft className="h-4 w-4"/> Finance & Accounting</Link>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#1F6B3A]">Herbal Vitaly · EGP</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#173621]">Financial Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Trial balance and indicative accounts from posted native journals only.</p></div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">As of <input className="rounded-lg border bg-white p-2" type="date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></label>
        <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4"/> Refresh</button>
      </div>
    </header>
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <ShieldAlert className="h-5 w-5 shrink-0"/>
      <p><strong>Not a statutory financial statement.</strong> Opening balances, inventory costs,
        complete tax treatment, bank reconciliation, and accountant sign-off are not confirmed.
        Empty books cannot be presented as zero profit or zero tax.</p>
    </div>
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {busy&&<p className="text-sm text-slate-500">Checking posted journal balances…</p>}
    {state&&<>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Chart of accounts</p>
          <p className="mt-1 text-2xl font-semibold">{state.accountsCount}</p>
          <p className="text-xs text-slate-500">Accountant approval required</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Posted journals</p>
          <p className="mt-1 text-2xl font-semibold">{state.postedJournalCount}</p>
          <p className="text-xs text-slate-500">Drafts are excluded</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Debit / Credit control</p>
          <p className="mt-1 text-lg font-semibold text-[#173621]">{state.trialBalanceBalanced?'Balanced':'Review required'}</p>
          <p className="text-xs text-slate-500">Data not certified</p>
        </div>
      </div>
      {summary?<>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-[#173621]"><BarChart3 className="h-5 w-5"/> Indicative Ledger Totals</h2>
          <p className="mt-1 text-xs text-slate-500">Cumulative accounting entries through {state.asOf}. Not a fiscal-year P&L.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{rows.map(([label,value])=><div key={label} className="flex justify-between gap-4 border-b p-2 text-sm"><span>{label}</span><strong className="tabular-nums">{egp(value||'0')}</strong></div>)}</div>
        </section>
      </>:<div className="rounded-2xl border bg-white p-7 text-center">
        <BookOpen className="mx-auto h-7 w-7 text-[#1F6B3A]"/>
        <h2 className="mt-2 font-semibold">No validated financial statements available</h2>
        <p className="mt-1 text-sm text-slate-500">Configure the chart of accounts, approved opening balances and posted journals before reporting profit or tax.</p>
      </div>}
      <section className="overflow-hidden rounded-2xl border bg-white">
        <h2 className="border-b p-4 font-semibold text-[#173621]">Trial Balance · EGP</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>
          <th className="p-3">Account</th><th className="p-3">Category</th><th className="p-3 text-right">Debits</th><th className="p-3 text-right">Credits</th>
        </tr></thead><tbody className="divide-y">{state.trialBalance.map(r=><tr key={r.code}>
          <td className="p-3"><span className="font-semibold">{r.code}</span> · {r.name}</td><td className="p-3">{r.type}</td>
          <td className="p-3 text-right tabular-nums">{egp(r.debitPiasters)}</td>
          <td className="p-3 text-right tabular-nums">{egp(r.creditPiasters)}</td>
        </tr>)}
        {!state.trialBalance.length&&<tr><td className="p-6 text-center text-slate-500" colSpan={4}>No approved chart of accounts yet.</td></tr>}
        </tbody></table></div>
      </section>
    </>}
  </main>;
}
