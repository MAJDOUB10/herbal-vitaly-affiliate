'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandIdentity } from '@/components/brand/BrandIdentity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.user) {
        setError(data.message || 'Unable to sign in.');
        return;
      }
      router.replace(data.user.role === 'ADMIN' ? '/admin' : '/affiliate');
      router.refresh();
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="hv-auth-shell">
      <div className="w-full max-w-md space-y-6">
        <BrandIdentity />
        <Card className="hv-auth-card">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in with your email address and password</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-2">
                <Label htmlFor="login-email">Email address</Label>
                <div className="relative">
                  <Mail aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="login-email" type="email" autoComplete="username" required autoFocus
                    className="pl-10" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <LockKeyhole aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    minLength={1} maxLength={128} required placeholder="Your password"
                    className="pl-10 pr-11" value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                    {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> :
                      <Eye aria-hidden="true" className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-[#1F6B3A] hover:bg-[#18572F]" size="lg" type="submit"
                disabled={loading || !email || !password}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          New affiliate? <Link href="/register" className="font-medium text-primary hover:underline">Create an account</Link>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Already registered using email codes? Select <Link href="/forgot-password" className="font-medium text-primary hover:underline">Forgot password</Link> to set your password.
        </p>
      </div>
    </main>
  );
}
