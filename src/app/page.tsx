import type { Metadata } from 'next';
import PartnerLanding from '@/components/landing/PartnerLanding';

export const metadata: Metadata = {
  title: 'Herbal Vitaly | Thoughtful Nutrition & Creator Partnerships',
  description: 'Meet Herbal Vitaly, an Egyptian nutritional supplements brand with a considered approach to everyday wellbeing. Discover our products and join the Herbal Vitaly Affiliate Partner Hub.',
  alternates: { canonical: 'https://partner.herbalvitaly.com/' },
  openGraph: {
    title: 'Herbal Vitaly — Wellness Has a New Story. Yours.',
    description: 'Explore the Herbal Vitaly wellness portfolio and discover a creator partnership built around real products, trust and transparent tracking.',
    url: 'https://partner.herbalvitaly.com/',
    siteName: 'Herbal Vitaly Affiliate Hub',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <PartnerLanding />;
}
