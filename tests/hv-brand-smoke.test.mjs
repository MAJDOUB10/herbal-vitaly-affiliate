import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Herbal Vitaly brand identity uses the original logo and tagline', () => {
  const brand = read('src/components/brand/BrandIdentity.tsx');
  assert.match(brand, /herbal-vitaly-affiliate-official-logo\.png/);
  assert.match(brand, /Let nature be your medicine/);
  assert.match(brand, /#1F6B3A/);
});

test('login, register and dashboards use shared brand identity', () => {
  for (const path of ['src/app/login/page.tsx', 'src/app/register/page.tsx', 'src/app/admin/layout.tsx', 'src/app/affiliate/layout.tsx']) {
    assert.match(read(path), /<BrandIdentity\b/, path);
    assert.doesNotMatch(read(path), />Refferq</, path);
  }
});

test('theme uses corporate green and proper public application title', () => {
  assert.match(read('src/app/globals.css'), /--primary:\s*145 55% 27%/);
  assert.match(read('src/app/layout.tsx'), /title: 'Herbal Vitaly Affiliate Hub'/);
  assert.match(read('src/lib/email.ts'), /Herbal Vitaly/);
});
