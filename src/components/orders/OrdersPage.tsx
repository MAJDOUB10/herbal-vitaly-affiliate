'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShoppingBag, Tag, Link2 } from 'lucide-react';

type Attribution = 'AFFILIATE_LINK' | 'PROMO_CODE' | 'LINK_AND_PROMO' | 'CONFLICT' | 'UNATTRIBUTED' | 'UNVERIFIED';
type OrderRow = {
  id: string;
  orderName: string;
  totalEGP: string;
  subtotalEGP: string;
  currency: string;
  updatedAt: string;
  attributionSource: Attribution;
  discountCode: string | null;
  referralCode?: string | null;
  affiliateId?: string | null;
  partnerName?: string | null;
  status: string;
};
type PartnerOption = { id: string; name: string; code: string };
type WebhookStatus = {
  success: boolean; hasOrderAccess?: boolean; hmacConfigured?: boolean;
  matching?: Array<{ topic: string; installed: boolean }>;
  error?: string;
};

type ResponseData = {
  success: boolean; orders: OrderRow[]; partners?: PartnerOption[];
  total: number; page: number; perPage: number; error?: string;
};
const sourceLabels: Record<string, string> = {
  AFFILIATE_LINK: 'Referral link',
  PROMO_CODE: 'Promo code',
  LINK_AND_PROMO: 'Link + promo',
  CONFLICT: 'Attribution conflict',
  UNATTRIBUTED: 'Unattributed',
  UNVERIFIED: 'Not verified',
};
const sourceOptions = Object.entries(sourceLabels);
const orderStatusLabels: Record<string, string> = {
  CANCELLED: 'Cancelled', REFUNDED: 'Refunded', ATTRIBUTION_CONFLICT: 'Review attribution',
  UNATTRIBUTED: 'Unattributed', NON_COD_REVIEW: 'Non-COD review',
  PENDING_FINANCIAL_APPROVAL: 'Awaiting finance approval',
  AWAITING_COD_RECONCILIATION: 'Awaiting COD reconciliation', PENDING_DELIVERY: 'Pending delivery',
};
const amount = (v: string) => new Intl.NumberFormat('en-EG', {
  style: 'currency', currency: 'EGP', maximumFractionDigits: 2,
}).format(Number(v) || 0);
const date = (v: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(v));

