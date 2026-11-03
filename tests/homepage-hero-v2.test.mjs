import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const jsx = read('src/components/landing/PartnerLanding.tsx');
const css = read('src/app/globals.css');

test('homepage hero uses the approved English affiliate photo with no products or action buttons inside the hero',()=>{
  const hero=jsx.split('<section className="hv-hero hv-hero-photo"')[1].split('<div className="hv-editorial-marquee"')[0];
  assert.ok(hero.includes('/images/partner-affiliate-hero-en.jpg'));
  assert.ok(hero.includes('Join the Herbal Vitaly Affiliate Program'));
  assert.ok(hero.includes('aria-labelledby="hv-hero-title"'));
  assert.ok(!hero.includes('<a '));
  assert.ok(!hero.includes('hv-hero-product'));
  assert.ok(!hero.includes('src={products['));
  assert.ok(!jsx.includes('ghostwriter_images'));
  assert.ok(readFileSync(new URL('../public/images/partner-affiliate-hero-en.jpg', import.meta.url)).length>10000);
});
test('English remains primary and Arabic mobile content retains support',()=>{
  assert.ok(jsx.includes("useState<Language>('en')"));
  assert.ok(jsx.includes("setLanguage(arabic ? 'en' : 'ar')"));
  assert.ok(jsx.includes('شراكة حقيقية تبدأ بالثقة'));
  assert.ok(jsx.includes('Transparent partnerships'));
});
test('hero responsive rules preserve photo composition and show clear live text on mobile',()=>{
  for(const x of ['.hv-hero-photo-desktop img','.hv-hero-photo-mobile-copy h2','.hv-hero-photo-mobile-visual img','object-fit:cover','@media (max-width:700px)','@media (prefers-reduced-motion: reduce)'])
    assert.ok(css.includes(x),x);
});
test('all authentication and catalogue/navigation destinations remain available',()=>{
  for(const x of ['href="/login"','href="/register"','href="#partnership"','href="#collection"','id="philosophy"','id="collection"','id="partnership"','id="questions"'])
    assert.ok(jsx.includes(x),x);
});
