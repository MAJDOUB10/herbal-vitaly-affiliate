import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/lib/otp';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeLoginEmail, isValidLoginEmail, hashedLoginIdentifier } from '@/lib/password-auth-policy';

/** OTP is used only to verify a NEW account. It never grants a login session. */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.JWT_SECRET) return NextResponse.json({ success: false, error: 'Verification unavailable' }, { status: 503 });
    const body = await request.json();
    const email = normalizeLoginEmail(body?.email);
    const code = body?.code;
    if (!isValidLoginEmail(email) || typeof code !== 'string' || !/^\d{6}$/.test(code))
      return NextResponse.json({ success: false, error: 'Invalid code' }, { status: 400 });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const [one, two] = await Promise.all([
      checkRateLimit(ip, 'auth/verify-registration-ip', 5, 60_000),
      checkRateLimit(hashedLoginIdentifier(email, process.env.JWT_SECRET), 'auth/verify-registration-account', 8, 15 * 60_000),
    ]);
    if (!one.allowed || !two.allowed) return NextResponse.json({ success: false, error: 'Too many attempts' }, { status: 429 });

    // Prevent this legacy OTP route from becoming an alternate passwordless login.
    const account = await prisma.user.findUnique({ where: { email }, select: { status: true } });
    if (!account || account.status !== 'PENDING')
      return NextResponse.json({ success: false, error: 'Account verification unavailable' }, { status: 400 });

    const result = await otpService.verifyOTP(email, code);
    if (!result.success) return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    return NextResponse.json({
      success: true,
      pendingApproval: Boolean(result.pendingApproval),
      message: result.pendingApproval
        ? 'Email verified. Await administrator approval before signing in.'
        : 'Email verified. Sign in with the password you created.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
