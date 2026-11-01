import { NextRequest, NextResponse } from 'next/server';
import { googleProviderParams, GOOGLE_CALLBACK, GOOGLE_FLOW_COOKIE,
  googlePkceChallenge, googleRandom, googleReady, signGoogleFlow } from '@/lib/google-oauth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const login = new URL('/login', 'https://partner.herbalvitaly.com');
  if (!googleReady()) {
    login.searchParams.set('error', 'google-unavailable');
    return NextResponse.redirect(login);
  }
  // Only use the official partner origin: never trust Host or return_to query params.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  try {
    const rate = await checkRateLimit(ip, 'google-oauth-start', 20, 60_000);
    if (!rate.allowed) {
      login.searchParams.set('error', 'too-many-attempts');
      return NextResponse.redirect(login);
    }
    const { clientId } = googleProviderParams();
    const state = googleRandom();
    const verifier = googleRandom();
    const nonce = googleRandom();
    const sealed = await signGoogleFlow({ state, verifier, nonce });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', GOOGLE_CALLBACK);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', googlePkceChallenge(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
    const response = NextResponse.redirect(url);
    response.cookies.set(GOOGLE_FLOW_COOKIE, sealed, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 8 * 60,
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    login.searchParams.set('error', 'google-unavailable');
    return NextResponse.redirect(login);
  }
}
