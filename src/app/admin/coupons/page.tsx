'use client';

import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Ticket, Plus, Pencil, Trash2, Copy, Check,
} from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
  maxUses?: number;
  usedCount: number;
  affiliateId?: string | null;
  source?: string;
  shopifyProductIds?: string[];
  shopifyProductHandles?: string[];
  shopifyStatus?: string;
  isActive: boolean;
  startsAt?: string;
  expiresAt?: string;
  createdAt: string;
}

type PartnerChoice = { id: string; name: string; referralCode: string };
type ProductChoice = { id: string; title: string; handle: string; onlineStoreUrl: string };

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [partners, setPartners] = useState<PartnerChoice[]>([]);
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [formError, setFormError] = useState('');
  const [mappingCouponId, setMappingCouponId] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '', description: '', discountType: 'PERCENTAGE', discountValue: '',
    maxUses: '', affiliateId: '', expiresAt: '', productIds: [] as string[],
  });

  useEffect(() => {
    fetchCoupons();
    fetch('/api/admin/coupons/partners', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.success) setPartners(data.partners || []); })
      .catch(() => setMappingError('Unable to load approved partners'));
    fetch('/api/admin/coupons/products', { cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (data.success) setProducts(data.products || []); })
      .catch(error => setCatalogError(error instanceof Error ? error.message : 'Shopify catalog unavailable'));
  }, []);

  const fetchCoupons = async () => {
    try {
      const res = await fetch('/api/admin/coupons');
      const data = await res.json();
      if (data.success) setCoupons(data.coupons || []);
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignShopifyCoupon = async (coupon: Coupon, affiliateId: string | null) => {
    setMappingCouponId(coupon.id);
    setMappingError('');
    try {
      const response = await fetch('/api/admin/coupons/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponId: coupon.id, affiliateId, expectedAffiliateId: coupon.affiliateId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to assign partner');
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, affiliateId } : c));
    } catch (error) {
      setMappingError(error instanceof Error ? error.message : 'Unable to save partner mapping');
    } finally {
      setMappingCouponId(null);
    }
  };

  const handleSave = async () => {
    setFormError('');
    if (!editing && (!form.affiliateId || !form.productIds.length)) {
      setFormError('Select an approved partner and at least one Shopify product.'); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        code: form.code,
        description: form.description || null,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        affiliateId: form.affiliateId || null,
        expiresAt: form.expiresAt || null,
        productIds: form.productIds,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = await fetch('/api/admin/coupons', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to create Shopify discount');
      await fetchCoupons();
      closeDialog();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create Shopify discount');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await fetch('/api/admin/coupons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, isActive: !isActive } : c));
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      await fetch('/api/admin/coupons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      description: c.description || '',
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      maxUses: c.maxUses ? String(c.maxUses) : '',
      affiliateId: c.affiliateId || '',
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
      productIds: c.shopifyProductIds || [],
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setFormError('');
    setForm({ code: '', description: '', discountType: 'PERCENTAGE', discountValue: '', maxUses: '', affiliateId: '', expiresAt: '', productIds: [] });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const stats = {
    total: coupons.length,
    active: coupons.filter(c => c.isActive).length,
    totalUses: coupons.reduce((s, c) => s + c.usedCount, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coupons</h1>
          <p className="text-muted-foreground">Shopify promo codes can be linked to approved partners without changing Shopify discounts</p>
        </div>
        <Button onClick={() => { closeDialog(); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Create Shopify Coupon
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Coupons</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Ticket className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.active}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Redemptions</CardTitle>
            <Ticket className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalUses}</div></CardContent>
        </Card>
      </div>

      {mappingError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{mappingError}</p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>All Coupons</CardTitle>
          <CardDescription>Discount codes for customers referred by affiliates</CardDescription>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ticket className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No coupons yet</h3>
              <p className="text-sm text-muted-foreground">Create your first discount code</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <code className="rounded bg-muted px-2 py-0.5 text-sm font-mono">{c.code}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(c.code)}>
                          {copied === c.code ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `${c.discountValue} EGP`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.usedCount}{c.maxUses ? `/${c.maxUses}` : ''}</TableCell>
                    <TableCell className="text-sm">
                      {c.source === 'SHOPIFY' ? (
                        <select
                          aria-label={`Partner for Shopify coupon ${c.code}`}
                          disabled={mappingCouponId === c.id || !c.isActive}
                          className="w-52 max-w-full rounded-md border border-[#E4EBE6] bg-white p-2 text-sm text-[#17251D] focus:outline-primary disabled:opacity-50"
                          value={c.affiliateId || ''}
                          onChange={e => assignShopifyCoupon(c, e.target.value || null)}
                        >
                          <option value="">Not assigned</option>
                          {partners.map(p => <option key={p.id} value={p.id}>{p.name} · {p.referralCode}</option>)}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">
                          {partners.find(p => p.id === c.affiliateId)?.name || (c.affiliateId ? 'Assigned (inactive partner)' : 'Program-wide')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.shopifyProductHandles?.length
                        ? c.shopifyProductHandles.map(handle => (
                          <div key={handle} className="mb-1">
                            <a className="text-primary underline" target="_blank" rel="noopener noreferrer"
                              href={'https://herbalvitaly.com/products/' + encodeURIComponent(handle)}>
                              {products.find(p => p.handle === handle)?.title || handle}
                            </a>
                          </div>
                        ))
                        : <span className="text-muted-foreground">All / legacy</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</TableCell>
                    <TableCell>
                      {c.source === 'SHOPIFY'
                        ? <Badge variant={c.isActive && c.shopifyStatus === 'ACTIVE' ? 'default' : 'secondary'}>{c.shopifyStatus === 'ACTIVE' ? 'Shopify active' : c.shopifyStatus || 'Shopify pending'}</Badge>
                        : <Switch checked={c.isActive} onCheckedChange={() => handleToggle(c.id, c.isActive)} />}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {c.source !== 'SHOPIFY' && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update legacy Refferq coupon (Shopify codes are managed in Shopify)' : 'Create and activate a Shopify discount restricted to the chosen products and partner'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Coupon Code (optional — auto-generate if empty)</Label>
              <Input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="e.g. SARA10 — or leave blank to generate" className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="20% off for new customers" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Discount Type</Label>
                <Select value={form.discountType} onValueChange={v => setForm({...form, discountType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED">Fixed Amount (E£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Discount Value *</Label>
                <Input type="number" value={form.discountValue} onChange={e => setForm({...form, discountValue: e.target.value})} placeholder="20" />
              </div>
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Products eligible for this Shopify discount *</Label>
                {catalogError && <p role="alert" className="text-sm text-red-700">{catalogError}</p>}
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-[#E4EBE6] p-2">
                  {products.map(product => (
                    <label key={product.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm hover:bg-[#EAF4ED]">
                      <input type="checkbox" className="mt-1 accent-[#1F6B3A]"
                        checked={form.productIds.includes(product.id)}
                        onChange={e => setForm(previous => ({
                          ...previous,
                          productIds: e.target.checked
                            ? [...previous.productIds, product.id]
                            : previous.productIds.filter(id => id !== product.id),
                        }))}/>
                      <span>{product.title}</span>
                    </label>
                  ))}
                  {!products.length && <p className="p-2 text-sm text-muted-foreground">No Shopify products available</p>}
                </div>
                <p className="text-xs text-muted-foreground">Only checked products receive the discount, including their variants.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Max Uses</Label>
                <Input type="number" value={form.maxUses} onChange={e => setForm({...form, maxUses: e.target.value})} placeholder="Unlimited" />
              </div>
              <div className="grid gap-2">
                <Label>Expires At</Label>
                <Input type="date" value={form.expiresAt} onChange={e => setForm({...form, expiresAt: e.target.value})} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Approved Affiliate {!editing && '*'}</Label>
              <select className="rounded-md border border-[#E4EBE6] bg-white px-3 py-2 text-sm"
                value={form.affiliateId} onChange={e => setForm({ ...form, affiliateId: e.target.value })}>
                <option value="">Select an approved partner</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name} · {p.referralCode}</option>)}
              </select>
            </div>
          </div>
          {formError && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.discountValue || (!editing && (!form.affiliateId || !form.productIds.length || !!catalogError))}>
              {saving ? 'Saving...' : editing ? 'Update legacy' : 'Create & Activate in Shopify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
