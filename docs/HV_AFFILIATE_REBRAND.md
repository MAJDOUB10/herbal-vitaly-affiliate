# Herbal Vitaly Affiliate Hub — rebrand implementation

## Scope
- Exact reference deployment: `9826e97a49effd92515cbf598c62369b8d993a50`, branch `feat/hv-shopify-bosta-cod-staging-20261029`.
- This feature branch is **preview-only**. Do not merge or point `partner.herbalvitaly.com` to the branch without reviewed approval.
- The original Herbal Vitaly transparent logo was retrieved from the brand owner's asset library and stored in Shopify Files, without changing the Shopify storefront.
- Corporate green: `#1F6B3A`. White-first UI and discreet green action and navigation states.
- Branding component: `src/components/brand/BrandIdentity.tsx`.
- Theme tokens: `src/app/globals.css` and root metadata in `src/app/layout.tsx`.
- UI surfaces: login, registration, admin and affiliate shells, KPI dashboard accents and business pages using primary blue.
- Transactional email display identity changed in `src/lib/email.ts`. `src/lib/otp.ts` already sends a Herbal Vitaly-branded text message.

## Deliberate safeguards
- No changes to authentication APIs, RBAC, PostgreSQL schema, Shopify discount sync, Bosta reconciliation or financial calculations.
- Preserve the public `Refferq.trackConversion` JavaScript API and existing `refferq-tracker.js` script name for integrator compatibility; only replace visible brand references.
- Do not change the sending domain at runtime without Resend DNS verification.
- Do not automatically update Production, change DNS, merge branches, or overwrite staging data.

## QA checklist (manual before merge)
- Check /login email stage, OTP stage, invalid / expired OTP, loading, error, and success.
- Check /register onboarding and approval states.
- Check /admin and /affiliate role-based access, sidebar responsiveness, menus, mobile overflow and key workflows.
- Check coupons, COD, invoices, payouts and partner selectors; no financial side effects.
- Check original logo is served without distortion and tagline remains visible.
- Verify metadata, favicon, email templates and brand colors across the application.
- Review Arabic RTL and future localization flows; no translation framework is added in this styling change.
- Verify Resend from-address and DATABASE_URL/JWT_SECRET configuration in the intended environment before any real onboarding.
- Validate Next.js build and take desktop/mobile screenshots from the successful Preview deployment.

## Known constraints
- The image is served from a Shopify CDN URL; the permanent file must remain hosted for the app to render the brandmark.
- The current change is a UI rebrand, not a Production infrastructure or authentication repair.
- Existing third-party integration technical names are intentionally left intact.
