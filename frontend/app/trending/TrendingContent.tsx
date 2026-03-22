"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

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
      className={`w-full border-b border-border/10 px-5 py-4 text-left transition-colors ${
        active ? "bg-[#f7f3eb] dark:bg-[#131313]" : "hover:bg-muted/30"
      }`}
    >
      <h3 className="text-lg font-semibold leading-snug text-foreground">
        {topic.label}
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary/40">
        <span>{topic.sourceCount} sources</span>
        <span>·</span>
        <span>{topic.articleCount} updates</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-secondary">
        {stripMarkdown(topic.summary).slice(0, 150)}
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
            Grouped topic
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            {topic.label}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary/45">
            <span>{topic.sourceCount} sources</span>
            <span>·</span>
            <span>{topic.articleCount} updates</span>
          </div>
        </div>
        <Link
          href={`/topics/${topic.slug}`}
          className="hidden shrink-0 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background sm:inline-flex"
        >
          Open topic
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
          Overview
        </h2>
        <p className="mt-4 text-[15px] leading-8 text-secondary sm:text-base">
          {stripMarkdown(topic.summary)}
        </p>
      </div>

      {topic.keyPoints.length > 0 && (
        <div className="mt-8 rounded-3xl border border-border/20 bg-white p-5 dark:bg-gray-950">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
            Why this topic matters
          </h2>
          <div className="mt-4 space-y-3">
            {topic.keyPoints.slice(0, 3).map((point, index) => (
              <div key={index} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary/30" />
                <p className="text-sm leading-7 text-secondary">{stripMarkdown(point)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sourceTrail.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
            Today&apos;s source trail
          </h2>
          <div className="mt-4 grid gap-3">
            {sourceTrail.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-border/20 bg-background p-4 transition-colors hover:bg-muted/30"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-secondary/40">
                  {hostFromUrl(item.url, item.source)}
                </p>
                <h3 className="mt-2 text-base font-semibold leading-snug text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  {stripMarkdown(item.summary).slice(0, 150)}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  Open original
                  <ExternalLink size={14} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-border/20 pt-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/topics/${topic.slug}`}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background"
          >
            Open full topic page
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/30 px-5 py-3 text-sm font-semibold text-foreground"
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
      className="block rounded-[26px] border border-border/20 bg-white p-6 shadow-sm dark:bg-gray-950"
    >
      <h3 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
        {topic.label}
      </h3>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary/45">
        <span>{topic.sourceCount} sources</span>
        <span>·</span>
        <span>{topic.articleCount} updates</span>
      </div>
      <p className="mt-5 text-sm leading-7 text-secondary">
        {stripMarkdown(topic.summary)}
      </p>
      {topic.keyPoints.length > 0 && (
        <div className="mt-5 rounded-2xl bg-muted/35 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
            Why this topic matters
          </p>
          <div className="mt-3 space-y-2">
            {topic.keyPoints.slice(0, 2).map((point, index) => (
              <div key={index} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary/30" />
                <p className="text-sm leading-6 text-secondary">{stripMarkdown(point)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
        Open topic page
        <ArrowRight size={14} />
      </div>
    </Link>
  );
}

export default function TrendingContent({
  topicCards,
  items,
}: {
  topicCards: TopicCard[];
  items: TrendingItem[];
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
      <div className="rounded-3xl border border-border/20 bg-white p-12 text-center shadow-sm dark:bg-gray-950">
        <p className="text-lg font-semibold">Today&apos;s grouped topics are on the way</p>
        <p className="mt-2 text-sm text-secondary">
          Trace collapses scattered coverage into one clearer view. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-border/20 bg-white p-8 shadow-sm dark:bg-gray-950 sm:p-10">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
            Public preview
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            The feed should feel like one story browser, not a pile of links
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-secondary sm:text-lg">
            This preview shows the actual Trace idea: topic-first reading, visible source counts, and one cleaner entry point into the story.
          </p>
        </div>
      </section>

      <div className="hidden md:block">
        <section
          className="overflow-hidden rounded-[32px] border border-border/20 bg-white shadow-sm dark:bg-gray-950"
          style={{ minHeight: 640 }}
        >
          <div className="flex min-h-[640px]">
            <div className="w-[360px] shrink-0 border-r border-border/20">
              <div className="border-b border-border/20 px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
                  Today&apos;s grouped topics
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
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
              <div className="border-t border-border/20 px-5 py-4">
                <Link
                  href="/"
                  className="group flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
                >
                  Sign in for full feed
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {selectedTopic ? (
              <TopicPanel topic={selectedTopic} items={items} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-secondary">
                No topics yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-5 md:hidden">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
              Today&apos;s grouped topics
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Start with the story
            </h2>
          </div>
          <Link
            href="/"
            className="hidden rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background sm:inline-flex"
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
