'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3,
  Check, ChevronDown, ClipboardCheck, HeartHandshake, Link2, Menu,
  MessageCircle, Play, ShieldCheck, Sparkles, TicketPercent, X,
  Globe2, Leaf, PackageCheck, UsersRound,
} from 'lucide-react';
import { HERBAL_VITALY } from '@/components/brand/BrandIdentity';

type Language = 'en' | 'ar';
type Collection = 'signature' | 'women' | 'men' | 'wellbeing';

const products = [
  {
    id: 'tiynefret', name: 'TIYNEFRET', category: 'Beauty from within',
    arabicCategory: 'العناية بالجمال من الداخل',
    description: 'Daily nutritional support for hair, skin and nails.',
    arabicDescription: 'دعم غذائي يومي للشعر والبشرة والأظافر.',
    image: 'https://cdn.shopify.com/s/files/1/1003/9420/5506/files/Image_ChatGPT_9_oct._2026_03_29_41-9.png?v=1791513017',
    url: 'https://herbalvitaly.com/products/tiynefret', color: 'rose',
    collections: ['signature', 'women'],
  },
  {
    id: 'ushabti', name: 'USHABTI', category: 'Men’s vitality',
    arabicCategory: 'حيوية الرجل',
    description: 'Tribulus and black maca for everyday vitality.',
    arabicDescription: 'تريبولوس وماكا سوداء لدعم الحيوية.',
    image: 'https://cdn.shopify.com/s/files/1/1003/9420/5506/files/ChatGPT-Image-23-juin-2026_-04_19_01.webp?v=1782184805',
    url: 'https://herbalvitaly.com/products/ushabti', color: 'blue',
    collections: ['signature', 'men'],
  },
  {
    id: 'tut-flora', name: 'TUT FLORA', category: 'Digestive balance',
    arabicCategory: 'راحة وتوازن الهضم',
    description: 'Probiotic nutritional support for gut wellness.',
    arabicDescription: 'دعم غذائي بالبروبيوتيك لصحة الأمعاء.',
    image: 'https://cdn.shopify.com/s/files/1/1003/9420/5506/files/tut_flora_651x651_1e8e55b7-e70e-41a0-8ea5-5a5339370025.webp?v=1781925930',
    url: 'https://herbalvitaly.com/products/tut-flora', color: 'clay',
    collections: ['signature', 'wellbeing'],
  },
  {
    id: 'inomeri', name: 'INOMERI', category: 'Women’s wellbeing',
    arabicCategory: 'صحة المرأة',
    description: 'Myo-inositol and selected nutrients for women.',
    arabicDescription: 'مايو إينوزيتول وعناصر غذائية مختارة للمرأة.',
    image: 'https://cdn.shopify.com/s/files/1/1003/9420/5506/files/inomeri_651x651_3d29d180-cee8-42bc-a01e-99b9955b742f.webp?v=1781926334',
    url: 'https://herbalvitaly.com/products/inomeri', color: 'lilac',
    collections: ['women'],
  },
  {
    id: 'flexoria', name: 'FLEXORIA', category: 'Movement & joints',
    arabicCategory: 'المفاصل والحركة',
    description: 'Nutritional support for comfortable everyday movement.',
    arabicDescription: 'دعم غذائي لراحة الحركة اليومية.',
    image: 'https://cdn.shopify.com/s/files/1/1003/9420/5506/files/flexoria_651x651_3dfaee98-7a47-41e2-9293-855320050290.webp?v=1781926613',
    url: 'https://herbalvitaly.com/products/flexoria', color: 'blue',
    collections: ['wellbeing'],
  },
  {
    id: 'amuhotep', name: 'AMUHOTEP', category: 'Omega-3 nutrition',
    arabicCategory: 'دعم غذائي بأوميجا 3',
    description: 'Liquid omega-3 nutritional support.',
    arabicDescription: 'مكمل غذائي سائل بأحماض أوميجا 3.',
    image: 'https://cdn.shopify.com/s/files/1/1003/9420/5506/files/amuhotep_651x651_94eee8db-27c1-4ff4-9315-2a7e4853b192.webp?v=1781926189',
    url: 'https://herbalvitaly.com/products/amuhotep', color: 'blue',
    collections: ['wellbeing'],
  },
] as const;

