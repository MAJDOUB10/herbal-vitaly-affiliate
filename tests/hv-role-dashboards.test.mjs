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
 assert.match(ui, /Detailed return reasons are not yet available/);
 assert.match(ui, /Payouts only after delivery/);
 assert.match(ui, /Orders do not create payable commissions before COD\/Bosta reconciliation/);
 assert.doesNotMatch(api, /payout\.create|commission\.update|prisma\.hvCodOrder\.update/);
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

test('shared dashboard endpoint is covered by the same signed HttpOnly session boundary', () => {
 const proxy = source('src/proxy.ts');
 const api = source('src/app/api/dashboard/insights/route.ts');
 assert.match(proxy, /'\/api\/dashboard\/:path\*'/);
 assert.match(proxy, /request\.cookies\.get\('auth-token'\)/);
 assert.match(proxy, /jwtVerify\(/);
 assert.match(proxy, /passwordSessionVersion\(user\.password\)/);
 assert.match(proxy, /headers\.delete\('x-user-id'\)/);
 assert.match(proxy, /headers\.delete\('x-authenticated-role'\)/);
 assert.match(proxy, /headers\.set\('x-user-id', user\.id\)/);
 assert.match(proxy, /headers\.set\('x-authenticated-role', user\.role\)/);
 assert.match(api, /user\.role !== headerRole/);
 assert.match(api, /user\.status !== 'ACTIVE'/);
 assert.match(api, /affiliateId: user\.affiliate!\.id/);
});

test('Admin and Partner dashboards present consistent English labels, dates and CSV controls', () => {
 const ui = source('src/components/dashboard/HvDashboard.tsx');
 const adminLayout = source('src/app/admin/layout.tsx');
 const partnerLayout = source('src/app/affiliate/layout.tsx');
 assert.match(ui, /<main lang="en"/);
 assert.match(ui, /'en-GB'/);
 assert.doesNotMatch(ui, /'fr-FR'/);
 for (const label of ['Tracked orders', 'Order value', 'Delivered orders', 'Return reasons',
   'Shopify catalog', 'Delivery statuses', 'Attribution source', 'Export CSV',
   'Partner performance', 'Pending commissions', 'No records match these filters']) {
   assert.ok(ui.includes(label), 'English dashboard label missing: ' + label);
 }
 for (const layout of [adminLayout, partnerLayout]) {
   assert.match(layout, /title: 'Dashboard'/);
   assert.match(layout, /title: 'Orders'/);
 }
 assert.doesNotMatch(ui, /Commandes suivies|Filtres d'analyse|Motifs de retour|Réinitialiser|Charger|Remboursées|Partenaire|Livraison en attente/);
});
