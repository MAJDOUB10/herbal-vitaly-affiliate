'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Check,
  ChevronDown, CircleHelp, ClipboardCheck, Gift, HeartHandshake, LifeBuoy,
  Link2, Mail, Menu, PackageCheck, PlayCircle, ShieldCheck, Sparkles, TicketPercent,
  Truck, Users, Wallet, X,
} from 'lucide-react';
import { HERBAL_VITALY } from '@/components/brand/BrandIdentity';

type Language = 'ar' | 'en';

const content = {
  ar: {
    lang: 'العربية', alternate: 'English',
    navHow: 'إزاي بيشتغل؟', navBenefits: 'المميزات', navFaq: 'الأسئلة الشائعة',
    signIn: 'تسجيل الدخول', join: 'انضم كشريك', mobileMenu: 'القائمة',
    eyebrow: 'HERBAL VITALY · AFFILIATE PROGRAM',
    hero1: 'تأثيرك يستاهل',
    hero2: 'فرصة تكبر بيها.',
    heroBody: 'عندك جمهور بيثق في ترشيحاتك؟ انضم لبرنامج شركاء Herbal Vitaly، شارك منتجاتنا بكودك الخاص، وتابع الطلبات والعمولات المؤهلة من مكان واحد.',
    heroPrimary: 'ابدأ دلوقتي', heroSecondary: 'أنا شريك بالفعل',
    guide: 'شوف شرح التسجيل', guideTime: 'فيديو خطوة بخطوة',
    trust1: 'تسجيل أونلاين', trust2: 'كود خصم خاص بيك', trust3: 'متابعة واضحة للطلبات',
    previewEyebrow: 'نظرة على لوحة الشريك', previewTitle: 'كل شغلك في مكان واحد',
    previewTag: 'نموذج توضيحي', previewCode: 'كودك الشخصي', previewLinks: 'روابط المنتجات',
    previewTracking: 'متابعة الطلبات', previewCommission: 'العمولات المؤهلة',
    previewSample: 'مثال فقط', previewProducts: 'منتجات تقدر تروّج لها',
    previewProduct1: 'تي نفرت', previewProduct2: 'أوشبتي',
    featuresEyebrow: 'ليه تبقى شريك معانا؟',
    featuresTitle: 'من أول لينك لحد متابعة عمولتك',
    featuresBody: 'أدوات بسيطة تساعدك تركز على المحتوى والتوصيات، وتتابع أداءك بوضوح.',
    features: [
      { title: 'كود خصم باسمك', description: 'اختار كود خاص بيك، وشاركه مع جمهورك على السوشيال ميديا.' },
      { title: 'لينك مخصص لكل منتج', description: 'روابط تساعدك تروّج للمنتجات وتتبع المبيعات المرتبطة بك.' },
      { title: 'متابعة الطلبات والتوصيل', description: 'اطلع على الطلبات وحالة التوصيل والمرتجعات من حسابك.' },
      { title: 'تقارير وعمولات', description: 'اعرف المبيعات والعمولات المؤهلة بعد التحقق من الطلبات والتحصيل.' },
      { title: 'دعم للشركاء', description: 'افتح طلب دعم وتابع رد فريقنا من نفس البوابة.' },
      { title: 'كل حاجة في حساب واحد', description: 'بياناتك، الأكواد، الروابط، الطلبات والتقارير في مكان منظم.' },
    ],
    stepsEyebrow: '3 خطوات وتبدأ',
    stepsTitle: 'ابدأ بسهولة، واشتغل بطريقتك',
    steps: [
      { title: 'سجّل حسابك', description: 'أنشئ حساب شريك وفعّل بريدك الإلكتروني.' },
      { title: 'اختار الكود واللينكات', description: 'حدّد كود الخصم الخاص بيك، وخد روابط المنتجات.' },
      { title: 'انشر وتابع', description: 'شارك مع جمهورك، وتابع الطلبات والعمولات من لوحة التحكم.' },
    ],
    whoEyebrow: 'مين يقدر ينضم؟',
    whoTitle: 'لصنّاع المحتوى والمؤثرين اللي بيحبوا يشاركوا اختيارات مفيدة.',
    whoBody: 'سواء بتقدم محتوى عن العناية الشخصية، الصحة العامة، أو أسلوب الحياة، تقدر تقدم طلب الانضمام وتتعرف على أدوات البرنامج.',
    whoNote: 'قبول الشراكة والعمولات يخضعان لشروط البرنامج والتحقق من المبيعات.',
    explore: 'اكتشف منتجات Herbal Vitaly',
    faqEyebrow: 'محتاج تعرف أكتر؟',
    faqTitle: 'أسئلة بتتكرر',
    faqs: [
      { q: 'لازم يكون عندي عدد معين من المتابعين؟', a: 'تقدر تسجّل اهتمامك بالبرنامج، ويتم تقييم الأهلية حسب سياسة Herbal Vitaly ومعايير الشراكة المعمول بها.' },
      { q: 'هستلم كود الخصم إزاي؟', a: 'بعد إنشاء الحساب وتفعيل البريد الإلكتروني وتسجيل الدخول، هتقدر تختار كود متاح وتربطه بحسابك والمنتجات المؤهلة.' },
      { q: 'أتابع المبيعات والعمولات فين؟', a: 'من لوحة حسابك هتشوف الروابط والطلبات وبيانات التوصيل والعمولات وفقًا لحالة كل طلب.' },
      { q: 'هل العمولة بتتحسب أول ما العميل يطلب؟', a: 'لأ، استحقاق العمولة بيكون حسب شروط البرنامج والتحقق من الطلب والتسليم والتحصيل والتسوية، ومش بمجرد إنشاء الطلب.' },
      { q: 'أكلم الدعم إزاي؟', a: 'من حساب الشريك تقدر تفتح تذكرة في مركز الدعم، أو تبعت إيميل إلى contact@herbalvitaly.com.' },
    ],
    bottomEyebrow: 'HERBAL VITALY AFFILIATE',
    bottomTitle: 'جاهز تحوّل محتواك لشراكة حقيقية؟',
    bottomBody: 'سجّل، اختار كودك، وابدأ شارك منتجات Herbal Vitaly مع جمهورك.',
    bottomCta: 'إنشاء حساب شريك', bottomLogin: 'عندك حساب؟ سجّل دخول',
    footerTag: 'Let nature be your medicine',
    footerAbout: 'منصة شركاء Herbal Vitaly للتسويق بالعمولة وإدارة روابط المنتجات والطلبات.',
    footerLinks: 'روابط مفيدة', footerCompany: 'Herbal Vitaly', footerContact: 'تواصل معانا',
    footerPrivacy: 'الخصوصية', footerTerms: 'شروط البرنامج',
    footerRights: 'جميع الحقوق محفوظة.',
    footerNotice: 'العمولات تُراجع وفقًا للطلبات المؤهلة، وليست أرباحًا مضمونة.',
  },
  en: {
    lang: 'English', alternate: 'العربية',
    navHow: 'How it works', navBenefits: 'Benefits', navFaq: 'FAQs',
    signIn: 'Sign in', join: 'Become a partner', mobileMenu: 'Menu',
    eyebrow: 'HERBAL VITALY · AFFILIATE PROGRAM',
    hero1: 'Your influence.',
    hero2: 'A new opportunity.',
    heroBody: 'Have an audience that trusts your recommendations? Join the Herbal Vitaly partner program, share products with your personal code, and follow eligible sales and commissions in one place.',
    heroPrimary: 'Join the program', heroSecondary: 'I am already a partner',
    guide: 'Watch the registration guide', guideTime: 'Step-by-step video',
    trust1: 'Online registration', trust2: 'Your own discount code', trust3: 'Clear order visibility',
    previewEyebrow: 'A glimpse inside the partner portal', previewTitle: 'Everything in one place',
    previewTag: 'Illustrative preview', previewCode: 'Your promo code', previewLinks: 'Product links',
    previewTracking: 'Order tracking', previewCommission: 'Eligible commissions',
    previewSample: 'Sample only', previewProducts: 'Products to share',
    previewProduct1: 'TIYNEFRET', previewProduct2: 'USHABTI',
    featuresEyebrow: 'WHY PARTNER WITH US',
    featuresTitle: 'From your first link to commission tracking',
    featuresBody: 'Straightforward tools to help you focus on content while staying informed about performance.',
    features: [
      { title: 'Your own discount code', description: 'Choose a personal code and share it with your audience.' },
      { title: 'Product-specific links', description: 'Share direct product links with your partner attribution.' },
      { title: 'Orders and delivery', description: 'Follow orders, delivery progress and returns from your dashboard.' },
      { title: 'Reports and commissions', description: 'See eligible sales and commissions after order and settlement verification.' },
      { title: 'Partner support', description: 'Open a support ticket and follow our team’s replies in the portal.' },
      { title: 'One connected dashboard', description: 'Keep your codes, links, orders, reports and details in one place.' },
    ],
    stepsEyebrow: 'THREE SIMPLE STEPS',
    stepsTitle: 'Get started. Make it your own.',
    steps: [
      { title: 'Create your account', description: 'Register as a partner and verify your email address.' },
      { title: 'Choose your code and links', description: 'Set up your available promo code and access product links.' },
      { title: 'Share and follow progress', description: 'Recommend products and track eligible orders and commissions.' },
    ],
    whoEyebrow: 'WHO IS IT FOR?',
    whoTitle: 'For creators and influencers who share meaningful recommendations.',
    whoBody: 'If your content covers self-care, wellness or everyday lifestyle, you can apply to join the program and explore its tools.',
    whoNote: 'Eligibility and commissions are subject to program terms and verified orders.',
    explore: 'Explore Herbal Vitaly products',
    faqEyebrow: 'GOOD TO KNOW',
    faqTitle: 'Frequently asked questions',
    faqs: [
      { q: 'Do I need a certain number of followers?', a: 'You can register your interest. Eligibility is assessed according to Herbal Vitaly’s current partner program criteria.' },
      { q: 'How do I get my discount code?', a: 'After registering, verifying your email and signing in, you can choose an available code and associate it with your eligible products.' },
      { q: 'Where can I see my sales and commissions?', a: 'Your dashboard shows your product links, orders, delivery information and commission details according to each order’s status.' },
      { q: 'Is a commission earned when a customer places an order?', a: 'Not automatically. Commissions depend on the program rules and verification of the order, delivery, collection and settlement.' },
      { q: 'How can I contact support?', a: 'Open a ticket from your partner dashboard or email contact@herbalvitaly.com.' },
    ],
    bottomEyebrow: 'HERBAL VITALY AFFILIATE',
    bottomTitle: 'Ready to grow with Herbal Vitaly?',
    bottomBody: 'Create your account, choose your code and start sharing products with your audience.',
    bottomCta: 'Create partner account', bottomLogin: 'Already a partner? Sign in',
    footerTag: 'Let nature be your medicine',
    footerAbout: 'The Herbal Vitaly partner platform for affiliate marketing and managing product links and orders.',
    footerLinks: 'Useful links', footerCompany: 'Herbal Vitaly', footerContact: 'Contact us',
    footerPrivacy: 'Privacy policy', footerTerms: 'Program terms',
    footerRights: 'All rights reserved.',
    footerNotice: 'Commissions depend on verified eligible orders; earnings are not guaranteed.',
  },
} as const;

