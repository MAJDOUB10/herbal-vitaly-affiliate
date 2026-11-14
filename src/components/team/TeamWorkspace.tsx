'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import CommissionSimulator from '@/components/team/CommissionSimulator';
import { UsersRound, Wallet, ClipboardCopy, ShieldCheck, UserRoundPlus, RefreshCw } from 'lucide-react';

type View = 'team' | 'commissions' | 'payouts' | 'analytics';
type Partner = { id: string; name: string; email: string; status: string; verified: boolean;
  referralCode: string; shareBps: number; orders: number;
  salesPiasters: number; commissionPoolPreviewPiasters: number };
type Invite = { id: string; email: string; shareBps: number; expiresAt: string; usedAt: string | null };
type TeamResult = { partners: Partner[]; invites: Invite[]; financialStatus: string };
type CommissionRow = { orderId: string; order: string; partner: string; amountPiasters: number;
  childPiasters: number; masterPiasters: number; totalPiasters: number;
  shareBps: number; stage: string; updatedAt: string };
const money = (piasters: number) => (piasters / 100).toLocaleString('en-EG', { maximumFractionDigits: 2 }) + ' EGP';
const tabNames: Record<View, string> = {
  team: 'My Team', commissions: 'Team Commissions', payouts: 'Team Payouts', analytics: 'Team Analytics',
};
const links: { name: View; href: string }[] = [
  { name: 'team', href: '/affiliate/team' },
  { name: 'commissions', href: '/affiliate/team/commissions' },
  { name: 'payouts', href: '/affiliate/team/payouts' },
  { name: 'analytics', href: '/affiliate/team/analytics' },
];

