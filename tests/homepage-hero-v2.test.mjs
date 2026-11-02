import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const jsx = read('src/components/landing/PartnerLanding.tsx');
const css = read('src/app/globals.css');

test('approved desktop and mobile hero implemented as live HTML, not static screenshot', () => {
  for (const phrase of [
    'hv-hero-v2', 'hv-hero-trust', 'hv-hero-trust-item',
    'hv-hero-stage', 'hv-hero-stage-podium--wide',
    'hv-hero-stage-podium--small', 'hv-hero-botanical--left',
    'hv-hero-product--tiynefret', 'hv-hero-product--ushabti',
    'hv-hero-signature', 'hv-hero-window-shadow'
  ]) assert.ok(jsx.includes(phrase), phrase);
  assert.ok(!jsx.includes('ghostwriter_images'));
  assert.ok(jsx.includes('src={products[0].image}'));
  assert.ok(jsx.includes('src={products[1].image}'));
  assert.ok(jsx.includes('href={products[0].url}'));
  assert.ok(jsx.includes('href={products[1].url}'));
});
test('new features are multilingual while English remains the default',()=>{
  assert.ok(jsx.includes("useState<Language>('en')"));
  for (const phrase of ['Creator Partnership', 'Official Product Portfolio',
    'Trusted Brand Story', 'NUTRITIONAL WELLBEING',
    'برنامج شركاء', 'منتجات أصلية', 'علامة مصرية',
    'heroProofDesc3', 'heroValueStrip',
    'aria-labelledby="hv-hero-title"']) assert.ok(jsx.includes(phrase), phrase);
});
test('responsive visual system sizes correctly on small screens and honors reduced motion',()=>{
  for(const phrase of ['.hv-hero-v2 .hv-hero-content',
    '.hv-hero-v2 .hv-display-title', '.hv-hero-trust-item',
    '.hv-hero-v2 .hv-hero-art-arc',
    '.hv-hero-product--tiynefret', '.hv-hero-product--ushabti',
    '@media (max-width:700px)', '@media (max-width:390px)',
    '@media (prefers-reduced-motion: reduce)']) assert.ok(css.includes(phrase), phrase);
});
test('auth destinations and other page sections are preserved',()=>{
  for(const phrase of ['href="/login"', 'href="/register"', 'href="#partnership"',
    'href="#collection"', 'id="philosophy"', 'id="collection"',
    'id="partnership"', 'id="questions"']) assert.ok(jsx.includes(phrase), phrase);
  for(const forbidden of ['prisma.', 'discountCodeBasicCreate', 'Math.random()', 'cookies().set'])
    assert.ok(!jsx.includes(forbidden),forbidden);
});
