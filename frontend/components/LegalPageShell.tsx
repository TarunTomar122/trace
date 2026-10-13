import Link from 'next/link';
import FeedFooter from '@/components/FeedFooter';

export type LegalTab = 'privacy' | 'terms' | 'contact' | 'delete-account';

const BASE_TABS: { id: LegalTab; href: string; label: string }[] = [
  { id: 'privacy', href: '/privacy-policy', label: 'Privacy' },
  { id: 'terms', href: '/terms', label: 'Terms' },
  { id: 'contact', href: '/contact', label: 'Contact' },
];

export default function LegalPageShell({
  activeTab,
  title,
  subtitle,
  children,
  showDeleteTab = false,
}: {
  activeTab: LegalTab;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showDeleteTab?: boolean;
}) {
  const tabs = showDeleteTab
    ? [...BASE_TABS, { id: 'delete-account' as const, href: '/delete-account', label: 'Delete Account' }]
    : BASE_TABS;

  return (
    <div className="min-h-screen bg-white text-[#0f1419]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <header className="mx-auto flex max-w-[880px] items-center justify-between border-b border-[#eff3f4] px-5 py-4 sm:px-8">
        <a href="/feed" className="flex items-center gap-2"><img src="/trace.webp" alt="Trace" className="h-6 w-auto" /><span className="text-[17px] font-extrabold tracking-[-0.02em]">Trace</span></a>
        <nav className="flex items-center gap-5 text-[13px] font-medium text-[#75705f]">
          <a className="transition-opacity hover:opacity-70" href="/feed">Feed</a>
          <Link className="transition-opacity hover:opacity-70" href="/feed">Profile</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[880px] px-5 sm:px-8">
        <section className="pb-10 pt-14 sm:pb-14 sm:pt-20">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1d9bf0]">Trace · Legal</p>
          <h1 className="mt-4 text-[clamp(2rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-5 max-w-xl text-[16px] leading-[1.7] text-[#536471]">{subtitle}</p>
          ) : null}
          <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-y border-[#eff3f4] py-4 text-[13px] font-medium" aria-label="Legal pages">
            {tabs.map((tab) =>
              activeTab === tab.id ? (
                <span
                  key={tab.id}
                  className="text-[#1d9bf0] underline decoration-[#1d9bf0] underline-offset-[5px]"
                >
                  {tab.label}
                </span>
              ) : (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className="text-[#536471] transition-colors hover:text-[#1d9bf0]"
                >
                  {tab.label}
                </Link>
              ),
            )}
          </nav>
        </section>

        <section className="legal-content pb-20">
          <div className="border-t border-[#e4e1d8] pt-8 sm:pt-10">{children}</div>
        </section>
      </main>

      <FeedFooter stocksBrewMedium="legal_footer" />
    </div>
  );
}
