import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import { getDailyArchiveEntries } from '@/lib/daily-archive';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Daily News Archive | Trace',
  description:
    'Browse Trace daily archives of past tech story roundups and topic overviews. Access previous-day snapshots in one place.',
  alternates: {
    canonical: 'https://www.yourtrace.online/daily',
  },
  openGraph: {
    title: 'Daily News Archive | Trace',
    description:
      'Past daily snapshots of grouped tech stories and topic overviews from Trace.',
    url: 'https://www.yourtrace.online/daily',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Daily News Archive | Trace',
    description:
      'Browse previous-day Trace snapshots for grouped stories and topic overviews.',
  },
};

function formatDateLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatWeekday(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(parsed);
}

export default async function DailyArchiveIndexPage() {
  const entries = await getDailyArchiveEntries(365);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="mx-auto max-w-7xl pt-20 pb-14 sm:pt-28 sm:pb-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">Trace Archive</p>
          <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[3.5rem]">
            Daily snapshots
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-secondary">
            Every day, Trace captures the full picture — stories, discussions, and launches — and archives it here. Browse any past day to see what shaped the conversation.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {[
              { href: '/trending', label: 'Trending' },
              { href: '/research', label: 'Research' },
              { href: '/compare', label: 'Compare' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-border/[0.08] px-3.5 py-1.5 text-[12px] font-medium text-secondary/60 transition-all hover:text-foreground hover:border-border/20"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Archive list */}
        <section className="mx-auto max-w-7xl pb-20">
          {entries.length === 0 ? (
            <div className="rounded-[20px] border border-border/[0.08] bg-surface/30 p-12 text-center">
              <p className="text-[15px] font-semibold">No archived snapshots yet</p>
              <p className="mt-2 text-[13px] text-secondary/60">Check back tomorrow for your first daily archive.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry, i) => (
                <Link
                  key={entry.date}
                  href={`/daily/${entry.date}`}
                  className="group rounded-[16px] border border-border/[0.06] bg-surface/30 p-5 transition-all hover:bg-surface/60 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-border/15"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[15px] font-semibold tracking-[-0.01em]">{formatShortDate(entry.date)}</p>
                        <span className="text-[11px] text-secondary/35">{formatWeekday(entry.date)}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] text-secondary/50">
                        {entry.trendingCount} stories · {entry.topicCount} topics
                      </p>
                      {entry.topHeadline && (
                        <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-secondary/70">{entry.topHeadline}</p>
                      )}
                    </div>
                    <ArrowRight size={14} className="mt-1 shrink-0 text-secondary/20 transition-all group-hover:text-foreground/50 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
