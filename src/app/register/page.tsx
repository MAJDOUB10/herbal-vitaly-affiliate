'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BrandIdentity } from '@/components/brand/BrandIdentity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Mail, ShieldCheck, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

type Step = 'details' | 'otp' | 'success';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 12 || password.length > 128 || password !== confirmPassword) {
      setError('Use a password of 12–128 characters and confirm it correctly.');
      return;
    }
    setLoading(true);

    try {
      // Step 1: Register the user
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, role: 'AFFILIATE' }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        setError(registerData.message || 'Registration failed');
        setLoading(false);
        return;
      }

      // Registration API already sends the first OTP. A second request
      // immediately afterwards would be rejected by the 60-second cooldown.
      setStep('otp');
      if (registerData.otpSent) {
        setMessage('Verification code sent. Check your inbox.');
      } else {
        setError('Your account was created, but email delivery failed. Use Resend code to retry.');
      }
    } catch (_e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setError('Please enter the full 6-digit code');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code: otp }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStep('success');
        setMessage(data.message || 'Your email is verified. You can sign in when approved.');
      } else {
        setError(data.error || 'Invalid verification code');
      }
    } catch (_e) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setMessage('A new verification code has been sent.');
      } else {
        setError('Failed to resend code. Please try again.');
      }
    } catch (_e) {
      setError('Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hv-auth-shell">
      <div className="w-full max-w-md space-y-6">
        {/* Official Herbal Vitaly identity */}
        <BrandIdentity />

        {/* Card */}
        <Card className="hv-auth-card">
          {step === 'details' && (
            <>
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">Create your account</CardTitle>
                <CardDescription>
                  Join as an affiliate partner and start earning
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10"
                        required
                        autoFocus
                        autoComplete="name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input id="register-password" type="password" autoComplete="new-password"
                      value={password} minLength={12} maxLength={128}
                      onChange={e => setPassword(e.target.value)} required
                      placeholder="At least 12 characters" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input id="confirm-password" type="password" autoComplete="new-password"
                      value={confirmPassword} minLength={12} maxLength={128}
                      onChange={e => setConfirmPassword(e.target.value)} required
                      placeholder="Repeat your password" />
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading || !name || !email || password.length < 12 || password !== confirmPassword}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Verify your email</CardTitle>
                <CardDescription>
                  Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleVerifyOTP}>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {message && (
                    <Alert>
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={(value) => setOtp(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading || otp.length < 6}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>
                  <div className="flex items-center justify-between w-full">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStep('details');
                        setOtp('');
                        setError('');
                        setMessage('');
                      }}
                    >
                      <ArrowLeft className="mr-1 h-3 w-3" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResendOTP}
                      disabled={loading}
                    >
                      Resend code
                    </Button>
                  </div>
                </CardFooter>
              </form>
            </>
          )}

          {step === 'success' && (
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Welcome aboard, {name}!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {message || 'Your email is verified. Your application awaits administrator approval.'}
                  </p>
                </div>
                <Link href="/login" className="inline-block rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Go to sign in</Link>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Footer */}
        {step !== 'success' && (
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
