'use client';

import React, { useEffect, useState } from 'react';
import { Tag, Link2, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ProductLink = { handle: string; productUrl: string; affiliateLink: string };
type PartnerCoupon = {
  id: string; code: string; discountType: string; discountValue: number;
  products: ProductLink[];
};

export default function AffiliateCouponsPage() {
  const [coupons, setCoupons] = useState<PartnerCoupon[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    fetch('/api/affiliate/shopify-coupons', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load coupons');
        setCoupons(data.coupons || []);
      })
      .catch(err => setError(err.message || 'Unable to load coupons'))
      .finally(() => setLoading(false));
  }, []);

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(value); }
    catch { setError('Clipboard unavailable. Select the link to copy it manually.'); }
  };

  return <main className="space-y-5 p-3 md:p-6">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Herbal Vitaly Affiliate Hub</p>
      <h1 className="mt-1 text-2xl font-bold">My Shopify Coupons & Product Links</h1>
      <p className="text-sm text-muted-foreground">
        Share one product-specific affiliate link. It records your referral and applies your assigned Shopify code at checkout.
      </p>
    </div>
    {loading && <p role="status">Loading your Shopify discounts…</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {!loading && coupons.length === 0 && !error &&
      <Card><CardContent className="py-8 text-center text-muted-foreground">
        No active Shopify coupon is assigned to your account yet. Contact Herbal Vitaly administration.
      </CardContent></Card>}
    {coupons.map(c => <Card key={c.id}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3 text-lg">
          <Tag className="h-5 w-5 text-primary" /> {c.code}
          <span className="rounded-full bg-[#EAF4ED] px-3 py-1 text-xs font-semibold text-primary">
            {c.discountType === 'PERCENTAGE' ? c.discountValue + '%' : c.discountValue + ' EGP'} off
          </span>
        </CardTitle>
        <CardDescription>Only the listed products qualify for this Shopify discount.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {c.products.map(p => <div key={p.handle} className="space-y-2 rounded-xl border border-[#E4EBE6] p-3">
          <a href={p.productUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            {decodeURIComponent(p.handle)} <ExternalLink className="h-3 w-3"/>
          </a>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input readOnly aria-label={'Affiliate link for ' + p.handle}
              className="min-w-0 flex-1 rounded-lg border border-[#E4EBE6] bg-[#F7FAF8] px-3 py-2 font-mono text-xs"
              value={p.affiliateLink} onFocus={e => e.currentTarget.select()} />
            <Button type="button" variant="outline" className="gap-2"
              onClick={() => copy(p.affiliateLink)}>
              <Copy className="h-4 w-4" /> {copied === p.affiliateLink ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>)}
      </CardContent>
    </Card>)}
    <p className="text-xs text-muted-foreground">
      Referral sales are subject to verified Shopify orders and COD/Bosta financial reconciliation.
      The code does not automatically authorize a commission or a payout.
    </p>
  </main>;
}
