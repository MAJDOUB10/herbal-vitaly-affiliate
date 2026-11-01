-- Protect automatic affiliate coupon creation against concurrent OTP/sign-in requests.
-- Does not change existing codes, coupon percentages, payouts, or orders.
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_one_auto_code_per_affiliate_idx"
  ON "coupons" ("affiliate_id")
  WHERE "affiliate_id" IS NOT NULL
    AND "description" = 'Automatic OTP-verified affiliate onboarding';
