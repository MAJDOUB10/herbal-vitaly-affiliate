'use client';

import React, { useEffect, useState } from 'react';
import { Tag, Copy, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ProductLink = { handle: string; title: string; productUrl: string; affiliateLink: string; trackedLink: string | null };
type PartnerCoupon = {
  id: string; code: string; discountType: string; discountValue: number;
  products: ProductLink[];
};

export default function AffiliateCouponsPage() {
  const [coupons, setCoupons] = useState<PartnerCoupon[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [preferredCode, setPreferredCode] = useState('');
  const preferredCodeValid = /^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(preferredCode);
  const [assigned, setAssigned] = useState<{
    code: string; active: boolean; emailSent: boolean;
    missingShopify?: boolean; conflictingShopify?: boolean;
  } | null>(null);
  const [policyEnabled, setPolicyEnabled] = useState(true);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  const [saving, setSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const [onboardingMessage, setOnboardingMessage] = useState('');
  const refreshCoupons = () => fetch('/api/affiliate/shopify-coupons', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load coupons');
        setCoupons(data.coupons || []);
      });
  const refreshChosenCode = () => fetch('/api/affiliate/promo-code', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not load your promo code');
        setAssigned(data.assigned || null);
        setPolicyEnabled(Boolean(data.enabled));
      });

  useEffect(() => {
    refreshChosenCode().catch(err => setOnboardingError(err.message || 'Unable to load promo code'))
      .finally(() => setOnboardingLoading(false));
    fetch('/api/affiliate/shopify-coupons', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load coupons');
        setCoupons(data.coupons || []);
      })
      .catch(err => setError(err.message || 'Unable to load coupons'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (assigned || !preferredCodeValid) {
      setAvailability('idle');
      return;
    }
    setAvailability('checking');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/affiliate/promo-code?code=' + encodeURIComponent(preferredCode),
          { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Cannot verify availability');
        setAvailability(data.available ? 'available' : 'taken');
      } catch (err) {
        if (!controller.signal.aborted) setAvailability('error');
      }
    }, 450);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [preferredCode, preferredCodeValid, assigned]);

  const chooseCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !preferredCodeValid || availability !== 'available') return;
    setSaving(true);
    setOnboardingError('');
    setOnboardingMessage('');
    try {
      const response = await fetch('/api/affiliate/promo-code', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: preferredCode }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to create your code');
      setOnboardingMessage(data.active
        ? 'Your personal code is active in Shopify. Share your product links below.'
        : 'Your code is reserved. You can retry activation if Shopify confirmation is delayed.');
      await refreshChosenCode();
      await refreshCoupons().catch(() => {});
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Unable to create your code');
      await refreshChosenCode().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const retryChosenCode = async () => {
    if (!assigned || saving) return;
    setPreferredCode(assigned.code);
    setSaving(true);
    setOnboardingError('');
    try {
      const response = await fetch('/api/affiliate/promo-code', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: assigned.code }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to retry');
      setOnboardingMessage(data.active ? 'Shopify code active.' : 'Code saved; verification is pending.');
      await refreshChosenCode();
      await refreshCoupons().catch(() => {});
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Unable to retry');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(value); }
    catch { setError('Clipboard unavailable. Select the link to copy it manually.'); }
  };

  return <main className="space-y-5 p-3 md:p-6">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Herbal Vitaly Affiliate Hub</p>
      <h1 className="mt-1 text-2xl font-bold">My Shopify Coupons & Product Links</h1>
      <p className="text-sm text-muted-foreground">
        Share the tracked product link to record affiliate clicks and open the correct Shopify product page with your verified promo code. The direct Shopify link is available as a fallback.
      </p>
    </div>
    {!onboardingLoading && !assigned && policyEnabled && (
      <Card className="border-[#B7D7C0] bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tag className="h-5 w-5 text-[#1F6B3A]" /> Choose your personal promo code
          </CardTitle>
          <CardDescription>
            Your affiliate account is active. Choose your own code of 3–40 characters, for example SARA15, MOHAMED or ALI2026.
            We will check Refferq and Shopify, create your discount, and email you the details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={chooseCode}>
            <div className="space-y-2">
              <Label htmlFor="partner-chosen-code">Your personal promo code</Label>
              <Input id="partner-chosen-code" value={preferredCode} autoComplete="off" minLength={3} maxLength={40}
                className="max-w-lg font-mono text-lg font-semibold tracking-wider uppercase"
                placeholder="SARA15" aria-describedby="partner-code-availability"
                onChange={e => { setPreferredCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40)); setOnboardingError(''); }} />
              <p id="partner-code-availability" role="status" aria-live="polite"
                className={'text-sm ' + (availability === 'available' ? 'text-green-700' :
                  availability === 'taken' || availability === 'error' ? 'text-red-600' : 'text-muted-foreground')}>
                {!preferredCodeValid ? 'Enter 3–40 characters (letters, numbers, - or _), starting with a letter or number.' :
                  availability === 'checking' ? 'Checking Shopify and Refferq…' :
                  availability === 'available' ? '✓ Code available' :
                  availability === 'taken' ? 'Code already taken. Try another.' :
                  availability === 'error' ? 'Availability check unavailable. Try again.' : 'Enter your code.'}
              </p>
            </div>
            <Button type="submit" disabled={saving || availability !== 'available'} className="bg-[#1F6B3A]">
              {saving ? 'Creating your Shopify code…' : 'Create my promo code'}
            </Button>
          </form>
        </CardContent>
      </Card>
    )}
    {!onboardingLoading && !assigned && !policyEnabled && (
      <p className="rounded-lg border p-3 text-sm text-muted-foreground">
        New promo codes are temporarily disabled by Admin.
      </p>
    )}
    {assigned && (
      <Card className="border-[#B7D7C0]">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Your assigned promo code</p>
            <p className="font-mono text-2xl font-bold tracking-wider text-[#1F6B3A]">{assigned.code}</p>
            <p className="flex items-center gap-1 text-sm">
              {assigned.active ? <CheckCircle2 className="h-4 w-4 text-green-700" /> :
                <AlertCircle className="h-4 w-4 text-amber-600" />}
              {assigned.conflictingShopify ? 'Shopify code conflict — contact Admin' :
                assigned.missingShopify ? 'Deleted from Shopify — restore your code' :
                assigned.active ? 'Active in Shopify' : 'Pending Shopify confirmation'}
              {assigned.active && !assigned.emailSent && ' · Email notification pending'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => copy(assigned.code)}>Copy code</Button>
            {(!assigned.active || !assigned.emailSent) && !assigned.conflictingShopify &&
              <Button type="button" disabled={saving || !policyEnabled} onClick={retryChosenCode}>
                {saving ? 'Restoring…' : assigned.missingShopify
                  ? 'Restore code in Shopify' : 'Retry confirmation / email'}
              </Button>}
          </div>
        </CardContent>
      </Card>
    )}
    {onboardingError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{onboardingError}</p>}
    {onboardingMessage && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{onboardingMessage}</p>}
    {loading && <p role="status">Loading your Shopify discounts…</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {!loading && !onboardingLoading && assigned?.active && coupons.length === 0 && !error &&
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
        <p className="text-xs font-medium text-muted-foreground">Shopify verified product pages · your discount code: <span className="font-mono font-bold text-[#1F6B3A]">{c.code}</span></p>
        {c.products.map(p => {
          // The /r/ redirect is the click-tracked link. Never treat a bare
          // Shopify ?ref= discount URL as an attributed referral click.
          const trackedProductLink = p.trackedLink ||
            (p.affiliateLink.startsWith('https://partner.herbalvitaly.com/r/') ? p.affiliateLink : null);
          const directShopifyLink = p.affiliateLink.startsWith('https://herbalvitaly.com/')
            ? p.affiliateLink : null;
          return <div key={p.handle} className="space-y-3 rounded-xl border border-[#E4EBE6] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a href={p.productUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                {p.title} <ExternalLink className="h-3 w-3"/>
              </a>
              {trackedProductLink && <span className="rounded-full bg-[#EAF4ED] px-3 py-1 text-xs font-semibold text-[#1F6B3A]">
                Tracked link available
              </span>}
            </div>
            {trackedProductLink ? <>
              <Label htmlFor={'tracked-product-'+c.id+'-'+p.handle} className="text-xs font-semibold text-[#1F6B3A]">
                Your personal tracked product link
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input id={'tracked-product-'+c.id+'-'+p.handle} readOnly
                  aria-label={'Tracked affiliate link for '+p.handle}
                  className="min-w-0 flex-1 rounded-lg border border-[#C5DCCB] bg-[#F1F9F3] px-3 py-2 font-mono text-xs"
                  value={trackedProductLink} onFocus={e => e.currentTarget.select()} />
                <Button type="button" className="gap-2 bg-[#1F6B3A] hover:bg-[#16522C]"
                  onClick={() => copy(trackedProductLink)}>
                  <Copy className="h-4 w-4"/> {copied === trackedProductLink ? 'Tracked link copied' : 'Copy tracked link'}
                </Button>
                <Button type="button" variant="outline" className="gap-2" asChild>
                  <a href={trackedProductLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4"/> Test link
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Records your affiliate referral click before redirecting to this product's Shopify page.
                Product views and subsequent browser events require the Shopify analytics integration and visitor consent.
              </p>
            </> : <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Tracked link unavailable for this product. Contact support before using this link for click attribution.
            </p>}
            {directShopifyLink && <details className="rounded-lg border border-[#E4EBE6] p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                Direct Shopify discount link (does not record referral clicks)
              </summary>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input readOnly aria-label={'Direct Shopify discount link for '+p.handle}
                  className="min-w-0 flex-1 rounded-lg border border-[#E4EBE6] bg-[#F7FAF8] px-3 py-2 font-mono text-xs"
                  value={directShopifyLink} onFocus={e => e.currentTarget.select()} />
                <Button type="button" variant="outline" className="gap-2"
                  onClick={() => copy(directShopifyLink)}>
                  <Copy className="h-4 w-4"/> {copied === directShopifyLink ? 'Copied' : 'Copy Shopify link'}
                </Button>
              </div>
            </details>}
          </div>;
        })}
      </CardContent>
    </Card>)}
    <p className="text-xs text-muted-foreground">
      Referral sales are subject to verified Shopify orders and COD/Bosta financial reconciliation.
      The code does not automatically authorize a commission or a payout.
    </p>
  </main>;
}
