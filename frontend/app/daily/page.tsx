import type { Metadata } from 'next';
import Link from 'next/link';
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

export default async function DailyArchiveIndexPage() {
  const entries = await getDailyArchiveEntries(365);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-5xl pt-24 pb-20 sm:pt-32">
          <p className="text-[11px] uppercase tracking-[0.24em] text-secondary/45">Trace Archive</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Daily snapshots</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-secondary">
            Explore previous-day snapshots of stories and topic overviews. Today&apos;s date is intentionally excluded from this archive.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <Link href="/trending" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">Trending</Link>
            <Link href="/research" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">Research</Link>
            <Link href="/compare" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">Compare</Link>
            <Link href="/tools" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">Tools</Link>
          </div>

          <div className="mt-10 rounded-3xl border border-border/20 bg-white p-6 shadow-sm dark:bg-gray-950">
            {entries.length === 0 ? (
              <p className="text-sm text-secondary">No archived daily snapshots yet.</p>
            ) : (
              <ul className="space-y-4">
                {entries.map((entry) => (
                  <li key={entry.date}>
                    <Link
                      href={`/daily/${entry.date}`}
                      className="group block rounded-2xl border border-border/15 bg-background p-4 transition-colors hover:border-border/35"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold">{formatDateLabel(entry.date)}</p>
                          <p className="mt-1 text-xs text-secondary/60">
                            {entry.trendingCount} stories · {entry.topicCount} topics
                          </p>
                          {entry.topHeadline && (
                            <p className="mt-2 line-clamp-2 text-sm text-secondary/75">{entry.topHeadline}</p>
                          )}
                        </div>
                        <span className="text-xs font-medium text-secondary/50 group-hover:text-foreground">
                          Open
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
