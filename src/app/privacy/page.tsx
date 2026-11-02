import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPageShell from '@/components/landing/LegalPageShell';

export const metadata: Metadata = {
  title: 'Privacy Policy | Herbal Vitaly Affiliate Hub',
  description: 'Learn how the Herbal Vitaly affiliate partner portal processes account, referral and order-related information.',
  alternates: { canonical: 'https://partner.herbalvitaly.com/privacy' },
};

const Heading = ({ children }: { children: React.ReactNode }) =>
  <h2 className="mb-2 text-lg font-extrabold text-[#173321]">{children}</h2>;

export default function PartnerPrivacy() {
  return <LegalPageShell title="Privacy Policy" subtitle="Herbal Vitaly Affiliate Hub · Last updated 2 November 2026">
    <section><Heading>1. About this service</Heading>
      <p>Herbal Vitaly operates this affiliate partner portal at partner.herbalvitaly.com. The service lets eligible partners register, obtain product referral links and discount codes, follow related orders and submit support requests. For privacy questions, contact <a className="font-semibold text-[#1F6B3A] underline" href="mailto:contact@herbalvitaly.com">contact@herbalvitaly.com</a>.</p>
    </section>
    <section><Heading>2. Information we process</Heading>
      <p>When you create or use a partner account, we process the name and email address you provide, authentication details, partner identifiers, referral codes and links, partner activity related to promotions, order and delivery statuses, commission records, and messages you send to partner support. We may also process technical security data, such as session identifiers, timestamps and network information needed to keep the portal operational and protect accounts.</p>
    </section>
    <section><Heading>3. Sign in with Google</Heading>
      <p>If you choose Google sign-in, we request only the basic Google identity scopes (openid, email, profile). We verify the signed identity response and may store your Google account’s unique identifier, verified email and display name to authenticate or link your partner account. The portal does not request access to your Gmail messages, Google Drive files or Google contacts, and does not store Google access or ID tokens for ongoing use.</p>
    </section>
    <section><Heading>4. Why we use this information</Heading>
      <p>We use information to maintain partner accounts, attribute eligible product referrals, display order and commission statuses, reconcile delivery or cash-on-delivery records, prevent abuse, respond to support requests and meet applicable business or legal obligations. Partner attribution and payout eligibility require order verification; this portal does not automatically authorize commission payments when an order is first placed.</p>
    </section>
    <section><Heading>5. Service integrations</Heading>
      <p>Depending on the feature used, relevant data may be processed through hosting and infrastructure providers such as Vercel and Neon, our Shopify store for product discounts and orders, delivery integrations such as Bosta for reconciliation, and our transactional email provider for necessary account emails. Google provides authentication only if you choose that method. We limit integration data to what is relevant to the service.</p>
    </section>
    <section><Heading>6. Cookies and account security</Heading>
      <p>The portal uses essential authentication and security cookies to keep account access protected, including an HttpOnly session cookie. Optional Google sign-in uses a short-lived security cookie to protect the authentication process. You can sign out from your account, and your browser settings may let you manage cookies, but essential cookies are required to stay signed in.</p>
    </section>
    <section><Heading>7. Retention and requests</Heading>
      <p>Account, referral and transaction-related records are kept as reasonably needed to operate the affiliate program, maintain records of business activity and satisfy applicable retention obligations. To request access, correction or deletion of your personal information, email <a className="font-semibold text-[#1F6B3A] underline" href="mailto:contact@herbalvitaly.com">contact@herbalvitaly.com</a>. Some order or financial records may need to be retained where required by applicable law or legitimate accounting obligations.</p>
    </section>
    <section><Heading>8. Updates and contact</Heading>
      <p>This policy may be updated when the service or legal requirements change. The current version will be available on this page. For program rules, see the <Link href="/terms" className="font-semibold text-[#1F6B3A] underline">Affiliate Program Terms</Link>.</p>
    </section>
  </LegalPageShell>;
}
