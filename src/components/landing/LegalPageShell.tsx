import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { HERBAL_VITALY } from '@/components/brand/BrandIdentity';

export default function LegalPageShell({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#FBFDFC] text-[#173321]">
    <header className="border-b border-[#E0EBE4] bg-white">
      <div className="mx-auto flex max-w-[1050px] items-center justify-between gap-4 px-5 py-4">
        <Link href="/" aria-label="Back to Herbal Vitaly Affiliate homepage">
          <img src={HERBAL_VITALY.logo} alt="Herbal Vitaly" width={140} height={76} className="h-[60px] w-auto object-contain"/>
        </Link>
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-[#DCE9E1] px-4 py-2.5 text-sm font-bold text-[#1F6B3A] hover:bg-[#F2F9F4]"><ArrowLeft className="h-4 w-4"/>Back to homepage</Link>
      </div>
    </header>
    <main className="mx-auto max-w-[860px] px-5 py-12 sm:py-20">
      <div className="mb-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#1F6B3A]">HERBAL VITALY AFFILIATE HUB</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-[#708477]">{subtitle}</p>
      </div>
      <article className="space-y-8 rounded-[1.5rem] border border-[#E0EAE3] bg-white p-6 text-sm leading-8 text-[#536E5C] shadow-sm sm:p-10">
        {children}
      </article>
    </main>
    <footer className="border-t border-[#E0EBE4] bg-white px-5 py-7 text-center text-sm text-[#627A69]">
      <a href="mailto:contact@herbalvitaly.com" className="inline-flex items-center gap-2 hover:text-[#1F6B3A]"><Mail className="h-4 w-4"/>contact@herbalvitaly.com</a>
      <p className="mt-2">© 2026 Herbal Vitaly · Let nature be your medicine</p>
    </footer>
  </div>;
}
