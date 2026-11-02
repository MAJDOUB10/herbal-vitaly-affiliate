import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const page = read('src/app/page.tsx');
const landing = read('src/components/landing/PartnerLanding.tsx');
const styles = read('src/app/globals.css');
const shell = read('src/components/landing/LegalPageShell.tsx');
const privacy = read('src/app/privacy/page.tsx');
const terms = read('src/app/terms/page.tsx');
const proxy = read('src/proxy.ts');

test('public corporate homepage replaces login redirect while protected routes remain secure', () => {
  assert.ok(page.includes('return <PartnerLanding />;'));
  assert.ok(page.includes("https://partner.herbalvitaly.com/"));
  assert.ok(!page.includes("redirect('/login')"));
  for (const guard of ["'/affiliate/:path*'", "'/admin/:path*'", "'/api/affiliate/:path*'"]) {
    assert.ok(proxy.includes(guard), guard);
  }
});

test('English is the true first-visit primary language and Arabic is switchable RTL', () => {
  assert.ok(landing.includes("useState<Language>('en')"));
  assert.ok(landing.includes("const [language, setLanguage]"));
  assert.ok(landing.includes("setLanguage(arabic ? 'en' : 'ar')"));
  assert.ok(landing.includes("dir={arabic ? 'rtl' : 'ltr'}"));
  assert.ok(landing.includes("lang={language}"));
  assert.ok(landing.includes("'Wellness has'"));
  assert.ok(landing.includes("'حكايتك.'"));
});

test('corporate editorial story is distinct and product visuals are real, official Shopify assets', () => {
  for (const x of ['HERBAL_VITALY.logo', 'THE HERBAL VITALY PARTNER JOURNAL',
    "'Wellness has'", "'Your voice.'", "'People make the difference'",
    "'TIYNEFRET'", "'USHABTI'", "'TUT FLORA'", "'INOMERI'",
    "cdn.shopify.com/s/files/", "https://herbalvitaly.com/products/tiynefret",
    "https://herbalvitaly.com/products/ushabti",
    "https://herbalvitaly.com/products/tut-flora"]) {
    assert.ok(landing.includes(x),x);
  }
  assert.ok(!landing.includes('YOURCODE'));
  assert.ok(!landing.includes('SARA15'));
  assert.ok(!landing.includes('guaranteed earnings'));
  assert.ok(!landing.includes('100% guaranteed'));
  assert.ok(!landing.includes('fake reviews'));
});

test('conversion architecture contains functioning auth, resource, help and video links', () => {
  for (const x of ['href="/login"', 'href="/register"', 'href="#partnership"',
    'href="#collection"', 'href="#philosophy"', 'href="#questions"',
    'href="/privacy"', 'href="/terms"',
    'https://www.youtube.com/watch?v=1O3iYU1I-EQ',
    'contact@herbalvitaly.com', 'https://herbalvitaly.com']) {
    assert.ok(landing.includes(x),x);
  }
});

test('UI interactions include collection selection, mobile navigation and accessible disclosure', () => {
  for (const x of ['useState<Collection>', 'setActiveCollection(item)',
    'aria-pressed={activeCollection===item}',
    'aria-expanded={menuOpen}', 'aria-controls="hv-mobile-navigation"',
    'setMenuOpen(!menuOpen)', 'onClick={closeMenu}',
    '<details key={item.q}', '<summary>', 'aria-live="polite"',
    'aria-label={t.ariaMenu}', 'className="hv-skip"']) {
    assert.ok(landing.includes(x),x);
  }
});

test('scroll motion is IntersectionObserver based, bounded and respects reduced-motion', () => {
  for (const x of ["IntersectionObserver", "observer.unobserve(entry.target)",
    "matchMedia('(prefers-reduced-motion: reduce)')",
    "document.documentElement.classList.add('hv-enhanced-motion')",
    "observer.disconnect()", "window.addEventListener('scroll', onScroll, { passive: true })"])
    assert.ok(landing.includes(x),x);
  for (const x of ['.hv-enhanced-motion [data-hv-reveal]:not(.is-visible)',
    '.hv-product-image-wrap img', '@media (max-width: 700px)',
    '@media (prefers-reduced-motion: reduce)', '.hv-editorial', '.hv-button:hover']) {
    assert.ok(styles.includes(x),x);
  }
});

test('legal pages remain public with Google OAuth transparency and affiliate conditions', () => {
  assert.ok(shell.includes('HERBAL_VITALY.logo'));
  assert.ok(privacy.includes('openid, email, profile'));
  assert.ok(privacy.includes('Google account'));
  assert.ok(terms.includes('dietary supplements, not medicines'));
  assert.ok(terms.includes('Cash-on-delivery'));
  assert.ok(landing.includes('footerDisclaimer'));
  assert.ok(page.includes('robots: { index: true, follow: true }'));
});

test('no business-critical data mutations or fake commission results in homepage', () => {
  for(const src of [page,landing,shell,privacy,terms]) {
    for(const forbidden of ['prisma.', 'discountCodeBasicCreate', 'ShopifyAdminGraphQL',
      'SignJWT(', 'cookies().set', 'Math.random()']) {
      assert.ok(!src.includes(forbidden),forbidden);
    }
  }
});
