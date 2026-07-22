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
    <div className="min-h-screen bg-[#faf9f5] text-[#1b1a17]">
      <header className="mx-auto flex max-w-[880px] items-center justify-between border-b border-[#e4e1d8] px-5 py-4 sm:px-8">
        <Link href="/feed" className="font-mono text-[12.5px] font-bold tracking-[0.28em]">TRACE</Link>
        <nav className="flex items-center gap-5 text-[13px] font-medium text-[#75705f]">
          <Link className="transition-opacity hover:opacity-70" href="/feed">Edition</Link>
          <Link className="transition-opacity hover:opacity-70" href="/feed?view=pulse">Pulse</Link>
          <Link className="transition-opacity hover:opacity-70" href="/profile">Profile</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[880px] px-5 sm:px-8">
        <section className="pb-10 pt-14 sm:pb-14 sm:pt-20">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2557d6]">Trace · Legal</p>
          <h1 className="mt-5 font-serif text-[3.5rem] leading-[0.94] tracking-[-0.03em] sm:text-[5rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-6 max-w-xl text-[16px] leading-[1.7] text-[#75705f]">{subtitle}</p>
          ) : null}
          <nav className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-y border-[#e4e1d8] py-4 text-[13px] font-medium" aria-label="Legal pages">
            {tabs.map((tab) =>
              activeTab === tab.id ? (
                <span
                  key={tab.id}
                  className="text-[#2557d6] underline decoration-[#2557d6] underline-offset-[5px]"
                >
                  {tab.label}
                </span>
              ) : (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className="text-[#75705f] transition-colors hover:text-[#2557d6]"
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
