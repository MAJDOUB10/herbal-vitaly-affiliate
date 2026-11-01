-- Google OIDC links to existing account, preserving id, affiliate, coupons and all financial records.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_sub" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_key" ON "users" ("google_sub");
