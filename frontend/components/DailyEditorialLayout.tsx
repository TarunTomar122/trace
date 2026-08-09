"use client";

import React from "react";
import { ArticleImage } from "@/components/ArticleImage";
import type { PublicFeedCardItem, PublicTopicCardItem } from "@/components/PublicFeedCard";

/* ─── Helpers ─── */

function stripMarkdown(text: string): string {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*#+\s*/gm, "")
    .trim();
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

/* ─── Editorial Card Types ─── */

type EditorItem = {
  id: string;
  title: string;
  preview?: string;
  source?: string;
  sourceCount: number;
  timestamp?: string;
  thumbnail?: string | null;
};

/* ─── Hero Card (large image + title) ─── */

function EditorialHeroCard({
  item,
  onClick,
}: {
  item: EditorItem;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left hover:opacity-95 transition-opacity"
    >
      <article className="group">
        {item.thumbnail && (
          <div className="overflow-hidden rounded-xl mb-4">
            <ArticleImage
              thumbnail={item.thumbnail}
              title={item.title}
              alt=""
              loading="eager"
              decoding="async"
              className="w-full h-[300px] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-secondary/55 mb-2">
          {item.source && (
            <span className="font-medium uppercase tracking-[0.08em]">
              {item.source}
            </span>
          )}
          {item.timestamp && (
            <>
              <span className="text-secondary/30">·</span>
              <span>{getTimeLabel(item.timestamp)}</span>
            </>
          )}
          {item.sourceCount > 1 && (
            <>
              <span className="text-secondary/30">·</span>
              <span>{item.sourceCount} sources</span>
            </>
          )}
        </div>
        <h2 className="text-[16px] font-[550] text-foreground leading-[1.35] tracking-[-0.01em] mb-2">
          {stripMarkdown(item.title)}
        </h2>
        {item.preview && (
          <p className="text-[15px] text-secondary/70 leading-relaxed line-clamp-3">
            {stripMarkdown(item.preview)}
          </p>
        )}
      </article>
    </button>
  );
}

/* ─── Medium Card (image + compact) ─── */

function EditorialMediumCard({
  item,
  onClick,
}: {
  item: EditorItem;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left hover:opacity-95 transition-opacity"
    >
      <article className="group">
        {item.thumbnail && (
          <div className="overflow-hidden rounded-lg mb-3">
            <ArticleImage
              thumbnail={item.thumbnail}
              title={item.title}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-[170px] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[10px] text-secondary/50 mb-1.5">
          {item.source && (
            <span className="font-medium uppercase tracking-[0.08em]">
              {item.source}
            </span>
          )}
          {item.sourceCount > 1 && (
            <>
              <span className="text-secondary/30">·</span>
              <span>{item.sourceCount} sources</span>
            </>
          )}
        </div>
        <h3 className="min-h-[3.6rem] text-[16px] font-[550] text-foreground leading-[1.35] tracking-[-0.01em] mb-1 line-clamp-3">
          {stripMarkdown(item.title)}
        </h3>
        {item.preview && (
          <p className="text-[13px] text-secondary/60 leading-relaxed line-clamp-2">
            {stripMarkdown(item.preview)}
          </p>
        )}
      </article>
    </button>
  );
}

/* ─── Sidebar Item (compact) ─── */

function EditorialSidebarItem({
  item,
  showDivider = true,
  onClick,
}: {
  item: EditorItem;
  showDivider?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left hover:bg-foreground/[0.03] -mx-2 px-2 rounded-lg transition-colors"
    >
      <article
        className={`py-3.5 ${showDivider ? "border-b border-border/15" : ""}`}
      >
        <h4 className="text-[16px] font-[550] text-foreground leading-[1.35] tracking-[-0.01em] mb-1.5 line-clamp-3">
          {stripMarkdown(item.title)}
        </h4>
        <div className="flex items-center gap-1.5 text-[10px] text-secondary/50">
          {item.source && (
            <span className="truncate max-w-[120px]">{item.source}</span>
          )}
          {item.sourceCount > 1 && (
            <>
              <span className="text-secondary/25">·</span>
              <span className="shrink-0">{item.sourceCount} sources</span>
            </>
          )}
          {item.timestamp && (
            <>
              <span className="text-secondary/25">·</span>
              <span className="shrink-0">{getTimeLabel(item.timestamp)}</span>
            </>
          )}
        </div>
      </article>
    </button>
  );
}

/* ─── Topic Sidebar Item ─── */

function EditorialTopicItem({
  topic,
  onClick,
}: {
  topic: { id: string; title: string; sourceCount: number; articleCount: number };
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left hover:bg-foreground/[0.03] -mx-2 px-2 rounded-lg transition-colors"
    >
      <article className="py-3.5 border-b border-border/15">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground/45">
            Topic
          </span>
        </div>
        <h4 className="text-[14px] font-semibold text-foreground leading-snug tracking-[-0.01em] mb-1.5 line-clamp-2">
          {stripMarkdown(topic.title)}
        </h4>
        <div className="flex items-center gap-1.5 text-[10px] text-secondary/50">
          <span>{topic.sourceCount} sources</span>
          <span className="text-secondary/25">·</span>
          <span>{topic.articleCount} updates</span>
        </div>
      </article>
    </button>
  );
}

/* ─── Convert data to EditorItems ─── */

function toEditorItem(item: PublicFeedCardItem): EditorItem {
  return {
    id: item.id,
    title: item.title,
    preview: item.preview || item.summary,
    source: item.source,
    sourceCount: item.sourceCount || 0,
    timestamp: item.timestamp,
    thumbnail: item.thumbnail,
  };
}

/* ─── Main 3-Column Editorial Layout ─── */

export function DailyEditorialLayout({
  stories,
  topics,
  onStoryClick,
}: {
  stories: PublicFeedCardItem[];
  topics: PublicTopicCardItem[];
  archiveDates?: Array<{ date: string; topHeadline?: string; trendingCount: number }>;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  onStoryClick?: (item: PublicFeedCardItem) => void;
}) {
  const editorItems = stories.map(toEditorItem);

  // Hero = first story
  const heroItem = editorItems[0] || null;
  // Center grid = next 4 stories
  const centerGrid = editorItems.slice(1, 5);
  // Remaining stories — split evenly between left and right, max 6 per side
  const remaining = editorItems.slice(5);
  const half = Math.min(Math.ceil(remaining.length / 2), 8);
  const leftStories = remaining.slice(0, half);
  const rightStories = remaining.slice(half, half + 8);

  // Interleave topics into sidebar lists — insert a topic every 3 stories
  type SidebarEntry =
    | { kind: "story"; data: EditorItem; storyIdx: number }
    | { kind: "topic"; data: { id: string; title: string; sourceCount: number; articleCount: number } };

  function interleaveSidebar(stories: EditorItem[], topics: typeof topicItems, startTopicIdx: number): {
    entries: SidebarEntry[];
    topicsUsed: number;
  } {
    const entries: SidebarEntry[] = [];
    let ti = startTopicIdx;
    for (let si = 0; si < stories.length; si++) {
      // Insert topic every 3 stories if available
      if (ti < topics.length && si > 0 && si % 3 === 0) {
        const t = topics[ti];
        entries.push({
          kind: "topic",
          data: { id: t.id, title: t.title, sourceCount: t.sourceCount, articleCount: t.articleCount },
        });
        ti++;
      }
      entries.push({ kind: "story", data: stories[si], storyIdx: si });
    }
    return { entries, topicsUsed: ti - startTopicIdx };
  }

  const topicItems = topics.map((t) => ({
    id: t.id,
    title: t.title,
    sourceCount: t.sourceCount,
    articleCount: t.articleCount,
  }));

  const leftResult = interleaveSidebar(leftStories, topicItems, 0);
  const rightResult = interleaveSidebar(rightStories, topicItems, leftResult.topicsUsed);

  return (
    <div className="hidden lg:block">
      <div className="grid grid-cols-[minmax(200px,1fr)_minmax(0,2.2fr)_minmax(200px,1fr)] gap-8 pt-6 pb-8">
        {/* Left sidebar — stories + topics interleaved */}
        <aside className="min-w-0">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/60">
              More stories
            </span>
            <div className="flex-1 h-px bg-border/25" />
          </div>
          <div>
            {leftResult.entries.length > 0 ? (
              leftResult.entries.map((entry, ei) => {
                const isLast = ei === leftResult.entries.length - 1;
                if (entry.kind === "topic") {
                  return (
                    <EditorialTopicItem
                      key={`t-${entry.data.id}`}
                      topic={entry.data}
                    />
                  );
                }
                return (
                  <EditorialSidebarItem
                    key={entry.data.id}
                    item={entry.data}
                    showDivider={!isLast}
                    onClick={() => {
                      const idx = stories.findIndex((s) => s.id === entry.data.id);
                      if (idx >= 0) onStoryClick?.(stories[idx]);
                    }}
                  />
                );
              })
            ) : (
              <p className="text-[13px] text-secondary/40 py-4">
                More stories on the right
              </p>
            )}
          </div>
        </aside>

        {/* Center — hero + grid */}
        <main className="min-w-0">
          {heroItem && (
            <div className="mb-8">
              <EditorialHeroCard
                item={heroItem}
                onClick={() => onStoryClick?.(stories[0])}
              />
            </div>
          )}
          {centerGrid.length > 0 && (
            <div className="grid grid-cols-2 gap-6">
              {centerGrid.map((item) => (
                <EditorialMediumCard
                  key={item.id}
                  item={item}
                  onClick={() => {
                    const idx = stories.findIndex((s) => s.id === item.id);
                    if (idx >= 0) onStoryClick?.(stories[idx]);
                  }}
                />
              ))}
            </div>
          )}
        </main>

        {/* Right sidebar — stories + topics interleaved */}
        <aside className="min-w-0">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/60">
              More stories
            </span>
            <div className="flex-1 h-px bg-border/25" />
          </div>
          <div>
            {rightResult.entries.length > 0 ? (
              rightResult.entries.map((entry, ei) => {
                const isLast = ei === rightResult.entries.length - 1;
                if (entry.kind === "topic") {
                  return (
                    <EditorialTopicItem
                      key={`t-${entry.data.id}`}
                      topic={entry.data}
                    />
                  );
                }
                return (
                  <EditorialSidebarItem
                    key={entry.data.id}
                    item={entry.data}
                    showDivider={!isLast}
                    onClick={() => {
                      const idx = stories.findIndex((s) => s.id === entry.data.id);
                      if (idx >= 0) onStoryClick?.(stories[idx]);
                    }}
                  />
                );
              })
            ) : (
              <p className="text-[13px] text-secondary/40 py-4">
                No more stories
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
