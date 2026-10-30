import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeLoginEmail, isValidLoginEmail, hashedLoginIdentifier, passwordSessionVersion } from '@/lib/password-auth-policy';

const GENERIC_ERROR = 'Invalid credentials or account not approved';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ success: false, message: 'Authentication unavailable' }, { status: 503 });
    }
    const body = await request.json();
    const email = normalizeLoginEmail(body?.email);
    const password = body?.password;
    if (!isValidLoginEmail(email) || typeof password !== 'string' || password.length > 128 || !password.length)
      return NextResponse.json({ success: false, message: 'Enter a valid email and password' }, { status: 400 });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown';
    const identityKey = hashedLoginIdentifier(email, process.env.JWT_SECRET);
    const [ipRate, identityRate] = await Promise.all([
      checkRateLimit(ip, 'password-login-ip', 7, 60_000),
      checkRateLimit(identityKey, 'password-login-account', 10, 15 * 60_000),
    ]);
    if (!ipRate.allowed || !identityRate.allowed) {
      return NextResponse.json({ success: false, message: 'Too many attempts. Try again later.' }, {
        status: 429, headers: { 'Retry-After': '60' },
      });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    // Perform a bcrypt operation even for unknown emails to reduce timing differences.
    const comparisonHash = user?.password || await bcrypt.hash('no-such-user', 12);
    const valid = await bcrypt.compare(password, comparisonHash);
    if (!user || !valid || user.status !== 'ACTIVE' || !user.emailVerifiedAt) {
      return NextResponse.json({ success: false, message: GENERIC_ERROR }, { status: 401 });
    }

    const token = await new SignJWT({
      userId: user.id, role: user.role, email: user.email,
      name: user.name, pv: passwordSessionVersion(user.password),
    }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id, email: user.email, name: user.name,
        role: user.role, hasAffiliate: user.role === 'AFFILIATE',
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('auth-token', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 86400, path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ success: false, message: 'Login unavailable. Try again later.' }, { status: 500 });
  }
}
