'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, BookOpen, Building2, CalendarDays, CircleAlert, FileText,
  Landmark, Package, ReceiptText, RefreshCcw, Scale, ShoppingBag, Truck, Users, Wallet,
} from 'lucide-react';

type Snapshot = {
  success: true;
  days: number;
  currency: 'EGP';
  dataAsOf: string;
  operational: {
    trackedOrders: number;
    trackedOrderValuePiasters: number;
    deliveredOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
    codReconciledOrders: number;
    codReconciledOrderValuePiasters: number;
    codAwaitingReconciliationOrders: number;
    codAwaitingReconciliationOrderValuePiasters: number;
    pendingCommissionsPiasters: number;
    approvedCommissionsPiasters: number;
    paidCommissionsPiasters: number;
  };
  accounting: { connected: false };
  limitations: string[];
};

const currency = (piasters: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency', currency: 'EGP', minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(piasters / 100);

const cards = [
  { name: 'Sales & Customers', href: '/admin/orders', description: 'Shopify orders, refunds and customer records', icon: ShoppingBag, ready: true },
  { name: 'COD Reconciliation', href: '/admin/cod', description: 'Bosta collections and evidence-based merchant settlement', icon: Truck, ready: true },
  { name: 'Affiliate Commissions', href: '/admin/payouts', description: 'Pending, approved and paid partner commissions', icon: Users, ready: true },
  { name: 'Customer Invoices', href: '', description: 'Customer invoices, credit notes and receivables', icon: ReceiptText, ready: false },
  { name: 'Purchases & Suppliers', href: '', description: 'Purchase orders, supplier bills and accounts payable', icon: Building2, ready: false },
  { name: 'Expenses & Budgets', href: '', description: 'Operating expenses, advertising and cost centers', icon: Wallet, ready: false },
  { name: 'Inventory & COGS', href: '', description: 'Product costs, valuation and gross margins', icon: Package, ready: false },
  { name: 'General Ledger', href: '', description: 'Chart of accounts, balanced entries and trial balance', icon: BookOpen, ready: false },
  { name: 'Tax & ETA', href: '', description: 'Egypt tax mapping, e-Invoice and e-Receipt', icon: Scale, ready: false },
  { name: 'Financial Statements', href: '', description: 'Balance sheet, P&L and cash flow from posted entries', icon: FileText, ready: false },
];

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold text-[#173621]">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default function FinanceAccountingPage() {
  const [days, setDays] = useState(30);
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/admin/finance/overview?days=' + days, {
      signal: controller.signal, cache: 'no-store',
    }).then(async response => {
      const json = await response.json();
      if (!response.ok || json.success !== true) throw new Error(json.error || 'Unable to load finance data');
      setSnapshot(json as Snapshot);
    }).catch(error => {
      if (!controller.signal.aborted) { setSnapshot(null); setError(error.message); }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [days, refresh]);

  const data = snapshot?.operational;

  return (
    <main lang="en" className="space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F6B3A]">Herbal Vitaly · Egypt</p>
          <h1 className="mt-1 text-2xl font-bold text-[#173621]">Finance & Accounting</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Company-wide financial workspace. The operational figures below are live Refferq records;
            statutory accounting remains unavailable until a dedicated ledger is connected and reconciled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
            <CalendarDays className="h-4 w-4 text-[#1F6B3A]" />
            <select aria-label="Reporting period" value={days} onChange={event => setDays(Number(event.target.value))}
              className="bg-transparent outline-none">
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>365 days</option>
            </select>
          </label>
          <button type="button" onClick={() => setRefresh(value => value + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F6B3A] px-3 py-2 text-sm font-semibold text-white">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <strong>Accounting not connected.</strong> No purchases, supplier invoices, bank balances,
            income statement, taxes payable or net profit are being calculated. Nothing on this page
            creates invoices, journal entries, commission approvals or payments.
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[#173621]">Operational financial indicators</h2>
          <p className="text-xs text-slate-500">EGP only · selected period · not accounting revenue</p>
        </div>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {loading && <p role="status" className="rounded-xl border bg-white p-4 text-sm text-slate-500">Loading verified operational data…</p>}
        {data && !loading && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Tracked Shopify order value" value={currency(data.trackedOrderValuePiasters)}
              hint={data.trackedOrders + ' imported orders; includes cancelled/refunded orders'} />
            <Metric label="Delivered orders" value={String(data.deliveredOrders)}
              hint={data.cancelledOrders + ' cancelled · ' + data.refundedOrders + ' refunded'} />
            <Metric label="Reconciled COD order value" value={currency(data.codReconciledOrderValuePiasters)}
              hint={data.codReconciledOrders + ' records with merchant settlement reference; not bank balance'} />
            <Metric label="COD awaiting merchant reconciliation" value={currency(data.codAwaitingReconciliationOrderValuePiasters)}
              hint={data.codAwaitingReconciliationOrders + ' delivered and courier-collected orders'} />
            <Metric label="Pending affiliate commissions" value={currency(data.pendingCommissionsPiasters)}
              hint="Not payable until eligible and approved" />
            <Metric label="Approved affiliate commissions" value={currency(data.approvedCommissionsPiasters)}
              hint="Recorded commission state; separate from bank settlement" />
            <Metric label="Paid affiliate commissions" value={currency(data.paidCommissionsPiasters)}
              hint="Recorded payout status; requires payment evidence" />
            <Metric label="Accounting net profit" value="Not available"
              hint="Requires validated sales, purchases, expenses, taxes and COGS ledger entries" />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[#173621]">Finance modules</h2>
          <p className="text-xs text-slate-500">Operational pages are linked; full accounting modules require ERP integration.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(item => (
            <div key={item.name} className="rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <item.icon className="h-5 w-5 text-[#1F6B3A]" />
                <span className={'rounded-full px-2 py-1 text-[11px] font-medium ' +
                  (item.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600')}>
                  {item.ready ? 'Operational data' : 'ERP required'}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[#173621]">{item.name}</h3>
              <p className="mt-1 min-h-10 text-xs text-slate-500">{item.description}</p>
              {item.ready ? (
                <Link href={item.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1F6B3A]">
                  Open module <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : (
                <p className="mt-3 text-xs font-medium text-slate-500">Not yet connected</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E4EBE6] bg-white p-5">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-[#1F6B3A]" />
          <h2 className="font-semibold text-[#173621]">Full accounting implementation requirements</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Deploy a separate double-entry accounting service; configure EGP chart of accounts,
          Egyptian tax treatment per product, supplier and customer masters, payment clearing accounts,
          validated Shopify/Bosta imports, immutable posting and reversal journals, and accountant approval.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Phase 1 is deliberately read-only. Never infer tax liability or net profit from orders alone.
          Existing Affiliate payout and COD safety gates remain unchanged.
        </p>
      </section>
    </main>
  );
}
