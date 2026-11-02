import type { Metadata } from 'next';
import PartnerLanding from '@/components/landing/PartnerLanding';

export const metadata: Metadata = {
  title: 'Herbal Vitaly Affiliate Hub | Join Our Partner Program',
  description: 'Join the Herbal Vitaly affiliate program in Egypt. Create your personal promo code, share products, and follow eligible sales, deliveries and commissions.',
  alternates: { canonical: 'https://partner.herbalvitaly.com/' },
  openGraph: {
    title: 'Herbal Vitaly Affiliate Hub — Partner Program',
    description: 'Become a Herbal Vitaly partner. Your audience. Your code. Your partner dashboard.',
    url: 'https://partner.herbalvitaly.com/',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <PartnerLanding />;
}
