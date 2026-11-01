import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';
import { passwordSessionVersion, isValidLoginEmail, normalizeLoginEmail } from '@/lib/password-auth-policy';
import * as bcrypt from 'bcryptjs';

export const GOOGLE_CALLBACK = 'https://partner.herbalvitaly.com/api/auth/google/callback';
export const GOOGLE_FLOW_COOKIE = '__Host-hv-google-flow';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export function googleReady() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
    process.env.JWT_SECRET && process.env.VERCEL_ENV === 'production');
}

export function googleProviderParams() {
  if (!googleReady()) throw new Error('Google sign-in is not configured');
  return { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    secret: new TextEncoder().encode(process.env.JWT_SECRET!) };
}

export function googleRandom(): string { return randomBytes(32).toString('base64url'); }
export function googlePkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export async function signGoogleFlow(input: { state: string; verifier: string; nonce: string }) {
  const { secret } = googleProviderParams();
  return new SignJWT({ purpose: 'google-login', ...input })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8m').sign(secret);
}
export async function verifyGoogleFlow(token: string | undefined, state: string) {
  if (!token || !/^[A-Za-z0-9_-]{30,100}$/.test(state)) throw Error('Invalid Google login session');
  const { secret } = googleProviderParams();
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  if (payload.purpose !== 'google-login' || payload.state !== state ||
      typeof payload.verifier !== 'string' || !/^[A-Za-z0-9_-]{30,100}$/.test(payload.verifier) ||
      typeof payload.nonce !== 'string' || !/^[A-Za-z0-9_-]{30,100}$/.test(payload.nonce))
    throw Error('Invalid Google state');
  return { verifier: payload.verifier, nonce: payload.nonce };
}

export async function verifyGoogleIdToken(idToken: string, nonce: string) {
  const { clientId } = googleProviderParams();
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId, clockTolerance: '10s',
  });
  const email = normalizeLoginEmail(payload.email);
  if (!payload.sub || !/^[0-9]{10,64}$/.test(payload.sub) ||
      !isValidLoginEmail(email) || payload.email_verified !== true ||
      payload.nonce !== nonce)
    throw Error('Google identity could not be verified');
  const name = typeof payload.name === 'string' && payload.name.trim().length >= 2
    ? payload.name.trim().slice(0, 100) : email.split('@')[0].slice(0, 100);
  // Google is authoritative for Gmail addresses and for Google Workspace
  // domains proven by the signed hd claim. Other external emails may have
  // changed owner since Google's original email verification.
  const hostedDomain = typeof payload.hd === 'string' ? payload.hd.toLowerCase() : '';
  const authoritativeEmail = email.endsWith('@gmail.com') ||
    email.endsWith('@googlemail.com') ||
    (Boolean(hostedDomain) && email.endsWith('@' + hostedDomain));
  return { sub: payload.sub, email, name, authoritativeEmail };
}

export async function resolveGoogleAffiliate(identity: {
  sub: string; email: string; name: string; authoritativeEmail: boolean;
}) {
  // Google subject is stable even if an account later changes its email.
  const linked = await prisma.user.findUnique({ where: { googleSub: identity.sub },
    include: { affiliate: true } });
  if (linked) {
    if (linked.role !== 'AFFILIATE' || linked.status !== 'ACTIVE' ||
        !linked.emailVerifiedAt || !linked.affiliate)
      throw Error('Google account is not authorized for partner sign-in');
    return linked;
  }

  // Do not grant admin access via OAuth or upgrade an unverified/suspended user.
  const existing = await prisma.user.findUnique({ where: { email: identity.email },
    include: { affiliate: true } });
  if (existing) {
    if (existing.role !== 'AFFILIATE' || existing.status !== 'ACTIVE' ||
        !existing.emailVerifiedAt || !existing.affiliate ||
        !identity.authoritativeEmail ||
        (existing.googleSub && existing.googleSub !== identity.sub))
      throw Error('An account already exists and cannot be linked automatically');
    const update = await prisma.user.updateMany({
      where: { id: existing.id, googleSub: null, role: 'AFFILIATE', status: 'ACTIVE',
        emailVerifiedAt: { not: null } },
      data: { googleSub: identity.sub },
    });
    if (update.count !== 1)
      throw Error('Google account linking conflicted; please try again');
    return (await prisma.user.findUnique({ where: { id: existing.id },
      include: { affiliate: true } }))!;
  }

  // Block automatic onboarding using a reserved administrator email.
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(normalizeLoginEmail);
  if (admins.includes(identity.email))
    throw Error('Administrator accounts must use existing password sign-in');

  // New verified Google partners become normal AFFILIATE accounts only;
  // they still pick their unique Shopify promo code after the first sign-in.
  const password = await bcrypt.hash(randomBytes(48).toString('base64url'), 12);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const user = await tx.user.create({ data: {
          email: identity.email, name: identity.name, password,
          googleSub: identity.sub, role: 'AFFILIATE', status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        } });
        const affiliate = await tx.affiliate.create({ data: {
          userId: user.id, referralCode: 'GOOGLE-' + randomBytes(7).toString('hex').toUpperCase(),
          payoutDetails: {}, balanceCents: 0,
        } });
        return { ...user, affiliate };
      });
    } catch (error) {
      // Unique constraints prevent racing sign-ups for the same email or subject.
      if (error && typeof error === 'object' && 'code' in error &&
          error.code === 'P2002') {
        const winner = await prisma.user.findUnique({ where: { googleSub: identity.sub },
          include: { affiliate: true } });
        if (winner && winner.role === 'AFFILIATE' && winner.status === 'ACTIVE' &&
            winner.emailVerifiedAt && winner.affiliate) return winner;
        continue;
      }
      throw error;
    }
  }
  throw Error('Google account creation conflict');
}

export async function googleSession(user: { id: string; role: string; email: string; name: string; password: string }) {
  const { secret } = googleProviderParams();
  return new SignJWT({
    userId: user.id, role: user.role, email: user.email, name: user.name,
    pv: passwordSessionVersion(user.password),
  }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(secret);
}
