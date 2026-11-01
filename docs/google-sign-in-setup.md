# Google sign-in setup for Herbal Vitaly Affiliate Hub

Google Cloud credentials are not currently configured in Vercel. Google sign-in stays disabled until the owner completes these steps.

1. Visit https://console.cloud.google.com/auth/clients and create an OAuth Client of type Web application.
2. In Google Auth Platform / Branding, set Herbal Vitaly, support contact@herbalvitaly.com, and authorized domain herbalvitaly.com. Configure the audience and publish the app as appropriate.
3. Set authorized redirect URI: https://partner.herbalvitaly.com/api/auth/google/callback
4. Set authorized JavaScript origin (if requested): https://partner.herbalvitaly.com
5. In Vercel project herbal-vitaly-affiliate > Settings > Environment Variables, add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Mark the secret sensitive; target Production.
6. Redeploy the latest main branch in Production after adding the values. Do not put the secret into GitHub or the chat.
7. Test https://partner.herbalvitaly.com/login with a real verified affiliate email. Check new affiliate signup, existing affiliate linking, and that admins cannot use Google until separately supported.

Security: server-only OAuth authorization code with PKCE S256, nonce, signed state cookie, validated Google ID token, verified emails; no token persistence. Only ACTIVE verified AFFILIATE accounts are eligible; no admin auto-elevation. Existing user IDs, coupons, commissions and payout records are preserved. Automatic linking to an existing account by email is limited to authoritative Google addresses (Gmail or verified Workspace hosted domains). Existing partners with Yahoo/other third-party addresses must use their current email/password login; their accounts are not linked automatically to a Google identity because Google cannot guarantee current ownership of that email.
Docs: https://developers.google.com/identity/openid-connect/openid-connect
