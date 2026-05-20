"use client";

import React, { useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Share2, Check, ExternalLink } from "lucide-react";
import { ArticleImage } from "@/components/ArticleImage";
import type { FeedItem, TrendingTopic } from "@/lib/firestore";
import {
  type FeedListItem,
  prepareFeedStoryNavigation,
  getFeedStoryPath,
  getFeedRelatedPool,
} from "./FeedUi";

const MD_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[#111827]">{children}</strong>
  ),
};

function stripMarkdown(text: string): string {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*#+\s*/gm, "")
    .trim();
}

function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return "";
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function FeedStoryTopic({
  item,
  returnHref,
}: {
  item: FeedListItem;
  returnHref: string;
}) {
  const router = useRouter();
  const topic = item.data as TrendingTopic;

  const [shareCopied, setShareCopied] = React.useState(false);

  const sortedTimeline = useMemo(() => {
    if (!topic.timeline) return [];
    return [...topic.timeline].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [topic.timeline]);

  const findArticle = useCallback(
    (event: { article_url?: string }) => {
      if (!event.article_url || !topic.articles) return null;
      return (
        topic.articles.find(
          (article) =>
            article.url === event.article_url &&
            article.summary?.short_article?.body,
        ) || null
      );
    },
    [topic.articles],
  );

  const openTimelineArticle = (article: FeedItem) => {
    const nested: FeedListItem = {
      id: article.id,
      type: "article",
      title: article.title,
      preview: article.summary?.short_article?.body?.slice(0, 140) || "",
      timestamp: article.published_date,
      source: article.source_name || article.source,
      sourceCount: 1,
      thumbnail: article.thumbnail,
      data: article,
    };
    const pool = getFeedRelatedPool();
    prepareFeedStoryNavigation(nested, pool.length > 0 ? pool : undefined);
    router.push(getFeedStoryPath(nested));
  };

  const handleShare = async () => {
    const slug = topic.topic_key || topic.id;
    const shareUrl = `${window.location.origin}/topics/${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const hasImage = topic.thumbnail && typeof topic.thumbnail === "string" && topic.thumbnail.length > 10;

  const metaParts = [
    topic.source_count ? `${topic.source_count} sources` : null,
    topic.article_count ? `${topic.article_count} updates` : null,
  ].filter(Boolean);
  const metaLine = metaParts.join(" · ");

  const firstArticleUrl = topic.articles?.[0]?.url;

  return (
    <div className="min-h-screen bg-[#f9f9f7]">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-[#e5e7eb]/60 bg-[#f9f9f7] px-5 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <Link
            href={returnHref}
            prefetch={false}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] text-[#374151] hover:text-[#111827]"
          >
            <ArrowLeft size={16} />
          </Link>
          {metaLine && (
            <p className="flex-1 truncate text-center text-[12px] font-medium text-[#9ca3af]">
              {metaLine}
            </p>
          )}
          <button
            onClick={handleShare}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] text-[#374151] hover:text-[#111827] transition-colors"
            aria-label="Share"
          >
            {shareCopied ? <Check size={15} className="text-green-500" /> : <Share2 size={15} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-12 pt-6">
        {/* title */}
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[#111827] leading-[1.22]">
          {topic.title}
        </h1>

        {/* hero image */}
        {hasImage && (
          <div className="mt-5 overflow-hidden rounded-2xl bg-[#e5e7eb]">
            <ArticleImage
              thumbnail={topic.thumbnail}
              title={topic.title}
              fallbackWidth={800}
              fallbackHeight={500}
              className="w-full aspect-[16/10] object-cover"
            />
          </div>
        )}

        {/* summary body */}
        {topic.summary && (
          <div className="mt-6 text-[16px] leading-[1.72] text-[#4b5563]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {topic.summary}
            </ReactMarkdown>
          </div>
        )}

        {/* key points */}
        {topic.key_points && topic.key_points.length > 0 && (
          <div className="mt-8">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
              Key points
            </p>
            <ul className="space-y-3.5">
              {topic.key_points.slice(0, 6).map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" />
                  <div className="text-[14.5px] leading-relaxed text-[#374151]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                      {point}
                    </ReactMarkdown>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* timeline */}
        {sortedTimeline.length > 0 && (
          <div className="mt-8">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
              Timeline
            </p>
            <div className="relative pl-4">
              {/* vertical line */}
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-[#e5e7eb]" />
              <div className="flex flex-col gap-5">
                {sortedTimeline.map((event, i) => {
                  const article = findArticle(event);
                  const isClickable = !!article;
                  const timeMeta = [getTimeAgo(event.timestamp), event.source_name].filter(Boolean).join(" · ");

                  const inner = (
                    <>
                      {timeMeta && (
                        <p className="text-[11px] font-medium text-[#9ca3af]">{timeMeta}</p>
                      )}
                      <p className="mt-0.5 text-[14px] font-semibold leading-snug text-[#111827]">
                        {event.title}
                      </p>
                      {event.summary && (
                        <p className="mt-1 text-[13px] leading-relaxed text-[#6b7280]">
                          {stripMarkdown(event.summary)}
                        </p>
                      )}
                    </>
                  );

                  return (
                    <div key={event.id || i} className="relative">
                      {/* dot */}
                      <div className="absolute -left-4 top-[7px] h-2 w-2 rounded-full border-2 border-[#2563eb] bg-white" />
                      {isClickable ? (
                        <button
                          type="button"
                          onClick={() => openTimelineArticle(article!)}
                          className="w-full text-left"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div>{inner}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* action buttons */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#e5e7eb] bg-white py-3 text-[14px] font-semibold text-[#374151] shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:bg-[#f9fafb] transition-colors"
          >
            <Share2 size={15} />
            Copy link
          </button>
          {firstArticleUrl && (
            <a
              href={firstArticleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#111827] py-3 text-[14px] font-semibold text-white hover:bg-[#1f2937] transition-colors"
            >
              Read original
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