export default function OrdersPage({ admin = false }: { admin?: boolean }) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [partner, setPartner] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [syncStatus, setSyncStatus] = useState<WebhookStatus | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const fetchOrders = useCallback(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (admin && source) params.set('source', source);
    if (admin && partner) params.set('affiliateId', partner);
    if (admin && search) params.set('search', search);
    const endpoint = admin ? '/api/admin/orders' : '/api/affiliate/shopify-orders';
    setLoading(true);
    setError('');
    fetch(endpoint + '?' + params.toString(), { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json() as ResponseData;
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load orders');
        setRows(data.orders || []);
        setTotal(data.total);
        setPerPage(data.perPage || 25);
        if (admin && data.partners) setPartners(data.partners);
      })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || 'Unable to load orders'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin, page, partner, search, source, refresh]);
  useEffect(() => fetchOrders(), [fetchOrders]);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shopify/order-webhooks', { cache: 'no-store' });
      const data = await res.json() as WebhookStatus;
      setSyncStatus({ ...data, success: res.ok && data.success });
    } catch {
      setSyncStatus({ success: false, error: 'Unable to check Shopify webhook status' });
    }
  }, []);
  useEffect(() => { if (admin) { void fetchSyncStatus(); } }, [admin, fetchSyncStatus]);

  const activateWebhooks = async () => {
    setSyncLoading(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/admin/shopify/order-webhooks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Shopify subscription failed');
      setSyncMessage('Order webhooks registered. New Shopify orders will be received automatically.');
      await fetchSyncStatus();
      setRefresh(v => v + 1);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Unable to register Shopify order webhooks');
    } finally {
      setSyncLoading(false);
    }
  };

  const backfillRecentOrders = async () => {
    if (!window.confirm('Recover up to 50 recently updated Shopify orders? This does not mark any order paid or delivered.')) return;
    setRecovering(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/admin/shopify/backfill-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 2 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Some Shopify orders could not be synchronized');
      setSyncMessage(`Scanned ${data.scanned}; imported/updated ${data.importedOrUpdated}; unchanged ${data.unchanged}.` +
        (data.moreAvailable ? ' Additional pages exist in Shopify; this is a partial recovery.' : ''));
      setRefresh(v => v + 1);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Shopify recovery failed');
    } finally { setRecovering(false); }
  };

  const pageTotal = useMemo(() =>
    rows.reduce((sum, o) => sum + Number(o.totalEGP || 0), 0), [rows]);
  const maxPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <main className="space-y-5 p-3 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
            Herbal Vitaly Affiliate Hub
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#17251D]">
            <ShoppingBag className="h-6 w-6 text-primary" /> Orders · Commandes
          </h1>
          <p className="text-sm text-muted-foreground">
            {admin
              ? 'Shopify orders attributed by approved affiliate referral links or assigned promo codes.'
              : 'Your Shopify sales from referral links and your assigned promo codes.'}
          </p>
        </div>
        <button type="button" onClick={() => setRefresh(v => v + 1)}
          className="flex items-center gap-2 rounded-lg border border-[#E4EBE6] bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-[#EAF4ED]">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>
      {admin && (
        <section className="space-y-3 rounded-xl border border-[#E4EBE6] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#17251D]">Shopify → Refferq order synchronization</h2>
              <p className="text-xs text-muted-foreground">Live app-specific webhook status; no payouts or commissions are approved.</p>
            </div>
            <button type="button" onClick={() => void fetchSyncStatus()}
              className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-xs font-medium text-primary">Check synchronization</button>
          </div>
          {syncStatus?.success ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={syncStatus.hasOrderAccess ? 'text-green-700' : 'text-amber-800'}>
                Shopify read_orders: {syncStatus.hasOrderAccess ? 'authorized' : 'missing'}
              </span>
              <span>· HMAC: {syncStatus.hmacConfigured ? 'configured' : 'missing'}</span>
              {(syncStatus.matching || []).map(x => (
                <span key={x.topic} className={'rounded-full px-2 py-1 ' +
                  (x.installed ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800')}>
                  {x.topic}: {x.installed ? 'connected' : 'missing'}
                </span>
              ))}
            </div>
          ) : <p className="text-xs text-amber-800">{syncStatus?.error || 'Checking Shopify app connection…'}</p>}
          {syncStatus?.success && syncStatus.hasOrderAccess &&
           syncStatus.hmacConfigured && syncStatus.matching?.some(x => !x.installed) &&
            <button type="button" onClick={activateWebhooks} disabled={syncLoading}
              className="rounded-lg bg-[#1F6B3A] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {syncLoading ? 'Connecting…' : 'Activate Shopify order webhooks'}
            </button>}
          {syncStatus?.success && syncStatus.hasOrderAccess &&
            <button type="button" onClick={backfillRecentOrders} disabled={recovering}
              className="rounded-lg border border-[#1F6B3A] px-4 py-2 text-xs font-semibold text-[#1F6B3A] disabled:opacity-50">
              {recovering ? 'Reconciling…' : 'Recover recent Shopify orders'}
            </button>}
          {syncMessage && <p role="status" className="text-sm text-amber-800">{syncMessage}</p>}
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E4EBE6] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Matching orders</p>
          <p className="mt-2 text-2xl font-bold text-primary">{total}</p>
        </div>
        <div className="rounded-xl border border-[#E4EBE6] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Current page · order value</p>
          <p className="mt-2 text-2xl font-bold text-primary">{amount(String(pageTotal))}</p>
        </div>
        <div className="rounded-xl border border-[#E4EBE6] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Commissions</p>
          <p className="mt-2 text-sm font-semibold text-amber-700">Subject to COD/Bosta + finance review</p>
        </div>
      </div>
      {admin && (
        <div className="grid gap-3 rounded-xl border border-[#E4EBE6] bg-white p-4 md:grid-cols-3">
          <label className="space-y-1 text-sm font-medium">
            <span>Search order / referral / coupon</span>
            <span className="relative block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input className="w-full rounded-lg border border-[#E4EBE6] py-2 pl-9 pr-3 outline-none focus:ring-2 focus:ring-primary"
                value={search} placeholder="Order #, promo code..."
                onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </span>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Partner</span>
            <select value={partner} onChange={e => { setPartner(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-[#E4EBE6] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary">
              <option value="">All partners</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Attribution source</span>
            <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-[#E4EBE6] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary">
              <option value="">All sources</option>
              {sourceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-[#E4EBE6] bg-white shadow-sm">
        {error && <p role="alert" className="border-b bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b bg-[#F7FAF8] text-left text-[#42564A]">
              <tr>{['Order', 'Date', ...(admin ? ['Partner'] : []), 'Source', 'Promo code', 'Status', 'Total'].map(h =>
                <th className="whitespace-nowrap px-4 py-3 font-semibold" key={h}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#E4EBE6]">
              {rows.map(o => (
                <tr key={o.id} className="hover:bg-[#F7FAF8]">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{o.orderName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{date(o.updatedAt)}</td>
                  {admin && <td className="px-4 py-3">{o.partnerName || '—'}{o.referralCode &&
                    <div className="text-xs text-muted-foreground">{o.referralCode}</div>}</td>}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EAF4ED] px-2 py-1 text-xs font-medium text-primary">
                      {o.attributionSource === 'PROMO_CODE' ? <Tag className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                      {sourceLabels[o.attributionSource] || o.attributionSource}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{o.discountCode || '—'}</td>
                  <td className="px-4 py-3 text-xs">{orderStatusLabels[o.status] || o.status}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{amount(o.totalEGP)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={admin ? 7 : 6} className="p-10 text-center text-muted-foreground">
                {loading ? 'Loading Shopify orders…' : 'No orders yet for these filters. Tracking must also be enabled on Shopify.'}
              </td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4EBE6] px-4 py-3 text-sm">
          <span className="text-muted-foreground">Page {page} of {maxPage} · {total} matching orders</span>
          <div className="flex gap-2">
            <button type="button" disabled={loading || page <= 1} onClick={() => setPage(v => v - 1)}
              className="rounded-lg border px-3 py-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" disabled={loading || page >= maxPage} onClick={() => setPage(v => v + 1)}
              className="rounded-lg border px-3 py-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Read-only reporting. Orders can be cancelled, returned or unpaid; displayed totals are not commissions.
        Payment authorization requires verified delivery, collection and reconciliation.
      </p>
    </main>
  );
}
