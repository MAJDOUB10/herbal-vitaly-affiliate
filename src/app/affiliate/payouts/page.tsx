import PartnerPayoutsV4 from '@/components/finance/PartnerPayoutsV4';

// EGP reporting is read-only and remains subject to separate financial approval.
// No transfer initiation or payout mutation is performed on this partner page.
export default function PayoutsPage(){
  return <PartnerPayoutsV4/>;
}
