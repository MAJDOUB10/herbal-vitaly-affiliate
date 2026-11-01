import { prisma } from '@/lib/prisma';

export const DEFAULT_AUTO_COUPON_SETTINGS = {
  enabled: true,
  prefix: 'HV',
  discountPercent: 15,
  productHandles: ['tiynefret', 'ushabti'] as string[],
  sendEmail: true,
};

export type AutoCouponPolicy = typeof DEFAULT_AUTO_COUPON_SETTINGS;

export function validateAutoCouponPolicy(value: unknown): AutoCouponPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid automatic coupon settings');
  const v = value as Record<string, unknown>;
  if (typeof v.enabled !== 'boolean' || typeof v.sendEmail !== 'boolean')
    throw new Error('Enabled and email notification must be set');
  if (typeof v.prefix !== 'string' || !/^[A-Z][A-Z0-9]{1,9}$/.test(v.prefix))
    throw new Error('Code prefix must be 2–10 uppercase letters or digits and begin with a letter');
  if (typeof v.discountPercent !== 'number' || !Number.isFinite(v.discountPercent) ||
      v.discountPercent < 1 || v.discountPercent > 50 ||
      Math.round(v.discountPercent * 100) !== v.discountPercent * 100)
    throw new Error('Discount must be 1–50%, with at most two decimal places');
  if (!Array.isArray(v.productHandles) || v.productHandles.length < 1 ||
      v.productHandles.length > 20 ||
      v.productHandles.some(x => typeof x !== 'string' || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(x)) ||
      new Set(v.productHandles).size !== v.productHandles.length)
    throw new Error('Select between 1 and 20 distinct Shopify products');
  return {
    enabled: v.enabled,
    prefix: v.prefix,
    discountPercent: v.discountPercent,
    productHandles: [...v.productHandles] as string[],
    sendEmail: v.sendEmail,
  };
}

export async function getAutoCouponSettings(): Promise<AutoCouponPolicy> {
  const policy = await prisma.autoCouponSettings.findUnique({ where: { id: 'default' } });
  return policy ? {
    enabled: policy.enabled,
    prefix: policy.prefix,
    discountPercent: policy.discountPercent,
    productHandles: policy.productHandles,
    sendEmail: policy.sendEmail,
  } : { ...DEFAULT_AUTO_COUPON_SETTINGS, productHandles: [...DEFAULT_AUTO_COUPON_SETTINGS.productHandles] };
}
