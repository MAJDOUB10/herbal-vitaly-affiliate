'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, FilePlus2, RefreshCw, ReceiptText, ShieldAlert, Plus, Trash2 } from 'lucide-react';

type Party = { id: string; name: string; kind: string; email: string | null; taxId: string | null };
type FinanceDoc = {
  id: string; number: string; kind: string; status: string; description: string;
  documentDate: string; totalPiasters: string; taxPiasters: string;
  counterparty: { id: string; name: string } | null;
};
type Line = { description: string; sku: string; net: string; tax: string; taxCode: string };
const todayISO = () => new Date().toISOString().slice(0, 10);
const startLine = (): Line => ({ description: '', sku: '', net: '', tax: '0', taxCode: '' });
const money = (p: string) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(Number(p) / 100);
const piasters = (s: string) => {
  const value = s.trim();
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Enter a positive EGP amount with at most 2 decimals');
  const result = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2,'0'));
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeds EGP precision limit');
  return result;
};

export default function FinanceDocumentsPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [documents, setDocuments] = useState<FinanceDoc[]>([]);
  const [kind, setKind] = useState('SUPPLIER_BILL');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [description, setDescription] = useState('');
  const [documentDate, setDocumentDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [lines, setLines] = useState<Line[]>([startLine()]);
  const [partyName, setPartyName] = useState('');
  const [partyKind, setPartyKind] = useState('SUPPLIER');
  const [partyTax, setPartyTax] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [draftsEnabled, setDraftsEnabled] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, h] = await Promise.all([
        fetch('/api/admin/finance/parties', { cache:'no-store' }),
        fetch('/api/admin/finance/documents', { cache:'no-store' }),
        fetch('/api/admin/finance/health', { cache:'no-store' }),
      ]);
      const partyJSON = await p.json(), docJSON = await d.json(), healthJSON = await h.json();
      if (!p.ok || !d.ok) throw new Error(partyJSON.error || docJSON.error || 'Finance tables unavailable');
      setParties(partyJSON.parties || []);
      setDocuments(docJSON.documents || []);
      setDraftsEnabled(healthJSON.draftEditingEnabled === true);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load finance data');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const options = useMemo(() =>
    parties.filter(p => kind === 'EXPENSE' ||
      (kind === 'SUPPLIER_BILL' ? ['SUPPLIER','BOTH'] : ['CUSTOMER','BOTH']).includes(p.kind)),
  [kind,parties]);

  const updateLine = (i: number, key: keyof Line, value: string) =>
    setLines(old => old.map((l, n) => n === i ? { ...l, [key]: value } : l));

  const createParty = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/admin/finance/parties', {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:partyName,kind:partyKind,taxId:partyTax || null}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save supplier');
      setPartyName('');setPartyTax('');setMessage('Counterparty added.');await reload();
    }catch(e){setError(e instanceof Error?e.message:'Save failed');}
    finally{setBusy(false);}
  };

  const createDocument = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const structuredLines = lines.map(l=>({
        description:l.description,sku:l.sku||null,netPiasters:piasters(l.net),
        taxPiasters:piasters(l.tax||'0'),taxCode:l.taxCode||null,
      }));
      const res = await fetch('/api/admin/finance/documents',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          kind,counterpartyId:counterpartyId||null,description,
          documentDate,dueDate:dueDate||null,externalRef:externalRef||null,
          idempotencyKey:'manual-'+crypto.randomUUID(),
          lines:structuredLines,
        }),
      });
      const json=await res.json();
      if(!res.ok)throw new Error(json.error||'Could not save finance draft');
      setDescription('');setExternalRef('');setDueDate('');setLines([startLine()]);
      setMessage('Financial document saved as DRAFT only. Not posted to the ledger.');
      await reload();
    }catch(e){setError(e instanceof Error?e.message:'Save failed');}
    finally{setBusy(false);}
  };

  const label = 'block text-xs font-semibold text-slate-600 mb-1';
  const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1F6B3A] focus:outline-none focus:ring-2 focus:ring-emerald-100';

  return <main lang="en" className="space-y-6 pb-12">
    <Link href="/admin/finance" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1F6B3A]">
      <ArrowLeft className="h-4 w-4"/> Finance & Accounting
    </Link>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#1F6B3A]">Herbal Vitaly · Finance Operations</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#173621]">Purchases, Suppliers & Expenses</h1>
        <p className="mt-1 text-sm text-slate-500">Draft documents in EGP. Source records only; they do not affect the general ledger or VAT filings.</p>
      </div>
      <button type="button" onClick={()=>void reload()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">
        <RefreshCw className="h-4 w-4"/> Refresh
      </button>
    </header>
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <ShieldAlert className="h-5 w-5 shrink-0"/>
      <div><strong>{draftsEnabled?'Draft entry unlocked':'Draft entry locked'}.</strong> Supplier bills, customer invoices, expense receipts and credit notes remain NON-ISSUED drafts.
        Tax line entries are provisional until approved by an Egyptian accountant. No bank transfer, Shopify change or tax submission will occur.</div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
    {loading && <p role="status" className="text-sm text-slate-500">Loading finance registers…</p>}
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-[#1F6B3A]"/><h2 className="font-semibold text-[#173621]">Suppliers & Customers</h2></div>
        <p className="mt-1 text-xs text-slate-500">{parties.length} counterparties available</p>
        <form className="mt-4 space-y-3" onSubmit={createParty}>
          <div><label className={label} htmlFor="party-name">Legal / Trade name</label><input id="party-name" required className={field} maxLength={200} value={partyName} onChange={e=>setPartyName(e.target.value)}/></div>
          <div><label className={label} htmlFor="party-kind">Role</label><select id="party-kind" className={field} value={partyKind} onChange={e=>setPartyKind(e.target.value)}>
            <option value="SUPPLIER">Supplier</option><option value="CUSTOMER">Customer</option><option value="BOTH">Both</option>
          </select></div>
          <div><label className={label} htmlFor="party-tax">Tax ID (optional, unverified)</label><input id="party-tax" className={field} maxLength={50} value={partyTax} onChange={e=>setPartyTax(e.target.value)}/></div>
          <button type="submit" disabled={busy||!draftsEnabled} className="inline-flex items-center gap-2 rounded-lg bg-[#1F6B3A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            <Plus className="h-4 w-4"/> Add counterparty
          </button>
        </form>
        <div className="mt-4 max-h-60 overflow-auto divide-y text-sm">
          {parties.slice(0,40).map(p=><div key={p.id} className="flex justify-between gap-2 py-2">
            <span className="font-medium">{p.name}</span><span className="shrink-0 text-slate-500">{p.kind}</span>
          </div>)}
          {!parties.length && <p className="py-3 text-xs text-slate-500">No suppliers or customers yet.</p>}
        </div>
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-[#1F6B3A]"/><h2 className="font-semibold text-[#173621]">New financial document</h2></div>
        <form className="mt-4 space-y-3" onSubmit={createDocument}>
          <div><label htmlFor="finance-kind" className={label}>Document type</label>
            <select id="finance-kind" className={field} value={kind} onChange={e=>{setKind(e.target.value);setCounterpartyId('');}}>
              <option value="SUPPLIER_BILL">Supplier Bill / Purchase</option><option value="EXPENSE">Expense</option>
              <option value="CUSTOMER_INVOICE">Customer Invoice Draft</option><option value="CREDIT_NOTE">Credit Note Draft</option>
            </select></div>
          <div><label htmlFor="finance-party" className={label}>Counterparty {kind==='EXPENSE'?'(optional)':'(required)'}</label>
            <select id="finance-party" className={field} value={counterpartyId} required={kind!=='EXPENSE'} onChange={e=>setCounterpartyId(e.target.value)}>
              <option value="">Select counterparty</option>{options.map(p=><option key={p.id} value={p.id}>{p.name} · {p.kind}</option>)}
            </select></div>
          <div><label htmlFor="finance-desc" className={label}>Purpose / Description</label><input id="finance-desc" required minLength={3} maxLength={500} className={field} value={description} onChange={e=>setDescription(e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label htmlFor="finance-date" className={label}>Document date</label><input type="date" required id="finance-date" value={documentDate} className={field} onChange={e=>setDocumentDate(e.target.value)}/></div>
            <div><label htmlFor="finance-due" className={label}>Due date</label><input type="date" id="finance-due" value={dueDate} className={field} onChange={e=>setDueDate(e.target.value)}/></div>
          </div>
          <div><label htmlFor="finance-ref" className={label}>Supplier reference (optional)</label><input id="finance-ref" className={field} value={externalRef} maxLength={160} onChange={e=>setExternalRef(e.target.value)}/></div>
          <div className="space-y-3 border-t pt-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#173621]">Document lines · EGP</h3>
            {lines.map((l,i)=><div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2"><strong className="text-xs">Line {i+1}</strong>
                {lines.length>1 && <button type="button" aria-label={'Remove line '+(i+1)} onClick={()=>setLines(x=>x.filter((_,n)=>n!==i))}><Trash2 className="h-4 w-4 text-rose-600"/></button>}
              </div>
              <input aria-label={'Line '+(i+1)+' description'} placeholder="Product or expense description" required className={field+' mt-2'} maxLength={350} value={l.description} onChange={e=>updateLine(i,'description',e.target.value)}/>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div><label className={label}>Net amount EGP</label><input inputMode="decimal" placeholder="0.00" required className={field} value={l.net} onChange={e=>updateLine(i,'net',e.target.value)}/></div>
                <div><label className={label}>Provisional tax EGP</label><input inputMode="decimal" className={field} value={l.tax} onChange={e=>updateLine(i,'tax',e.target.value)}/></div>
              </div>
            </div>)}
            <button type="button" onClick={()=>setLines(x=>x.length<100?[...x,startLine()]:x)} className="text-xs font-semibold text-[#1F6B3A]">+ Add item line</button>
          </div>
          <button type="submit" disabled={busy||!draftsEnabled} className="w-full rounded-lg bg-[#1F6B3A] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
            Save non-posted draft
          </button>
        </form>
      </div>
    </section>
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b p-4"><ReceiptText className="h-5 w-5 text-[#1F6B3A]"/><h2 className="font-semibold">Company finance draft register</h2></div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>
          <th className="p-3">Date</th><th className="p-3">Number / Type</th><th className="p-3">Counterparty</th>
          <th className="p-3 text-right">Total EGP</th><th className="p-3">Status</th>
        </tr></thead><tbody className="divide-y">
          {documents.map(d=><tr key={d.id}><td className="whitespace-nowrap p-3">{d.documentDate}</td>
            <td className="p-3"><div className="font-medium">{d.kind.replaceAll('_',' ')}</div><div className="text-xs text-slate-500">{d.number}</div></td>
            <td className="p-3">{d.counterparty?.name||'—'}</td><td className="p-3 text-right tabular-nums">{money(d.totalPiasters)}</td>
            <td className="p-3 text-xs font-semibold text-amber-700">{d.status}</td></tr>)}
          {!documents.length&&!loading&&<tr><td colSpan={5} className="p-7 text-center text-sm text-slate-500">No company finance drafts. Nothing has been posted.</td></tr>}
        </tbody></table>
      </div>
    </section>
  </main>;
}
