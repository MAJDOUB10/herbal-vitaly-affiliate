import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const page = read('src/app/page.tsx');
const landing = read('src/components/landing/PartnerLanding.tsx');
const shell = read('src/components/landing/LegalPageShell.tsx');
const privacy = read('src/app/privacy/page.tsx');
const terms = read('src/app/terms/page.tsx');
const proxy = read('src/proxy.ts');

test('public homepage replaces automatic redirect to login without changing protected routes', () => {
  assert.ok(page.includes('return <PartnerLanding />;'));
  assert.ok(page.includes('https://partner.herbalvitaly.com/'));
  assert.ok(!page.includes("redirect('/login')"));
  assert.ok(proxy.includes("'/affiliate/:path*'"));
  assert.ok(proxy.includes("'/admin/:path*'"));
  assert.ok(proxy.includes("'/api/affiliate/:path*'"));
  assert.ok(!proxy.includes("'/':path*'"));
});

test('homepage has bilingual content, real authentication CTAs, tutorial and SEO metadata', () => {
  for (const required of [
    "type Language = 'ar' | 'en'",
    "setLang(arabic ? 'en' : 'ar')",
    "dir={arabic ? 'rtl' : 'ltr'}",
    'HERBAL VITALY · AFFILIATE PROGRAM',
    "href=\"/login\"",
    "href=\"/register\"",
    "href=\"#how\"",
    "href=\"#benefits\"",
    "href=\"#faq\"",
    'https://www.youtube.com/watch?v=1O3iYU1I-EQ',
    'contact@herbalvitaly.com',
    'Let nature be your medicine',
  ]) assert.ok(landing.includes(required), required);
  assert.ok(page.includes('robots: { index: true, follow: true }'));
});

test('homepage preserves official logo, accurate products and transparent mockup', () => {
  assert.ok(landing.includes('HERBAL_VITALY.logo'));
  assert.ok(landing.includes("YOURCODE"));
  assert.ok(landing.includes("previewTag: 'Illustrative preview'"));
  assert.ok(landing.includes("previewTag: 'نموذج توضيحي'"));
  assert.ok(!landing.includes('SARA15'));
  for(const product of ['TIYNEFRET', 'USHABTI'])assert.ok(landing.includes(product));
  assert.ok(landing.includes('eligible sales'));
  assert.ok(landing.includes('العمولات'));
  assert.ok(!landing.includes('Guaranteed earnings'));
});

test('mobile navigation and FAQs work without requiring login or javascript for details', () => {
  for(const x of ['aria-expanded={menuOpen}', 'setMenuOpen(!menuOpen)',
    'md:hidden', '<details key={entry.q}', '<summary', 'group-open:rotate-180'])
    assert.ok(landing.includes(x),x);
});

test('public privacy and program terms pages include real contact, essential Google scope and cross-links', () => {
  assert.ok(shell.includes('HERBAL_VITALY.logo'));
  assert.ok(shell.includes('mailto:contact@herbalvitaly.com'));
  assert.ok(landing.includes('href="/privacy"'));
  assert.ok(landing.includes('href="/terms"'));
  assert.ok(privacy.includes('openid, email, profile'));
  assert.ok(privacy.includes('Google account'));
  assert.ok(privacy.includes('Bosta'));
  assert.ok(privacy.includes('HttpOnly'));
  assert.ok(privacy.includes('<Link href="/terms"'));
  assert.ok(terms.includes('dietary supplements, not medicines'));
  assert.ok(terms.includes('Cash-on-delivery'));
  assert.ok(terms.includes('<Link href="/privacy"'));
});

test('landing and legal pages do not mutate orders, discounts or affiliate state', () => {
  for(const src of [page,landing,shell,privacy,terms]) {
    for(const forbidden of ['prisma.', 'discountCodeBasicCreate', 'ShopifyAdminGraphQL',
      'checkRateLimit(', 'SignJWT(', 'cookies().set'])
      assert.ok(!src.includes(forbidden),forbidden);
  }
});
