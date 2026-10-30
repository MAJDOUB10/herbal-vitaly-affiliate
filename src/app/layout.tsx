import React from 'react';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata = {
  title: 'Herbal Vitaly Affiliate Hub',
  description: 'Herbal Vitaly Partner & Affiliate Hub — Let nature be your medicine.',
  icons: { icon: 'https://cdn.shopify.com/s/files/1/1003/9420/5506/files/herbal-vitaly-affiliate-official-logo.png?v=1793365508' },
  openGraph: { title: 'Herbal Vitaly Affiliate Hub', description: 'Let nature be your medicine', images: [{ url: 'https://cdn.shopify.com/s/files/1/1003/9420/5506/files/herbal-vitaly-affiliate-official-logo.png?v=1793365508', alt: 'Herbal Vitaly official logo' }] },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The corporate brand color is fixed across authentication and dashboards
  const dynamicStyles = {
    '--primary': hexToHSL('#1F6B3A'),
    '--radius': '0.5rem',
  } as React.CSSProperties;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased" style={dynamicStyles}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

// Helper to convert hex to HSL for Tailwind compatibility
function hexToHSL(hex: string): string {
  // Remove hash if present
  const rHex = hex.replace('#', '');
  const r = parseInt(rHex.substring(0, 2), 16) / 255;
  const g = parseInt(rHex.substring(2, 4), 16) / 255;
  const b = parseInt(rHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}