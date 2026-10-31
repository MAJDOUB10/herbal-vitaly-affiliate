/**
 * Shopify Admin API is invoked server-side. The Vercel project MUST have
 * either legacy SHOPIFY_ADMIN_ACCESS_TOKEN or SHOPIFY_CLIENT_ID +
 * SHOPIFY_CLIENT_SECRET (Dev Dashboard app) with product and discount scopes.
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

type AuthCache = { token: string; expiresAt: number };
let cachedShopifyAccess: AuthCache | null = null;

/**
 * Supports both a legacy custom app access token and modern Shopify Dev
 * Dashboard credentials. The client_credentials token expires in ~24 hours.
 * The latter requires app and store under the SAME Shopify organization.
 */
async function shopCredentials(): Promise<string> {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  if (shop !== SHOP) throw new Error('Incorrect Shopify shop configuration');
  const legacy = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (legacy) return legacy;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error('Shopify app credentials not configured in Vercel');
  if (cachedShopifyAccess && cachedShopifyAccess.expiresAt > Date.now() + 300000)
    return cachedShopifyAccess.token;
  const resp = await fetch('https://' + SHOP + '/admin/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret,
    }),
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error('Shopify credentials grant failed; verify app installation and organization');
  const data = await resp.json() as { access_token?: string; scope?: string; expires_in?: number };
  const scopes = (data.scope || '').split(',');
  if (!data.access_token || !scopes.includes('read_products') || !scopes.includes('write_discounts'))
    throw new Error('Shopify application is missing read_products or write_discounts approval');
  cachedShopifyAccess = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Math.min(data.expires_in || 3600, 86400)) * 1000,
  };
  return cachedShopifyAccess.token;
}

export async function shopifyAdminGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const accessToken = await shopCredentials();
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

/** Verified product targets for Shopify discount codes, including legacy
 * synced codes whose Refferq product arrays were never populated.
 * Read-only: never changes discounts or coupon assignments.
 */
export type ShopifyCouponTarget = {
  status: string;
  scope: 'PRODUCTS' | 'ALL' | 'COLLECTIONS' | 'MISSING' | 'UNSUPPORTED';
  products: Array<{ id: string; title: string; handle: string; url: string }>;
  collections: Array<{ title: string; handle: string }>;
  truncated: boolean;
};
type DiscountReply = {
  id: string;
  codeDiscount: {
    status?: string;
    customerGets?: {
      items?: {
        __typename: string;
        products?: {
          nodes: Array<{ id: string; handle: string; title: string; onlineStoreUrl: string | null }>;
          pageInfo: { hasNextPage: boolean };
        };
        collections?: {
          nodes: Array<{ title: string; handle: string }>;
          pageInfo: { hasNextPage: boolean };
        };
      };
    };
  };
};
const MISSING_TARGET: ShopifyCouponTarget = {
  status: 'NOT_FOUND', scope: 'MISSING', products: [], collections: [], truncated: false,
};

export async function getShopifyCouponTargets(codes: string[]): Promise<Record<string, ShopifyCouponTarget>> {
  const safeCodes = [...new Set(codes.map(validateDiscountCode).filter((x): x is string => Boolean(x)))].slice(0, 100);
  const result: Record<string, ShopifyCouponTarget> = {};
  for (let start = 0; start < safeCodes.length; start += 5) {
    const batch = safeCodes.slice(start, start + 5);
    const variables: Record<string, unknown> = {};
    const definitions: string[] = [];
    const clauses = batch.map((code, i) => {
      variables['code' + i] = code;
      definitions.push('$code' + i + ': String!');
      return ` c${i}: codeDiscountNodeByCode(code: $code${i}) {
        id codeDiscount {
          ... on DiscountCodeBasic {
            status customerGets { items {
              __typename
              ... on DiscountProducts {
                products(first: 40) {
                  nodes { id title handle onlineStoreUrl }
                  pageInfo { hasNextPage }
                }
              }
              ... on DiscountCollections {
                collections(first: 40) {
                  nodes { title handle }
                  pageInfo { hasNextPage }
                }
              }
            } }
          }
        }
      }`;
    });
    const query = 'query HvCouponProductTargets(' + definitions.join(', ') + ') { ' + clauses.join('\n') + ' }';
    const response = await shopifyAdminGraphQL<Record<string, DiscountReply | null>>(query, variables);
    for (let i = 0; i < batch.length; i++) {
      const node = response['c' + i];
      if (!node) { result[batch[i]] = { ...MISSING_TARGET }; continue; }
      const discount = node.codeDiscount;
      const items = discount?.customerGets?.items;
      const kind = items?.__typename;
      const scope: ShopifyCouponTarget['scope'] =
        kind === 'DiscountProducts' ? 'PRODUCTS' :
        kind === 'AllDiscountItems' ? 'ALL' :
        kind === 'DiscountCollections' ? 'COLLECTIONS' : 'UNSUPPORTED';
      result[batch[i]] = {
        status: discount?.status || 'UNKNOWN',
        scope,
        products: scope === 'PRODUCTS'
          ? (items?.products?.nodes || [])
              .filter(p => p.onlineStoreUrl?.startsWith('https://herbalvitaly.com/products/'))
              .map(p => ({ id: p.id, title: p.title, handle: p.handle, url: p.onlineStoreUrl! }))
          : [],
        collections: scope === 'COLLECTIONS' ? (items?.collections?.nodes || []) : [],
        truncated: Boolean(items?.products?.pageInfo?.hasNextPage ||
                           items?.collections?.pageInfo?.hasNextPage),
      };
    }
  }
  return result;
}
