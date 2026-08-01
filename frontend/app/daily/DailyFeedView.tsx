"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Loader2 } from "lucide-react";
import { trackCheckoutClicked } from "@/lib/posthog";
import {
  PublicTopicCard,
  type PublicFeedCardItem,
  type PublicTopicCardItem,
} from "@/components/PublicFeedCard";
import PremiumCTASection from "@/components/PremiumCTASection";
import { DailyEditorialLayout } from "@/components/DailyEditorialLayout";
import DailyArchiveArticleView from "./DailyArchiveArticleView";
import { stripMarkdown } from "@/lib/feed-article-text";

/* ─── Types ─── */

type ArchiveDate = {
  date: string;
  trendingCount: number;
  topicCount: number;
  topHeadline?: string;
};

type FeedStory = PublicFeedCardItem;
type FeedTopic = PublicTopicCardItem;

type FeedData = {
  date: string;
  trending: FeedStory[];
  topics: FeedTopic[];
};

type FetchedFeed = {
  date: string;
  trending: Array<{
    id: string;
    title: string;
    url: string;
    thumbnail: string | null;
    source: string;
    summary: {
      short_article: {
        body: string;
        subtitle: string;
        key_takeaways: string[];
      };
    };
    published_date: string;
    metadata: { source_count: number };
  }>;
  trendingTopics: Array<{
    id: string;
    title: string;
    summary: string;
    source_count: number;
    article_count: number;
    key_points: string[];
  }>;
};

/* ─── Helpers ─── */

function getTodayIso(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function formatDateLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function formatDateWeekday(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(d);
}

function convertFetchedFeed(data: FetchedFeed): FeedData {
  return {
    date: data.date,
    trending: data.trending.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      thumbnail: item.thumbnail || undefined,
      source: item.source,
      summary: item.summary?.short_article?.body || item.summary?.short_article?.subtitle || "",
      sourceCount: item.metadata?.source_count || 0,
      timestamp: item.published_date || undefined,
      keyPoints: (item.summary?.short_article?.key_takeaways || []).filter(
        (k): k is string => typeof k === "string" && k.trim().length > 0,
      ),
    })),
    topics: data.trendingTopics.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
      sourceCount: t.source_count,
      articleCount: t.article_count,
      keyPoints: (t.key_points || []).filter(
        (k): k is string => typeof k === "string" && k.trim().length > 0,
      ),
    })),
  };
}

/**
 * Interleave stories and topics like /feed does.
 */
function buildFeedList(
  stories: FeedStory[],
  topics: FeedTopic[],
): Array<
  | { kind: "story"; data: FeedStory }
  | { kind: "topic"; data: FeedTopic }
> {
  const list: Array<
    | { kind: "story"; data: FeedStory }
    | { kind: "topic"; data: FeedTopic }
  > = [];

  let si = 0;
  let ti = 0;
  let counter = 0;

  while (si < stories.length || ti < topics.length) {
    if (ti < topics.length && counter > 0 && counter % 4 === 0) {
      list.push({ kind: "topic", data: topics[ti] });
      ti++;
    } else if (si < stories.length) {
      list.push({ kind: "story", data: stories[si] });
      si++;
    } else if (ti < topics.length) {
      list.push({ kind: "topic", data: topics[ti] });
      ti++;
    }
    counter++;
  }

  return list;
}

/* ─── Date Picker Tabs ─── */

