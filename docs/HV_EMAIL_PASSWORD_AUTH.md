# Herbal Vitaly Affiliate Hub — email + password authentication (Preview)

## Scope
Replaces passwordless login with **email + password**, using the existing hashed-password column and bcryptjs (12 rounds), existing JWT HttpOnly secure cookie and proxy role validation. Keeps Herbal Vitaly white/green identity.

- `/login` — email and password, show/hide and password recovery link.
- `/register` — choose & confirm 12–128-character password, verify email via existing 6-digit OTP, then await manual approval. Public registration cannot self-select ADMIN.
- `/forgot-password` — request a limited-lifetime email code, then set a bcrypt-hashed password. Reuses the verified sender via Resend.
- `/api/auth/login` — password validation, two-dimensional rate limiting, session cookie, no password ever returned.
- `/api/auth/verify-otp` — strictly account verification for PENDING accounts; **never grants a login cookie**.
- `/api/auth/reset-password/*` — recovery for email-verified ACTIVE users only, OTP consumed once, no auto-login.
- `src/proxy.ts` — validates a session-version claim derived from password hash on each protected request. Password resets revoke existing sessions without database changes.

## Migration of existing accounts
Previously, registered users were assigned random passwords unknown to the user. **Do not assume their passwords work**. When released, both verified active admin and affiliate accounts should use `/forgot-password` to set a new password.

STAGING counts checked 2026-10-30: one verified active admin, one verified active affiliate, one unverified pending affiliate. No account records were changed during this development.

## Safe rollout
1. Preview the GitHub feature branch `feat/hv-email-password-login-20261030`.
2. Verify `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` exist **for this deployment environment**. Never copy values to documentation.
3. Test login with an invalid account, invalid password, excessive attempts, inactive and unverified account.
4. Test registration with valid password, verify OTP once, confirm no unauthorised admin or auto-login.
5. Test reset via a test/owned verified inbox: successful email delivery and password change, wrong/expired/reused code rejection. Confirm old sessions stop working.
6. Test owner admin account recovery **before** changing the public `partner.herbalvitaly.com` alias; keep the prior ready deployment as rollback.
7. Confirm CSS/mobile layout and redirect to the appropriate /admin or /affiliate role.
8. Only then assign the new READY deployment to public URL. Avoid auto merging into main or updating Shopify.

## Remaining security considerations
- For a high-risk admin account, consider adding phishing-resistant MFA before long-term production use.
- A reset code uses the existing 10-minute OTP service and is not a login bypass.
- Password strength policy requires length but not arbitrary character-class composition; admins should select unique long passwords.
- All changes are code-only; no database migration, order, coupon, Shopify or financial modification.
