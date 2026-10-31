import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyShopifyHmac } from '@/lib/hv-cod-connector';
import { ingestShopifyOrderSnapshot } from '@/lib/hv-order-ingest';

// Only receives Shopify order status snapshots. It never creates or approves
// commissions or changes balances. Enable subscriptions only after credentials
// and domain have been reviewed by Herbal Vitaly.
export async function POST(request: NextRequest) {
  // Accept live Shopify HTTPS webhook deliveries with the same verification
  // in Preview and Production. Shopify signs with the app CLIENT SECRET.
  if (!['preview', 'production'].includes(process.env.VERCEL_ENV || '')) {
    return NextResponse.json({ error: 'Unsupported environment' }, { status: 423 });
  }
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!secret || shopDomain !== 'kk20pd-es.myshopify.com') {
    return NextResponse.json({ error: 'Shopify webhook verification unavailable' }, { status: 503 });
  }
  const requestSize = Number(request.headers.get('content-length') || 0);
  if (requestSize > 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 1024 * 1024)
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  const sourceShop = request.headers.get('x-shopify-shop-domain');
  const signature = request.headers.get('x-shopify-hmac-sha256');
  const topic = request.headers.get('x-shopify-topic');
  const deliveryId = request.headers.get('x-shopify-webhook-id');
  if (sourceShop !== shopDomain || !verifyShopifyHmac(raw, signature, secret))
    return NextResponse.json({ error: 'Invalid Shopify signature or shop' }, { status: 401 });
  if (!['orders/create', 'orders/updated', 'orders/cancelled'].includes(topic || '') || !deliveryId || deliveryId.length > 128)
    return NextResponse.json({ error: 'Unsupported topic or missing delivery ID' }, { status: 422 });
  try {
    const payload = JSON.parse(raw);
    const result = await ingestShopifyOrderSnapshot(payload, topic!, 'shopify:' + deliveryId);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return NextResponse.json({ success: true, status: 'duplicate' });
    console.error('Shopify COD webhook rejected', e instanceof Error ? e.name : 'unknown');
    return NextResponse.json({ error: 'Invalid Shopify order event' }, { status: 422 });
  }
}
