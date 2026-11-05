-- Additive migration: affiliate-linked WhatsApp Business Cloud API inbox.
-- New tables are independent of Shopify, COD/Bosta and commission accounting.
-- Apply only after staging verification and an authorized production DB backup.
CREATE TABLE IF NOT EXISTS "wa_conversations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "wa_id" TEXT NOT NULL UNIQUE,
  "display_name" TEXT,
  "affiliate_id" TEXT,
  "last_inbound_at" TIMESTAMP(3),
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wa_conversations_affiliate_id_fkey"
    FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "wa_conversations_affiliate_id_last_message_at_idx"
  ON "wa_conversations"("affiliate_id","last_message_at");
CREATE INDEX IF NOT EXISTS "wa_conversations_last_message_at_idx"
  ON "wa_conversations"("last_message_at");

CREATE TABLE IF NOT EXISTS "wa_messages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversation_id" TEXT NOT NULL,
  "wa_message_id" TEXT UNIQUE,
  "direction" TEXT NOT NULL,
  "message_type" TEXT NOT NULL DEFAULT 'text',
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "author_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wa_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "wa_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "wa_messages_conversation_id_created_at_idx"
  ON "wa_messages"("conversation_id","created_at");
