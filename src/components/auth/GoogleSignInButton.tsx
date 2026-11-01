'use client';
import { useEffect, useState } from 'react';

export function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    fetch('/api/auth/google/status', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : { enabled: false })
      .then(data => setEnabled(data.enabled === true))
      .catch(() => setEnabled(false))
      .finally(() => setChecked(true));
  }, []);
  return <div className="space-y-2">
    <div className="relative flex items-center gap-3 py-1" aria-hidden="true">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">OR</span>
      <div className="h-px flex-1 bg-border" />
    </div>
    {enabled ? <a href="/api/auth/google"
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#D5E4D9] bg-white px-4 py-3 text-sm font-semibold text-[#173321] transition-colors hover:bg-[#F4FAF6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B3A]">
      <GoogleSymbol />{label}
    </a> : <button type="button" disabled
      className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm font-semibold text-slate-400 opacity-65">
      <GoogleSymbol /> {label}
    </button>}
    {checked && !enabled && <p className="text-center text-xs text-muted-foreground">
      Google sign-in is not configured yet. Email and password sign-in remains available.
    </p>}
  </div>;
}
function GoogleSymbol() {
  return <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.29 5.48-4.86 7.18l7.73 6C44.32 38.01 46.98 31.81 46.98 24.55z"/>
    <path fill="#FBBC05" d="M10.53 28.59C10.05 27.13 9.77 25.59 9.77 24s.28-3.13.76-4.59l-7.98-6.2C.92 16.47 0 20.13 0 24s.92 7.53 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>;
}
