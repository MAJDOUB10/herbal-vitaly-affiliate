import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/lib/otp';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeLoginEmail, isValidLoginEmail, hashedLoginIdentifier } from '@/lib/password-auth-policy';

const message = 'If this account is eligible, a password reset code will be sent to its email.';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.JWT_SECRET || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
      return NextResponse.json({ success: false, message: 'Email service temporarily unavailable.' }, { status: 503 });
    const body = await request.json();
    const email = normalizeLoginEmail(body?.email);
    if (!isValidLoginEmail(email)) return NextResponse.json({ success: false, message: 'Invalid email' }, { status: 400 });
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const [one, two] = await Promise.all([
      checkRateLimit(ip, 'password-reset-request-ip', 3, 60_000),
      checkRateLimit(hashedLoginIdentifier(email, process.env.JWT_SECRET), 'password-reset-request-account', 4, 15 * 60_000),
    ]);
    if (!one.allowed || !two.allowed)
      return NextResponse.json({ success: false, message: 'Too many requests; try later.' }, { status: 429 });
    // OTP service responds uniformly for unknown or unavailable accounts.
    await otpService.sendOTP(email, 'reset-password');
    return NextResponse.json({ success: true, message }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, message: 'Reset unavailable. Try later.' }, { status: 503 });
  }
}
