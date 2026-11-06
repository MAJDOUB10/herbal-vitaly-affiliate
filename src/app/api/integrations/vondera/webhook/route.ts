import { createHash, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENTS = new Set([
  'orders.created', 'orders.updated', 'orders.deleted',
  'products.created', 'products.updated', 'products.deleted',
  'customers.created', 'customers.updated', 'customers.deleted',
  'inventory.updated', 'transactions.created', 'payout.created', 'payout.updated',
  'abandoned_carts.created', 'app.revoked',
]);
const MAX_BODY_BYTES = 512 * 1024;
type JSONObject = Record<string, unknown>;
declare global {
  // eslint-disable-next-line no-var
  var __hvVonderaPool: Pool | undefined;
}

function isObject(value: unknown): value is JSONObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function obj(value: unknown): JSONObject {
  return isObject(value) ? value : {};
}
function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}
function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : NaN);
  return Number.isFinite(n) ? n : null;
}
function piasters(value: unknown): number | null {
  const n = num(value);
  return n === null || Math.abs(n) > 9e12 ? null : Math.round(n * 100);
}
function dateOrNow(value: unknown): Date {
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (Number.isFinite(d.getTime())) return d;
  }
  // Firestore timestamps are used by some Vondera resources.
  const seconds = num(obj(value)._seconds);
  return seconds === null ? new Date() : new Date(seconds * 1000);
}
function safePayload(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[max-depth]';
  if (Array.isArray(value)) return value.slice(0, 200).map(v => safePayload(v, depth + 1));
  if (!isObject(value)) return value;
  const result: JSONObject = {};
  for (const [key, part] of Object.entries(value)) {
    if (/^(customer|requestMeta|shippingAddress|billingAddress|notes|comments|sessionId|ipAddress|userAgent|phone|otherPhone|email|address|name|fullName|firstName|lastName|receiptImage)$/i.test(key)) continue;
    result[key] = safePayload(part, depth + 1);
  }
  return result;
}
function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
  globalThis.__hvVonderaPool ??= new Pool({
    connectionString: process.env.DATABASE_URL, max: 3,
    connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true },
  });
  return globalThis.__hvVonderaPool;
}
function verifyToken(given: string | null): boolean {
  const secret = process.env.VONDERA_WEBHOOK_TOKEN;
  if (!given || !secret || secret.length < 32) return false;
  const hash = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(given), hash(secret));
}
function entityFrom(body: JSONObject): JSONObject {
  const top = obj(body.payload);
  const inside = obj(body.data);
  const nested = obj(inside.data);
  const candidate = Object.keys(nested).length ? nested :
    Object.keys(inside).length ? inside :
    Object.keys(top).length ? top : body;
  return obj(candidate.order ?? candidate.product ?? candidate.customer ?? candidate);
}

export async function POST(request: NextRequest) {
  if (process.env.VONDERA_SYNC_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Integration not enabled' }, { status: 503 });
  }
  const event = request.nextUrl.searchParams.get('event');
  const storeId = process.env.VONDERA_STORE_ID;
  if (!event || !EVENTS.has(event) || !storeId) {
    return NextResponse.json({ error: 'Invalid integration configuration' }, { status: 400 });
  }
  if (!verifyToken(request.nextUrl.searchParams.get('token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  let body: JSONObject;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) throw new Error('Expected JSON object');
    body = parsed;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON object' }, { status: 400 });
  }
  const entity = entityFrom(body);
  const claimedStoreId = str(entity.storeId ?? body.storeId);
  if (claimedStoreId && claimedStoreId !== storeId) {
    return NextResponse.json({ error: 'Store mismatch' }, { status: 403 });
  }
  // Identical deliveries are idempotent, including Vondera's retries.
  const key = createHash('sha256').update(storeId).update('|').update(event).update('|').update(raw).digest('hex');
  const resourceId = str(entity.id ?? entity.orderId ?? entity.productId ?? entity.customerId);
  const updatedAt = dateOrNow(entity.updatedAt ?? entity.createdAt ?? entity.date);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const eventInsert = await client.query(
      'INSERT INTO hv_vondera_webhook_events (event_key,store_id,event_type,resource_id,safe_payload) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING RETURNING event_key',
      [key, storeId, event, resourceId, JSON.stringify(safePayload(body))]
    );
    if (eventInsert.rowCount === 0) {
      await client.query('COMMIT');
      return NextResponse.json({ accepted: true, duplicate: true });
    }
    if (resourceId && event.startsWith('orders.')) {
      const payment = obj(entity.payment);
      const utm = obj(entity.utmData);
      const discounts = entity.discountCodes;
      const firstDiscount = Array.isArray(discounts) ? obj(discounts[0]) : {};
      const status = event === 'orders.deleted' ? 'Deleted' : str(entity.status);
      await client.query(
        \`INSERT INTO hv_vondera_orders
          (store_id,order_id,order_number,status,payment_status,currency,total_piasters,discount_code,referral_code,source_updated_at,last_event_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (store_id,order_id) DO UPDATE SET
           order_number = COALESCE(EXCLUDED.order_number,hv_vondera_orders.order_number),
           status = COALESCE(EXCLUDED.status,hv_vondera_orders.status),
           payment_status = COALESCE(EXCLUDED.payment_status,hv_vondera_orders.payment_status),
           currency = EXCLUDED.currency,
           total_piasters = COALESCE(EXCLUDED.total_piasters,hv_vondera_orders.total_piasters),
           discount_code = COALESCE(EXCLUDED.discount_code,hv_vondera_orders.discount_code),
           referral_code = COALESCE(EXCLUDED.referral_code,hv_vondera_orders.referral_code),
           source_updated_at = EXCLUDED.source_updated_at,
           last_event_key = EXCLUDED.last_event_key,
           synced_at = now()
         WHERE EXCLUDED.source_updated_at >= hv_vondera_orders.source_updated_at\`,
        [storeId, resourceId, str(entity.orderNumber ?? entity.orderName),
         status, str(entity.paymentStatus ?? payment.paymentStatus),
         str(payment.currency ?? entity.currency) ?? 'EGP',
         piasters(payment.totalPrice ?? entity.totalCost ?? entity.totalPrice ?? entity.total),
         str(entity.discountCode ?? firstDiscount.code),
         str(utm.aff ?? entity.referralCode),
         updatedAt, key]
      );
    } else if (resourceId && event.startsWith('products.')) {
      await client.query(
        \`INSERT INTO hv_vondera_products
          (store_id,product_id,title,currency,price_piasters,quantity,source_updated_at,last_event_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (store_id,product_id) DO UPDATE SET
           title = COALESCE(EXCLUDED.title,hv_vondera_products.title),
           currency = EXCLUDED.currency,
           price_piasters = COALESCE(EXCLUDED.price_piasters,hv_vondera_products.price_piasters),
           quantity = COALESCE(EXCLUDED.quantity,hv_vondera_products.quantity),
           source_updated_at = EXCLUDED.source_updated_at,
           last_event_key = EXCLUDED.last_event_key,
           synced_at = now()
         WHERE EXCLUDED.source_updated_at >= hv_vondera_products.source_updated_at\`,
        [storeId, resourceId, str(entity.name ?? entity.arabicName ?? entity.title),
         str(entity.currency) ?? 'EGP', piasters(entity.price),
         num(entity.quantity), updatedAt, key]
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ accepted: true, event, projected: !!resourceId }, { status: 202 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Vondera webhook ingestion failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Ingestion failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
