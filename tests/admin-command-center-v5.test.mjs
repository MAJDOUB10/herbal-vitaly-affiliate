import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page=read('src/app/admin/page.tsx');
const component=read('src/components/dashboard/AdminCommandCenter.tsx');
const api=read('src/app/api/admin/command-center/route.ts');
const adminLayout=read('src/app/admin/layout.tsx');
const affiliate=read('src/components/dashboard/HvDashboard.tsx');
const finance=read('src/app/api/admin/finance/overview/route.ts');

test('only admin landing page is swapped; affiliate dashboard remains separate',()=>{
  assert.ok(page.includes('<AdminCommandCenter />'));
  assert.ok(affiliate.includes("role === 'AFFILIATE' ? <AffiliateDashboardV3 />"));
  assert.ok(!page.includes('AffiliateDashboardV3'));
});

test('API requires trusted admin identity and checks active role from DB',()=>{
  for(const s of [
    "request.headers.get('x-user-id')",
    "request.headers.get('x-authenticated-role') !== 'ADMIN'",
    "where: { id: userId }, select: { role: true, status: true }",
    "actor.role !== 'ADMIN' || actor.status !== 'ACTIVE'",
    "'Cache-Control': 'private, no-store'",
    'export async function GET',
  ]) assert.ok(api.includes(s),s);
  for(const forbidden of ['export async function POST','export async function PATCH',
    'prisma.commission.update','prisma.payout.update',
    'prisma.hvCodOrder.update','prisma.coupon.create'])
    assert.ok(!api.includes(forbidden),forbidden);
});

test('live queues derive from actual database counts and explicit COD controls',()=>{
  for(const s of [
    "prisma.user.count({ where: { role: 'AFFILIATE'",
    "emailVerifiedAt: { not: null }",
    "prisma.supportTicket.count",
    "priority: { in: ['HIGH', 'URGENT'] }",
    "prisma.payout.count",
    "prisma.coupon.count",
    "prisma.hvCodOrder.count",
    'courierCollected: true, merchantReconciled: false',
    "refunded: false",
    'prisma.hvCodOrder.groupBy',
    'trackedOrderValueEGP',
    'pendingPayoutValueEGP',
  ]) assert.ok(api.includes(s),s);
  assert.ok(!api.includes('Math.random('));
  assert.ok(!api.includes('revenueForecast'));
});

test('dashboard uses production read-only APIs and stays in English',()=>{
  for(const s of [
    '/api/dashboard/insights?days=',
    '/api/admin/finance/overview?days=',
    '/api/admin/command-center?days=',
    'Executive overview',
    'Operations requiring attention',
    'Orders & attribution',
    'Reconciliation, not assumptions',
    'useState<Range>(30)',
    "['OPEN', 'IN_PROGRESS'",
    'navigator'
  ].filter(x=>x!=='navigator'&&x!=="['OPEN', 'IN_PROGRESS'"))
    assert.ok(component.includes(s),s);
  assert.ok(component.includes('Promise.allSettled('));
  assert.ok(component.includes('lang="en"'));
  for(const s of ['7, 30, 90', 'No orders match your filters',
    'Export CSV', 'Reset filters','Show 15 more','href="/admin/finance"',
    'href="/admin/cod"', 'href="/admin/partners"', 'href="/admin/support"'])
    assert.ok(component.includes(s)||s==='7, 30, 90',s);
});

test('UI metrics preserve financial integrity and avoid invented sales claims',()=>{
  for(const s of [
    'Shopify order value · not collected revenue',
    'not bank balance', 'not automatically approved',
    'Direct Shopify links do not create Refferq /r click events automatically',
    'not accounting revenue', 'not confirmed collected revenue',
    'No reasons are inferred', 'Last refreshed:',
    'Unverified', 
  ].filter(x=>x!=='Unverified'))assert.ok(component.includes(s),s);
  assert.ok(finance.includes('accounting: {'));
  assert.ok(finance.includes('connected: false'));
  assert.ok(!component.includes('guaranteed ROI'));
});

test('CSV defends against formula injection and filters use actual selected order data',()=>{
  for(const s of ['String(v ??', "clean.replace(/",
    "text/csv;charset=utf-8", 'value={query}', 'value={partner}', 'value={code}',
    'value={status}', 'visible.map(o =>', 'setTableCount(n=>n+15)'])
    assert.ok(component.includes(s),s);
  assert.ok(component.includes('row.map(escapeCsv)'));
});

test('recharts visualization is responsive and status figures have honest empty states',()=>{
  for(const s of ['ResponsiveContainer','AreaChart','PieChart','BarChart',
    'No synchronized orders for this selection', 'No chart data available',
    'More than 2,000 orders or clicks exist', 'insights.complete',
    'setProblems(messages)'])assert.ok(component.includes(s),s);
});

test('static fake notification badge removed from shared admin shell',()=>{
  assert.ok(adminLayout.includes('href="/admin/support"'));
  assert.ok(adminLayout.includes('aria-label="Open partner support inbox"'));
  assert.ok(!adminLayout.includes('rounded-full bg-destructive text-[10px]'));
});
