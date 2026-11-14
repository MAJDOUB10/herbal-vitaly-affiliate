'use client';

import { useEffect, useState } from 'react';
import CommissionSimulator, { type SimulatorPartner } from '@/components/team/CommissionSimulator';

type Partner = {
  id: string; isMasterPartner: boolean; referralCode: string;
  user: { name: string; email: string; status: string; emailVerifiedAt: string | null };
  _count: { subPartners: number };
};

export default function PartnerNetworksPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [subPartners, setSubPartners] = useState<SimulatorPartner[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/partner-networks', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load partner networks');
      const list = (data.partners || []) as Partner[];
      setPartners(list);
      const enabled = list.filter(p => p.isMasterPartner);
      setSelectedMasterId(previous =>
        enabled.some(p => p.id === previous) ? previous : (enabled[0]?.id || ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load partner networks');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSubPartners(masterId: string) {
    const res = await fetch('/api/admin/partner-networks?masterId=' + encodeURIComponent(masterId), {
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to load sub-partners');
    return (data.subPartners || []) as SimulatorPartner[];
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!selectedMasterId) {
      setSubPartners([]);
      setLoadingChildren(false);
      return;
    }
    let cancelled = false;
    setLoadingChildren(true);
    setSubPartners([]);
    void fetchSubPartners(selectedMasterId)
      .then(children => { if (!cancelled) setSubPartners(children); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load sub-partners'); })
      .finally(() => { if (!cancelled) setLoadingChildren(false); });
    return () => { cancelled = true; };
  }, [selectedMasterId]);

  async function toggle(p: Partner) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/partner-networks', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: p.id, enabled: !p.isMasterPartner }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveSubPartnerRate(partnerId: string, shareBps: number) {
    if (!selectedMasterId) throw new Error('Select a Master Partner first.');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/partner-networks', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterId: selectedMasterId, partnerId, shareBps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save sub-partner rate');
      setSubPartners(await fetchSubPartners(selectedMasterId));
    } finally {
      setBusy(false);
    }
  }

  const masters = partners.filter(p => p.isMasterPartner);
  const selectedMaster = masters.find(p => p.id === selectedMasterId);

  return <div className="mx-auto max-w-6xl space-y-5">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-[#1F6B3A]">Herbal Vitaly Admin</p>
      <h1 className="text-2xl font-bold">Partner Networks</h1>
      <p className="mt-1 text-sm text-slate-500">Enable Master Partner privileges only for trusted, verified partner accounts.</p>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">{error}</div>}

    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Commission simulator · Master Partner</h2>
        <p className="text-sm text-slate-500">
          Preview a 20% total commission split. Selecting a sub-partner allows you to save their
          future allocation rate, without creating a payable commission.
        </p>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Master Partner
        <select value={selectedMasterId} onChange={event => setSelectedMasterId(event.target.value)}
          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900"
          disabled={loading || busy}>
          {!masters.length && <option value="">No active Master Partner available</option>}
          {masters.map(p => <option key={p.id} value={p.id}>{p.user.name} · {p.referralCode}</option>)}
        </select>
      </label>
      {loadingChildren && <p className="text-sm text-slate-500">Loading selected Master network...</p>}
      <CommissionSimulator
        key={selectedMasterId || 'free'}
        contextLabel={selectedMaster ? 'Réseau de ' + selectedMaster.user.name : 'Simulation libre · aucun Master sélectionné'}
        partners={subPartners}
        onSaveShare={selectedMaster && !loadingChildren && !busy ? saveSubPartnerRate : undefined}
      />
    </section>

    {loading ? <p>Loading...</p> : <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[650px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-600"><tr>
          {['Partner', 'Code', 'Status', 'Sub-partners', 'Master status', 'Action'].map(h =>
            <th key={h} className="px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>{partners.map(p => <tr className="border-t" key={p.id}>
          <td className="px-4 py-3"><p className="font-semibold">{p.user.name}</p><p className="text-xs text-slate-500">{p.user.email}</p></td>
          <td className="px-4 py-3 font-mono">{p.referralCode}</td>
          <td className="px-4 py-3">{p.user.status}{!p.user.emailVerifiedAt ? ' / unverified' : ''}</td>
          <td className="px-4 py-3">{p._count.subPartners}</td>
          <td className="px-4 py-3">{p.isMasterPartner ? 'Enabled' : 'Disabled'}</td>
          <td className="px-4 py-3">
            <button type="button" disabled={busy || (!p.isMasterPartner &&
              (p.user.status !== 'ACTIVE' || !p.user.emailVerifiedAt))}
              onClick={() => void toggle(p)}
              className="rounded-lg bg-[#1F6B3A] px-3 py-2 text-white disabled:opacity-40">
              {p.isMasterPartner ? 'Disable' : 'Enable'}
            </button>
          </td>
        </tr>)}</tbody>
      </table>
      {!partners.length && <p className="p-6 text-sm text-slate-500">No eligible partners found.</p>}
    </div>}
    <p className="text-xs text-slate-500">
      Role permissions and simulator settings do not authorize a payout.
      Financial settlement remains independently locked pending reconciliation.
    </p>
  </div>;
}
