# Herbal Vitaly WhatsApp Business – Affiliate Inbox

This project integrates **future WhatsApp Business Cloud API messages** into
`https://partner.herbalvitaly.com`. It does not import old conversations from
WhatsApp / WhatsApp Business mobile apps.

## Features

- Admin inbox: `/admin/whatsapp` – receive, inspect, manually associate a WhatsApp
  contact with a verified affiliate and reply manually inside Meta's 24-hour window.
- Partner mirror: `/affiliate/whatsapp` – read only the business conversations
  that Admin explicitly linked to the authenticated affiliate. Partners reply
  from WhatsApp itself.
- Webhook: `GET/POST https://partner.herbalvitaly.com/api/whatsapp/webhook` – public
  Meta callback with verify-token handshake, HMAC-SHA256 signature verification and
  message-ID deduplication. No affiliate session is required at this callback.
- Status sync for SENT, DELIVERED, READ and FAILED events.
- No automatic campaign sends, no templates, no financial operations.
- Non-text media are represented by a placeholder, not automatically downloaded.

## Configuration (Vercel Production – do not paste secrets into chats or GitHub)

1. In Meta for Developers, create/select a Business app and WhatsApp Business
   Platform account (WABA). Connect a phone number and find the **Phone Number ID**.
2. Configure the Meta app webhook subscription to the callback above, subscribe
   to the `messages` field and choose a new long random **verify token**.
3. Generate a system-user business access token with the appropriate WhatsApp
   messaging access. Store it exclusively in **Vercel → Project → Settings →
   Environment Variables (Production)**, with these environment variable names:

   - `HV_WHATSAPP_ACCESS_TOKEN`: access token (**secret**).
   - `HV_WHATSAPP_PHONE_NUMBER_ID`: Meta phone-number ID.
   - `HV_WHATSAPP_APP_SECRET`: Meta app secret (**secret**) for webhook HMAC.
   - `HV_WHATSAPP_VERIFY_TOKEN`: webhook verification token (**secret**).
   - `HV_WHATSAPP_PUBLIC_NUMBER`: business E.164 phone digits, e.g. `2010...`;
     used only to build the customer's `wa.me` link.
   - `HV_WHATSAPP_ENABLED`: `true`, only after migration and credentials pass QA.

4. Apply the **additive** database migration from
   `prisma/migrations/20261105125000_affiliate_whatsapp_inbox/migration.sql`
   after a database backup, first in a test branch. Verify `wa_conversations`
   and `wa_messages` exist in the environment connected to Vercel.
5. Publish the application and check `/admin/whatsapp`. Verify webhook challenge
   and test an inbound message from a consenting test phone to your business
   number. Meta should deliver it to the Admin inbox.
6. Admin links the conversation to a verified affiliate using the partner selector.
   Partner can then see that conversation at `/affiliate/whatsapp`.
7. Test a manual reply **within 24 hours of inbound** and verify its delivery
   receipt. Outside that window use **Meta-approved message templates** through
   Meta WhatsApp Manager; the admin's free-text composer is disabled.

## Operations and privacy

- Admin assignment is explicit: matching names or unverified phone numbers does
  **not** automatically expose a conversation to a partner.
- Do not share one WhatsApp Business number's conversation history with every
  affiliate. Each affiliate API query filters by its session-derived affiliate ID.
- This inbox stores new message text and phone numbers in PostgreSQL in plain
  application columns. Before rolling out broadly, define a retention/deletion
  policy and restrict database administration; provide an appropriate notice
  to partners. Consider application-level encryption where required.
- Meta may retry webhook deliveries: `wa_message_id` is unique and duplicates do
  not extend the service window. Outbound user actions carry a UUID idempotency key.
- The Graph API is pinned to `v26.0`; review Meta's changelog on upgrades.
- Status updates are best-effort and a timed-out message can be accepted by Meta
  even if your dashboard shows FAILED. **Check the actual WhatsApp thread before
  retrying.**
- This feature is independent from Shopify orders, Bosta COD, affiliate
  commissions and payouts and never changes those financial records.
- Deactivate `HV_WHATSAPP_ENABLED` to suspend webhook reception and replies
  without deleting stored messages; enable only after configuration is complete.

## Authoritative references

- Meta WhatsApp Business Platform: https://developers.facebook.com/docs/whatsapp/
- Meta Cloud API / send messages: https://www.postman.com/meta/whatsapp-business-platform/request/8gvd47s/send-text-message
- Customer-service policy: https://developers.facebook.com/docs/whatsapp/cloud-api/
