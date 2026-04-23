"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { RecentDailyArchiveLinkStrip, type RecentArchiveItem } from "@/components/RecentDailyArchiveLinkStrip";

type TrendingItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  thumbnail?: string;
};

type TopicCard = {
  slug: string;
  label: string;
  summary: string;
  sourceCount: number;
  articleCount: number;
  keyPoints: string[];
  thumbnail?: string;
};

const FREE_PAGE_LINKS = [
  { href: "/daily", label: "Daily archive" },
  { href: "/research", label: "Research" },
  { href: "/compare", label: "Compare" },
  { href: "/tools", label: "Tools" },
] as const;

function stripMarkdown(text: string): string {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .trim();
}

function hostFromUrl(url: string, fallback: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return fallback || "";
  }
}

function TopicRow({
  topic,
  active,
  onSelect,
}: {
  topic: TopicCard;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full border-b border-border/[0.06] px-5 py-4.5 text-left transition-all ${
        active
          ? "bg-surface/80 dark:bg-white/[0.03]"
          : "hover:bg-surface/40"
      }`}
    >
      <h3 className="text-[15px] font-semibold leading-snug text-foreground tracking-[-0.01em]">
        {topic.label}
      </h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/30">
        <span>{topic.sourceCount} sources</span>
        <span>·</span>
        <span>{topic.articleCount} updates</span>
      </div>
      <p className="mt-2.5 text-[13px] leading-[1.6] text-secondary/60">
        {stripMarkdown(topic.summary).slice(0, 120)}
      </p>
    </button>
  );
}

function TopicPanel({
  topic,
  items,
}: {
  topic: TopicCard;
  items: TrendingItem[];
}) {
  const sourceTrail = useMemo(() => items.slice(0, 4), [items]);

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">
            Grouped topic
          </p>
          <h1 className="mt-3 text-[1.75rem] font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-[2.25rem]">
            {topic.label}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/30">
            <span>{topic.sourceCount} sources</span>
            <span>·</span>
            <span>{topic.articleCount} updates</span>
          </div>
        </div>
        <Link
          href={`/topics/${topic.slug}`}
          className="hidden shrink-0 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90 sm:inline-flex"
        >
          Open topic
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">
          Overview
        </h2>
        <p className="mt-4 text-[15px] leading-[1.8] text-secondary">
          {stripMarkdown(topic.summary)}
        </p>
      </div>

      {topic.keyPoints.length > 0 && (
        <div className="mt-8 rounded-[16px] border border-border/[0.06] bg-surface/30 p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">
            Why this topic matters
          </h2>
          <div className="mt-4 space-y-3">
            {topic.keyPoints.slice(0, 3).map((point, index) => (
              <div key={index} className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-secondary/20" />
                <p className="text-[14px] leading-[1.7] text-secondary">{stripMarkdown(point)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sourceTrail.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">
            Today&apos;s source trail
          </h2>
          <div className="mt-4 grid gap-3">
            {sourceTrail.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-[14px] border border-border/[0.06] bg-background p-4 transition-all hover:bg-surface/40 hover:shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/30">
                  {hostFromUrl(item.url, item.source)}
                </p>
                <h3 className="mt-2 text-[15px] font-semibold leading-snug text-foreground tracking-[-0.01em]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-secondary/60">
                  {stripMarkdown(item.summary).slice(0, 150)}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground/60 transition-colors group-hover:text-foreground">
                  Open original
                  <ExternalLink size={12} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-border/[0.06] pt-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/topics/${topic.slug}`}
            className="group inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90"
          >
            Open full topic page
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/[0.1] px-5 py-2.5 text-[13px] font-semibold text-foreground transition-all hover:bg-surface/40"
          >
            Sign in for full feed
          </Link>
        </div>
      </div>
    </div>
  );
}

