import type { Metadata } from 'next';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import { getDailyArchiveEntries, type DailyArchiveEntry } from '@/lib/daily-archive';

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

function formatListDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function monthHeadingKey(ym: string): string {
  const [y, m] = ym.split('-');
  const d = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, 1));
  if (Number.isNaN(d.getTime())) return ym;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

function groupByMonthNewestFirst(entries: DailyArchiveEntry[]): { ym: string; label: string; items: DailyArchiveEntry[] }[] {
  const map = new Map<string, DailyArchiveEntry[]>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    if (!ym || ym.length !== 7) continue;
    if (!map.has(ym)) map.set(ym, []);
    map.get(ym)!.push(e);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([ym, items]) => ({
      ym,
      label: monthHeadingKey(ym),
      items: [...items].sort((a, b) => b.date.localeCompare(a.date)),
    }));
}

export default async function DailyArchiveIndexPage() {
  const entries = await getDailyArchiveEntries(365);
  const sections = groupByMonthNewestFirst(entries);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main>
        <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.45em] text-secondary/50">
            Trace
          </p>
          <h1 className="mt-3 text-center text-2xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-[1.75rem]">
            Daily archive index
          </h1>
          <p className="mt-3 text-center text-[14px] leading-relaxed text-secondary/65">
            Every public daily issue, newest first. Open any date for the full newsletter.
          </p>
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-y border-border/15 py-3 text-[12px] text-secondary/55" aria-label="Other sections">
            <Link className="font-medium transition-colors hover:text-foreground" href="/trending">Trending</Link>
            <span className="text-border/40" aria-hidden>·</span>
            <Link className="font-medium transition-colors hover:text-foreground" href="/research">Research</Link>
            <span className="text-border/40" aria-hidden>·</span>
            <Link className="font-medium transition-colors hover:text-foreground" href="/compare">Compare</Link>
          </nav>

          {entries.length === 0 ? (
            <p className="mt-12 text-center text-sm text-secondary/50">No archived issues yet.</p>
          ) : (
            <div className="mt-10 space-y-0">
              {sections.map((section) => (
                <section key={section.ym} className="border-t border-border/20 pt-10 first:border-0 first:pt-0">
                  <h2 className="mb-0 px-0 pb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-secondary/50">
                    {section.label}
                  </h2>
                  <ol className="m-0 list-none border-t border-border/12 p-0" role="list" aria-label={`Issues in ${section.label}`}>
                    {section.items.map((entry) => (
                      <li key={entry.date} className="border-b border-border/10 last:border-b-0">
                        <Link
                          href={`/daily/${entry.date}`}
                          className="block py-3.5 no-underline transition-colors hover:bg-foreground/[0.02] sm:py-4 -mx-2 sm:-mx-3 px-2 sm:px-3 rounded-sm group"
                        >
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                            <span className="order-1 text-[15px] font-medium leading-snug text-foreground group-hover:underline group-hover:decoration-foreground/30 group-hover:underline-offset-2">
                              {formatListDate(entry.date)}
                            </span>
                            <span className="order-2 shrink-0 text-[11px] text-secondary/45 sm:order-2 sm:text-right tabular-nums">
                              {entry.trendingCount} stories · {entry.topicCount} topics
                            </span>
                          </div>
                          {entry.topHeadline ? (
                            <p className="mt-1.5 pl-0 text-[12px] leading-snug text-secondary/50 line-clamp-2">
                              {entry.topHeadline}
                            </p>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}

          <p className="mt-10 text-center text-[11px] text-secondary/40">
            {entries.length} {entries.length === 1 ? 'issue' : 'issues'} in this index
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
