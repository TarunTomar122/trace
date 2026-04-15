"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Clock, Share2, Check, Loader2, Sparkles } from "lucide-react";

const ACCENT = "#F59E0B";

interface ArticleData {
  id: string;
  url: string;
  title: string;
  type: string;
  source: string;
  source_name: string;
  interest_id: string;
  feed_type: string;
  published_date: string;
  thumbnail: string | null;
  summary: {
    short_article?: {
      subtitle?: string;
      slides?: string[];
      outline?: string[];
      body?: string;
      key_takeaways?: string[];
      why_it_matters?: string;
    };
    reading_time_minutes?: number;
  };
  metadata: {
    feed_type: string;
    source_description?: string;
  };
}

interface Props {
  article: ArticleData;
}

function normalizeText(value?: string | null): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function buildBodyContent(article: ArticleData): string {
  const shortArticle = article.summary?.short_article;
  const rawBody = normalizeText(shortArticle?.body);
  const slides = Array.isArray(shortArticle?.slides)
    ? shortArticle.slides
        .map((slide) => normalizeText(String(slide).replace(/^Slide\s*\d+:\s*/i, "")))
        .filter(Boolean)
    : [];

  if (rawBody.length > 80) return rawBody;
  if (slides.length > 0) return slides.join("\n\n");
  return rawBody;
}

function hasMeaningfulSubtitle(article: ArticleData): boolean {
  const subtitle = normalizeText(article.summary?.short_article?.subtitle);
  if (!subtitle) return false;
  return subtitle.toLowerCase() !== normalizeText(article.title).toLowerCase();
}

function getSafeReturnPath(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export default function ArticleContent({ article }: Props) {
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shortArticle = article.summary?.short_article;
  const subtitle = normalizeText(shortArticle?.subtitle);
  const bodyContent = buildBodyContent(article);
  const keyTakeaways = Array.isArray(shortArticle?.key_takeaways)
    ? shortArticle!.key_takeaways!.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const whyItMatters = normalizeText(shortArticle?.why_it_matters);
  const readingTime = article.summary?.reading_time_minutes || 3;
  const hasImage = typeof article.thumbnail === "string" && article.thumbnail.length > 10;
  const returnHref = getSafeReturnPath(searchParams.get("from"), "/trending");
  const backLabel = returnHref.startsWith("/daily/") ? "Back to daily" : "Back";

  const handleShare = async () => {
    setSharing(true);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/10 bg-background/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/trace.webp" alt="Trace" width={28} height={28} className="h-7 w-7 rounded-md" />
            <span className="text-[15px] font-semibold tracking-[0.14em] text-foreground">TRACE</span>
          </Link>
          <Link
            href="/feed"
            className="text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: ACCENT }}
          >
            Get your feed
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-5 pb-10">
        <div className="mb-5">
          <Link
            href={returnHref}
            className="inline-flex items-center gap-1.5 text-sm text-secondary/55 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} />
            {backLabel}
          </Link>
        </div>

        <div className="mb-7 flex items-center gap-2 text-xs text-secondary/45">
          {article.source_name && <span>{article.source_name}</span>}
          {article.source_name && <span>·</span>}
          <span className="inline-flex items-center gap-1">
            <Clock size={13} />
            {readingTime} min read
          </span>
        </div>

        <h1 className="mb-5 text-[2.1rem] font-bold leading-[1.06] tracking-[-0.045em] text-foreground sm:text-[2.6rem]">
          {article.title}
        </h1>

        {hasMeaningfulSubtitle(article) && (
          <p className="mb-6 max-w-2xl text-[16px] leading-relaxed text-secondary/72">
            {subtitle}
          </p>
        )}

        {hasImage && (
          <div className="mb-7 overflow-hidden rounded-[24px] bg-surface-secondary">
            <img
              src={article.thumbnail!}
              alt=""
              className="max-h-[360px] w-full object-cover"
            />
          </div>
        )}

        {bodyContent ? (
          <div className="prose prose-base max-w-none text-[17px] leading-[1.95] text-secondary dark:prose-invert mb-8">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyContent}</ReactMarkdown>
          </div>
        ) : (
          <p className="mb-8 text-sm text-secondary/50">
            No summary available. Read the original source.
          </p>
        )}

        {keyTakeaways.length > 0 && (
          <div className="mb-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
              Key Takeaways
            </p>
            <ul className="space-y-2.5">
              {keyTakeaways.map((point, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 font-mono text-xs text-secondary/30">{index + 1}.</span>
                  <span className="prose prose-sm text-secondary/80 dark:prose-invert [&>p]:m-0 [&>p]:inline">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{point}</ReactMarkdown>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {whyItMatters && (
          <div className="mb-8 border-l-2 border-border/20 pl-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
              Why It Matters
            </p>
            <div className="prose prose-sm max-w-none text-secondary/75 dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{whyItMatters}</ReactMarkdown>
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-border/10 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-60"
            >
              {sharing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : copied ? (
                <Check size={14} className="text-green-500" />
              ) : (
                <Share2 size={14} />
              )}
              {sharing ? "Copying..." : copied ? "Link copied" : "Copy link"}
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: ACCENT }}
            >
              Read original source <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2 text-sm">
          <Link href="/trending" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
            Trending
          </Link>
          <Link href="/daily" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
            Daily archive
          </Link>
          <Link href="/research" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
            Research
          </Link>
          <Link href="/compare" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
            Compare
          </Link>
        </div>

        <div className="mt-12 rounded-[24px] border border-[color:rgba(245,158,11,0.18)] bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,247,237,0.95))] p-6">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: ACCENT }}
            >
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold text-foreground">
                Get your personalized feed
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-secondary/70">
                Trace groups the biggest stories, videos, and discussions into one feed so you can stay current without scanning ten tabs.
              </p>
              <Link
                href="/feed"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: ACCENT }}
              >
                Try Trace free
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
