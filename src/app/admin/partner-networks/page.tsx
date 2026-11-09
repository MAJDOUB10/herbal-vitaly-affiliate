'use client';

import { useEffect, useState } from 'react';

type Partner = { id: string; isMasterPartner: boolean; referralCode: string;
  user: { name: string; email: string; status: string; emailVerifiedAt: string | null };
  _count: { subPartners: number } };
export default function PartnerNetworksPage() {
  const [partners,setPartners] = useState<Partner[]>([]);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/partner-networks', { cache:'no-store' });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Unable to load partner networks');
      setPartners(data.partners);
    } catch(e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); },[]);
  async function toggle(p:Partner) {
    setBusy(true); setError('');
    try {
      const res=await fetch('/api/admin/partner-networks',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({affiliateId:p.id,enabled:!p.isMasterPartner}),
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || 'Update failed');
      await load();
    } catch(e) {setError(e instanceof Error?e.message:'Update failed');}
    finally {setBusy(false);}
  }
  return <div className="mx-auto max-w-6xl space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-[#1F6B3A]">Herbal Vitaly Admin</p>
      <h1 className="text-2xl font-bold">Partner Networks</h1>
      <p className="mt-1 text-sm text-slate-500">Enable Master Partner privileges only for trusted, verified partner accounts.</p></div>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">{error}</div>}
    {loading?<p>Loading...</p>:<div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>
        {['Partner','Code','Status','Sub-partners','Master status','Action'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
      </tr></thead><tbody>{partners.map(p=><tr className="border-t" key={p.id}>
        <td className="px-4 py-3"><p className="font-semibold">{p.user.name}</p><p className="text-xs text-slate-500">{p.user.email}</p></td>
        <td className="px-4 py-3 font-mono">{p.referralCode}</td>
        <td className="px-4 py-3">{p.user.status}{!p.user.emailVerifiedAt?' / unverified':''}</td>
        <td className="px-4 py-3">{p._count.subPartners}</td>
        <td className="px-4 py-3">{p.isMasterPartner?'Enabled':'Disabled'}</td>
        <td className="px-4 py-3"><button type="button" disabled={busy||(!p.isMasterPartner&&(p.user.status!=='ACTIVE'||!p.user.emailVerifiedAt))}
          onClick={()=>void toggle(p)} className="rounded-lg bg-[#1F6B3A] px-3 py-2 text-white disabled:opacity-40">
          {p.isMasterPartner?'Disable':'Enable'}</button></td>
      </tr>)}</tbody></table>
      {!partners.length&&<p className="p-6 text-sm text-slate-500">No eligible partners found.</p>}
    </div>}
    <p className="text-xs text-slate-500">Role permissions do not authorize a payout. Financial settlement remains independently locked pending reconciliation.</p>
  </div>;
}