export default function TeamWorkspace({ view }: { view: View }) {
  const [team, setTeam] = useState<TeamResult | null>(null);
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [share, setShare] = useState('60');
  const [inviteLink, setInviteLink] = useState('');
  const [rates, setRates] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/affiliate/team', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load team');
      setTeam(data as TeamResult);
      setRates(Object.fromEntries((data.partners as Partner[]).map(p => [p.id, String(p.shareBps / 100)])));
      if (view === 'commissions') {
        const commissions = await fetch('/api/affiliate/team/commissions', { cache: 'no-store' });
        const report = await commissions.json();
        if (!commissions.ok) throw new Error(report.error || 'Unable to load commissions');
        setRows(report.rows || []);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load'); }
    finally { setLoading(false); }
  }, [view]);
  useEffect(() => { void load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setInviteLink('');
    try {
      const response = await fetch('/api/affiliate/team/invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, shareBps: Math.round(Number(share) * 100) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invitation failed');
      setInviteLink(data.inviteUrl); setEmail(''); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Invitation failed'); }
    finally { setBusy(false); }
  }
  async function updateRate(partnerId: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/affiliate/team', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, shareBps: Math.round(Number(rates[partnerId]) * 100) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(false); }
  }

  async function saveSimulatorRate(partnerId: string, shareBps: number) {
    setBusy(true);
    try {
      const response = await fetch('/api/affiliate/team', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, shareBps }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed');
      await load();
    } finally {
      setBusy(false);
    }
  }
  const partners = team?.partners || [];
  const orders = partners.reduce((sum, p) => sum + p.orders, 0);
  const sales = partners.reduce((sum, p) => sum + p.salesPiasters, 0);
  const pool = partners.reduce((sum, p) => sum + p.commissionPoolPreviewPiasters, 0);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F6B3A]">Herbal Vitaly Partner Network</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{tabNames[view]}</h1>
          <p className="text-sm text-slate-500">Manage your network and review attributed sales.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>
      <nav aria-label="Team navigation" className="flex flex-wrap gap-2">
        {links.map(link => <Link key={link.href} href={link.href}
          className={'rounded-full px-4 py-2 text-sm font-medium ' +
            (view === link.name ? 'bg-[#1F6B3A] text-white' : 'border bg-white text-slate-700 hover:bg-slate-50')}>
          {tabNames[link.name]}</Link>)}
      </nav>
      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
      {loading ? <p className="py-12 text-center text-slate-500">Loading team data...</p> :
        !team ? <div className="rounded-xl border bg-white p-8">
          <ShieldCheck className="mb-3 h-8 w-8 text-[#1F6B3A]" />
          <h2 className="text-lg font-semibold">Master Partner authorization required</h2>
          <p className="mt-1 text-sm text-slate-600">An administrator must enable Master Partner access for your verified affiliate account.</p>
        </div> : <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Sub-partners', String(partners.length)],
              ['Verified COD orders', String(orders)],
              ['Reconciled sales', money(sales)],
              ['Commission pool estimate', money(pool)],
            ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-3 text-xl font-bold text-[#1F6B3A]">{value}</p></div>)}
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0" />
            <p><strong>Estimates only.</strong> Figures are based on Shopify order snapshots.
              They are not approved balances or payable earnings. No transfers are initiated from this module.</p>
          </div>
          {(view === 'team' || view === 'commissions') && <CommissionSimulator
            contextLabel="Partage entre Master et sous-partenaire · budget standard de 20 %"
            partners={partners.map(p => ({ id: p.id, name: p.name, shareBps: p.shareBps }))}
            onSaveShare={saveSimulatorRate}
          />}
          {view === 'team' && <>
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><UserRoundPlus className="h-5 w-5 text-[#1F6B3A]" /> Invite a sub-partner</h2>
              <p className="mt-1 text-sm text-slate-500">Invitations expire after 7 days. The invited partner creates their own password and verifies their email.</p>
              <form onSubmit={invite} className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <label className="text-sm font-medium">Partner email
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border px-3 py-2" placeholder="partner@example.com" /></label>
                <label className="text-sm font-medium">Share of your commission (%)
                  <input type="number" min="0" max="100" step="0.01" required value={share}
                    onChange={e => setShare(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
                <button disabled={busy} className="self-end rounded-lg bg-[#1F6B3A] px-5 py-2.5 font-medium text-white disabled:opacity-50">Create invitation</button>
              </form>
              {inviteLink && <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm">
                <p className="font-semibold text-green-900">Invitation created — share this link privately:</p>
                <p className="mt-1 break-all text-slate-700">{inviteLink}</p>
                <button type="button" className="mt-2 inline-flex items-center gap-1 font-semibold text-[#1F6B3A]"
                  onClick={() => void navigator.clipboard.writeText(inviteLink)}><ClipboardCopy className="h-4 w-4" /> Copy link</button>
              </div>}
            </section>
            <section className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b p-5"><UsersRound className="h-5 w-5 text-[#1F6B3A]" /><h2 className="font-semibold">Your partners</h2></div>
              <table className="w-full min-w-[730px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500"><tr>
                  {['Partner','Promo / referral code','Status','Orders','Sales (EGP)','Share of commission',''].map(h=><th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>{partners.map(p=><tr key={p.id} className="border-t">
                  <td className="px-4 py-3"><p className="font-semibold">{p.name}</p><p className="text-xs text-slate-500">{p.email}</p></td>
                  <td className="px-4 py-3 font-mono">{p.referralCode}</td>
                  <td className="px-4 py-3">{p.status}{!p.verified ? ' · Unverified' : ''}</td>
                  <td className="px-4 py-3">{p.orders}</td><td className="px-4 py-3">{money(p.salesPiasters)}</td>
                  <td className="px-4 py-3"><input aria-label={'Share for '+p.name} type="number" min="0" max="100" step="0.01"
                    value={rates[p.id] ?? String(p.shareBps / 100)} className="w-20 rounded-lg border px-2 py-1"
                    onChange={e=>setRates(v=>({...v,[p.id]:e.target.value}))} /> %</td>
                  <td className="px-4 py-3"><button type="button" disabled={busy} onClick={()=>void updateRate(p.id)}
                    className="font-semibold text-[#1F6B3A] disabled:opacity-50">Save</button></td>
                </tr>)}</tbody>
              </table>
              {!partners.length && <p className="p-6 text-sm text-slate-500">No sub-partners yet. Invite your first partner above.</p>}
            </section>
            <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Invitations</h2>
              {team.invites.length ? <ul className="mt-3 space-y-2 text-sm">{team.invites.map(i=>
                <li key={i.id} className="flex flex-wrap justify-between gap-2 border-b py-2">
                  <span>{i.email} · {i.shareBps / 100}%</span>
                  <span className="text-slate-500">{i.usedAt ? 'Accepted' : new Date(i.expiresAt).getTime() < Date.now() ? 'Expired' : 'Awaiting registration'}</span>
                </li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No invitations created.</p>}
            </section>
          </>}
          {view === 'commissions' && <section className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-5"><h2 className="font-semibold">Attributed order estimates</h2>
              <p className="mt-1 text-xs text-slate-500">Rates shown are the current configured shares. Historic payments must use frozen settlement snapshots.</p></div>
            <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-500">
              <tr>{['Order','Partner','Order value','Total pool','Sub-partner','Master Partner','Review status'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead><tbody>{rows.map(r=><tr key={r.orderId} className="border-t">
              <td className="px-4 py-3 font-medium">{r.order}</td><td className="px-4 py-3">{r.partner}</td>
              <td className="px-4 py-3">{money(r.amountPiasters)}</td>
              <td className="px-4 py-3">{money(r.totalPiasters)}</td>
              <td className="px-4 py-3">{money(r.childPiasters)}</td>
              <td className="px-4 py-3">{money(r.masterPiasters)}</td>
              <td className="px-4 py-3 text-xs">{r.stage.replaceAll('_',' ')}</td>
            </tr>)}</tbody></table>
            {!rows.length && <p className="p-6 text-sm text-slate-500">No attributed orders found.</p>}
          </section>}
          {view === 'payouts' && <section className="rounded-2xl border bg-white p-7">
            <Wallet className="mb-3 h-9 w-9 text-[#1F6B3A]" />
            <h2 className="text-lg font-semibold">Payouts are awaiting financial reconciliation</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Herbal Vitaly must approve verified delivery, collected COD funds, returns and an auditable split ledger before team payout requests can be enabled. This page does not create or issue payments.</p>
          </section>}
          {view === 'analytics' && <section className="rounded-2xl border bg-white p-7">
            <h2 className="font-semibold">Network performance overview</h2>
            <p className="mt-2 text-sm text-slate-600">Validated COD deliveries: {orders}. Reconciled order total: {money(sales)}. Estimated gross commission pool: {money(pool)}.</p>
            <p className="mt-3 text-xs text-slate-500">Reporting currently covers the most recent 100 direct sub-partners. Additional pages and trends require pagination.</p>
          </section>}
        </>}
    </div>
  );
}
