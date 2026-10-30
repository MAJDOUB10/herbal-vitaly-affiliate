import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAcceptablePassword, normalizeLoginEmail, isValidLoginEmail,
  hashedLoginIdentifier, passwordSessionVersion } from '../src/lib/password-auth-policy.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('password policy uses a long passphrase and limits unbounded input', () => {
  assert.equal(isAcceptablePassword('correct horse battery'), true);
  assert.equal(isAcceptablePassword('short'), false);
  assert.equal(isAcceptablePassword('a'.repeat(129)), false);
  assert.equal(isAcceptablePassword('a'.repeat(128)), true);
  assert.equal(isAcceptablePassword('hello world\u0000x'), false);
});

test('email logins normalize case without leaking cleartext into rate limiting', () => {
  assert.equal(normalizeLoginEmail('  PERSON@EXAMPLE.COM '), 'person@example.com');
  assert.equal(isValidLoginEmail(normalizeLoginEmail(' person@example.com ')), true);
  assert.equal(isValidLoginEmail('not-an-email'), false);
  assert.notEqual(hashedLoginIdentifier('p@example.com', 'key'), 'p@example.com');
  assert.notEqual(hashedLoginIdentifier('p@example.com', 'key1'), hashedLoginIdentifier('p@example.com', 'key2'));
});

test('password change revokes previously signed sessions', () => {
  assert.notEqual(passwordSessionVersion('bcrypt-hash-A'), passwordSessionVersion('bcrypt-hash-B'));
  assert.equal(passwordSessionVersion('bcrypt-hash-A'), passwordSessionVersion('bcrypt-hash-A'));
  const proxy = read('src/proxy.ts');
  assert.match(proxy, /payload\.pv/);
  assert.match(proxy, /passwordSessionVersion\(user\.password\)/);
});

test('password login protects identity, session, and role', () => {
  const route = read('src/app/api/auth/login/route.ts');
  assert.match(route, /bcrypt\.compare/);
  assert.match(route, /checkRateLimit/);
  assert.match(route, /status !== 'ACTIVE'/);
  assert.match(route, /emailVerifiedAt/);
  assert.match(route, /httpOnly: true/);
  assert.match(route, /passwordSessionVersion/);
  assert.doesNotMatch(route, /otpService/);
});

test('registration requires password but still verifies email and manual approval', () => {
  const register = read('src/app/api/auth/register/route.ts');
  const verify = read('src/app/api/auth/verify-otp/route.ts');
  assert.match(register, /isAcceptablePassword\(password\)/);
  assert.match(register, /otpService\.sendOTP/);
  assert.match(verify, /account\.status !== 'PENDING'/);
  assert.doesNotMatch(verify, /new SignJWT/);
  assert.doesNotMatch(verify, /cookies\.set\('auth-token'/);
});

test('recovering a password requires a one-time email code and invalidates sessions', () => {
  const request = read('src/app/api/auth/reset-password/request/route.ts');
  const confirm = read('src/app/api/auth/reset-password/confirm/route.ts');
  assert.match(request, /otpService\.sendOTP/);
  assert.match(confirm, /otpService\.verifyOTP/);
  assert.match(confirm, /bcrypt\.hash\(newPassword, 12\)/);
  assert.match(confirm, /emailVerifiedAt/);
  assert.match(confirm, /status !== 'ACTIVE'/);
  assert.match(confirm, /cookies\.set\('auth-token'/);
  assert.doesNotMatch(confirm, /new SignJWT/);
});

test('UI has password login, reset and password selection in registration', () => {
  const login = read('src/app/login/page.tsx');
  const register = read('src/app/register/page.tsx');
  const reset = read('src/app/forgot-password/page.tsx');
  assert.match(login, /\/api\/auth\/login/);
  assert.match(login, /type=\{showPassword \? 'text' : 'password'\}/);
  assert.match(login, /Forgot password/);
  assert.doesNotMatch(login, /send-otp/);
  assert.match(register, /confirmPassword/);
  assert.match(register, /password, role: 'AFFILIATE'/);
  assert.match(reset, /reset-password\/confirm/);
});
