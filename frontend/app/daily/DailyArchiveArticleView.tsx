"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import { getArticleImage } from "@/lib/fallback-images";
import { stripMarkdown } from "@/lib/feed-article-text";
import type { PublicFeedCardItem } from "@/components/PublicFeedCard";

type ArticleViewItem = PublicFeedCardItem & {
  summary?: string;
  keyPoints?: string[];
};

function getTimeLabel(dateStr?: string): string {
  if (!dateStr) return "";
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return "";
  const now = new Date();
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

export default function DailyArchiveArticleView({
  item,
  sidebarItems,
  selectedId,
  onSelectStory,
  onBack,
}: {
  item: ArticleViewItem;
  sidebarItems: ArticleViewItem[];
  selectedId: string | null;
  onSelectStory: (id: string) => void;
  onBack: () => void;
}) {
  const imageUrl = getArticleImage(item.thumbnail || null, item.title);
  const body = item.summary || item.preview || "";

  return (
    <div className="pt-4 pb-16">
      <div className="grid grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] gap-10 xl:gap-14 items-start">
        <article className="min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] text-secondary/60 hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            <span>Back to feed</span>
          </button>

          <div className="flex items-center gap-2 text-[12px] text-secondary/55 mb-4">
            {item.source && (
              <span className="font-medium">{item.source}</span>
            )}
            {item.timestamp && (
              <>
                {item.source && <span className="text-secondary/30">·</span>}
                <span>{getTimeLabel(item.timestamp)}</span>
              </>
            )}
          </div>

          <h1 className="text-[2rem] xl:text-[2.25rem] font-bold text-foreground leading-[1.12] tracking-[-0.03em] mb-6">
            {stripMarkdown(item.title)}
          </h1>

          {imageUrl && (
            <div className="mb-8">
              <img
                src={imageUrl}
                alt=""
                decoding="async"
                className="w-full max-h-[420px] object-cover rounded-xl"
              />
            </div>
          )}

          {body && (
            <div className="mb-8 text-[17px] text-foreground/85 leading-[1.85]">
              {body.split("\n").map((p, i) => {
                const trimmed = p.trim();
                if (!trimmed) return <br key={i} />;
                return (
                  <p key={i} className="mb-4">
                    {stripMarkdown(trimmed)}
                  </p>
                );
              })}
            </div>
          )}

          {item.keyPoints && item.keyPoints.length > 0 && (
            <div className="mb-8 p-6 rounded-xl border border-border/15 bg-surface-secondary/20">
              <h3 className="text-[11px] font-semibold text-secondary/55 mb-4 uppercase tracking-[0.15em]">
                Key Takeaways
              </h3>
              <div className="space-y-3">
                {item.keyPoints.slice(0, 6).map((point, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-secondary/35 font-mono text-[13px] mt-0.5 shrink-0">
                      {i + 1}.
                    </span>
                    <p className="text-[15px] text-secondary/80 leading-relaxed">
                      {stripMarkdown(point)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.url && (
            <div className="pt-6 border-t border-border/15">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                Read original source
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </article>

        {/* Right sidebar — More Stories */}
        <aside className="min-w-0 sticky top-20 self-start">
          <div className="mb-5 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/70">
              More Stories
            </span>
            <div className="flex-1 h-px bg-border/25" />
          </div>

          <div className="flex flex-col">
            {sidebarItems.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelectStory(s.id);
                  window.scrollTo(0, 0);
                }}
                className={`group flex gap-3 py-3.5 border-b border-border/10 last:border-0 text-left hover:bg-foreground/[0.02] -mx-2 px-2 rounded-lg transition-colors ${
                  s.id === selectedId ? "bg-foreground/[0.04]" : ""
                }`}
              >
                <span className="text-[22px] font-bold text-foreground/15 leading-none mt-0.5 shrink-0 w-7 text-right tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[14px] font-semibold text-foreground leading-snug tracking-[-0.01em] mb-1 line-clamp-3 group-hover:text-foreground/80">
                    {stripMarkdown(s.title)}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-secondary/45">
                    {s.source && (
                      <span className="truncate max-w-[120px]">{s.source}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {sidebarItems.length === 0 && (
            <p className="text-[13px] text-secondary/40 py-4">
              No other stories right now
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