function DatePickerTabs({
  dates,
  selectedDate,
  todayIso,
  onSelect,
}: {
  dates: ArchiveDate[];
  selectedDate: string | null;
  todayIso: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="sticky top-14 z-30 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-[#e5e7eb] bg-white/95 backdrop-blur-sm">
      <div className="px-4 sm:px-6 lg:px-8 py-2">
        <p className="text-center text-[11px] text-secondary/55 mb-1.5 leading-tight">
          Select a date to view its feed
        </p>
      </div>
      <div className="min-w-0 max-w-full overflow-x-auto overflow-y-hidden scrollbar-hide pb-2 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div className="flex w-max min-w-full justify-center">
          <div className="inline-flex shrink-0 items-center gap-1 px-4 sm:px-6 lg:px-8">
            {/* Today — locked */}
            <button
              type="button"
              onClick={() => onSelect(todayIso)}
              className={`relative shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors border ${
                selectedDate === todayIso
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  : "border-border/15 bg-foreground/[0.03] text-secondary/60 hover:text-foreground hover:bg-foreground/[0.06]"
              }`}
            >
              <Lock size={11} className="shrink-0" />
              Today
            </button>

            {/* Past dates */}
            {dates.slice(0, 30).map((d) => {
              const selected = selectedDate === d.date;
              const weekday = formatDateWeekday(d.date);
              return (
                <Link
                  key={d.date}
                  href={`/daily/${d.date}`}
                  prefetch={false}
                  className={`shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
                    selected
                      ? "bg-foreground text-background"
                      : "text-secondary/70 hover:text-foreground hover:bg-foreground/[0.06]"
                  }`}
                >
                  <span className="block text-[10px] opacity-60 mb-0.5">
                    {weekday}
                  </span>
                  {formatDateShort(d.date)}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Today Locked Card ─── */

function TodayLockedCard() {
  return (
    <div className="mt-6 mx-4 rounded-[20px] border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-200/90 mb-4">
          <Lock size={10} />
          Today&apos;s feed
        </div>
        <h2 className="text-[1.35rem] font-bold tracking-[-0.02em] text-foreground">
          Today&apos;s feed is live
        </h2>
        <p className="mt-2 text-[14px] text-secondary/60 leading-relaxed max-w-md">
          Fresh stories, grouped topics, and key takeaways — updated every
          morning. Try Trace Pro free for 3 days to unlock today&apos;s personalized
          feed.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] text-secondary/60">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1">
            Daily pulse
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1">
            Grouped topics
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1">
            Key takeaways
          </span>
        </div>
        <Link
          href="/profile?tab=subscription"
          prefetch={false}
          onClick={() => trackCheckoutClicked("daily_today_locked")}
          className="mt-6 inline-flex items-center rounded-full bg-foreground px-6 py-3 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90"
        >
          Try Pro free for 3 days
        </Link>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function DailyFeedView({
  archiveDates,
  initialDate,
  initialFeed,
}: {
  archiveDates: ArchiveDate[];
  initialDate: string | null;
  initialFeed: FeedData | null;
}) {
  const todayIso = getTodayIso();
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialDate,
  );
  const [feedData, setFeedData] = useState<FeedData | null>(initialFeed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isToday = selectedDate === todayIso;

  const fetchFeed = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-feed?date=${date}`);
      if (!res.ok) {
        throw new Error("Failed to load feed");
      }
      const data: FetchedFeed = await res.json();
      setFeedData(convertFetchedFeed(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setFeedData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDateSelect = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setSelectedId(null);
      if (date === todayIso) {
        setFeedData(null);
        return;
      }
      if (feedData?.date === date) return;
      fetchFeed(date);
    },
    [todayIso, feedData?.date, fetchFeed],
  );

  const feedList = useMemo(() => {
    if (!feedData) return [];
    return buildFeedList(feedData.trending, feedData.topics);
  }, [feedData]);

  const selectedStory = useMemo(() => {
    if (!selectedId || !feedData) return null;
    return feedData.trending.find((s) => s.id === selectedId) ?? null;
  }, [selectedId, feedData]);

  const sidebarStories = useMemo(() => {
    if (!feedData) return [];
    return feedData.trending
      .filter((s) => s.id !== selectedId)
      .slice(0, 8);
  }, [feedData, selectedId]);

  // If a story is selected, show article view
  if (selectedStory && feedData) {
    return (
      <div className="space-y-0">
        <section className="pt-4 pb-4 sm:pt-8 sm:pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">
            Daily archive
          </p>
          <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[2.5rem]">
            Browse any day&apos;s feed
          </h1>
        </section>

        <DailyArchiveArticleView
          item={{
            id: selectedStory.id,
            title: selectedStory.title || "",
            preview: selectedStory.summary || "",
            summary: selectedStory.summary || "",
            source: selectedStory.source || "",
            sourceCount: selectedStory.sourceCount || 0,
            timestamp: selectedStory.timestamp,
            thumbnail: selectedStory.thumbnail,
            url: selectedStory.url,
            keyPoints: selectedStory.keyPoints || [],
          }}
          sidebarItems={sidebarStories.map((s) => ({
            id: s.id,
            title: s.title || "",
            source: s.source || "",
            sourceCount: s.sourceCount || 0,
            timestamp: s.timestamp,
            url: s.url,
            thumbnail: s.thumbnail,
            summary: s.summary,
            keyPoints: s.keyPoints,
          }))}
          selectedId={selectedId}
          onSelectStory={setSelectedId}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Hero */}
      <section className="pt-4 pb-4 sm:pt-8 sm:pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">
          Daily archive
        </p>
        <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[2.5rem]">
          Browse any day&apos;s feed
        </h1>
        <p className="mt-3 text-[14px] text-secondary/60 leading-relaxed max-w-md">
          Pick a date to see that day&apos;s stories, grouped topics, and key
          takeaways — rendered exactly like the live feed.
        </p>
      </section>

      {/* Date picker */}
      <DatePickerTabs
        dates={archiveDates}
        selectedDate={selectedDate}
        todayIso={todayIso}
        onSelect={handleDateSelect}
      />

      {/* Content area */}
      {isToday ? (
        <TodayLockedCard />
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-secondary/40" />
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="text-[14px] text-secondary/60">{error}</p>
          <button
            type="button"
            onClick={() => selectedDate && fetchFeed(selectedDate)}
            className="mt-3 text-[13px] font-medium text-foreground underline"
          >
            Try again
          </button>
        </div>
      ) : feedData ? (
        <>
          {/* Date header — matches feed's tab bar info line */}
          <div className="pt-4 pb-2">
            <p className="text-center text-[11px] text-secondary/55">
              {formatDateLong(feedData.date)} · {feedData.trending.length}{" "}
              stories
              {feedData.topics.length > 0
                ? ` · ${feedData.topics.length} topics`
                : ""}
            </p>
          </div>

          {/* Desktop: 3-column editorial grid — matches /feed */}
          <DailyEditorialLayout
            stories={feedData.trending}
            topics={feedData.topics}
            onStoryClick={(item) => setSelectedId(item.id)}
          />

          {/* Mobile: feed-style card list */}
          <section className="lg:hidden border-t border-border/20">
            {feedList.map((entry) => {
              if (entry.kind === "topic") {
                return (
                  <PublicTopicCard
                    key={entry.data.id}
                    topic={entry.data}
                  />
                );
              }
              return (
                <article
                  key={entry.data.id}
                  onClick={() => setSelectedId(entry.data.id)}
                  className="border-b border-border/20 transition-colors duration-150 last:border-b-0 hover:bg-foreground/[0.02] cursor-pointer"
                >
                  <div className="flex gap-3 px-4 pt-5 pb-4 sm:pt-6 sm:pb-5">
                    <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                      <div className="flex items-baseline gap-1 min-w-0 text-[12px] leading-4 font-normal text-secondary/60">
                        <span className="truncate">{entry.data.source}</span>
                        {(entry.data.sourceCount ?? 0) > 1 && (
                          <span className="shrink-0 opacity-90">
                            · {entry.data.sourceCount} sources
                          </span>
                        )}
                      </div>
                      <p className="text-[17px] font-bold text-foreground leading-snug tracking-[-0.01em]">
                        {stripMarkdown(entry.data.title)}
                      </p>
                      {entry.data.summary && (
                        <p className="text-[15px] text-foreground/80 leading-normal line-clamp-3">
                          {stripMarkdown(typeof entry.data.summary === "string" ? entry.data.summary : "")}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          {/* Premium CTA */}
          <div className="pt-4 pb-2">
            <PremiumCTASection variant="dark" />
          </div>
        </>
      ) : (
        <div className="py-16 text-center">
          <p className="text-[14px] text-secondary/50">
            Select a date above to view its feed.
          </p>
        </div>
      )}

      {archiveDates.length > 30 && (
        <nav aria-label="Older daily editions" className="border-t border-border/20 py-10">
          <details>
            <summary className="cursor-pointer text-[13px] font-semibold text-foreground">
              Browse older editions
            </summary>
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4 lg:grid-cols-6">
              {archiveDates.slice(30).map((entry) => (
                <Link
                  key={entry.date}
                  href={`/daily/${entry.date}`}
                  prefetch={false}
                  className="text-[12px] text-secondary/65 hover:text-foreground"
                >
                  {formatDateLong(entry.date)}
                </Link>
              ))}
            </div>
          </details>
        </nav>
      )}
    </div>
  );
}
