import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/lib/otp';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import * as bcrypt from 'bcryptjs';
import { normalizeLoginEmail, isValidLoginEmail, isAcceptablePassword, hashedLoginIdentifier } from '@/lib/password-auth-policy';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.JWT_SECRET) return NextResponse.json({ success: false, message: 'Service unavailable' }, { status: 503 });
    const body = await request.json();
    const email = normalizeLoginEmail(body?.email);
    const code = body?.code;
    const newPassword = body?.newPassword;
    if (!isValidLoginEmail(email) || typeof code !== 'string' || !/^\d{6}$/.test(code) ||
        !isAcceptablePassword(newPassword)) {
      return NextResponse.json({ success: false, message: 'Invalid code or password (minimum 12 characters)' }, { status: 400 });
    }
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const [one, two] = await Promise.all([
      checkRateLimit(ip, 'password-reset-confirm-ip', 6, 60_000),
      checkRateLimit(hashedLoginIdentifier(email, process.env.JWT_SECRET), 'password-reset-confirm-account', 8, 15 * 60_000),
    ]);
    if (!one.allowed || !two.allowed) return NextResponse.json({ success: false, message: 'Too many attempts' }, { status: 429 });
    // Hash first so the verification token is not consumed before a slow bcrypt call.
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await otpService.verifyOTP(email, code);
    if (!result.success || !result.user || result.pendingApproval ||
        result.user.status !== 'ACTIVE' || !result.user.emailVerifiedAt) {
      return NextResponse.json({ success: false, message: 'Invalid or expired reset code' }, { status: 400 });
    }
    // Unique OTP consumption prevents replay. Existing sessions are invalidated
    // because the proxy compares the password-hash version on every request.
    await prisma.user.update({ where: { id: result.user.id }, data: { password: passwordHash } });
    const response = NextResponse.json({
      success: true, message: 'Password saved. Sign in with your email and new password.',
    }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('auth-token', '', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', expires: new Date(0),
    });
    return response;
  } catch {
    return NextResponse.json({ success: false, message: 'Unable to reset password' }, { status: 500 });
  }
}
