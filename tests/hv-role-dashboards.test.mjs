import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('dashboards use one role-scoped private API with actual COD orders', () => {
 const api = source('src/app/api/dashboard/insights/route.ts');
 assert.match(api, /x-authenticated-role/);
 assert.match(api, /user\.role !== headerRole/);
 assert.match(api, /user\.status !== 'ACTIVE'/);
 assert.match(api, /user\.affiliate!\.id/);
 assert.match(api, /affiliateFilter = admin \?/);
 assert.match(api, /shopifyUpdatedAt: \{ gte: from \}/);
 assert.match(api, /prisma\.hvCodOrder\.findMany/);
 assert.match(api, /prisma\.referralClick\.count/);
 assert.match(api, /prisma\.commission\.findMany/);
 assert.match(api, /'Cache-Control': 'private, no-store'/);
});

test('dashboard does not fabricate Shopify products, return reasons or approved payouts', () => {
 const api = source('src/app/api/dashboard/insights/route.ts');
 const ui = source('src/components/dashboard/HvDashboard.tsx');
 assert.match(api, /returnReason: null/);
 assert.match(api, /product: null/);
 assert.match(api, /o\.merchantReconciled/);
 assert.match(api, /c\.status === 'PAID'/);
 assert.match(ui, /Motifs détaillés non encore transmis/);
 assert.match(ui, /Paiement uniquement après livraison/);
 assert.match(ui, /Aucune commande ne vaut commission payable/);
 assert.doesNotMatch(api, /payout\.create|commission\.update|merchantReconciled: true/);
});

test('admin and affiliate dashboards share UI but cannot impersonate each other', () => {
 const admin = source('src/app/admin/page.tsx');
 const partner = source('src/app/affiliate/page.tsx');
 const ui = source('src/components/dashboard/HvDashboard.tsx');
 assert.match(admin, /role="ADMIN"/);
 assert.match(partner, /role="AFFILIATE"/);
 assert.match(ui, /\/api\/dashboard\/insights/);
 assert.match(ui, /\/api\/affiliate\/shopify-coupons/);
 assert.match(ui, /\/api\/admin\/coupons\/products/);
 assert.match(ui, /o\.shopifyOrderUrl \?/);
});
