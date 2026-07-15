"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ExternalLink, Lock } from "lucide-react";
import { trackCheckoutClicked } from "@/lib/posthog";

/* ─── Helpers ─── */

function sourceHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function SourceAvatar({ source }: { source: string }) {
  const letter = source.replace(/^\d+/, "")[0]?.toUpperCase() ?? source[0]?.toUpperCase() ?? "?";
  const hue = sourceHue(source);
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold select-none"
      style={{ background: `hsl(${hue} 60% 92%)`, color: `hsl(${hue} 50% 35%)` }}
    >
      {letter}
    </div>
  );
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function getTimeLabel(dateStr?: string): string {
  if (!dateStr) return "";
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return "";
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - ts) / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const date = new Date(ts);
  const isToday = date.toDateString() === now.toDateString();
  if (isToday)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stripMarkdown(text: string): string {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*#+\s*/gm, "")
    .trim();
}

/* ─── Types ─── */

export type PublicFeedCardItem = {
  id: string;
  title: string;
  preview?: string;
  summary?: string;
  source?: string;
  sourceCount?: number;
  timestamp?: string;
  thumbnail?: string | null;
  url?: string;
  keyPoints?: string[];
};

export type PublicTopicCardItem = {
  id: string;
  title: string;
  summary?: string;
  sourceCount: number;
  articleCount: number;
  keyPoints?: string[];
  slug?: string;
};

/* ─── Locked Gate ─── */