const translations = {
  en: {
    navStory: 'About Herbal Vitaly', navProducts: 'Product Portfolio', navPartner: 'Partnership',
    navFaq: 'Resources', logIn: 'Sign In', join: 'Become a Partner',
    ariaMenu: 'Toggle navigation', languageName: 'English', alternative: 'العربية',
    eyebrow: 'THE HERBAL VITALY PARTNER JOURNAL · 01',
    heroTitle1: 'Wellness has', heroTitle2: 'a new story.', heroAccent: 'Yours.',
    heroText: 'Meet a contemporary Egyptian nutrition brand built around considered ingredients, everyday wellbeing and the people who share our story.',
    heroCta: 'Explore the partnership', heroAlt: 'Discover the collection',
    heroProof1: 'Creator Partnership', heroProofDesc1: 'Build, promote and grow with Herbal Vitaly.',
    heroProof2: 'Official Product Portfolio', heroProofDesc2: 'Our range of nutritional supplements.',
    heroProof3: 'Trusted Brand Story', heroProofDesc3: 'An Egyptian brand rooted in everyday wellness.',
    heroValueStrip: 'NUTRITIONAL WELLBEING   ·   EGYPTIAN NUTRITION BRAND   ·   GROWTH THROUGH PARTNERSHIP',
    issueLabel: 'THE BRAND / THE PEOPLE / THE PARTNERSHIP',
    heroIndex: 'A DIFFERENT KIND OF PARTNERSHIP',
    scroll: 'SCROLL TO EXPLORE',
    imageCaption: 'Thoughtful nutrition. Made for real life.',
    strip1: 'NATURE-LED THINKING', strip2: 'A GROWING WELLNESS COLLECTION',
    strip3: 'TOOLS FOR REAL PARTNERS',
    philosophyIndex: '01 / THE COMPANY', philosophyTag: 'Our point of view',
    philosophyTitle: 'Good wellbeing starts with thoughtful choices.',
    philosophyText: 'Herbal Vitaly develops a portfolio of nutritional supplements shaped by purposeful formulas, clear product information and a belief that everyday care should feel considered — not complicated.',
    philosophyQuote: 'Let nature be your medicine.',
    philosophySmall: 'A guiding philosophy, not a substitute for medical treatment.',
    philosophyLink: 'Get to know the brand',
    philosophyCardA: 'Nature as inspiration', philosophyCardB: 'People at the centre',
    productsIndex: '02 / THE COLLECTION', productsTag: 'The collection',
    productsTitle: 'A portfolio with a point of view.',
    productsText: 'Discover selected products from the official Herbal Vitaly store. Every product below uses its original Shopify imagery.',
    productsTabs: { signature: 'Selected stories', women: 'Women’s care', men: 'Men’s vitality', wellbeing: 'Everyday wellbeing' },
    viewProduct: 'Explore product', collectionLink: 'View the entire collection',
    productNotice: 'Food supplements support nutrition and do not replace a balanced diet or medical advice.',
    partnerIndex: '03 / THE PARTNERSHIP', partnerTag: 'The creator partnership',
    partnerTitle1: 'Your voice.', partnerTitle2: 'Our world.', partnerTitle3: 'One connection.',
    partnerText: 'We believe a great recommendation begins with trust. Our partner hub gives creators a practical way to share products and understand the journey from referral to eligible commission.',
    partnerPrimary: 'Join the partner program', partnerVideo: 'Watch the partner guide',
    partnerVideoNote: 'A short walkthrough of registration and the dashboard.',
    stepTitle: 'A partnership, without the guesswork.',
    steps: [
      { label: 'Create your place', description: 'Register your account and verify your email to enter the partner hub.' },
      { label: 'Make it personal', description: 'Choose an available promo code and collect your product-specific referral links.' },
      { label: 'Follow the journey', description: 'Review orders, delivery updates and eligible commissions in your dashboard.' },
    ],
    workspace: 'THE PARTNER DESK', workspaceSub: 'Built for clarity, not clutter.',
    workspaceItems: [
      { title: 'Personal promo codes', sub: 'Easy to share, tied to your account' },
      { title: 'Product & referral links', sub: 'A direct route to the collection' },
      { title: 'Order & delivery tracking', sub: 'Stay informed through each stage' },
      { title: 'Commission visibility', sub: 'Subject to order reconciliation' },
    ],
    workspaceFoot: 'The illustration describes features, not live results or guaranteed earnings.',
    voicesIndex: '04 / WHO IT’S FOR', voicesTag: 'People make the difference',
    voicesTitle: 'For creators who care what they recommend.',
    voicesText: 'Whether you talk about beauty rituals, everyday wellness, movement or lifestyle, a partnership should feel authentic to your audience. Tell a real story, in your own voice.',
    voicesNote: 'Program eligibility, discounts and commissions are governed by the current partner terms.',
    faqIndex: '05 / THE DETAILS', faqTag: 'Worth knowing',
    faqTitle: 'Good questions deserve clear answers.',
    faqs: [
      { q: 'How do I become a Herbal Vitaly partner?', a: 'Create a partner account, verify your email address and follow the onboarding steps. Participation remains subject to our program criteria.' },
      { q: 'Can I choose my own discount code?', a: 'Yes. After signing in, you can choose an available personal code, subject to Shopify availability and the applicable program configuration.' },
      { q: 'How do I know which orders count?', a: 'Your dashboard shows tracked orders and delivery information. Eligible commissions are confirmed according to the program rules, payment collection and delivery reconciliation.' },
      { q: 'Does an order automatically create a commission?', a: 'No. A placed order does not guarantee a commission or payment. Orders must satisfy the program’s eligibility and reconciliation rules.' },
      { q: 'Where can I get help?', a: 'Use the Support Center inside your account, or email contact@herbalvitaly.com.' },
    ],
    finalIndex: 'THE NEXT CHAPTER', finalHeadline: 'There’s room for your story.',
    finalBody: 'Join a community of people who want their recommendations to mean something.',
    finalCta: 'Create a partner account', finalLogin: 'Already a partner? Sign in',
    footerTagline: 'Let nature be your medicine', footerNote: 'Herbal Vitaly partner platform. Nutritional supplements and creator partnerships.',
    footerExplore: 'Explore', footerAccount: 'Your account', footerContact: 'Contact',
    footerStore: 'Herbal Vitaly Store', footerPrivacy: 'Privacy policy', footerTerms: 'Program terms',
    footerRights: '© 2026 Herbal Vitaly. All rights reserved.',
    footerDisclaimer: 'Eligible commissions are verified; no earnings are guaranteed.',
  },
  ar: {
    navStory: 'عن هيربال فيتالي', navProducts: 'منتجاتنا', navPartner: 'الشراكة',
    navFaq: 'الأسئلة الشائعة', logIn: 'تسجيل الدخول', join: 'انضم كشريك',
    ariaMenu: 'فتح القائمة', languageName: 'العربية', alternative: 'English',
    eyebrow: 'HERBAL VITALY · برنامج الشركاء',
    heroTitle1: 'للصحة حكاية', heroTitle2: 'جديدة.', heroAccent: 'حكايتك.',
    heroText: 'اكتشف علامة مصرية للمكملات الغذائية بتهتم باختيار المكونات، والعناية اليومية، والناس اللي بيشاركوا حكايتها.',
    heroCta: 'اكتشف الشراكة', heroAlt: 'شوف منتجاتنا',
    heroProof1: 'برنامج شركاء', heroProofDesc1: 'شارك جمهورك واكبر مع هيربال فيتالي.',
    heroProof2: 'منتجات أصلية', heroProofDesc2: 'مجموعة متنوعة من المكملات الغذائية.',
    heroProof3: 'علامة مصرية', heroProofDesc3: 'اهتمام حقيقي بالصحة اليومية.',
    heroValueStrip: 'دعم غذائي يومي   ·   علامة مصرية   ·   نمو من خلال الشراكة',
    issueLabel: 'العلامة / الناس / الشراكة', heroIndex: 'شراكة بطريقتنا',
    scroll: 'اكتشف أكتر',
    imageCaption: 'تغذية مدروسة. للحياة اليومية.',
    strip1: 'الطبيعة مصدر إلهامنا', strip2: 'تشكيلة متنوعة', strip3: 'أدوات حقيقية للشركاء',
    philosophyIndex: '01 / عن الشركة', philosophyTag: 'فلسفتنا',
    philosophyTitle: 'العناية اليومية بتبدأ باختيارات مدروسة.',
    philosophyText: 'هيربال فيتالي بتقدم مجموعة من المكملات الغذائية بتركيبات مختارة ومعلومات واضحة، انطلاقًا من فكرة إن الاهتمام اليومي بنفسك المفروض يكون أبسط.',
    philosophyQuote: 'Let nature be your medicine.',
    philosophySmall: 'فلسفة للعلامة، وليست بديلًا عن العلاج الطبي.',
    philosophyLink: 'اكتشف علامتنا',
    philosophyCardA: 'الطبيعة مصدر الإلهام', philosophyCardB: 'الناس في قلب اهتمامنا',
    productsIndex: '02 / المنتجات', productsTag: 'تشكيلة هيربال فيتالي',
    productsTitle: 'منتجات متنوعة. بفلسفة واحدة.',
    productsText: 'اختار من منتجات هيربال فيتالي على المتجر الرسمي. كل الصور أصلية من صفحات منتجات Shopify.',
    productsTabs: { signature: 'منتجات مختارة', women: 'العناية بالمرأة', men: 'حيوية الرجل', wellbeing: 'العناية اليومية' },
    viewProduct: 'اكتشف المنتج', collectionLink: 'كل المنتجات',
    productNotice: 'المكملات الغذائية مش بديل للأكل المتوازن أو النصيحة الطبية.',
    partnerIndex: '03 / الشراكة', partnerTag: 'برنامج صناع المحتوى',
    partnerTitle1: 'صوتك.', partnerTitle2: 'عالمنا.', partnerTitle3: 'شراكة حقيقية.',
    partnerText: 'بنؤمن إن الترشيح الجيد بيبدأ من الثقة. برنامج الشركاء بيساعدك تشارك المنتجات وتتابع رحلة كل طلب لحد تقييم العمولة المستحقة.',
    partnerPrimary: 'انضم للبرنامج', partnerVideo: 'فيديو شرح البرنامج',
    partnerVideoNote: 'شرح سريع للتسجيل ولوحة الشريك.',
    stepTitle: 'الشراكة خطوة بخطوة.',
    steps: [
      { label: 'اعمل حسابك', description: 'سجّل في برنامج الشركاء وفعّل بريدك الإلكتروني.' },
      { label: 'خلّيها خاصة بيك', description: 'اختار كود خصم متاح وخد روابط المنتجات الخاصة بيك.' },
      { label: 'تابع كل خطوة', description: 'راجع الطلبات وحالة الشحن والعمولات المؤهلة من حسابك.' },
    ],
    workspace: 'مساحة الشريك', workspaceSub: 'كل حاجة واضحة ومنظمة.',
    workspaceItems: [
      { title: 'كود خصم شخصي', sub: 'خاص بحسابك وسهل تشاركه' },
      { title: 'روابط المنتجات', sub: 'روابط ترويج لكل منتج' },
      { title: 'متابعة الطلبات', sub: 'تابع التوصيل وحالة الطلب' },
      { title: 'متابعة العمولات', sub: 'بعد التحقق من الطلبات والتسويات' },
    ],
    workspaceFoot: 'عرض توضيحي للمزايا، مش بيانات بيع حقيقية أو ضمان أرباح.',
    voicesIndex: '04 / الشركاء', voicesTag: 'الناس هي الأهم',
    voicesTitle: 'لصناع المحتوى اللي يهمهم اللي بيرشحوه.',
    voicesText: 'سواء محتواك عن الجمال، العناية اليومية، الرياضة أو الحياة الصحية، خلّي شراكتك صادقة مع جمهورك واحكي قصتك بأسلوبك.',
    voicesNote: 'أهلية الانضمام والخصومات والعمولات بتخضع لشروط البرنامج.',
    faqIndex: '05 / التفاصيل', faqTag: 'معلومات مهمة',
    faqTitle: 'أسئلة مهمة. إجابات واضحة.',
    faqs: [
      { q: 'إزاي أنضم لبرنامج الشركاء؟', a: 'أنشئ حساب شريك وفعّل بريدك الإلكتروني وكمل خطوات التسجيل. القبول بيخضع لشروط البرنامج.' },
      { q: 'ينفع أختار كود الخصم بنفسي؟', a: 'أيوه، بعد تسجيل الدخول تقدر تختار كود متاح حسب إعدادات البرنامج وتوفره على Shopify.' },
      { q: 'إزاي أعرف الطلبات المؤهلة؟', a: 'لوحة التحكم بتوضح الطلبات ومعلومات التوصيل. العمولات بتتحدد بعد التحقق من التحصيل والتسوية.' },
      { q: 'هل كل طلب عليه عمولة؟', a: 'مش تلقائي. لازم الطلب يستوفي شروط الاستحقاق والتسوية قبل احتساب العمولة.' },
      { q: 'أتواصل معاكم إزاي؟', a: 'افتح تذكرة دعم من حسابك أو ابعت على contact@herbalvitaly.com.' },
    ],
    finalIndex: 'الخطوة الجاية', finalHeadline: 'حكايتك ليها مكان معانا.',
    finalBody: 'انضم لبرنامج شراكة مبني على المحتوى الصادق والترشيحات الهادفة.',
    finalCta: 'أنشئ حساب شريك', finalLogin: 'عندك حساب؟ سجّل دخول',
    footerTagline: 'Let nature be your medicine', footerNote: 'منصة هيربال فيتالي للشركاء والمكملات الغذائية.',
    footerExplore: 'اكتشف', footerAccount: 'حسابك', footerContact: 'تواصل',
    footerStore: 'متجر هيربال فيتالي', footerPrivacy: 'الخصوصية', footerTerms: 'شروط البرنامج',
    footerRights: '© 2026 Herbal Vitaly. جميع الحقوق محفوظة.',
    footerDisclaimer: 'العمولات بتخضع للتحقق، ومفيش أرباح مضمونة.',
  },
} as const;