function MobileTopicCard({
  topic,
}: {
  topic: TopicCard;
}) {
  return (
    <Link
      href={`/topics/${topic.slug}`}
      className="group block rounded-[18px] border border-border/[0.06] bg-surface/30 p-6 transition-all hover:bg-surface/60 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
    >
      <h3 className="text-[1.25rem] font-bold leading-tight tracking-[-0.02em] text-foreground">
        {topic.label}
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/30">
        <span>{topic.sourceCount} sources</span>
        <span>·</span>
        <span>{topic.articleCount} updates</span>
      </div>
      <p className="mt-4 text-[14px] leading-[1.7] text-secondary">
        {stripMarkdown(topic.summary)}
      </p>
      {topic.keyPoints.length > 0 && (
        <div className="mt-4 rounded-[12px] bg-background/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/30">
            Why this matters
          </p>
          <div className="mt-2.5 space-y-2">
            {topic.keyPoints.slice(0, 2).map((point, index) => (
              <div key={index} className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-secondary/20" />
                <p className="text-[13px] leading-[1.6] text-secondary/70">{stripMarkdown(point)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground/60 transition-colors group-hover:text-foreground">
        Open topic page
        <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function TrendingContent({
  topicCards,
  items,
  recentDailyArchives = [],
}: {
  topicCards: TopicCard[];
  items: TrendingItem[];
  recentDailyArchives?: RecentArchiveItem[];
}) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSlug && topicCards.length > 0) {
      setSelectedSlug(topicCards[0].slug);
    }
  }, [selectedSlug, topicCards]);

  const selectedTopic =
    topicCards.find((topic) => topic.slug === selectedSlug) || topicCards[0] || null;

  if (topicCards.length === 0 && items.length === 0) {
    return (
      <div className="space-y-8">
        <div className="rounded-[20px] border border-border/[0.06] bg-surface/30 p-12 text-center">
          <p className="text-[16px] font-semibold">Today&apos;s grouped topics are on the way</p>
          <p className="mt-2 text-[14px] text-secondary/60">
            Trace collapses scattered coverage into one clearer view. Check back soon.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {FREE_PAGE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-border/[0.08] px-3.5 py-1.5 text-[12px] font-medium text-secondary/60 hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        {recentDailyArchives.length > 0 && (
          <RecentDailyArchiveLinkStrip
            items={recentDailyArchives}
            variant="trending"
            intro="In the meantime, open a recent full-day snapshot below."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <section className="pt-12 pb-2 sm:pt-16">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">
            Public preview
          </p>
          <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[3.5rem]">
            The story, not the link pile
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-secondary">
            Trace groups coverage by topic across sources so you get one clear entry point into the story — not ten duplicate tabs.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {FREE_PAGE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-border/[0.08] px-3.5 py-1.5 text-[12px] font-medium text-secondary/60 transition-all hover:text-foreground hover:border-border/20"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        {recentDailyArchives.length > 0 && (
          <div className="mt-10 max-w-3xl">
            <RecentDailyArchiveLinkStrip
              items={recentDailyArchives}
              variant="trending"
              heading="Recent daily snapshots"
              intro="See what a full day looked like in Trace: stories, topic overviews, and links to adjacent days."
            />
          </div>
        )}
      </section>

      {/* Desktop: split panel */}
      <div className="hidden md:block">
        <section
          className="overflow-hidden rounded-[20px] border border-border/[0.06] bg-surface/20"
          style={{ minHeight: 640 }}
        >
          <div className="flex min-h-[640px]">
            <div className="w-[340px] shrink-0 border-r border-border/[0.06]">
              <div className="border-b border-border/[0.06] px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">
                  Today&apos;s grouped topics
                </p>
                <h2 className="mt-2 text-[17px] font-bold tracking-[-0.02em] text-foreground">
                  Start with the story
                </h2>
              </div>
              <div className="max-h-[640px] overflow-y-auto">
                {topicCards.map((topic) => (
                  <TopicRow
                    key={topic.slug}
                    topic={topic}
                    active={selectedTopic?.slug === topic.slug}
                    onSelect={() => setSelectedSlug(topic.slug)}
                  />
                ))}
              </div>
              <div className="border-t border-border/[0.06] px-5 py-4">
                <Link
                  href="/"
                  className="group flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90"
                >
                  Sign in for full feed
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {selectedTopic ? (
              <TopicPanel topic={selectedTopic} items={items} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-[13px] text-secondary/40">
                No topics yet.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Mobile: card stack */}
      <div className="space-y-4 md:hidden">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">
              Today&apos;s grouped topics
            </p>
            <h2 className="mt-2 text-[1.5rem] font-bold tracking-[-0.03em] text-foreground">
              Start with the story
            </h2>
          </div>
          <Link
            href="/"
            className="hidden rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-background sm:inline-flex"
          >
            Sign in
          </Link>
        </div>

        {topicCards.map((topic) => (
          <MobileTopicCard key={topic.slug} topic={topic} />
        ))}
      </div>
    </div>
  );
}
