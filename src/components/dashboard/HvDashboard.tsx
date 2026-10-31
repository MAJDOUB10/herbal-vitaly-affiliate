'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { AreaChart, Area, BarChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, ClipboardCopy, ExternalLink, FilterX, Link2, Package, RefreshCw, RotateCcw, ShoppingBag, Ticket, Truck, Users, Wallet } from 'lucide-react';

type Order = {
  id: string; name: string; date: string; totalEGP: number | null; currency: string;
  code: string | null; referralCode: string | null; source: string; status: string;
  cod: boolean; collected: boolean; reconciled: boolean; bostaState: number | null;
  trackingNumber: string | null; returnReason: string | null; product: string | null;
  partnerId: string | null; partner: string | null; shopifyOrderUrl: string | null;
};
type Insights = {
  success: boolean; role: 'ADMIN' | 'AFFILIATE'; name: string; referralCode: string | null;
  days: number; complete: boolean; activeCoupons: number;
  totals: { trackedOrders: number; clicks: number; leads: number; orderValueEGP: number;
    deliveredOrders: number; pendingOrders: number; returnedOrders: number;
    cancelledOrders: number; settledOrders: number };
  finance: { approvedEGP: number; pendingEGP: number; paidEGP: number };
  orders: Order[]; clicksByDay: string[];
  partners: Array<{ id: string; name: string; code: string }>;
};
type Product = { id: string; handle: string; title: string; onlineStoreUrl?: string | null };
type Coupon = { id: string; code: string; products: Array<{
  handle: string; title: string; productUrl: string; affiliateLink: string;
}> };

const green = '#1F6B3A';
const formatMoney = (n: number | null) => n == null ? '—' :
  new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' EGP';
const dayLabel = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
const statusNames: Record<string, string> = {
  PENDING: 'Livraison en attente', DELIVERED: 'Livrée', REFUNDED: 'Remboursée',
  CANCELLED: 'Annulée', AFFILIATE_LINK: 'Lien affilié', PROMO_CODE: 'Code promo',
  LINK_AND_PROMO: 'Lien + code', UNATTRIBUTED: 'Sans attribution',
  UNVERIFIED: 'Non vérifiée', CONFLICT: 'Conflit',
};
const statusColor: Record<string, string> = {
  DELIVERED: 'bg-emerald-50 text-emerald-800', PENDING: 'bg-amber-50 text-amber-800',
  REFUNDED: 'bg-rose-50 text-rose-800', CANCELLED: 'bg-rose-50 text-rose-800',
};
const empty = 'Aucune donnée pour ces filtres';

