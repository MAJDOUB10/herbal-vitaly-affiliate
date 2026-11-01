/**
 * Post-OTP onboarding: a single Shopify discount per verified affiliate.
 * Never auto-approves a payment, Shopify order or financial commission.
 * A persisted reservation precedes the Shopify mutation so retries are safe.
 */
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import {
  buildBasicDiscountInput, createShopifyDiscount, getShopifyDiscountByCode,
  getShopifyProducts, productDiscountLink, validateDiscountCode,
} from '@/lib/hv-shopify-discounts';

const ELIGIBLE_HANDLES = ['tiynefret', 'ushabti'] as const;
const RATE = 15;
const RETRY_LEASE_MS = 5 * 60_000;

export function automaticPartnerCode(referralCode: string, affiliateId: string): string {
  const fromReferral = 'HV' + referralCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const fallback = 'HV' + affiliateId.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = fromReferral.length <= 40 ? fromReferral : fallback.slice(0, 40);
  const validated = validateDiscountCode(code);
  if (!validated) throw new Error('Unable to derive an affiliate discount reference');
  return validated;
}

export function eligiblePartnerCoupon(input: {
  role: string; status: string; emailVerifiedAt: Date | null; hasAffiliate: boolean;
}) {
  return input.role === 'AFFILIATE' && input.status === 'ACTIVE' &&
    Boolean(input.emailVerifiedAt) && input.hasAffiliate;
}

function safeHtml(s: string): string {
  return s.replace(/[&<>"']/g, x => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[x] || x));
}

async function sendCouponEmail(couponId: string, email: string, name: string, code: string) {
  const leaseAt = new Date();
  const claimed = await prisma.coupon.updateMany({
    where: {
      id: couponId, isActive: true, source: 'SHOPIFY', shopifyStatus: 'ACTIVE',
      autoEmailSentAt: null,
      OR: [
        { autoEmailClaimedAt: null },
        { autoEmailClaimedAt: { lt: new Date(leaseAt.getTime() - RETRY_LEASE_MS) } },
      ],
    },
    data: { autoEmailClaimedAt: leaseAt, autoEmailError: null },
  });
  if (claimed.count !== 1) return;
  try {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
      throw new Error('Partner email service is not configured');
    const links = ELIGIBLE_HANDLES.map(handle => ({
      label: handle === 'tiynefret' ? 'TIYNEFRET' : 'USHABTI',
      url: productDiscountLink(code, handle),
    }));
    const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;background:#fff;color:#163b25">
      <div style="text-align:center"><img src="https://cdn.shopify.com/s/files/1/1003/9420/5506/files/herbal-vitaly-affiliate-official-logo.png?v=1793365508" width="152" alt="Herbal Vitaly" /></div>
      <h2 style="color:#1F6B3A">Welcome to Herbal Vitaly Affiliate Hub</h2>
      <p>Hello ${safeHtml(name)}, your affiliate account is now active.</p>
      <p>Your personal Shopify discount code is:</p>
      <div style="text-align:center;padding:18px;margin:18px 0;border:1px solid #bdd7c5;border-radius:10px;font-size:25px;letter-spacing:2px;font-weight:bold;color:#1F6B3A">${safeHtml(code)}</div>
      <p><strong>Customer discount: 15%</strong> on TIYNEFRET and USHABTI only. It cannot be combined with other discounts.</p>
      <p>Share your personal shopping links:</p>
      <ul>${links.map(l => `<li style="margin:9px 0"><a style="color:#1F6B3A" href="${l.url}">${l.label} — 15% off</a></li>`).join('')}</ul>
      <p>Partner dashboard: <a href="https://partner.herbalvitaly.com/login">partner.herbalvitaly.com</a></p>
      <p style="font-size:12px;color:#64746a">Commissions are calculated separately and require normal order/delivery and financial verification.</p>
      <p style="color:#1F6B3A">Let nature be your medicine</p>
    </div>`;
    const text = `Hello ${name}, your Herbal Vitaly partner account is active. Shopify code: ${code}. Your customers receive 15% off TIYNEFRET and USHABTI only. Links: ${links.map(l => l.label + ': ' + l.url).join(' | ')}. Your dashboard: https://partner.herbalvitaly.com/login. Commissions remain subject to delivery and finance verification.`;
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_EMAIL, to: email,
      subject: 'Herbal Vitaly — Your partner discount code is ready',
      html, text,
    }, { idempotencyKey: 'hv-partner-coupon-v1-' + couponId });
    if (result.error || !result.data?.id)
      throw new Error('Resend did not confirm partner coupon email');
    await prisma.coupon.update({
      where: { id: couponId },
      data: { autoEmailSentAt: new Date(), autoEmailError: null },
    });
  } catch (error) {
    // Keep the same code and Resend idempotency key on retry.
    await prisma.coupon.updateMany({
      where: { id: couponId, autoEmailSentAt: null },
      data: { autoEmailClaimedAt: null, autoEmailError:
        error instanceof Error ? error.message.slice(0,200) : 'Email sending failed' },
    }).catch(() => {});
    throw error;
  }
}

