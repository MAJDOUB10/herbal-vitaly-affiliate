'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BrandIdentity } from '@/components/brand/BrandIdentity';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyRound, Loader2 } from 'lucide-react';

type Stage = 'request' | 'confirm' | 'complete';
export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/reset-password/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) { setError(result.message || 'Unable to send reset code'); return; }
      setStage('confirm');
      setMessage(result.message);
    } catch { setError('Request failed. Try again later.'); }
    finally { setBusy(false); }
  };
  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12 || newPassword.length > 128 || newPassword !== confirmation) {
      setError('Use a password of 12–128 characters and repeat it correctly.'); return;
    }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) { setError(result.message || 'Invalid reset code'); return; }
      setNewPassword(''); setConfirmation(''); setCode('');
      setStage('complete');
      setMessage(result.message);
    } catch { setError('Password reset failed. Try again.'); }
    finally { setBusy(false); }
  };
  return <main className="hv-auth-shell">
    <div className="w-full max-w-md space-y-6">
      <BrandIdentity />
      <Card className="hv-auth-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 rounded-xl bg-[#EAF4ED] p-3 text-primary"><KeyRound className="mx-auto h-6 w-6"/></div>
          <CardTitle>{stage === 'complete' ? 'Password saved' : 'Reset password'}</CardTitle>
          <CardDescription>
            {stage === 'request' ? 'Enter your account email to receive a one-time recovery code.' :
              stage === 'confirm' ? 'Enter the 6-digit code and choose a new password.' : 'You can now sign in securely.'}
          </CardDescription>
        </CardHeader>
        {error && <div className="px-6"><Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert></div>}
        {message && <div className="px-6"><Alert><AlertDescription>{message}</AlertDescription></Alert></div>}
        {stage === 'request' && <form onSubmit={sendCode}>
          <CardContent className="space-y-2">
            <Label htmlFor="reset-email">Email address</Label>
            <Input id="reset-email" type="email" autoComplete="username" required
              value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </CardContent>
          <CardFooter><Button type="submit" className="w-full" disabled={busy || !email}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Send recovery code
          </Button></CardFooter>
        </form>}
        {stage === 'confirm' && <form onSubmit={resetPassword}>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="recovery-code">6-digit code</Label>
              <Input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
                maxLength={6} required value={code} onChange={e => setCode(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128}
                required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input id="confirm-new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128}
                required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6 || newPassword.length < 12 || newPassword !== confirmation}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Set password
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setStage('request'); setCode(''); setError(''); }}>
              Request another code
            </Button>
          </CardFooter>
        </form>}
        {stage === 'complete' && <CardFooter><Button asChild className="w-full"><Link href="/login">Go to sign in</Link></Button></CardFooter>}
      </Card>
      <p className="text-center text-sm"><Link href="/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </div>
  </main>;
}
