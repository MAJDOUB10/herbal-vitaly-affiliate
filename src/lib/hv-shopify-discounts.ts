/**
 * Shopify Admin API is invoked server-side. The Vercel project MUST have
 * SHOPIFY_ADMIN_ACCESS_TOKEN with read_products and write_discounts scopes.
 * No token must ever reach client components, logs or GitHub.
 */
const SHOP = 'kk20pd-es.myshopify.com';
const API_VERSION = '2026-07';
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const ID_PATTERN = /^gid:\/\/shopify\/Product\/[0-9]+$/;

export type HvShopProduct = { id: string; handle: string; title: string; status: string; onlineStoreUrl?: string | null };
export function validateDiscountCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const value = code.trim().toUpperCase();
  return CODE_PATTERN.test(value) ? value : null;
}
export function validateProductIds(values: unknown): string[] | null {
  if (!Array.isArray(values) || values.length < 1 || values.length > 30) return null;
  const ids = [...new Set(values)];
  if (ids.some(id => typeof id !== 'string' || !ID_PATTERN.test(id))) return null;
  return ids;
}
export function productDiscountLink(code: string, handle: string): string {
  if (!validateDiscountCode(code) || !handle || handle.length > 255 ||
      !/^[^/?#]+$/.test(handle)) throw new Error('Invalid product discount link');
  const destination = '/products/' + encodeURIComponent(handle);
  return 'https://herbalvitaly.com/discount/' + encodeURIComponent(code) +
    '?redirect=' + encodeURIComponent(destination);
}
export type DiscountInput = {
  code: string; discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number; productIds: string[];
  startsAt: Date; expiresAt?: Date | null; maxUses?: number | null;
};
export function buildBasicDiscountInput(data: DiscountInput): Record<string, unknown> {
  if (!validateDiscountCode(data.code) || !validateProductIds(data.productIds) ||
      !Number.isFinite(data.discountValue) || data.discountValue <= 0 ||
      (data.discountType === 'PERCENTAGE' && data.discountValue > 100) ||
      (data.discountType === 'FIXED' && data.discountValue > 100000) ||
      (data.maxUses != null && (!Number.isInteger(data.maxUses) || data.maxUses < 1)))
    throw new Error('Invalid discount data');
  if (data.expiresAt && data.expiresAt <= data.startsAt) throw new Error('Expiry must follow start');
  return {
    title: 'Herbal Vitaly Affiliate — ' + data.code,
    code: data.code,
    startsAt: data.startsAt.toISOString(),
    ...(data.expiresAt ? { endsAt: data.expiresAt.toISOString() } : {}),
    ...(data.maxUses ? { usageLimit: data.maxUses } : {}),
    context: { all: 'ALL' },
    combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: false },
    appliesOncePerCustomer: false,
    customerGets: {
      items: { products: { productsToAdd: data.productIds } },
      value: data.discountType === 'PERCENTAGE'
        ? { percentage: data.discountValue / 100 }
        : { discountAmount: { amount: data.discountValue.toFixed(2), appliesOnEachItem: true } },
    },
  };
}

function shopCredentials(): string {
  const key = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!key || shop !== SHOP)
    throw new Error('Shopify Admin API integration not configured for the expected shop');
  return key;
}
export async function shopifyAdminGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const accessToken = shopCredentials();
  const response = await fetch('https://' + SHOP + '/admin/api/' + API_VERSION + '/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Shopify Admin API request failed (' + response.status + ')');
  const body = await response.json();
  if (body.errors?.length) throw new Error('Shopify GraphQL request rejected: ' +
    body.errors.map((e: { message?: string }) => e.message || 'Unknown').join('; ').slice(0,450));
  return body.data as T;
}

export async function getShopifyProducts(): Promise<HvShopProduct[]> {
  const query = `query HvAffiliateProducts {
    products(first: 80, query: "status:active") {
      nodes { id handle title status onlineStoreUrl }
    }
  }`;
  const r = await shopifyAdminGraphQL<{ products: { nodes: HvShopProduct[] } }>(query);
  return r.products.nodes.filter(p => p.status === 'ACTIVE' && p.onlineStoreUrl?.startsWith('https://herbalvitaly.com/'));
}

export async function getShopifyDiscountByCode(code: string): Promise<{ id: string; status: string } | null> {
  const q = `query HvDiscountCodeExists($code: String!) {
    codeDiscountNodeByCode(code: $code) {
      id codeDiscount { ... on DiscountCodeBasic { status } }
    }
  }`;
  const r = await shopifyAdminGraphQL<{ codeDiscountNodeByCode: { id: string; codeDiscount: { status?: string } } | null }>(q,{ code });
  return r.codeDiscountNodeByCode ? { id: r.codeDiscountNodeByCode.id,
    status: r.codeDiscountNodeByCode.codeDiscount?.status || 'UNKNOWN' } : null;
}
export async function createShopifyDiscount(input: Record<string, unknown>): Promise<{ id: string; status: string; summary: string }> {
  const q = `mutation HvCreateAffiliateDiscount($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
      codeDiscountNode {
        id
        codeDiscount { ... on DiscountCodeBasic { status summary } }
      }
      userErrors { field message code }
    }
  }`;
  type Result = { discountCodeBasicCreate: {
    codeDiscountNode: { id: string; codeDiscount: { status: string; summary: string } } | null;
    userErrors: Array<{ field?: string[]; message: string; code?: string }>;
  } };
  const out = (await shopifyAdminGraphQL<Result>(q, { input })).discountCodeBasicCreate;
  if (out.userErrors.length) throw new Error(out.userErrors.map(e => e.message).join('; '));
  if (!out.codeDiscountNode) throw new Error('Shopify did not return a discount');
  return {
    id: out.codeDiscountNode.id,
    status: out.codeDiscountNode.codeDiscount.status,
    summary: out.codeDiscountNode.codeDiscount.summary,
  };
}
