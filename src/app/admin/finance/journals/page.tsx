'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, RefreshCw, ShieldAlert } from 'lucide-react';

type Journal = {
  id: string;
  documentNo: string;
  effectiveDate: string;
  description: string;
  currency: string;
  status: string;
  lines: Array<{
    lineNumber: number;
    accountCode: string;
    accountName: string;
    debitPiasters: string;
    creditPiasters: string;
  }>;
};
type Response = { success: boolean; status: string; journals: Journal[]; note: string };

const formatPiasters = (value: string) =>
  new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(Number(value) / 100);

export default function NativeAccountingJournalsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    fetch('/api/admin/finance/journals', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Could not load general ledger');
        if (!controller.signal.aborted) setData(json);
      })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [refresh]);

  return <main lang="en" className="space-y-5 pb-10">
    <Link href="/admin/finance" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1F6B3A]">
      <ArrowLeft className="h-4 w-4" /> Finance & Accounting
    </Link>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[.2em] font-semibold text-[#1F6B3A]">Herbal Vitaly · EGP</p>
        <h1 className="mt-1 text-2xl font-bold text-[#173621]">Native General Ledger</h1>
        <p className="mt-1 text-sm text-slate-500">Journal entries and balanced debit/credit lines. Read-only interface.</p>
      </div>
      <button onClick={() => setRefresh(x => x + 1)}
        className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-[#1F6B3A]">
        <RefreshCw className="h-4 w-4"/> Refresh
      </button>
    </header>

    <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <p>This native ledger requires a reviewed database migration, accountant-approved chart of
        accounts, fiscal periods and opening balances. Production accounting posting is disabled;
        no invoices, taxes or profit are inferred from operational sales metrics.</p>
    </div>

    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {!data && !error && <p role="status" className="text-sm text-slate-500">Loading native accounting records…</p>}
    {data?.status === 'NOT_ACTIVATED' &&
      <div className="rounded-2xl border bg-white p-8 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-[#1F6B3A]"/>
        <h2 className="mt-2 font-semibold">Accounting schema not activated</h2>
        <p className="mt-1 text-sm text-slate-500">{data.note}</p>
      </div>}
    {data?.status === 'SCHEMA_READY' && (
      <div className="space-y-3">
        {data.journals.length === 0 && <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">
          No journal entries recorded. Financial balances are unavailable until validated entries are posted.
        </p>}
        {data.journals.map(journal => (
          <section key={journal.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-[#173621]">{journal.documentNo}</h2>
                <p className="text-xs text-slate-500">{journal.effectiveDate} · {journal.description}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{journal.status}</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr><th className="p-2">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr>
                </thead>
                <tbody>
                  {journal.lines.map(line => <tr key={line.lineNumber} className="border-t">
                    <td className="p-2">{line.accountCode} · {line.accountName}</td>
                    <td className="p-2 text-right tabular-nums">{formatPiasters(line.debitPiasters)}</td>
                    <td className="p-2 text-right tabular-nums">{formatPiasters(line.creditPiasters)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    )}
  </main>;
}
