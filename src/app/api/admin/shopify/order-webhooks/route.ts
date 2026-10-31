import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shopifyAdminGraphQL } from '@/lib/hv-shopify-discounts';

/**
 * Authenticated admin-only, app-owned webhook registration and status.
 * Uses the SAME Shopify Dev Dashboard app credentials as the receiver's HMAC.
 * Never registers the wrong Shopify connector app's subscriptions.
 */
const ENDPOINT = 'https://partner.herbalvitaly.com/api/integrations/shopify/orders';
const TOPICS = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED'] as const;
type Subscription = { id: string; topic: string; uri: string };
type Registry = {
  webhookSubscriptions: { nodes: Subscription[]; pageInfo: { hasNextPage: boolean } };
};
const SCOPES = `query HvInstalledAppScopes {
  currentAppInstallation { accessScopes { handle } }
}`;
const LIST = `query HvOrderWebhookStatus {
  webhookSubscriptions(first: 100, topics: [ORDERS_CREATE, ORDERS_UPDATED, ORDERS_CANCELLED]) {
    nodes { id topic uri }
    pageInfo { hasNextPage }
  }
}`;
const CREATE = `mutation HvSubscribeOrderWebhook($topic: WebhookSubscriptionTopic!, $input: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $input) {
    webhookSubscription { id topic uri }
    userErrors { field message }
  }
}`;
async function isAdmin(request: NextRequest): Promise<boolean> {
  const id = request.headers.get('x-user-id');
  if (!id || request.headers.get('x-authenticated-role') !== 'ADMIN') return false;
  const admin = await prisma.user.findUnique({
    where: { id }, select: { role: true, status: true },
  });
  return admin?.role === 'ADMIN' && admin.status === 'ACTIVE';
}
async function registry() {
  const app = await shopifyAdminGraphQL<{
    currentAppInstallation: { accessScopes: Array<{ handle: string }> };
  }>(SCOPES);
  const scopes = app.currentAppInstallation.accessScopes.map(x => x.handle);
  const hasOrderAccess = scopes.includes('read_orders') || scopes.includes('write_orders');
  if (!hasOrderAccess) {
    return {
      scopes, hasOrderAccess, subscriptions: [] as Subscription[], paginated: false,
      matching: TOPICS.map(topic => ({ topic, installed: false })),
    };
  }
  const data = await shopifyAdminGraphQL<Registry>(LIST);
  return {
    scopes,
    hasOrderAccess,
    subscriptions: data.webhookSubscriptions.nodes,
    paginated: data.webhookSubscriptions.pageInfo.hasNextPage,
    matching: TOPICS.map(topic => ({
      topic,
      installed: data.webhookSubscriptions.nodes.some(x => x.topic === topic && x.uri === ENDPOINT),
    })),
  };
}
export async function GET(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const r = await registry();
    return NextResponse.json({ success: true, ...r, expectedEndpoint: ENDPOINT,
      hmacConfigured: Boolean(process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET) },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Cannot inspect this Shopify app installation; check its credentials and permissions.' }, { status: 503 });
  }
}
export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (process.env.VERCEL_ENV !== 'production' || request.headers.get('origin') !== 'https://partner.herbalvitaly.com')
    return NextResponse.json({ error: 'Use the Production admin dashboard' }, { status: 403 });
  if (process.env.HV_ENABLE_SHOPIFY_ORDER_WEBHOOKS !== 'true')
    return NextResponse.json({ error: 'Order webhook installation is locked until approved for Production' }, { status: 423 });
  if (!process.env.SHOPIFY_CLIENT_SECRET)
    return NextResponse.json({ error: 'Shopify app client secret is required for webhook HMAC verification' }, { status: 503 });
  try {
    const state = await registry();
    if (!state.hasOrderAccess)
      return NextResponse.json({ error: 'Shopify Affiliate Portal app needs read_orders access scope and must be reinstalled/updated' }, { status: 422 });
    if (state.paginated)
      return NextResponse.json({ error: 'Too many subscriptions; verify manually before installing' }, { status: 409 });
    const created: Subscription[] = [];
    for (const row of state.matching.filter(x => !x.installed)) {
      const data = await shopifyAdminGraphQL<{
        webhookSubscriptionCreate: {
          webhookSubscription: Subscription | null;
          userErrors: Array<{ message: string }>;
        };
      }>(CREATE, { topic: row.topic, input: { uri: ENDPOINT, format: 'JSON' } });
      const result = data.webhookSubscriptionCreate;
      if (result.userErrors.length || !result.webhookSubscription)
        throw new Error('Shopify rejected ' + row.topic + ': ' +
          result.userErrors.map(x => x.message).join('; ').slice(0,150));
      created.push(result.webhookSubscription);
    }
    const refreshed = await registry();
    return NextResponse.json({ success: true, created: created.map(x => x.topic),
      matching: refreshed.matching,
      message: 'Registered order webhooks. No order or financial record was changed.' },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not register Shopify webhooks; verify installed topics before retrying' },
      { status: 502 });
  }
}
