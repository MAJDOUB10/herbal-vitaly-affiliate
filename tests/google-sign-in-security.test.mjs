import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=src('prisma/schema.prisma');
const sql=src('prisma/migrations/20261101230000_google_oidc_subject/migration.sql');
const core=src('src/lib/google-oauth.ts');
const start=src('src/app/api/auth/google/route.ts');
const callback=src('src/app/api/auth/google/callback/route.ts');
const status=src('src/app/api/auth/google/status/route.ts');
const ui=src('src/components/auth/GoogleSignInButton.tsx');
const login=src('src/app/login/page.tsx');
const register=src('src/app/register/page.tsx');

test('Google sign in is disabled until Production OAuth credentials are configured',()=>{
  for(const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','JWT_SECRET',
    "process.env.VERCEL_ENV === 'production'"])assert.ok(core.includes(key),key);
  assert.ok(status.includes('googleReady()'));
  assert.ok(ui.includes('setEnabled(data.enabled === true)'));
  assert.ok(ui.includes('<button type="button" disabled'));
  assert.ok(!ui.includes('GOOGLE_CLIENT_SECRET'));
});

test('OIDC uses signed HttpOnly state, PKCE S256, verified nonce and restricted host',()=>{
  for(const x of ['randomBytes(32)',"createHash('sha256')",'new SignJWT',
    "purpose: 'google-login'",".setExpirationTime('8m')",'jwtVerify(token, secret',
    'payload.state !== state','payload.nonce'])assert.ok(core.includes(x),x);
  for(const x of ["'response_type', 'code'","'scope', 'openid email profile'",
    "'code_challenge_method', 'S256'","'nonce', nonce",'secure: true','httpOnly: true',
    "sameSite: 'lax'"])assert.ok(start.includes(x),x);
  assert.ok(start.includes('GOOGLE_CALLBACK'));
  assert.ok(!start.includes("request.nextUrl.searchParams.get('redirect')"));
});

test('callback validates Google identity and never grants administrator access',()=>{
  for(const x of ['https://www.googleapis.com/oauth2/v3/certs',
    "algorithms: ['RS256']", 'audience: clientId', 'payload.email_verified !== true',
    'payload.nonce !== nonce','payload.sub'])assert.ok(core.includes(x),x);
  for(const x of ['verifyGoogleFlow(', 'code_verifier: verifier',
    'verifyGoogleIdToken(tokens.id_token, nonce)', 'resolveGoogleAffiliate(identity)',
    "user.role !== 'AFFILIATE'",'googleSession(user)', 'passwordSessionVersion']) {
    assert.ok((callback+'\n'+core).includes(x),x);
  }
  assert.ok(callback.includes("new URL('/login', 'https://partner.herbalvitaly.com')"));
  assert.ok(callback.includes("result.cookies.set(GOOGLE_FLOW_COOKIE, ''"));
});

test('linked partners keep accounts, privilege, coupons and payouts unchanged',()=>{
  for(const x of ['findUnique({ where: { googleSub: identity.sub }',
    "existing.role !== 'AFFILIATE'", "existing.status !== 'ACTIVE'",
    '!existing.emailVerifiedAt', 'googleSub: null',
    "role: 'AFFILIATE', status: 'ACTIVE'",
    'admins.includes(identity.email)', '!identity.authoritativeEmail', 'userId: user.id',
    'googleSub: identity.sub','emailVerifiedAt: new Date()'])
    assert.ok(core.includes(x),x);
  for(const table of ['commission','payout','hvCodOrder','coupon']) {
    for(const op of ['update','delete'])
      assert.ok(!core.includes('prisma.'+table+'.'+op+'('));
  }
});

test('migration only adds nullable unique Google identifier',()=>{
  assert.ok(schema.includes('googleSub      String?      @unique @map("google_sub")'));
  assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS "google_sub" TEXT'));
  assert.ok(sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_key"'));
  assert.ok(!/DROP|TRUNCATE|DELETE FROM|ALTER TABLE "affiliates"/i.test(sql));
});

test('Google buttons display on login and registration while password/OTP remain',()=>{
  assert.ok(login.includes('<GoogleSignInButton />'));
  assert.ok(register.includes('<GoogleSignInButton label="Sign up with Google" />'));
  assert.ok(login.includes("fetch('/api/auth/login'"));
  assert.ok(register.includes("fetch('/api/auth/register'"));
});
