import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/app/register/page.tsx', import.meta.url), 'utf8');

test('both registration password fields have independent visibility controls', () => {
  assert.ok(page.includes("const [showPassword, setShowPassword] = useState(false)"));
  assert.ok(page.includes("const [showConfirmPassword, setShowConfirmPassword] = useState(false)"));
  assert.ok(page.includes("type={showPassword ? 'text' : 'password'}"));
  assert.ok(page.includes("type={showConfirmPassword ? 'text' : 'password'}"));
  assert.ok(page.includes("aria-label={showPassword ? 'Hide password' : 'Show password'}"));
  assert.ok(page.includes("aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}"));
  assert.ok(page.includes('onClick={() => setShowPassword(v => !v)}'));
  assert.ok(page.includes('onClick={() => setShowConfirmPassword(v => !v)}'));
  assert.ok(page.includes('EyeOff') && page.includes('Eye'));
});

test('unmatched passwords display accessible red inline warning and prevent submission', () => {
  assert.ok(page.includes('const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword'));
  assert.ok(page.includes('{passwordMismatch && ('));
  assert.ok(page.includes('id="password-mismatch" role="alert"'));
  assert.ok(page.includes('className="text-sm font-medium text-red-600"'));
  assert.ok(page.includes('Passwords do not match.'));
  assert.ok(page.includes('aria-invalid={passwordMismatch}'));
  assert.ok(page.includes('aria-describedby={passwordMismatch ? \'password-mismatch\' : undefined}'));
  assert.ok(page.includes('if (passwordMismatch) {'));
  assert.ok(page.includes('disabled={loading || !name || !email || password.length < 12 || password !== confirmPassword}'));
  assert.ok(page.includes('autoComplete="new-password"'));
});
