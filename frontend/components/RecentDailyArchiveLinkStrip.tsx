import Link from 'next/link';
import { CalendarDays } from 'lucide-react';

export type RecentArchiveItem = {
  date: string;
  topHeadline?: string;
};

function formatDisplayDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

type Variant = 'landing' | 'trending';

export function RecentDailyArchiveLinkStrip({
  items,
  variant = 'trending',
  heading = 'Recent daily snapshots',
  intro = 'Open any day to see the full snapshot; day pages also link to each other for quick browsing.',
}: {
  items: RecentArchiveItem[];
  variant?: Variant;
  heading?: string;
  intro?: string;
}) {
  if (items.length === 0) return null;

  const card =
    variant === 'landing'
      ? 'rounded-[16px] border border-black/[0.06] bg-white/70 p-4 transition-all hover:border-black/10 hover:bg-white sm:p-5'
      : 'rounded-[16px] border border-border/[0.08] bg-surface/25 p-4 transition-all hover:border-border/20 hover:bg-surface/40 sm:p-5';

  const kicker = variant === 'landing' ? 'text-secondary/45' : 'text-secondary/35';
  const sub = variant === 'landing' ? 'text-secondary/50' : 'text-secondary/55';
  const hl = variant === 'landing' ? 'text-secondary/60' : 'text-secondary/55';

  return (
    <section
      className={variant === 'landing' ? '' : 'pt-2'}
      aria-label={heading}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.25em] ${kicker}`}>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={12} className="opacity-60" />
              {heading}
            </span>
          </p>
          <p className={`mt-1 max-w-2xl text-[13px] leading-relaxed ${sub}`}>{intro}</p>
        </div>
        <Link
          href="/daily"
          className="shrink-0 text-[12px] font-semibold text-foreground/50 transition-colors hover:text-foreground"
        >
          All archive days →
        </Link>
      </div>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.date}>
            <Link href={`/daily/${item.date}`} className={`block ${card}`}>
              <p className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                {formatDisplayDate(item.date)}
              </p>
              {item.topHeadline ? (
                <p className={`mt-1.5 line-clamp-2 text-[12px] leading-snug ${hl}`}>
                  {item.topHeadline}
                </p>
              ) : (
                <p className={`mt-1.5 text-[12px] ${hl}`}>Full-day tech snapshot and topic overviews</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
