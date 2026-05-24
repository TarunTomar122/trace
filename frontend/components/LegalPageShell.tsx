import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';

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
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />

      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-3xl pt-16 pb-10 sm:pt-24 sm:pb-14">
          <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">Legal</p>
          <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.25rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-5 text-[16px] leading-[1.8] text-[#6b7280]">{subtitle}</p>
          ) : null}
          <nav className="mt-8 flex flex-wrap gap-2" aria-label="Legal pages">
            {tabs.map((tab) =>
              activeTab === tab.id ? (
                <span
                  key={tab.id}
                  className="rounded-full bg-[#111827] px-4 py-2 text-[13px] font-medium text-white"
                >
                  {tab.label}
                </span>
              ) : (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-[13px] font-medium text-[#6b7280] transition-colors hover:border-[#d1d5db] hover:text-[#111827]"
                >
                  {tab.label}
                </Link>
              ),
            )}
          </nav>
        </section>

        <section className="mx-auto max-w-3xl pb-20">
          <div className="landing-card p-6 sm:p-10">{children}</div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