function LockedOverlay() {
  return (
    <div className="relative">
      <div
        className="pointer-events-none select-none space-y-2 px-4 pt-3 pb-20 opacity-40 blur-[6px]"
        aria-hidden
      >
        <div className="h-3 w-full rounded-full bg-foreground/20" />
        <div className="h-3 w-[92%] rounded-full bg-foreground/20" />
        <div className="h-3 w-full rounded-full bg-foreground/20" />
        <div className="h-3 w-[72%] rounded-full bg-foreground/20" />
        <div className="h-3 w-[88%] rounded-full bg-foreground/15" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <div className="rounded-2xl border border-border bg-background/95 p-4 shadow-sm backdrop-blur-sm">
          <div className="mb-2 inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-200/90">
            Trace Pro
          </div>
          <p className="text-[15px] font-bold text-foreground">
            Unlock the full brief
          </p>
          <p className="mt-1 text-[13px] leading-snug text-secondary/60">
            Get key takeaways, context, and source links for every story.
          </p>
          <Link
            href="/onboarding?intent=checkout"
            prefetch={false}
            onClick={() => trackCheckoutClicked("public_feed_card_unlock")}
            className="mt-3 inline-flex items-center rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
          >
            Subscribe
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Story Card ─── */

export function PublicFeedCard({
  item,
  isLocked = false,
}: {
  item: PublicFeedCardItem;
  isLocked?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const source = item.source || (item.url ? hostFromUrl(item.url) : "") || "Source";
  const timeLabel = getTimeLabel(item.timestamp);
  const preview = stripMarkdown(item.preview || item.summary || "");
  const hasKeyPoints = item.keyPoints && item.keyPoints.length > 0;

  return (
    <article
      className={`border-b border-border/20 transition-colors duration-150 last:border-b-0 ${
        isLocked ? "opacity-100" : "hover:bg-foreground/[0.02]"
      }`}
    >
      <div
        onClick={() => {
          if (!isLocked) setExpanded(!expanded);
        }}
        className={`flex gap-3 px-4 pt-5 pb-4 sm:pt-6 sm:pb-5 cursor-pointer ${
          expanded ? "pb-0" : ""
        } ${isLocked ? "cursor-default" : ""}`}
      >
        <div className="hidden sm:block shrink-0 pt-1" aria-hidden>
          <SourceAvatar source={source} />
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1 min-w-0 text-[12px] leading-4 font-normal text-secondary/60">
            <span className="truncate">{source}</span>
            {(item.sourceCount ?? 0) > 1 && (
              <span className="shrink-0 opacity-90">
                · {item.sourceCount} sources
              </span>
            )}
            {timeLabel && (
              <span className="shrink-0 opacity-90">· {timeLabel}</span>
            )}
          </div>

          <p className="text-[17px] font-bold text-foreground leading-snug tracking-[-0.01em]">
            {stripMarkdown(item.title)}
          </p>

          {preview && !isLocked && (
            <p
              className={`text-[15px] text-foreground/80 leading-normal ${
                expanded ? "" : "line-clamp-3"
              }`}
            >
              {preview}
            </p>
          )}

          {!expanded && !isLocked && (
            <span className="inline-block text-[15px] text-[#1d9bf0]">
              Show more
            </span>
          )}
        </div>
      </div>

      {expanded && !isLocked && (
        <div className="flex gap-3 px-4 pb-5 sm:pb-6 pt-0.5">
          <div className="hidden sm:block w-10 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-4 pt-3 sm:pt-4">
            {item.summary && item.summary !== item.preview && (
              <p className="text-[15px] text-foreground/80 leading-[1.6]">
                {stripMarkdown(item.summary)}
              </p>
            )}

            {hasKeyPoints && (
              <div className="rounded-2xl border border-border/30 bg-foreground/[0.02] p-4">
                <p className="text-[13px] font-bold text-foreground uppercase tracking-wide mb-2.5">
                  Key Takeaways
                </p>
                <div className="space-y-2">
                  {item.keyPoints!.slice(0, 5).map((point, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-secondary/50 font-mono text-[13px] mt-px shrink-0">
                        {i + 1}.
                      </span>
                      <p className="text-[14px] text-foreground/85 leading-[1.5]">
                        {stripMarkdown(point)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/30 hover:bg-foreground/[0.03] transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center shrink-0">
                  <ExternalLink size={16} className="text-secondary/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-secondary/60 truncate">
                    {hostFromUrl(item.url)}
                  </p>
                  <p className="text-[15px] text-foreground font-normal truncate">
                    Read original article
                  </p>
                </div>
              </a>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
              className="text-left text-[15px] text-[#1d9bf0] hover:underline"
            >
              Show less
            </button>
          </div>
        </div>
      )}

      {isLocked && <LockedOverlay />}
    </article>
  );
}

/* ─── Topic Card (interleaved in feed) ─── */

export function PublicTopicCard({
  topic,
  isLocked = false,
}: {
  topic: PublicTopicCardItem;
  isLocked?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={`border-b border-border/20 transition-colors duration-150 last:border-b-0 ${
        isLocked ? "opacity-100" : "hover:bg-foreground/[0.02]"
      }`}
    >
      <div
        onClick={() => {
          if (!isLocked) setExpanded(!expanded);
        }}
        className={`flex gap-3 px-4 pt-5 pb-4 sm:pt-6 sm:pb-5 cursor-pointer ${
          expanded ? "pb-0" : ""
        } ${isLocked ? "cursor-default" : ""}`}
      >
        <div className="hidden sm:block shrink-0 pt-1" aria-hidden>
          <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center shrink-0" />
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1 min-w-0 text-[12px] leading-4 font-normal text-secondary/60">
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
              Topic
            </span>
            <span className="shrink-0 opacity-90">
              · {topic.sourceCount} sources · {topic.articleCount} updates
            </span>
          </div>

          <p className="text-[17px] font-bold text-foreground leading-snug tracking-[-0.01em]">
            {stripMarkdown(topic.title)}
          </p>

          {topic.summary && !isLocked && (
            <p
              className={`text-[15px] text-foreground/80 leading-normal ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {stripMarkdown(topic.summary)}
            </p>
          )}

          {!expanded && !isLocked && (
            <span className="inline-block text-[15px] text-[#1d9bf0]">
              Show more
            </span>
          )}
        </div>
      </div>

      {expanded && !isLocked && (
        <div className="flex gap-3 px-4 pb-5 sm:pb-6 pt-0.5">
          <div className="hidden sm:block w-10 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-4 pt-3 sm:pt-4">
            {topic.summary && (
              <p className="text-[15px] text-foreground/80 leading-[1.6]">
                {stripMarkdown(topic.summary)}
              </p>
            )}

            {topic.keyPoints && topic.keyPoints.length > 0 && (
              <div className="rounded-2xl border border-border/30 bg-foreground/[0.02] p-4">
                <p className="text-[13px] font-bold text-foreground uppercase tracking-wide mb-2.5">
                  Key Points
                </p>
                <div className="space-y-2">
                  {topic.keyPoints.slice(0, 5).map((point, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-secondary/50 font-mono text-[13px] mt-px shrink-0">
                        {i + 1}.
                      </span>
                      <p className="text-[14px] text-foreground/85 leading-[1.5]">
                        {stripMarkdown(point)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {topic.slug && (
              <Link
                href={`/topics/${topic.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90 w-fit"
              >
                Open topic page
              </Link>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
              className="text-left text-[15px] text-[#1d9bf0] hover:underline"
            >
              Show less
            </button>
          </div>
        </div>
      )}

      {isLocked && <LockedOverlay />}
    </article>
  );
}

/* ─── Inline Unlock Banner ─── */

export function PublicInlineUnlockBanner({
  storyCount,
  className = "",
}: {
  storyCount: number;
  className?: string;
}) {
  return (
    <div
      className={`mx-4 my-4 rounded-2xl border border-border/20 bg-foreground/[0.02] px-4 py-4 sm:px-5 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
            <Lock size={15} className="text-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {storyCount} more stories waiting for you
            </p>
            <p className="mt-0.5 text-xs text-secondary/55">
              Subscribe to Pro for unlimited articles, key takeaways, and source
              links.
            </p>
          </div>
        </div>
        <Link
          href="/onboarding?intent=checkout"
          prefetch={false}
          onClick={() =>
            trackCheckoutClicked("public_inline_unlock_banner", {
              story_count: storyCount,
            })
          }
          className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
        >
          Subscribe to unlock
        </Link>
      </div>
    </div>
  );
}
