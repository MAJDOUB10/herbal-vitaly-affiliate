'use client';

import { useState } from 'react';
import { previewTeamCommissionFromSalePiasters } from '@/lib/team-network-math';

export type SimulatorPartner = { id: string; name: string; shareBps: number };

type Props = {
  partners?: SimulatorPartner[];
  onSaveShare?: (partnerId: string, shareBps: number) => Promise<void>;
  contextLabel?: string;
};

const MAX_SALE_EGP = 10_000_000;
const formatMoney = (piasters: number) =>
  (piasters / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' EGP';
const rateOnSale = (shareBps: number) =>
  Number((shareBps / 500).toFixed(3)).toLocaleString('fr-FR', { maximumFractionDigits: 3 });

/**
 * Display-only simulation: reuses the integer-piastre team split formula.
 * Saving a configured rate changes only the future allocation preference;
 * it NEVER settles orders or triggers payouts.
 */
export default function CommissionSimulator({ partners = [], onSaveShare, contextLabel }: Props) {
  const [saleInput, setSaleInput] = useState('1000');
  const [shareBps, setShareBps] = useState(2000); // 4% of sale = 20% of the 20% pool.
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedPartner = partners.find(p => p.id === selectedPartnerId);
  const sale = Number(saleInput);
  const validSale = saleInput.trim() !== '' && Number.isFinite(sale) &&
    sale >= 0 && sale <= MAX_SALE_EGP && Math.round(sale * 100) <= Number.MAX_SAFE_INTEGER;
  const salePiasters = validSale ? Math.round(sale * 100) : 0;
  const { childPiasters, masterPiasters, totalPiasters } =
    previewTeamCommissionFromSalePiasters(salePiasters, shareBps);
  const changed = Boolean(selectedPartner && selectedPartner.shareBps !== shareBps);

  function choosePartner(id: string) {
    setSelectedPartnerId(id);
    const next = partners.find(p => p.id === id);
    setShareBps(next ? next.shareBps : 2000);
    setMessage('');
  }

  async function save() {
    if (!selectedPartner || !onSaveShare || !changed || saving) return;
    setSaving(true);
    setMessage('');
    try {
      await onSaveShare(selectedPartner.id, shareBps);
      setMessage('Taux enregistré pour les prochaines répartitions. Aucun paiement effectué.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de sauvegarder le taux.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Simulateur de commissions" className="rounded-2xl border border-zinc-700 bg-[#090909] p-4 text-white shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Simulateur de commissions</h2>
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-200">Simulation · sans paiement</span>
      </div>
      {contextLabel && <p className="mb-4 text-xs text-zinc-400">{contextLabel}</p>}
      {partners.length > 0 && (
        <label className="mb-4 block text-sm font-medium text-zinc-200">
          Sous-partenaire (facultatif)
          <select
            value={selectedPartnerId}
            onChange={event => choosePartner(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white"
          >
            <option value="">Simulation libre · taux non enregistré</option>
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium text-zinc-200">
        Montant de la vente éligible (EGP)
        <input
          type="number" min="0" max={MAX_SALE_EGP} step="0.01" inputMode="decimal"
          value={saleInput} onChange={event => setSaleInput(event.target.value)}
          className="mt-1 block w-full rounded-full border border-zinc-700 bg-transparent px-4 py-3 text-base text-white outline-none focus:border-green-600"
        />
      </label>
      {!validSale && <p role="alert" className="mt-1 text-xs text-amber-300">
        Saisir une vente entre 0 et {MAX_SALE_EGP.toLocaleString('fr-FR')} EGP.
      </p>}
      <div className="mt-5">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm font-medium text-zinc-200">
          <label htmlFor="commission-simulator-share">Commission du sous-partenaire</label>
          <strong className="text-white">{rateOnSale(shareBps)} % de la vente</strong>
        </div>
        <input
          id="commission-simulator-share"
          type="range" min="0" max="10000" step="50" value={shareBps}
          onChange={event => { setShareBps(Number(event.target.value)); setMessage(''); }}
          className="h-3 w-full cursor-pointer accent-[#1F6B3A]"
          aria-valuetext={rateOnSale(shareBps) + ' pour cent du montant de la vente'}
        />
        <p className="mt-1 text-xs text-zinc-400">
          Plafond Herbal Vitaly : 20 % de la vente · part du sous-partenaire : {rateOnSale(shareBps)} %
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-300">Sous-partenaire</p>
          <p className="mt-1 text-xl font-bold">{formatMoney(childPiasters)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-300">Master Partner</p>
          <p className="mt-1 text-xl font-bold">{formatMoney(masterPiasters)}</p>
        </div>
      </div>
      <div
        role="img"
        aria-label={'Répartition : sous-partenaire ' + rateOnSale(shareBps) + ' % de la vente, Master ' + rateOnSale(10000 - shareBps) + ' % de la vente'}
        className="mt-6 flex h-3 w-full overflow-hidden rounded-full bg-[#D99B3A]"
      >
        <div style={{ width: (shareBps / 100) + '%' }} className="bg-[#1F6B3A]" />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-zinc-300">
        <span><span aria-hidden="true" className="mr-1 text-[#1F6B3A]">●</span>Sous-partenaire</span>
        <span><span aria-hidden="true" className="mr-1 text-[#D99B3A]">●</span>Master</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-4">
        <strong className="text-sm">Coût total Herbal Vitaly (20 %)</strong>
        <strong className="text-xl">{formatMoney(totalPiasters)}</strong>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-400">
        Simulation sur une vente éligible après remises. Les commissions réelles dépendent de la commande,
        de la livraison, de l&apos;encaissement COD et de la validation financière.
        Aucune somme n&apos;est créditée ou versée ici.
      </p>
      {onSaveShare && selectedPartner && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={saving || !changed || !validSale} onClick={() => void save()}
            className="rounded-lg bg-[#1F6B3A] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? 'Enregistrement...' : 'Enregistrer le taux du sous-partenaire'}
          </button>
          <span className="text-xs text-zinc-400">Taux actuel : {rateOnSale(selectedPartner.shareBps)} % de la vente</span>
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm text-amber-200">{message}</p>}
    </section>
  );
}
