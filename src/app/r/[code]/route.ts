import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signHvAttribution, shopifyAffiliateDestination } from '@/lib/hv-shopify-attribution';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const referralCode = code;
    const searchParams = request.nextUrl.searchParams;
    // The partner always lands on the actual Shopify shop, never the dashboard.
    // Deep links are only allowed to the same Herbal Vitaly storefront.
    const rawTarget = searchParams.get('dest') || searchParams.get('target');
    const targetUrl = shopifyAffiliateDestination(rawTarget).toString();

    // Find affiliate by referral code using Prisma
    const affiliate = await prisma.affiliate.findUnique({
      where: { referralCode },
      include: { user: true }
    });

    if (!affiliate || affiliate.user.status !== 'ACTIVE') {
      // Invalid referral code - redirect to default URL
      return NextResponse.redirect(targetUrl);
    }

    // Get client IP and user agent
    const clientIP = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const cleanIP = clientIP.split(',')[0].trim();
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const referer = request.headers.get('referer') || null;

    // ─── Fraud Detection ───────────────────────────────────────
    const { checkFraud } = await import('@/lib/fraud-detection');
    const fraudResult = await checkFraud({
      ipAddress: cleanIP,
      userAgent,
      affiliateId: affiliate.id,
    });

    // Generate attribution key
    const attributionKey = `attr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Find or create a referral record for click tracking
    let referral = await prisma.referral.findFirst({
      where: {
        affiliateId: affiliate.id,
        leadEmail: `click-${attributionKey}@tracking.internal`,
      }
    });

    if (!referral) {
      referral = await prisma.referral.create({
        data: {
          affiliateId: affiliate.id,
          leadName: 'Click Visitor',
          leadEmail: `click-${attributionKey}@tracking.internal`,
          status: 'PENDING',
          metadata: {
            source: 'referral_link',
            attribution_key: attributionKey,
            target_url: targetUrl,
            params: Object.fromEntries(searchParams.entries()),
          }
        }
      });
    }

    // Track the click in ReferralClick table (always track, even if suspicious)
    await prisma.referralClick.create({
      data: {
        referralId: referral.id,
        ipAddress: cleanIP,
        userAgent: userAgent,
        referer: referer,
        metadata: {
          attribution_key: attributionKey,
          target_url: targetUrl,
          is_deep_link: !!searchParams.get('dest'),
          fraud_check: {
            is_suspicious: fraudResult.isSuspicious,
            risk_score: fraudResult.riskScore,
            reasons: fraudResult.reasons,
          },
        }
      }
    });

    // A signed token is carried to Shopify and later verified against the
    // authenticated orders webhook. Never trust unsigned query parameters for payout.
    const attributionSecret = process.env.HV_ATTRIBUTION_SECRET || process.env.JWT_SECRET;
    if (!attributionSecret) {
      console.error('Missing attribution signing secret');
      return NextResponse.redirect(targetUrl);
    }
    const hvToken = signHvAttribution({
      referralCode, attributionKey, issuedAt: Date.now(),
    }, attributionSecret);

    // Create redirect response with attribution cookie
    const redirectUrl = new URL(targetUrl);

    // Preserve existing search params on the target URL (important for deep linking)
    searchParams.forEach((value, key) => {
      // Don't override existing ref/attr if they happen to be there, and don't pass dest/target again
      if (!['ref', 'attr', 'dest', 'target', 'hv_ref', 'hv_attr', 'hv_token'].includes(key)) {
        redirectUrl.searchParams.set(key, value);
      }
    });

    redirectUrl.searchParams.set('ref', referralCode);
    redirectUrl.searchParams.set('attr', attributionKey);
    redirectUrl.searchParams.set('hv_ref', referralCode);
    redirectUrl.searchParams.set('hv_attr', attributionKey);
    redirectUrl.searchParams.set('hv_token', hvToken);
    if (!redirectUrl.searchParams.has('utm_source')) redirectUrl.searchParams.set('utm_source', 'herbal_vitaly_affiliate');
    if (!redirectUrl.searchParams.has('utm_medium')) redirectUrl.searchParams.set('utm_medium', 'partner');
    if (!redirectUrl.searchParams.has('utm_campaign')) redirectUrl.searchParams.set('utm_campaign', 'affiliate');

    const response = NextResponse.redirect(redirectUrl.toString());

    // Set attribution cookie (expires in 30 days)
    const cookieExpiry = new Date();
    cookieExpiry.setDate(cookieExpiry.getDate() + 30);

    response.cookies.set('affiliate_attribution', JSON.stringify({
      referral_code: referralCode,
      attribution_key: attributionKey,
      affiliate_id: affiliate.id,
      timestamp: new Date().toISOString(),
    }), {
      expires: cookieExpiry,
      httpOnly: false, // Allow client-side access for conversion tracking
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Referral tracking error:', error);

    // Fail safely towards the store without claiming attribution.
    return NextResponse.redirect('https://herbalvitaly.com/');
  }
}