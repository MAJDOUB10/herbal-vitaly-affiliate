import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPageShell from '@/components/landing/LegalPageShell';

export const metadata: Metadata = {
  title: 'Affiliate Program Terms | Herbal Vitaly',
  description: 'Information about eligibility, referral codes, compliant marketing and eligible commissions for Herbal Vitaly partners.',
  alternates: { canonical: 'https://partner.herbalvitaly.com/terms' },
};

const Heading = ({ children }: { children: React.ReactNode }) =>
  <h2 className="mb-2 text-lg font-extrabold text-[#173321]">{children}</h2>;

export default function PartnerTerms() {
  return <LegalPageShell title="Affiliate Program Terms" subtitle="Herbal Vitaly Affiliate Hub · Last updated 2 November 2026">
    <section><Heading>1. The partner program</Heading>
      <p>The Herbal Vitaly Affiliate Hub provides eligible partners with promotional codes, product links and a dashboard for monitoring related order activity. Creating an account does not by itself guarantee approval for every benefit, commission, product or campaign. Herbal Vitaly may apply eligibility criteria and additional commercial terms made available to partners.</p>
    </section>
    <section><Heading>2. Accurate and responsible promotion</Heading>
      <p>Partners must present Herbal Vitaly products accurately, follow applicable advertising and consumer protection rules, disclose commercial or affiliate relationships where required and avoid misleading claims. Herbal Vitaly sells dietary supplements, not medicines. Partners must not claim that supplements diagnose, treat, cure or prevent a disease unless explicitly permitted by applicable law and approved product documentation.</p>
    </section>
    <section><Heading>3. Codes, links and attribution</Heading>
      <p>Partner discount codes and links are assigned through the portal and may be limited to selected products or periods. Sharing a code or receiving an order does not by itself establish a payable commission. Where order information is available, attribution is evaluated against the applicable program policy and verified Shopify, delivery and settlement records.</p>
    </section>
    <section><Heading>4. Commissions and payouts</Heading>
      <p>Commission rates, qualifying sales, hold periods and payment arrangements depend on the terms applicable to the partner and campaign. Canceled, refunded, undelivered, unpaid, invalid or otherwise ineligible orders may not qualify. Cash-on-delivery orders require reconciliation before financial approval. The dashboard provides visibility but does not guarantee earnings or automatic payouts.</p>
    </section>
    <section><Heading>5. Account and access</Heading>
      <p>Partners are responsible for keeping account access secure and maintaining accurate contact details. Misuse of referral tracking, fraudulent orders, misleading promotion or other material violations may result in code restrictions or account review. Administrative accounts are separate from public partner registration.</p>
    </section>
    <section><Heading>6. Support and changes</Heading>
      <p>For assistance, partners may use the Support Center after signing in or email <a href="mailto:contact@herbalvitaly.com" className="font-semibold text-[#1F6B3A] underline">contact@herbalvitaly.com</a>. Program terms and available features may change, and applicable updates should be communicated to partners through the portal or other appropriate channels. Read our <Link href="/privacy" className="font-semibold text-[#1F6B3A] underline">Privacy Policy</Link> for information about personal data processing.</p>
    </section>
  </LegalPageShell>;
}
