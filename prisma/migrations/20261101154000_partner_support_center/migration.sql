-- Partner/Admin support center. New tables only; finance, Shopify and existing
-- orders are not modified. Existing auth users are reused for ownership.
CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "order_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_status_check"
    CHECK ("status" IN ('OPEN','IN_PROGRESS','WAITING_PARTNER','RESOLVED','CLOSED')),
  CONSTRAINT "support_tickets_category_check"
    CHECK ("category" IN ('GENERAL','COUPON','ORDER','DELIVERY','RETURN','COMMISSION','PAYOUT','TECHNICAL')),
  CONSTRAINT "support_tickets_priority_check"
    CHECK ("priority" IN ('LOW','NORMAL','HIGH','URGENT'))
);
CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticket_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_messages_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_messages_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "support_tickets_user_id_last_message_at_idx"
  ON "support_tickets"("user_id","last_message_at");
CREATE INDEX IF NOT EXISTS "support_tickets_status_last_message_at_idx"
  ON "support_tickets"("status","last_message_at");
CREATE INDEX IF NOT EXISTS "support_messages_ticket_id_created_at_idx"
  ON "support_messages"("ticket_id","created_at");