function Metric({ title, value, note, icon: Icon, accent = green }: {
  title: string; value: string; note?: string; icon: typeof ShoppingBag; accent?: string;
}) {
  return <div className="rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs font-medium text-slate-500">{title}</span>
      <span className="rounded-xl p-2" style={{ color: accent, backgroundColor: accent + '13' }}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-2 break-words text-xl font-bold tracking-tight text-[#18291E]">{value}</p>
    {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
  </div>;
}
function Panel({ title, subtitle, children }: {
  title: string; subtitle?: string; children: ReactNode;
}) {
  return <section className="min-w-0 rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm">
    <h2 className="font-semibold text-[#173621]">{title}</h2>
    {subtitle && <p className="mb-3 mt-1 text-xs text-slate-500">{subtitle}</p>}
    {children}
  </section>;
}

export default function HvDashboard({ role }: { role: 'ADMIN' | 'AFFILIATE' }) {
  const admin = role === 'ADMIN';
  const [days, setDays] = useState(30);
  const [partner, setPartner] = useState('');
  const [data, setData] = useState<Insights | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [delivery, setDelivery] = useState('');
  const [source, setSource] = useState('');
  const [couponFilter, setCouponFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ days: String(days) });
    if (admin && partner) params.set('affiliateId', partner);
    fetch('/api/dashboard/insights?' + params.toString(), { cache: 'no-store' })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Données indisponibles');
        if (active) setData(json);
      }).catch(err => { if (active) { setError(err.message); setData(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, days, partner, refresh]);

  useEffect(() => {
    let active = true;
    setCatalogError('');
    const endpoint = admin ? '/api/admin/coupons/products' : '/api/affiliate/shopify-coupons';
    fetch(endpoint, { cache: 'no-store' })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Catalogue Shopify indisponible');
        if (!active) return;
        if (admin) setProducts((json.products || []).filter((p: Product) =>
          typeof p.onlineStoreUrl === 'string' && p.onlineStoreUrl.startsWith('https://herbalvitaly.com/')));
        else setCoupons(json.coupons || []);
      }).catch(err => { if (active) setCatalogError(err.message); });
    return () => { active = false; };
  }, [admin, refresh]);

  const rows = useMemo(() => (data?.orders || []).filter(o => {
    const text = [o.name, o.code, o.referralCode, o.partner].join(' ').toLowerCase();
    return (!query || text.includes(query.toLowerCase())) &&
      (!delivery || o.status === delivery) && (!source || o.source === source) &&
      (!couponFilter || (o.code || '') === couponFilter);
  }), [data, query, delivery, source, couponFilter]);

  const totals = useMemo(() => ({
    value: rows.reduce((n, o) => n + (o.totalEGP || 0), 0),
    delivered: rows.filter(o => o.status === 'DELIVERED').length,
    returned: rows.filter(o => o.status === 'REFUNDED').length,
    cancelled: rows.filter(o => o.status === 'CANCELLED').length,
    pending: rows.filter(o => o.status === 'PENDING').length,
    settled: rows.filter(o => o.reconciled).length,
  }), [rows]);

  const chartDays = useMemo(() => {
    const daily = new Map<string, { date: string; label: string; orders: number; value: number; clicks: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      daily.set(d, { date: d, label: dayLabel(d), orders: 0, value: 0, clicks: 0 });
    }
    rows.forEach(o => {
      const key = o.date.slice(0, 10), bucket = daily.get(key);
      if (bucket) { bucket.orders++; bucket.value += o.totalEGP || 0; }
    });
    (data?.clicksByDay || []).forEach(d => {
      const bucket = daily.get(d); if (bucket) bucket.clicks++;
    });
    return Array.from(daily.values());
  }, [rows, data, days]);

  const statusChart = [
    { name: 'Livrées', value: totals.delivered, color: green },
    { name: 'En attente', value: totals.pending, color: '#E7A43F' },
    { name: 'Remboursées', value: totals.returned, color: '#DE6676' },
    { name: 'Annulées', value: totals.cancelled, color: '#9BABB0' },
  ].filter(x => x.value > 0);
  const promoOptions = [...new Set((data?.orders || []).map(o => o.code).filter((x): x is string => Boolean(x)))].sort();
  const partnerRank = useMemo(() => {
    const map = new Map<string, { id: string; name: string; orders: number; delivered: number; returns: number; revenue: number }>();
    rows.forEach(o => {
      if (!o.partnerId) return;
      const t = map.get(o.partnerId) || { id: o.partnerId, name: o.partner || 'Partenaire', orders: 0, delivered: 0, returns: 0, revenue: 0 };
      t.orders++; t.revenue += o.totalEGP || 0;
      if (o.status === 'DELIVERED') t.delivered++;
      if (o.status === 'REFUNDED') t.returns++;
      map.set(o.partnerId, t);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [rows]);
  const productLinks = !admin ? coupons.flatMap(c => c.products.map(p => ({ ...p, code: c.code })))
    .filter(p => !productFilter || p.handle === productFilter) : [];

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value); setCopied(value);
    } catch { setCopied(''); }
  };
  const exportCsv = () => {
    const header = ['Order', 'Date', 'Partner', 'Promo', 'Attribution', 'Delivery status', 'COD reconciled', 'Total EGP'];
    const items = rows.map(o => [o.name, o.date, o.partner || '', o.code || '', o.source, o.status,
      o.reconciled ? 'yes' : 'no', o.totalEGP == null ? '' : String(o.totalEGP)]);
    const csv = [header, ...items].map(r => r.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = 'herbal-vitaly-' + (admin ? 'admin' : 'partner') + '-orders.csv';
    anchor.click(); URL.revokeObjectURL(url);
  };

  return <main className="space-y-5 pb-10">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1F6B3A]">Herbal Vitaly Affiliate Hub</p>
        <h1 className="mt-1 text-2xl font-bold text-[#172D20]">
          {admin ? 'Dashboard · Administration' : 'Dashboard · Partenaire'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Commandes synchronisées, attribution, livraison et résultats réels.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
          <CalendarDays className="h-4 w-4 text-[#1F6B3A]"/>
          <select aria-label="Période" value={days} onChange={e => setDays(Number(e.target.value))} className="bg-white outline-none">
            <option value={7}>7 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option>
          </select>
        </label>
        <button type="button" onClick={exportCsv} disabled={!data} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-[#1F6B3A] disabled:opacity-50">Exporter CSV</button>
        <button type="button" onClick={() => setRefresh(n => n + 1)} className="flex items-center gap-2 rounded-lg bg-[#1F6B3A] px-3 py-2 text-sm font-medium text-white">
          <RefreshCw className="h-4 w-4"/> Actualiser
        </button>
      </div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {loading && <p role="status" className="rounded-xl border bg-white p-4 text-sm text-slate-500">Chargement des données vérifiées…</p>}
    {data && <>
      {!data.complete && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Volume supérieur à 2 000 événements : les graphiques et tableaux correspondent uniquement aux données affichées.</p>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 2xl:grid-cols-8">
        <Metric title="Commandes suivies" value={String(data.totals.trackedOrders)} icon={ShoppingBag} note="Période sélectionnée"/>
        <Metric title="Valeur des commandes" value={formatMoney(data.totals.orderValueEGP)} icon={Wallet} note="Non assimilée à l'encaissement"/>
        <Metric title="Commandes livrées" value={String(data.totals.deliveredOrders)} icon={Truck}/>
        <Metric title="Remboursées / annulées" value={String(data.totals.returnedOrders + data.totals.cancelledOrders)} icon={RotateCcw} accent="#D64B68"/>
        <Metric title="Clics suivis" value={String(data.totals.clicks)} icon={Activity}/>
        <Metric title="Leads" value={String(data.totals.leads)} icon={Users}/>
        <Metric title={admin ? 'Codes actifs Shopify' : 'Commissions en attente'} value={admin ? String(data.activeCoupons) : formatMoney(data.finance.pendingEGP)} icon={Ticket}/>
        <Metric title="Commandes attribuées / clics" value={data.totals.clicks && data.complete ?
          (100 * data.orders.filter(o => ['AFFILIATE_LINK', 'PROMO_CODE', 'LINK_AND_PROMO'].includes(o.source)).length / data.totals.clicks).toFixed(1) + '%' : '—'}
          icon={BarChart3} note="Indicateur de suivi, pas un taux de conversion Shopify"/>
      </div>

      <Panel title="Shopify · Herbal Vitaly" subtitle="Boutique officielle et catalogue produits — données Refferq indépendantes de la validation COD/Bosta.">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-slate-600">Dernière commande synchronisée : {data.orders[0] ? new Date(data.orders[0].date).toLocaleString('fr-FR') : 'aucune'}</span>
          <div className="flex flex-wrap gap-2">
            <a href="https://herbalvitaly.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 font-medium text-[#1F6B3A]"><ExternalLink className="h-4 w-4"/> Boutique Shopify</a>
            <Link href={admin ? '/admin/coupons' : '/affiliate/coupons'} className="rounded-lg border px-3 py-2 font-medium text-[#1F6B3A]">{admin ? 'Coupons & produits' : 'Mes coupons & produits'}</Link>
            {admin && <Link href="/admin/orders" className="rounded-lg bg-[#E9F4EC] px-3 py-2 font-medium text-[#1F6B3A]">Synchronisation des commandes</Link>}
          </div>
        </div>
      </Panel>

      <Panel title="Filtres d'analyse" subtitle="Les KPI généraux correspondent à toute la période ; les graphiques et commandes ci-dessous respectent les filtres.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {admin && <label className="text-xs text-slate-500">Partenaire
            <select className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-slate-800" value={partner} onChange={e => setPartner(e.target.value)}>
              <option value="">Tous les partenaires</option>{data.partners.map(p => <option value={p.id} key={p.id}>{p.name} · {p.code}</option>)}
            </select>
          </label>}
          <label className="text-xs text-slate-500">Recherche commande / partenaire
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={query} onChange={e => setQuery(e.target.value)} placeholder="#2064, T15, partenaire…" />
          </label>
          <label className="text-xs text-slate-500">État livraison
            <select className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-slate-800" value={delivery} onChange={e => setDelivery(e.target.value)}>
              <option value="">Tous les statuts</option>
              {['PENDING','DELIVERED','REFUNDED','CANCELLED'].map(k => <option key={k} value={k}>{statusNames[k]}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500">Source d'attribution
            <select className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-slate-800" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">Toutes les sources</option>
              {['AFFILIATE_LINK','PROMO_CODE','LINK_AND_PROMO','UNATTRIBUTED','UNVERIFIED','CONFLICT'].map(k => <option key={k} value={k}>{statusNames[k]}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500">Code promo
            <select className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-slate-800" value={couponFilter} onChange={e => setCouponFilter(e.target.value)}>
              <option value="">Tous les codes</option>
              {promoOptions.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{rows.length} commandes affichées · {formatMoney(totals.value)} · {totals.settled} rapprochements financiers marqués</span>
          <button type="button" onClick={() => { setQuery(''); setDelivery(''); setSource(''); setCouponFilter(''); setPartner(''); }} className="inline-flex items-center gap-1 font-medium text-[#1F6B3A]"><FilterX className="h-3.5 w-3.5"/> Réinitialiser</button>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Évolution des commandes" subtitle="Valeur des commandes synchronisées (EGP) · par jour">
          <div className="h-56" role="img" aria-label="Graphique quotidien de valeur des commandes">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDays}><CartesianGrid vertical={false} stroke="#E4EBE6"/>
                <XAxis dataKey="label" tick={{fontSize:10}} minTickGap={25}/>
                <YAxis tick={{fontSize:10}} width={45}/><Tooltip formatter={(v) => formatMoney(Number(v))}/>
                <Area type="monotone" dataKey="value" stroke={green} fill="#E9F4EC" strokeWidth={2} name="Commandes" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Statuts de livraison" subtitle="Livrées, en attente, remboursées et annulées">
          {statusChart.length ? <div className="h-56" role="img" aria-label="Répartition des statuts de livraison">
            <ResponsiveContainer width="100%" height="100%"><PieChart>
              <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={76}>
                {statusChart.map(c => <Cell key={c.name} fill={c.color}/>)}
              </Pie><Tooltip />
            </PieChart></ResponsiveContainer>
          </div> : <p className="py-14 text-center text-sm text-slate-500">{empty}</p>}
          <div className="flex flex-wrap gap-3 text-xs">{statusChart.map(s => <span key={s.name}><span style={{color:s.color}}>●</span> {s.name}: {s.value}</span>)}</div>
        </Panel>
        <Panel title="Clics et commandes" subtitle="Clics réellement enregistrés et commandes attribuées">
          <div className="h-56" role="img" aria-label="Graphique de clics et commandes par jour">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDays}><CartesianGrid vertical={false} stroke="#E4EBE6"/>
                <XAxis dataKey="label" tick={{fontSize:10}} minTickGap={25}/><YAxis allowDecimals={false} tick={{fontSize:10}} width={25}/>
                <Tooltip/><Bar name="Clics" dataKey="clicks" fill="#A2D0B0" radius={[3,3,0,0]}/>
                <Bar name="Commandes" dataKey="orders" fill={green} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Motifs de retour" subtitle="Transparence des données Bosta / Shopify">
          <div className="flex min-h-28 items-center gap-3 rounded-xl bg-slate-50 p-4">
            <RotateCcw className="h-7 w-7 text-slate-400"/>
            <p className="text-sm text-slate-600">Motifs détaillés non encore transmis au modèle de commandes Refferq. <strong>{totals.returned} remboursée(s)</strong> et <strong>{totals.cancelled} annulée(s)</strong> dans la sélection. Aucun motif ne sera deviné.</p>
          </div>
        </Panel>
        <Panel title="Commissions enregistrées" subtitle="Soldes issus du registre des commissions, pas d'estimations automatiques sur les commandes COD">
          <div className="grid grid-cols-3 gap-3">
            {[['En attente',data.finance.pendingEGP],['Approuvées',data.finance.approvedEGP],['Payées',data.finance.paidEGP]].map(([label,value]) =>
              <div key={String(label)} className="rounded-xl bg-[#F5F9F6] p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-2 break-words text-sm font-bold">{formatMoney(Number(value))}</p>
              </div>)}
          </div>
          <p className="mt-3 text-xs text-amber-800">Paiement uniquement après livraison, collecte COD/Bosta et validation financière.</p>
        </Panel>
      </div>

      {!admin && <Panel title="Mon lien affilié" subtitle="Partagez un lien vers la boutique ou vers un produit spécifique.">
        <div className="grid gap-3 md:grid-cols-2">
          {[['Lien boutique','https://partner.herbalvitaly.com/r/' + (data.referralCode || '')],['Code de parrainage',data.referralCode || '—']].map(([label,value]) =>
            <div key={label}><p className="mb-1 text-xs text-slate-500">{label}</p>
              <div className="flex items-center gap-2"><input readOnly value={value} onFocus={e=>e.currentTarget.select()} className="w-full min-w-0 rounded-lg border p-2 text-xs"/>
                <button type="button" onClick={()=>copy(value)} title="Copier" className="rounded-lg border p-2 text-[#1F6B3A]"><ClipboardCopy className="h-4 w-4"/></button>
              </div>
            </div>)}
        </div>
      </Panel>}

      <Panel title={admin ? 'Catalogue Shopify' : 'Mes liens produits Shopify'}
        subtitle={admin ? 'Produits actifs publiés sur herbalvitaly.com, avec accès direct aux pages.' :
          'Liens attribués à votre compte avec code Shopify ; seuls les coupons actifs et vérifiés sont présentés.'}>
        {catalogError && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Catalogue indisponible : {catalogError}</p>}
        {!admin && <label className="mb-3 block text-xs text-slate-500">Filtrer les liens par produit
          <select className="mt-1 w-full rounded-lg border bg-white p-2 text-sm sm:w-72" value={productFilter} onChange={e=>setProductFilter(e.target.value)}>
            <option value="">Tous les produits</option>
            {[...new Map(coupons.flatMap(c=>c.products).map(p=>[p.handle,p.title] as const)).entries()].map(([handle,title])=><option key={handle} value={handle}>{title}</option>)}
          </select></label>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F6FAF7] text-xs text-slate-500"><tr><th className="px-3 py-3">Produit</th><th className="px-3 py-3">Page Shopify</th><th className="px-3 py-3">{admin ? 'Catalogue' : 'Code promo'}</th>{!admin && <th className="px-3 py-3">Lien affilié</th>}</tr></thead>
            <tbody className="divide-y divide-[#E4EBE6]">
              {admin ? products.map(p => <tr key={p.id}><td className="px-3 py-3 font-medium">{p.title}</td>
                <td className="px-3 py-3"><a className="inline-flex items-center gap-1 text-[#1F6B3A] underline" href={p.onlineStoreUrl!} target="_blank" rel="noopener noreferrer">Voir produit <ExternalLink className="h-3.5 w-3.5"/></a></td>
                <td className="px-3 py-3"><Link className="text-[#1F6B3A] underline" href="/admin/coupons">Voir ses remises</Link></td></tr>)
                : productLinks.map(p => <tr key={p.code+'-'+p.handle}><td className="px-3 py-3 font-medium">{p.title}</td>
                  <td className="px-3 py-3"><a className="inline-flex items-center gap-1 text-[#1F6B3A] underline" href={p.productUrl} target="_blank" rel="noopener noreferrer">Ouvrir <ExternalLink className="h-3.5 w-3.5"/></a></td>
                  <td className="px-3 py-3"><span className="rounded-md bg-[#EAF4ED] px-2 py-1 font-mono text-xs">{p.code}</span></td>
                  <td className="px-3 py-3"><button onClick={()=>copy(p.affiliateLink)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B3A]"><ClipboardCopy className="h-3.5 w-3.5"/>{copied===p.affiliateLink?'Copié':'Copier le lien'}</button></td></tr>)}
            </tbody>
          </table>
          {(admin ? products.length === 0 : productLinks.length === 0) && !catalogError && <p className="p-5 text-sm text-slate-500">Aucun produit ou coupon disponible pour ce compte.</p>}
        </div>
      </Panel>

      <Panel title={admin ? 'Commandes Shopify · Tous les partenaires' : 'Mes commandes attribuées'}
        subtitle="Aucune commande ne vaut commission payable avant rapprochement COD/Bosta. Les motifs de retour et les produits ne sont pas encore synchronisés par ligne.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F6FAF7] text-xs text-slate-500">
              <tr><th className="p-3">Commande</th><th className="p-3">Date</th>{admin && <th className="p-3">Partenaire</th>}
                <th className="p-3">Code</th><th className="p-3">Source</th><th className="p-3">Livraison</th>
                <th className="p-3">Retour</th><th className="p-3">Rapprochement</th><th className="p-3 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-[#E4EBE6]">
              {rows.slice(0, 60).map(o => <tr key={o.id} className="hover:bg-[#FBFDFB]">
                <td className="p-3 font-semibold">{o.shopifyOrderUrl ?
                  <a href={o.shopifyOrderUrl} target="_blank" rel="noopener noreferrer" className="text-[#1F6B3A] underline">#{o.name}</a> : '#'+o.name}</td>
                <td className="whitespace-nowrap p-3 text-xs text-slate-600">{new Date(o.date).toLocaleDateString('fr-FR')}</td>
                {admin && <td className="p-3 text-xs">{o.partner || '—'}</td>}
                <td className="p-3 font-mono text-xs">{o.code || '—'}</td>
                <td className="p-3 text-xs">{statusNames[o.source] || o.source}</td>
                <td className="p-3"><span className={'rounded-md px-2 py-1 text-xs ' + (statusColor[o.status]||'bg-slate-50 text-slate-700')}>{statusNames[o.status]||o.status}</span></td>
                <td className="p-3 text-xs text-slate-500">{o.returnReason || 'Non renseigné'}</td>
                <td className="p-3 text-xs">{o.reconciled ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3"/> Oui</span> : 'En attente'}</td>
                <td className="whitespace-nowrap p-3 text-right font-semibold">{formatMoney(o.totalEGP)}</td>
              </tr>)}
            </tbody>
          </table>
          {!rows.length && <p className="p-5 text-center text-sm text-slate-500">{empty}</p>}
        </div>
        {rows.length>60 && <p className="mt-3 text-xs text-slate-500">60 commandes visibles ici. Utilisez les filtres ou exportez le CSV pour la sélection entière.</p>}
      </Panel>
      {admin && <Panel title="Classement partenaires" subtitle="Valeur des commandes synchronisées attribuées (pas le chiffre d'affaires encaissé).">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-[#F6FAF7] text-xs text-slate-500"><tr><th className="p-3">Partenaire</th><th className="p-3">Commandes</th><th className="p-3">Livrées</th><th className="p-3">Remboursées</th><th className="p-3 text-right">Valeur</th></tr></thead>
          <tbody className="divide-y">{partnerRank.map(p=><tr key={p.id}><td className="p-3">{p.name}</td><td className="p-3">{p.orders}</td><td className="p-3">{p.delivered}</td><td className="p-3">{p.returns}</td><td className="p-3 text-right">{formatMoney(p.revenue)}</td></tr>)}</tbody>
        </table>{!partnerRank.length && <p className="p-3 text-sm text-slate-500">Aucune commande attribuée.</p>}</div>
      </Panel>}
      <p className="text-xs text-slate-500">Données : commandes enregistrées dans Refferq, clics et registre de commissions. Montants EGP. Les produits de chaque commande et les motifs détaillés de retour nécessitent un enrichissement Shopify/Bosta séparé.</p>
    </>}
  </main>;
}