export async function provisionAffiliateShopifyCoupon(userId: string): Promise<void> {
  // This feature is never executed against Shopify from Preview or local builds.
  if (process.env.VERCEL_ENV !== 'production' ||
      process.env.HV_ENABLE_SHOPIFY_DISCOUNT_WRITES !== 'true') return;

  const user = await prisma.user.findUnique({
    where: { id: userId }, include: { affiliate: true },
  });
  if (!user || !eligiblePartnerCoupon({
    role: user.role, status: user.status, emailVerifiedAt: user.emailVerifiedAt,
    hasAffiliate: Boolean(user.affiliate),
  }) || !user.affiliate) return;

  const affiliateId = user.affiliate.id;
  const code = automaticPartnerCode(user.affiliate.referralCode, affiliateId);

  // An existing Shopify coupon already associated with this partner is respected.
  // Never replace it, modify its rate or create an additional discount.
  const alreadyAssigned = await prisma.coupon.findFirst({
    where: { affiliateId, source: 'SHOPIFY', isActive: true, NOT: { code } },
    select: { id: true },
  });
  if (alreadyAssigned) return;

  let coupon = await prisma.coupon.findUnique({ where: { code } });
  if (coupon && coupon.affiliateId !== affiliateId)
    throw new Error('Affiliate discount code collision');

  if (!coupon) {
    const products = await getShopifyProducts();
    const chosen = ELIGIBLE_HANDLES.map(handle => products.find(p => p.handle === handle));
    if (chosen.some(p => !p))
      throw new Error('Required active Shopify products are not available');
    // Fail closed if an external discount owns this code.
    if (await getShopifyDiscountByCode(code))
      throw new Error('Affiliate code already exists in Shopify');
    try {
      coupon = await prisma.coupon.create({
        data: {
          code, affiliateId, createdBy: user.id, description: 'Automatic OTP-verified affiliate onboarding',
          discountType: 'PERCENTAGE', discountValue: RATE, currency: 'EGP',
          shopifyProductIds: chosen.map(p => p!.id),
          shopifyProductHandles: [...ELIGIBLE_HANDLES],
          source: 'REFFERQ_PENDING', shopifyStatus: 'PENDING',
          isActive: false, startsAt: new Date(Date.now() - 60_000),
        },
      });
    } catch (e) {
      // Concurrent login and OTP callbacks can race to reserve the same code.
      coupon = await prisma.coupon.findUnique({ where: { code } });
      if (!coupon || coupon.affiliateId !== affiliateId) throw e;
    }
  }

  if (coupon.source === 'REFFERQ_PENDING') {
    // Claim with an atomic lease; a second invocation cannot create a duplicate.
    const claimedAt = new Date();
    const claim = await prisma.coupon.updateMany({
      where: {
        id: coupon.id, source: 'REFFERQ_PENDING',
        OR: [
          { shopifyStatus: { in: ['PENDING', 'ERROR'] } },
          { shopifyStatus: 'CREATING', shopifySyncedAt: { lt: new Date(claimedAt.getTime() - RETRY_LEASE_MS) } },
        ],
      },
      data: { shopifyStatus: 'CREATING', shopifySyncedAt: claimedAt },
    });
    if (claim.count !== 1) return;
    try {
      const existing = await getShopifyDiscountByCode(code);
      const shopify = existing
        ? { id: existing.id, status: existing.status, summary: 'Affiliate discount recovered from Shopify' }
        : await createShopifyDiscount(buildBasicDiscountInput({
            code, discountType: 'PERCENTAGE', discountValue: RATE,
            productIds: coupon.shopifyProductIds, startsAt: new Date(Date.now() - 60_000),
          }));
      coupon = await prisma.coupon.update({
        where: { id: coupon.id },
        data: { source: 'SHOPIFY', shopifyDiscountId: shopify.id,
          shopifySummary: shopify.summary, shopifyStatus: shopify.status,
          shopifySyncedAt: new Date(), isActive: shopify.status === 'ACTIVE' },
      });
      await prisma.auditLog.create({ data: {
        actorId: user.id, action: 'AUTO_CREATE_PARTNER_SHOPIFY_COUPON',
        objectType: 'COUPON', objectId: coupon.id,
        payload: { affiliateId, code, shopifyDiscountId: shopify.id,
          scope: [...ELIGIBLE_HANDLES], percent: RATE, commissionsModified: false },
      }}).catch(() => {});
    } catch (error) {
      await prisma.coupon.updateMany({
        where: { id: coupon.id, source: 'REFFERQ_PENDING' },
        data: { shopifyStatus: 'ERROR', isActive: false },
      }).catch(() => {});
      throw error;
    }
  }

  if (coupon.source === 'SHOPIFY' && !coupon.isActive) {
    const remote = await getShopifyDiscountByCode(code);
    if (!remote || remote.status !== 'ACTIVE') return;
    coupon = await prisma.coupon.update({
      where: { id: coupon.id },
      data: { isActive: true, shopifyStatus: 'ACTIVE', shopifySyncedAt: new Date() },
    });
  }
  if (coupon.source === 'SHOPIFY' && coupon.isActive &&
      coupon.shopifyStatus === 'ACTIVE' && !coupon.autoEmailSentAt) {
    await sendCouponEmail(coupon.id, user.email, user.name, code);
  }
}
