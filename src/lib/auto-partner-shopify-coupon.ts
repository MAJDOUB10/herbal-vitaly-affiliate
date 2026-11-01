/**
 * Post-OTP onboarding: a single Shopify discount per verified affiliate.
 * Never auto-approves a payment, Shopify order or financial commission.
 * A persisted reservation precedes the Shopify mutation so retries are safe.
 */
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { getAutoCouponSettings } from '@/lib/auto-coupon-settings';
import {
  buildBasicDiscountInput, createShopifyDiscount, getShopifyDiscountByCode,
  getShopifyProducts, trackedAffiliateLandingLink, validateDiscountCode,
} from '@/lib/hv-shopify-discounts';

const RETRY_LEASE_MS = 5 * 60_000;

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

async function sendCouponEmail(couponId: string, email: string, name: string, referralCode: string, code: string, productHandles: string[], discountPercent: number) {
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
    const links = productHandles.map(handle => ({
      label: handle.toUpperCase(),
      url: ['tiynefret', 'ushabti'].includes(handle)
        ? trackedAffiliateLandingLink(referralCode, code, handle)
        : 'https://herbalvitaly.com/discount/' + encodeURIComponent(code) + '?redirect=' + encodeURIComponent('/products/' + handle),
    }));
    const productLabel = productHandles.map(h => h.toUpperCase()).join(', ');
    const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;background:#fff;color:#163b25">
      <div style="text-align:center"><img src="https://cdn.shopify.com/s/files/1/1003/9420/5506/files/herbal-vitaly-affiliate-official-logo.png?v=1793365508" width="152" alt="Herbal Vitaly" /></div>
      <h2 style="color:#1F6B3A">Welcome to Herbal Vitaly Affiliate Hub</h2>
      <p>Hello ${safeHtml(name)}, your affiliate account is now active.</p>
      <p>Your personal Shopify discount code is:</p>
      <div style="text-align:center;padding:18px;margin:18px 0;border:1px solid #bdd7c5;border-radius:10px;font-size:25px;letter-spacing:2px;font-weight:bold;color:#1F6B3A">${safeHtml(code)}</div>
      <p><strong>Customer discount: ${discountPercent}%</strong> on ${safeHtml(productLabel)} only. It cannot be combined with other discounts.</p>
      <p>Share your personal shopping links:</p>
      <ul>${links.map(l => `<li style="margin:9px 0"><a style="color:#1F6B3A" href="${l.url}">${safeHtml(l.label)} — ${discountPercent}% off</a></li>`).join('')}</ul>
      <p>Partner dashboard: <a href="https://partner.herbalvitaly.com/login">partner.herbalvitaly.com</a></p>
      <p style="font-size:12px;color:#64746a">Commissions are calculated separately and require normal order/delivery and financial verification.</p>
      <p style="color:#1F6B3A">Let nature be your medicine</p>
    </div>`;
    const text = `Hello ${name}, your Herbal Vitaly partner account is active. Shopify code: ${code}. Your customers receive ${discountPercent}% off ${productLabel} only. Links: ${links.map(l => l.label + ': ' + l.url).join(' | ')}. Your dashboard: https://partner.herbalvitaly.com/login. Commissions remain subject to delivery and finance verification.`;
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

/** Partner chooses their own 3-character code after a verified password login.
 * No code is created silently during registration or on sign-in.
 * Retrying a previously reserved code is allowed only for its owner.
 */
export async function provisionAffiliateShopifyCoupon(userId: string, requestedCode: string): Promise<void> {
  const chosenCode = requestedCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(chosenCode))
    throw new Error('Choose exactly 3 letters or numbers');
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

  const settings = await getAutoCouponSettings();
  if (!settings.enabled) return;
  const affiliateId = user.affiliate.id;
  // Preserve all existing assignments. A partner may not rename an
  // issued or reserved Shopify code by submitting a different suggestion.
  let coupon = await prisma.coupon.findFirst({
    where: { affiliateId, description: 'Automatic OTP-verified affiliate onboarding' },
    orderBy: { createdAt: 'asc' },
  });
  if (coupon && coupon.code !== chosenCode)
    throw new Error('A different promo code is already assigned to your account');
  if (!coupon) {
    const assigned = await prisma.coupon.findFirst({
      where: { affiliateId, source: 'SHOPIFY', isActive: true },
      select: { code: true },
    });
    if (assigned)
      throw new Error('A Shopify promo code is already assigned to your account');

    // Never adopt a code owned by another account or an existing Shopify
    // discount, even if its rate and product scope appear compatible.
    if (await prisma.coupon.findUnique({ where: { code: chosenCode }, select: { id: true } }))
      throw new Error('This code is already taken. Choose another.');
    if (await getShopifyDiscountByCode(chosenCode))
      throw new Error('This code is already taken. Choose another.');

    const products = await getShopifyProducts();
    const chosen = settings.productHandles.map(handle => products.find(p => p.handle === handle));
    if (chosen.some(p => !p))
      throw new Error('Required active Shopify products are not available');

    try {
      coupon = await prisma.coupon.create({
        data: {
          code: chosenCode, affiliateId, createdBy: user.id,
          description: 'Automatic OTP-verified affiliate onboarding',
          discountType: 'PERCENTAGE', discountValue: settings.discountPercent, currency: 'EGP',
          shopifyProductIds: chosen.map(p => p!.id),
          shopifyProductHandles: [...settings.productHandles],
          source: 'REFFERQ_PENDING', shopifyStatus: 'PENDING',
          isActive: false, startsAt: new Date(Date.now() - 60_000),
        },
      });
    } catch (error) {
      // Unique DB indexes prevent duplicate code assignment and multiple
      // automatic coupons for one affiliate during concurrent requests.
      const reserved = await prisma.coupon.findFirst({
        where: { affiliateId, description: 'Automatic OTP-verified affiliate onboarding' },
        orderBy: { createdAt: 'asc' },
      });
      if (reserved && reserved.code === chosenCode) coupon = reserved;
      else if (reserved) throw new Error('A different promo code is already assigned to your account');
      else if (error && typeof error === 'object' && 'code' in error &&
               error.code === 'P2002') throw new Error('This code is already taken. Choose another.');
      else throw error;
    }
  }
  const code = coupon.code;

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
            code, discountType: 'PERCENTAGE', discountValue: coupon.discountValue,
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
          scope: [...coupon.shopifyProductHandles], percent: coupon.discountValue, commissionsModified: false },
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
      coupon.shopifyStatus === 'ACTIVE' && !coupon.autoEmailSentAt && settings.sendEmail) {
    await sendCouponEmail(coupon.id, user.email, user.name, user.affiliate.referralCode,
      code, coupon.shopifyProductHandles, coupon.discountValue);
  }
}