const benefitsIcons = [TicketPercent, Link2, ClipboardCheck, BarChart3];

function Reveal({ children, className = '', delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  return <div data-hv-reveal style={{ '--reveal-delay': delay + 'ms' } as React.CSSProperties} className={className}>{children}</div>;
}

function BrandLogo({ small = false }: { small?: boolean }) {
  return <img src={HERBAL_VITALY.logo} width={small ? 123 : 152}
    height={small ? 76 : 92} alt="Herbal Vitaly — Let nature be your medicine"
    className={small ? 'hv-brand-logo hv-brand-logo--small' : 'hv-brand-logo'} />;
}

export default function PartnerLanding() {
  // English is the default first-visit language, Arabic is an accessible alternative.
  const [language, setLanguage] = useState<Language>('en');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCollection, setActiveCollection] = useState<Collection>('signature');
  const [scrolled, setScrolled] = useState(false);
  const t = translations[language];
  const arabic = language === 'ar';
  const ForwardArrow = arabic ? ArrowLeft : ArrowRight;
  const collections: Collection[] = ['signature', 'women', 'men', 'wellbeing'];
  const displayedProducts = products.filter(item => (item.collections as readonly string[]).includes(activeCollection));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Introduce only restrained, accessible motion. Content stays readable
    // without JavaScript, IntersectionObserver or if reduced motion is preferred.
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-hv-reveal]'));
    if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.06, rootMargin: '0px 0px -35px 0px' });
    nodes.forEach(node => observer.observe(node));
    requestAnimationFrame(() => document.documentElement.classList.add('hv-enhanced-motion'));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('hv-enhanced-motion');
    };
  }, [language, activeCollection]);

  const closeMenu = () => setMenuOpen(false);

  return <main className="hv-editorial" dir={arabic ? 'rtl' : 'ltr'} lang={language}>
    <a href="#content" className="hv-skip">{arabic ? 'اذهب للمحتوى' : 'Skip to content'}</a>

    <header className={`hv-header ${scrolled ? 'hv-header--scrolled' : ''}`}>
      <div className="hv-header-inner">
        <Link href="/" className="hv-header-logo" aria-label="Herbal Vitaly homepage" onClick={closeMenu}>
          <BrandLogo />
        </Link>
        <nav className="hv-main-nav" aria-label="Main navigation">
          <a href="#philosophy">{t.navStory}</a>
          <a href="#collection">{t.navProducts}</a>
          <a href="#partnership">{t.navPartner}</a>
          <a href="#questions">{t.navFaq}</a>
        </nav>
        <div className="hv-header-actions">
          <button type="button" className="hv-language" onClick={() => { setLanguage(arabic ? 'en' : 'ar'); closeMenu(); }}
            aria-label={arabic ? 'Switch to English' : 'التبديل إلى العربية'}>
            <Globe2 size={17} aria-hidden="true" /><span>{language.toUpperCase()}</span><ChevronDown size={13} aria-hidden="true" />
          </button>
          <Link className="hv-header-signin" href="/login">{t.logIn}</Link>
          <Link className="hv-button hv-button--small" href="/register">{t.join}<ForwardArrow size={15} aria-hidden="true"/></Link>
          <button className="hv-menu-button" type="button" aria-expanded={menuOpen} aria-controls="hv-mobile-navigation"
            aria-label={t.ariaMenu} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={22}/> : <Menu size={22}/>}
          </button>
        </div>
      </div>
      {menuOpen && <nav className="hv-mobile-nav" id="hv-mobile-navigation" aria-label="Mobile navigation">
        <a onClick={closeMenu} href="#philosophy">{t.navStory}</a>
        <a onClick={closeMenu} href="#collection">{t.navProducts}</a>
        <a onClick={closeMenu} href="#partnership">{t.navPartner}</a>
        <a onClick={closeMenu} href="#questions">{t.navFaq}</a>
        <Link onClick={closeMenu} href="/login">{t.logIn}</Link>
        <Link onClick={closeMenu} href="/register">{t.join}<ForwardArrow size={17}/></Link>
      </nav>}
    </header>

    <section className="hv-hero hv-hero-v2" id="content" aria-labelledby="hv-hero-title">
      <div className="hv-hero-rail" aria-hidden="true"><span>HERBAL VITALY</span><span>THE PARTNER JOURNAL</span><span>01 — 05</span></div>
      <div className="hv-hero-content">
        <Reveal className="hv-hero-copy">
          <div className="hv-eyebrow"><span className="hv-eyebrow-line"/>{t.eyebrow}</div>
          <h1 id="hv-hero-title" className="hv-display-title">{t.heroTitle1}<br/>{t.heroTitle2}<br/><em>{t.heroAccent}</em></h1>
          <p className="hv-hero-description">{t.heroText}</p>
          <div className="hv-action-row">
            <a className="hv-button" href="#partnership">{t.heroCta}<ForwardArrow size={18} aria-hidden="true"/></a>
            <a className="hv-text-link" href="#collection">{t.heroAlt}<ForwardArrow size={18} aria-hidden="true"/></a>
          </div>
          <div className="hv-hero-trust" aria-label={arabic ? 'مميزات الشراكة' : 'Reasons to partner with Herbal Vitaly'}>
            <div className="hv-hero-trust-item">
              <UsersRound size={30} strokeWidth={1.6} aria-hidden="true"/>
              <span><strong>{t.heroProof1}</strong><small>{t.heroProofDesc1}</small></span>
            </div>
            <div className="hv-hero-trust-item">
              <PackageCheck size={30} strokeWidth={1.6} aria-hidden="true"/>
              <span><strong>{t.heroProof2}</strong><small>{t.heroProofDesc2}</small></span>
            </div>
            <div className="hv-hero-trust-item">
              <ShieldCheck size={30} strokeWidth={1.6} aria-hidden="true"/>
              <span><strong>{t.heroProof3}</strong><small>{t.heroProofDesc3}</small></span>
            </div>
          </div>
        </Reveal>
        <Reveal className="hv-hero-art" delay={120}>
          <div className="hv-hero-art-plate">
            <span className="hv-art-number">HERBAL VITALY / 001</span>
            <div className="hv-hero-art-arc" aria-hidden="true"/>
            <div className="hv-hero-window-shadow" aria-hidden="true"/>
            <div className="hv-hero-botanical hv-hero-botanical--left" aria-hidden="true">
              <Leaf/><Leaf/><Leaf/><Leaf/>
            </div>
            <div className="hv-hero-stage">
              <div className="hv-hero-stage-podium hv-hero-stage-podium--wide" aria-hidden="true"/>
              <div className="hv-hero-stage-podium hv-hero-stage-podium--small" aria-hidden="true"/>
              <a className="hv-hero-product hv-hero-product--tiynefret" href={products[0].url} target="_blank" rel="noopener noreferrer" aria-label="Explore TIYNEFRET in the official Herbal Vitaly store">
                <img src={products[0].image} width="540" height="540" alt="Original TIYNEFRET packaging — hair, skin and nails food supplement" fetchPriority="high" />
              </a>
              <a className="hv-hero-product hv-hero-product--ushabti" href={products[1].url} target="_blank" rel="noopener noreferrer" aria-label="Explore USHABTI in the official Herbal Vitaly store">
                <img src={products[1].image} width="380" height="380" alt="Original blue USHABTI bottle with orange cap" />
              </a>
              <span className="hv-stage-leaf hv-stage-leaf--one" aria-hidden="true"><Leaf/></span>
              <span className="hv-stage-leaf hv-stage-leaf--two" aria-hidden="true"><Leaf/></span>
            </div>
            <span className="hv-art-vertical" aria-hidden="true">{t.heroIndex}</span>
          </div>
        </Reveal>
      </div>
      <div className="hv-hero-signature">
        <span className="hv-hero-signature-rule" aria-hidden="true"/>
        <Leaf size={17} strokeWidth={1.5} aria-hidden="true"/>
        <span>{t.heroValueStrip}</span>
        <span className="hv-hero-signature-rule" aria-hidden="true"/>
      </div>
      <div className="hv-hero-footline" aria-hidden="true" />
    </section>

    <div className="hv-editorial-marquee" aria-label="Herbal Vitaly values">
      {[t.strip1,t.strip2,t.strip3].map((label,i)=><div key={label} className="hv-marquee-item"><span className="hv-asterisk" aria-hidden="true">✳</span><span>{label}</span>{i!==2 && <span className="hv-marquee-rule" aria-hidden="true"/>}</div>)}
    </div>

    <section className="hv-section hv-philosophy" id="philosophy">
      <div className="hv-section-marker">{t.philosophyIndex}<span className="hv-marker-rule"/></div>
      <div className="hv-philosophy-grid">
        <Reveal className="hv-section-lead">
          <span className="hv-kicker">{t.philosophyTag}</span>
          <h2 className="hv-heading hv-heading--editorial">{t.philosophyTitle}</h2>
        </Reveal>
        <Reveal className="hv-philosophy-right" delay={100}>
          <p className="hv-big-paragraph">{t.philosophyText}</p>
          <a href="https://herbalvitaly.com" target="_blank" rel="noopener noreferrer" className="hv-text-link">
            {t.philosophyLink}<ArrowUpRight size={18} aria-hidden="true"/>
          </a>
          <div className="hv-philosophy-notes">
            <div><Sparkles size={25} aria-hidden="true"/><span>{t.philosophyCardA}</span></div>
            <div><HeartHandshake size={25} aria-hidden="true"/><span>{t.philosophyCardB}</span></div>
          </div>
        </Reveal>
      </div>
      <Reveal className="hv-philosophy-quote">
        <span aria-hidden="true" className="hv-quote-mark">“</span>
        <blockquote>{t.philosophyQuote}</blockquote>
        <span>{t.philosophySmall}</span>
      </Reveal>
    </section>

    <section className="hv-section hv-collection" id="collection">
      <div className="hv-section-marker">{t.productsIndex}<span className="hv-marker-rule"/></div>
      <Reveal className="hv-section-intro">
        <div>
          <span className="hv-kicker">{t.productsTag}</span>
          <h2 className="hv-heading">{t.productsTitle}</h2>
        </div>
        <p>{t.productsText}</p>
      </Reveal>
      <div className="hv-collection-tabs" role="group" aria-label="Product categories">
        {collections.map((item,i)=><button type="button" key={item}
          aria-pressed={activeCollection===item}
          className={`hv-collection-tab ${activeCollection===item?'hv-collection-tab--active':''}`}
          onClick={()=>setActiveCollection(item)}>
          <span className="hv-tab-number">0{i+1}</span>{t.productsTabs[item]}
        </button>)}
      </div>
      <div className="hv-product-grid" aria-live="polite">
        {displayedProducts.map((product,i)=><article key={product.id} className="hv-product-card" data-tone={product.color}>
          <div className="hv-product-image-wrap">
            <span className="hv-product-index">HV / 0{i+1}</span>
            <a href={product.url} target="_blank" rel="noopener noreferrer" aria-label={`${t.viewProduct}: ${product.name}`}>
              <img src={product.image} alt={`${product.name} — official Herbal Vitaly product image`} loading="lazy" width="430" height="430" />
            </a>
            <span className="hv-product-category">{arabic?product.arabicCategory:product.category}</span>
          </div>
          <div className="hv-product-card-meta">
            <div><h3>{product.name}</h3><p>{arabic?product.arabicDescription:product.description}</p></div>
            <a href={product.url} target="_blank" rel="noopener noreferrer"
              aria-label={`${t.viewProduct}: ${product.name}`}><ArrowUpRight size={21} aria-hidden="true"/></a>
          </div>
        </article>)}
      </div>
      <div className="hv-collection-footer">
        <p>{t.productNotice}</p>
        <a href="https://herbalvitaly.com/collections/all" target="_blank" rel="noopener noreferrer" className="hv-text-link">{t.collectionLink}<ArrowUpRight size={18}/></a>
      </div>
    </section>

    <section className="hv-partnership" id="partnership">
      <div className="hv-partnership-shell">
        <div className="hv-section-marker hv-section-marker--light">{t.partnerIndex}<span className="hv-marker-rule"/></div>
        <div className="hv-partnership-grid">
          <Reveal className="hv-partnership-copy">
            <span className="hv-kicker hv-kicker--light">{t.partnerTag}</span>
            <h2 className="hv-partnership-heading">{t.partnerTitle1}<br/>{t.partnerTitle2}<br/><em>{t.partnerTitle3}</em></h2>
            <p>{t.partnerText}</p>
            <div className="hv-action-row">
              <Link href="/register" className="hv-button hv-button--light">{t.partnerPrimary}<ForwardArrow size={18}/></Link>
              <a className="hv-video-link" href="https://www.youtube.com/watch?v=1O3iYU1I-EQ" target="_blank" rel="noopener noreferrer"><Play size={15}/>{t.partnerVideo}</a>
            </div>
            <small>{t.partnerVideoNote}</small>
          </Reveal>
          <Reveal className="hv-workspace" delay={110}>
            <div className="hv-workspace-header"><span className="hv-workspace-dot"/><span>{t.workspace}</span><span aria-hidden="true">↗</span></div>
            <div className="hv-workspace-content">
              <p className="hv-workspace-sub">{t.workspaceSub}</p>
              {t.workspaceItems.map((item,i)=>{
                const Icon=benefitsIcons[i];
                return <div key={item.title} className="hv-workspace-row">
                  <span className="hv-workspace-number">0{i+1}</span>
                  <span className="hv-workspace-row-text"><strong>{item.title}</strong><small>{item.sub}</small></span>
                  <Icon size={20} aria-hidden="true"/>
                </div>;
              })}
              <p className="hv-workspace-disclaimer">{t.workspaceFoot}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>

    <section className="hv-section hv-process" id="how">
      <Reveal className="hv-process-head"><span className="hv-kicker">THE METHOD / 001 — 003</span><h2 className="hv-heading">{t.stepTitle}</h2></Reveal>
      <div className="hv-process-grid">
        {t.steps.map((step,i)=><Reveal key={step.label} className="hv-process-step" delay={i*70}>
          <span className="hv-process-number">0{i+1}</span>
          <div className="hv-process-line" aria-hidden="true"><span/></div>
          <h3>{step.label}</h3>
          <p>{step.description}</p>
        </Reveal>)}
      </div>
    </section>

    <section className="hv-voices">
      <div className="hv-voices-inner">
        <Reveal className="hv-voices-text">
          <div className="hv-section-marker">{t.voicesIndex}<span className="hv-marker-rule"/></div>
          <span className="hv-kicker">{t.voicesTag}</span>
          <h2 className="hv-heading hv-heading--editorial">{t.voicesTitle}</h2>
          <p>{t.voicesText}</p>
          <small><ShieldCheck size={16}/>{t.voicesNote}</small>
        </Reveal>
        <Reveal className="hv-voices-art" delay={120}>
          <div className="hv-voices-shape" aria-hidden="true"/>
          <div className="hv-voices-art-inner">
            <div className="hv-voices-art-seal"><BadgeCheck size={28}/><span>HERBAL<br/>VITALY</span></div>
            <span className="hv-voices-art-type">PEOPLE FIRST.<br/><em>ALWAYS.</em></span>
            <span className="hv-voices-art-foot">NATURE / PURPOSE / COMMUNITY</span>
          </div>
        </Reveal>
      </div>
    </section>

    <section className="hv-section hv-faq" id="questions">
      <div className="hv-section-marker">{t.faqIndex}<span className="hv-marker-rule"/></div>
      <div className="hv-faq-grid">
        <Reveal className="hv-faq-lead"><span className="hv-kicker">{t.faqTag}</span><h2 className="hv-heading">{t.faqTitle}</h2></Reveal>
        <div className="hv-faq-list">
          {t.faqs.map((item,i)=><details key={item.q} className="hv-faq-item">
            <summary><span className="hv-faq-number">0{i+1}</span><span>{item.q}</span><ChevronDown size={20}/></summary>
            <div className="hv-faq-answer"><p>{item.a}</p></div>
          </details>)}
        </div>
      </div>
    </section>

    <section className="hv-final-cta">
      <Reveal className="hv-final-inner">
        <span className="hv-kicker">{t.finalIndex}</span>
        <h2>{t.finalHeadline}</h2>
        <p>{t.finalBody}</p>
        <div className="hv-final-actions">
          <Link href="/register" className="hv-button">{t.finalCta}<ForwardArrow size={18}/></Link>
          <Link href="/login" className="hv-text-link">{t.finalLogin}<ArrowUpRight size={18}/></Link>
        </div>
      </Reveal>
      <div className="hv-final-monogram" aria-hidden="true">HV</div>
    </section>

    <footer className="hv-footer">
      <div className="hv-footer-top">
        <div className="hv-footer-brand"><Link href="/" aria-label="Home"><BrandLogo small/></Link>
          <p>{t.footerTagline}</p><small>{t.footerNote}</small></div>
        <div className="hv-footer-col"><h3>{t.footerExplore}</h3>
          <a href="#philosophy">{t.navStory}</a><a href="#collection">{t.navProducts}</a>
          <a href="#partnership">{t.navPartner}</a><a href="https://herbalvitaly.com" target="_blank" rel="noopener noreferrer">{t.footerStore}</a></div>
        <div className="hv-footer-col"><h3>{t.footerAccount}</h3>
          <Link href="/register">{t.join}</Link><Link href="/login">{t.logIn}</Link>
          <Link href="/privacy">{t.footerPrivacy}</Link><Link href="/terms">{t.footerTerms}</Link></div>
        <div className="hv-footer-col"><h3>{t.footerContact}</h3>
          <a href="mailto:contact@herbalvitaly.com">contact@herbalvitaly.com</a>
          <a href="https://herbalvitaly.com" target="_blank" rel="noopener noreferrer">herbalvitaly.com<ArrowUpRight size={13}/></a>
          <a href="https://www.youtube.com/watch?v=1O3iYU1I-EQ" target="_blank" rel="noopener noreferrer">{t.partnerVideo}<ArrowUpRight size={13}/></a></div>
      </div>
      <div className="hv-footer-bottom"><span>{t.footerRights}</span><span>{t.footerDisclaimer}</span></div>
    </footer>
  </main>;
}
