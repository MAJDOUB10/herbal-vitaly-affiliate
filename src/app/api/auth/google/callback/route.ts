import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { GOOGLE_CALLBACK, GOOGLE_FLOW_COOKIE, googleProviderParams, googleReady,
  googleSession, resolveGoogleAffiliate, verifyGoogleFlow, verifyGoogleIdToken } from '@/lib/google-oauth';

function failed(reason: string) {
  const url = new URL('/login', 'https://partner.herbalvitaly.com');
  url.searchParams.set('error', reason);
  return url;
}
export async function GET(request: NextRequest) {
  // All paths clear the one-time OAuth flow cookie, including Google rejection.
  const result = await complete(request);
  result.cookies.set(GOOGLE_FLOW_COOKIE, '', {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
  });
  result.headers.set('Cache-Control', 'private, no-store');
  return result;
}

async function complete(request: NextRequest): Promise<NextResponse> {
  if (!googleReady()) return NextResponse.redirect(failed('google-unavailable'));
  if (request.nextUrl.searchParams.has('error'))
    return NextResponse.redirect(failed('google-cancelled'));

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code || code.length > 3000 || !state)
    return NextResponse.redirect(failed('google-failed'));
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rate = await checkRateLimit(ip, 'google-oauth-callback', 12, 60_000);
    if (!rate.allowed) return NextResponse.redirect(failed('too-many-attempts'));
    const { verifier, nonce } = await verifyGoogleFlow(
      request.cookies.get(GOOGLE_FLOW_COOKIE)?.value, state,
    );
    const { clientId, clientSecret } = googleProviderParams();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: GOOGLE_CALLBACK, grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
    if (!tokenResponse.ok) return NextResponse.redirect(failed('google-failed'));
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) return NextResponse.redirect(failed('google-failed'));
    const identity = await verifyGoogleIdToken(tokens.id_token, nonce);
    const user = await resolveGoogleAffiliate(identity);
    // No automatic admin or legacy role elevation by Google credentials.
    if (user.role !== 'AFFILIATE' || user.status !== 'ACTIVE' || !user.emailVerifiedAt ||
        !user.affiliate) return NextResponse.redirect(failed('account-unavailable'));
    const token = await googleSession(user);
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    const hasCoupon = Boolean(await prisma.coupon.findFirst({
      where: { affiliateId: user.affiliate.id,
        OR: [{ source: 'SHOPIFY', isActive: true },
          { description: 'Automatic OTP-verified affiliate onboarding' }] },
      select: { id: true },
    }));
    const response = NextResponse.redirect(new URL(
      hasCoupon ? '/affiliate' : '/affiliate/coupons', 'https://partner.herbalvitaly.com',
    ));
    response.cookies.set('auth-token', token, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 24 * 60 * 60, path: '/',
    });
    return response;
  } catch (error) {
    // Never leak raw Google OAuth tokens, profile or secrets to logs/client.
    console.error('Google sign-in failed', error instanceof Error ? error.name : 'Unknown');
    return NextResponse.redirect(failed('google-failed'));
  }
}
