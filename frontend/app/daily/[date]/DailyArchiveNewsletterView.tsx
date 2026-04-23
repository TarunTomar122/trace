import Link from 'next/link';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { decodeHtmlEntities, getArticleSummary, stripMarkdown } from '@/lib/feed-article-text';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';

function formatNavDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function storySummaryText(item: FeedItem): string {
  const s = getArticleSummary(item);
  if (s.trim()) return s;
  const w = item.summary?.short_article?.why_it_matters;
  if (typeof w === 'string' && w.trim()) return stripMarkdown(w);
  return '';
}

function topicSummaryText(topic: TrendingTopic): string {
  return stripMarkdown((topic.summary || '').trim());
}

type Neighbours = { older: string | null; newer: string | null };

type Props = {
  longDateLabel: string;
  /** Short ISO for metadata line, e.g. 2026-03-02 */
  isoDate: string;
  assembledAtLabel: string | null;
  trending: FeedItem[];
  trendingTopics: TrendingTopic[];
  neighbours: Neighbours;
};

export default function DailyArchiveNewsletterView({
  longDateLabel,
  isoDate,
  assembledAtLabel,
  trending,
  trendingTopics,
  neighbours,
}: Props) {
  const stories = trending.slice(0, 45);

  return (
    <div className="bg-background">
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14 lg:px-0">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.45em] text-secondary/50">
          Trace
        </p>
        <h1 className="mt-3 text-center text-2xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-[1.75rem]">
          {longDateLabel}
        </h1>
        <p className="mt-3 text-center text-[14px] leading-relaxed text-secondary/65">
          Daily newsletter · {isoDate}
          {assembledAtLabel ? ` · Assembled ${assembledAtLabel} UTC` : ''}
        </p>

        {(neighbours.older || neighbours.newer) && (
          <nav
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-y border-border/15 py-4 text-[12px]"
            aria-label="Other days"
          >
            {neighbours.older ? (
              <Link
                href={`/daily/${neighbours.older}`}
                className="inline-flex items-center gap-1.5 font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                <ArrowLeft size={13} />
                {formatNavDate(neighbours.older)}
              </Link>
            ) : null}
            {neighbours.older && neighbours.newer ? (
              <span className="text-border/40" aria-hidden>
                ·
              </span>
            ) : null}
            {neighbours.newer ? (
              <Link
                href={`/daily/${neighbours.newer}`}
                className="inline-flex items-center gap-1.5 font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                {formatNavDate(neighbours.newer)}
                <ArrowRight size={13} />
              </Link>
            ) : null}
          </nav>
        )}

        {stories.length > 0 ? (
          <div className="mt-10 space-y-0">
            {stories.map((item) => {
              const summary = storySummaryText(item);
              const keyTakeaways = item.summary?.short_article?.key_takeaways?.filter(
                (x): x is string => typeof x === 'string' && x.trim().length > 0,
              ) ?? [];
              const meta = [item.source_name || item.source, item.published_date].filter(Boolean);

              return (
                <article
                  key={item.id || item.url}
                  className="border-t border-border/20 py-10 first:border-t-0 first:pt-0"
                >
                  {meta.length > 0 && (
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-secondary/50">
                      {meta.join(' · ')}
                    </p>
                  )}
                  <h2 className="mt-2.5 text-[1.2rem] font-bold leading-snug tracking-[-0.02em] text-foreground sm:text-[1.3rem]">
                    {decodeHtmlEntities(String(item.title || ''))}
                  </h2>
                  {summary ? (
                    <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.8] text-foreground/85">
                      {summary}
                    </p>
                  ) : null}
                  {keyTakeaways.length > 0 && (
                    <div className="mt-5">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/50">
                        Key points
                      </h3>
                      <ol className="mt-2.5 list-outside list-decimal space-y-1.5 pl-5 text-[15px] leading-[1.65] text-foreground/85">
                        {keyTakeaways.map((point, i) => (
                          <li key={i} className="pl-0.5">
                            {stripMarkdown(point)}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {item.url && (
                    <p className="mt-5">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-secondary/60 underline decoration-border/50 underline-offset-2 transition-colors hover:text-foreground"
                      >
                        Read original
                        <ExternalLink size={11} strokeWidth={2.5} />
                      </a>
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-secondary/50">No stories in this issue.</p>
        )}

        {trendingTopics.length > 0 && (
          <section className="mt-12 border-t border-border/20 pt-10">
            <h2 className="text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-secondary/50">
              Topic overviews
            </h2>
            <p className="mt-1 text-center text-[13px] text-secondary/50">
              Grouped lenses from the same day
            </p>
            <div className="mt-8 space-y-0">
              {trendingTopics.slice(0, 15).map((topic) => {
                const tSummary = topicSummaryText(topic);
                const kps = (topic.key_points || [])
                  .map((k) => stripMarkdown(k).trim())
                  .filter(Boolean)
                  .slice(0, 5);
                return (
                  <article
                    key={topic.id}
                    className="border-t border-border/15 py-8 first:border-t-0 first:pt-0"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-secondary/50">
                      Topic
                      {topic.source_count != null ? ` · ${topic.source_count} sources` : ''}
                    </p>
                    <h3 className="mt-2 text-[1.1rem] font-bold leading-snug text-foreground">
                      {decodeHtmlEntities(String(topic.title || ''))}
                    </h3>
                    {tSummary ? (
                      <p className="mt-3 whitespace-pre-line text-[15px] leading-[1.75] text-foreground/80">
                        {tSummary}
                      </p>
                    ) : null}
                    {kps.length > 0 && (
                      <ul className="mt-3 list-outside list-disc space-y-1.5 pl-4 text-[14px] leading-relaxed text-foreground/80">
                        {kps.map((k, i) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-14 border-t border-border/20 pt-8 text-center">
          <Link
            href="/daily"
            className="inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-secondary/55 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} />
            All archive days
          </Link>
        </div>
      </div>
    </div>
  );
}