const featureIcons = [TicketPercent, Link2, Truck, BarChart3, LifeBuoy, Users];
const stepIcons = [Users, Gift, ClipboardCheck];

function Logo({ small = false }: { small?: boolean }) {
  return <img
    src={HERBAL_VITALY.logo}
    alt="Herbal Vitaly — Let nature be your medicine"
    width={small ? 125 : 155}
    height={small ? 74 : 90}
    className={small ? 'h-[55px] w-auto object-contain' : 'h-[66px] w-auto object-contain'}
    loading="eager"
  />;
}

export default function PartnerLanding() {
  const [lang, setLang] = useState<Language>('ar');
  const [menuOpen, setMenuOpen] = useState(false);
  const t = content[lang];
  const arabic = lang === 'ar';
  const ForwardArrow = arabic ? ArrowLeft : ArrowRight;
  return (
    <main dir={arabic ? 'rtl' : 'ltr'} lang={lang}
      className="min-h-screen overflow-x-hidden bg-white text-[#173321]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3">
        {arabic ? 'انتقل للمحتوى' : 'Skip to content'}
      </a>
      <div className="bg-[#143E27] px-4 py-2 text-center text-[11px] font-semibold tracking-wider text-white sm:text-xs" dir="ltr">
        HERBAL VITALY AFFILIATE HUB <span className="mx-2 text-[#8FC5A0]">✦</span> LET NATURE BE YOUR MEDICINE
      </div>
      <header className="sticky top-0 z-40 border-b border-[#E6EFE9] bg-white/95 backdrop-blur-lg">
        <div className="mx-auto flex h-[82px] max-w-[1240px] items-center justify-between gap-3 px-5 sm:px-8">
          <Link href="/" aria-label="Herbal Vitaly Affiliate Hub home" className="shrink-0">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#50675A] md:flex" aria-label="Main navigation">
            <a href="#how" className="transition-colors hover:text-[#1F6B3A]">{t.navHow}</a>
            <a href="#benefits" className="transition-colors hover:text-[#1F6B3A]">{t.navBenefits}</a>
            <a href="#faq" className="transition-colors hover:text-[#1F6B3A]">{t.navFaq}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setLang(arabic ? 'en' : 'ar')}
              aria-label={arabic ? 'Switch to English' : 'التبديل إلى العربية'}
              className="rounded-lg border border-[#D7E5DB] bg-white px-3 py-2 text-xs font-semibold text-[#1F6B3A] hover:bg-[#F0F8F2]">
              {t.alternate}
            </button>
            <Link href="/login" className="hidden rounded-lg px-3 py-2.5 text-sm font-semibold text-[#1F6B3A] hover:bg-[#F0F8F2] sm:inline-flex">{t.signIn}</Link>
            <Link href="/register" className="hidden items-center gap-2 rounded-lg bg-[#1F6B3A] px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#154E2B] sm:inline-flex">
              {t.join}<ForwardArrow className="h-4 w-4"/>
            </Link>
            <button type="button" aria-expanded={menuOpen} aria-label={t.mobileMenu}
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg border border-[#DCE9E0] p-2 text-[#1F6B3A] md:hidden">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && <nav className="space-y-1 border-t border-[#E6EFE9] bg-white px-5 py-3 shadow-md md:hidden">
          {[['#how', t.navHow], ['#benefits', t.navBenefits], ['#faq', t.navFaq], ['/login', t.signIn], ['/register', t.join]].map(([href, label]) =>
            <a key={href} href={href} onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-3 text-sm font-semibold text-[#1F6B3A] hover:bg-[#F1F8F3]">{label}</a>)}
        </nav>}
      </header>

      <section id="main" className="hv-landing-hero relative isolate overflow-hidden">
        <div aria-hidden="true" className="hv-landing-orb hv-landing-orb-one" />
        <div aria-hidden="true" className="hv-landing-orb hv-landing-orb-two" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pb-28 lg:pt-24">
          <div className="relative z-10 space-y-7">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#CFE3D5] bg-[#F5FBF7] px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-[#1F6B3A] sm:text-xs" dir="ltr">
              <Sparkles className="h-4 w-4 shrink-0"/>{t.eyebrow}
            </div>
            <h1 className="max-w-[690px] text-[clamp(2.85rem,5.1vw,5.15rem)] font-black leading-[1.16] tracking-[-0.045em] text-[#173321]">
              {t.hero1}<br/><span className="text-[#1F6B3A]">{t.hero2}</span>
            </h1>
            <p className="max-w-[590px] text-base leading-[2] text-[#52695C] sm:text-lg">{t.heroBody}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F6B3A] px-7 py-4 text-base font-bold text-white shadow-[0_15px_30px_rgba(31,107,58,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#164D2B]">
                {t.heroPrimary}<ForwardArrow className="h-5 w-5"/>
              </Link>
              <Link href="/login" className="inline-flex items-center justify-center rounded-xl border border-[#C7DBCF] bg-white px-7 py-4 text-base font-bold text-[#1F6B3A] transition-colors hover:bg-[#F4FAF6]">
                {t.heroSecondary}
              </Link>
            </div>
            <a href="https://www.youtube.com/watch?v=1O3iYU1I-EQ" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-sm font-semibold text-[#1F6B3A] hover:underline">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E8DE] bg-white shadow-sm"><PlayCircle className="h-5 w-5"/></span>
              <span>{t.guide}<span className="mt-0.5 block text-xs font-normal text-[#839489]">{t.guideTime}</span></span>
            </a>
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#DBE7DE] pt-6 text-xs font-semibold text-[#546E5D]">
              {[t.trust1, t.trust2, t.trust3].map(x => <span key={x} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-[#1F6B3A]"/>{x}</span>)}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[545px]" dir="ltr">
            <div className="absolute -inset-5 -z-10 rounded-[2.5rem] border border-[#E5EFE8] bg-white/60 shadow-[0_25px_90px_rgba(31,107,58,0.07)]"/>
            <div className="overflow-hidden rounded-[1.65rem] border border-[#DCE9DF] bg-white shadow-[0_30px_100px_rgba(15,61,35,0.13)]">
              <div className="flex items-center justify-between border-b border-[#E8F0EA] bg-[#F8FCF9] px-6 py-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1F6B3A]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F6B3A] text-white"><BarChart3 className="h-4 w-4"/></span>Partner Workspace</div>
                <span className="rounded-full border border-[#CDE4D4] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1F6B3A]">{t.previewTag}</span>
              </div>
              <div className="space-y-5 p-5 sm:p-7">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#72907C]">{t.previewEyebrow}</p>
                  <h2 className="text-xl font-extrabold text-[#183B25]">{t.previewTitle}</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1.25fr_0.75fr]">
                  <div className="rounded-2xl bg-gradient-to-br from-[#1F6B3A] to-[#133D25] p-5 text-white">
                    <div className="flex items-center justify-between gap-2 text-xs text-white/80"><span>{t.previewCode}</span><TicketPercent className="h-5 w-5"/></div>
                    <p className="mt-4 font-mono text-3xl font-bold tracking-[0.18em]">SARA15</p>
                    <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white/90"><BadgeCheck className="h-3.5 w-3.5"/>{t.previewSample}</p>
                  </div>
                  <div className="flex flex-col justify-center gap-3 rounded-2xl border border-[#E3EEE7] bg-[#F8FBF9] p-4">
                    <div className="flex items-center gap-2 text-[#1F6B3A]"><Link2 className="h-5 w-5"/><span className="text-xs font-bold">{t.previewLinks}</span></div>
                    <div className="h-2.5 w-full rounded-full bg-[#DBEDE1]"/><div className="h-2.5 w-3/4 rounded-full bg-[#DBEDE1]"/><div className="h-2.5 w-5/6 rounded-full bg-[#DBEDE1]"/>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl border border-[#E3EEE7] bg-white p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F7F2] text-[#1F6B3A]"><PackageCheck className="h-5 w-5"/></span><span className="text-xs font-bold text-[#3B5946]">{t.previewTracking}</span><Check className="ml-auto h-4 w-4 text-[#1F6B3A]"/></div>
                  <div className="flex items-center gap-3 rounded-xl border border-[#E3EEE7] bg-white p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F7F2] text-[#1F6B3A]"><Wallet className="h-5 w-5"/></span><span className="text-xs font-bold text-[#3B5946]">{t.previewCommission}</span><Check className="ml-auto h-4 w-4 text-[#1F6B3A]"/></div>
                </div>
                <div className="rounded-2xl border border-[#E3EEE7] p-4">
                  <p className="mb-3 text-xs font-bold text-[#47654F]">{t.previewProducts}</p>
                  <div className="space-y-2">
                    {[t.previewProduct1,t.previewProduct2].map((x,i) => <div key={x} className="flex items-center gap-3 rounded-lg bg-[#F7FAF8] px-3 py-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0EAE3] bg-white text-[#1F6B3A]"><Gift className="h-4 w-4"/></span>
                      <span className="flex-1 text-xs font-semibold text-[#294B34]">{x}</span>
                      <span className="font-mono text-[10px] text-[#708C79]">0{i+1}</span>
                      <ArrowUpRight className="h-4 w-4 text-[#1F6B3A]"/>
                    </div>)}
                  </div>
                </div>
              </div>
            </div>
            <div aria-hidden="true" className="absolute -bottom-7 -left-8 -z-20 h-28 w-28 rounded-[2rem] bg-[#DFF1E4] blur-2xl"/>
          </div>
        </div>
      </section>

      <section id="benefits" className="scroll-mt-24 bg-white px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-12 max-w-[720px]">
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.2em] text-[#1F6B3A]">{t.featuresEyebrow}</p>
            <h2 className="text-3xl font-extrabold leading-[1.4] tracking-[-0.03em] text-[#173321] sm:text-4xl">{t.featuresTitle}</h2>
            <p className="mt-4 text-base leading-8 text-[#657C6B]">{t.featuresBody}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {t.features.map((feature,i) => {
              const Icon = featureIcons[i];
              return <div key={feature.title} className="group rounded-[1.4rem] border border-[#E0EBE4] bg-white p-7 shadow-[0_12px_28px_rgba(20,80,40,0.035)] transition-all hover:-translate-y-1 hover:border-[#BFDAC7] hover:shadow-[0_20px_40px_rgba(20,80,40,0.09)]">
                <span className="mb-6 inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-[#EDF8F0] p-3.5 text-[#1F6B3A]"><Icon className="h-6 w-6"/></span>
                <h3 className="text-lg font-bold text-[#173321]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-8 text-[#687E6E]">{feature.description}</p>
              </div>;
            })}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-24 border-y border-[#E6F0E9] bg-[#F7FBF8] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto mb-14 max-w-[680px] text-center">
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.2em] text-[#1F6B3A]">{t.stepsEyebrow}</p>
            <h2 className="text-3xl font-extrabold leading-[1.4] sm:text-4xl">{t.stepsTitle}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {t.steps.map((item,i)=>{
              const Icon=stepIcons[i];
              return <div className="relative rounded-[1.5rem] border border-[#E0EBE4] bg-white p-8 shadow-sm" key={item.title}>
                <div className="mb-8 flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1F6B3A] text-white"><Icon className="h-6 w-6"/></span>
                  <span className="text-4xl font-black text-[#E1EDE5]">0{i+1}</span>
                </div>
                <h3 className="text-lg font-extrabold">{item.title}</h3>
                <p className="mt-3 text-sm leading-8 text-[#697E70]">{item.description}</p>
              </div>;
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-[1240px] gap-10 overflow-hidden rounded-[2rem] border border-[#DAE9DE] bg-[#F9FCFA] p-8 sm:p-12 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:p-16">
          <div>
            <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[#1F6B3A]">{t.whoEyebrow}</p>
            <h2 className="max-w-[660px] text-3xl font-extrabold leading-[1.4] sm:text-4xl">{t.whoTitle}</h2>
            <p className="mt-5 max-w-[650px] text-base leading-8 text-[#6A8070]">{t.whoBody}</p>
            <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-[#698271]"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#1F6B3A]"/>{t.whoNote}</p>
            <a href="https://herbalvitaly.com" target="_blank" rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#1F6B3A] hover:underline">
              {t.explore}<ArrowUpRight className="h-4 w-4"/>
            </a>
          </div>
          <div className="relative mx-auto flex aspect-[1.1] w-full max-w-[420px] items-center justify-center">
            <div aria-hidden="true" className="absolute inset-8 rounded-full border-[35px] border-[#DDEEE2]"/>
            <div aria-hidden="true" className="absolute inset-20 rounded-full border border-[#8AB99A]/35"/>
            <div className="relative flex h-52 w-52 items-center justify-center rounded-[2.8rem] border border-[#D6E8DC] bg-white shadow-[0_26px_55px_rgba(22,84,44,0.12)]">
              <span className="absolute -right-7 -top-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1F6B3A] text-white shadow-lg"><HeartHandshake className="h-8 w-8"/></span>
              <img src={HERBAL_VITALY.logo} alt="Herbal Vitaly" width={180} height={120} className="h-32 w-36 object-contain"/>
              <span className="absolute -bottom-5 -left-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#DCE9E0] bg-white text-[#1F6B3A] shadow-lg"><Sparkles className="h-7 w-7"/></span>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 border-t border-[#E6F0E9] bg-white px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-[930px]">
          <div className="mb-12 text-center">
            <p className="mb-4 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#1F6B3A]"><CircleHelp className="h-4 w-4"/>{t.faqEyebrow}</p>
            <h2 className="text-3xl font-extrabold sm:text-4xl">{t.faqTitle}</h2>
          </div>
          <div className="space-y-3">
            {t.faqs.map((entry,i)=><details key={entry.q} className="group rounded-2xl border border-[#E1EBE4] bg-white px-6 py-5 open:border-[#BFDAC8] open:bg-[#FBFDFB]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold marker:hidden sm:text-base">
                {entry.q}<ChevronDown className="h-5 w-5 shrink-0 text-[#1F6B3A] transition-transform group-open:rotate-180"/>
              </summary>
              <p className="pt-4 text-sm leading-8 text-[#607869]">{entry.a}</p>
            </details>)}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 pt-8 sm:px-8 lg:pb-24">
        <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-[2rem] bg-[#15482B] px-7 py-16 text-center text-white sm:px-14 sm:py-20">
          <div aria-hidden="true" className="absolute -left-24 -top-28 h-80 w-80 rounded-full border-[50px] border-white/[0.045]"/>
          <div aria-hidden="true" className="absolute -bottom-36 -right-14 h-96 w-96 rounded-full border-[55px] border-white/[0.045]"/>
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B3D8BE]" dir="ltr">{t.bottomEyebrow}</p>
            <h2 className="mx-auto mt-5 max-w-[810px] text-3xl font-extrabold leading-[1.35] sm:text-5xl">{t.bottomTitle}</h2>
            <p className="mx-auto mt-5 max-w-[620px] text-sm leading-8 text-[#D6EADB] sm:text-base">{t.bottomBody}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-4 text-sm font-extrabold text-[#1F6B3A] transition-colors hover:bg-[#EAF5ED]">{t.bottomCta}<ForwardArrow className="h-4 w-4"/></Link>
              <Link href="/login" className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white underline-offset-4 hover:underline">{t.bottomLogin}</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#E3ECE6] bg-[#FBFDFC] px-5 pb-8 pt-14 sm:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo small />
            <p className="mt-4 text-sm italic text-[#1F6B3A]" dir="ltr">{t.footerTag}</p>
            <p className="mt-3 text-sm leading-7 text-[#6E8374]">{t.footerAbout}</p>
          </div>
          <div>
            <h3 className="mb-5 text-sm font-bold text-[#173321]">{t.footerLinks}</h3>
            <div className="flex flex-col items-start gap-3 text-sm text-[#657F6D]">
              <a href="#how" className="hover:text-[#1F6B3A]">{t.navHow}</a>
              <a href="#faq" className="hover:text-[#1F6B3A]">{t.navFaq}</a>
              <Link href="/privacy" className="hover:text-[#1F6B3A]">{t.footerPrivacy}</Link>
              <Link href="/terms" className="hover:text-[#1F6B3A]">{t.footerTerms}</Link>
            </div>
          </div>
          <div>
            <h3 className="mb-5 text-sm font-bold">{t.footerContact}</h3>
            <div className="flex flex-col items-start gap-4 text-sm text-[#657F6D]">
              <a href="mailto:contact@herbalvitaly.com" dir="ltr" className="inline-flex items-center gap-2 hover:text-[#1F6B3A]"><Mail className="h-4 w-4"/>contact@herbalvitaly.com</a>
              <a href="https://herbalvitaly.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-[#1F6B3A]"><ArrowUpRight className="h-4 w-4"/>herbalvitaly.com</a>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-12 flex max-w-[1240px] flex-col justify-between gap-3 border-t border-[#E5EDE7] pt-6 text-xs text-[#8A9E8E] sm:flex-row">
          <p>© 2026 Herbal Vitaly. {t.footerRights}</p>
          <p>{t.footerNotice}</p>
        </div>
      </footer>
    </main>
  );
}
