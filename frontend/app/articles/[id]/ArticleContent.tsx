"use client";

import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSearchParams } from "next/navigation";
import { Clock, Share2, Check, Loader2, ExternalLink } from "lucide-react";
import StoryPageShell, { getStoryBackLabel } from "@/components/StoryPageShell";
import StorySharePromo from "@/components/StorySharePromo";
import { ArticleImage } from "@/components/ArticleImage";
import ArticleFeedback from "@/components/ArticleFeedback";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildArticleShareUrl,
  copyOrShareUrl,
  getPublicStoryCta,
} from "@/lib/article-share";

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
  const {
    user,
    profile,
    loading,
    profileResolved,
    profileFresh,
    profileRefreshFailed,
  } = useAuth();
  const [shareCopied, setShareCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shortArticle = article.summary?.short_article;
  const subtitle = normalizeText(shortArticle?.subtitle);
  const bodyContent = buildBodyContent(article);
  const keyTakeaways = Array.isArray(shortArticle?.key_takeaways)
    ? shortArticle!.key_takeaways!.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const whyItMatters = normalizeText(shortArticle?.why_it_matters);
  const readingTime = article.summary?.reading_time_minutes || 3;
  const fromParam = searchParams.get("from");
  const isFromFeed = Boolean(
    fromParam && getSafeReturnPath(fromParam, "").startsWith("/feed"),
  );
  const returnHref = isFromFeed ? getSafeReturnPath(fromParam, "/feed") : "/";
  const backLabel = getStoryBackLabel(returnHref);
  const isPublicShare = !isFromFeed;
  const shareUrl = useMemo(() => buildArticleShareUrl(article), [article]);
  const publicCta = getPublicStoryCta({
    user,
    profile,
    loading: loading || !profileResolved,
    profileFresh,
    profileRefreshFailed,
  });

  const handleShare = async () => {
    const url = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!url) return;
    setSharing(true);
    try {
      await copyOrShareUrl(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    } finally {
      setSharing(false);
    }
  };

  const shareButton = (
    <button
      type="button"
      onClick={handleShare}
      disabled={sharing}
      className="story-page-share"
    >
      {sharing ? (
        <Loader2 size={14} className="animate-spin" />
      ) : shareCopied ? (
        <Check size={14} className="text-green-500" />
      ) : (
        <Share2 size={14} />
      )}
      {sharing ? "Copying..." : shareCopied ? "Link copied" : "Copy link"}
    </button>
  );

  const overview = (
    <>
      <div className="story-page-meta mb-4">
        {article.source_name && <span>{article.source_name}</span>}
        {article.source_name && <span>·</span>}
        <span className="inline-flex items-center gap-1">
          <Clock size={13} />
          {readingTime} min read
        </span>
      </div>

      <h1 className="story-page-title">{article.title}</h1>

      {bodyContent ? (
        <div className="story-page-body mb-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyContent}</ReactMarkdown>
        </div>
      ) : (
        <p className="mb-8 text-sm text-[#6b7280]">
          No summary available. Read the original source.
        </p>
      )}

      {keyTakeaways.length > 0 && (
        <div className="mb-8">
          <h2 className="story-page-section-title">Key takeaways</h2>
          <div className="space-y-3">
            {keyTakeaways.map((point, index) => (
              <div key={index} className="story-page-key-point">
                <span className="story-page-key-point-dot" />
                <div className="story-page-body text-[15px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{point}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {whyItMatters && (
        <div className="story-page-card mb-8">
          <h2 className="story-page-section-title">Why it matters</h2>
          <div className="story-page-body text-[15px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{whyItMatters}</ReactMarkdown>
          </div>
        </div>
      )}

      <div className="story-page-actions">
        <ArticleFeedback articleId={article.id || article.url} />
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="story-page-btn-primary"
        >
          Read original source
          <ExternalLink size={14} />
        </a>
      </div>

      <StorySharePromo trackingId="shared_article_promo" />
    </>
  );

  const appContent = (
    <>
      <div className="story-page-meta mb-4">
        {article.source_name && <span>{article.source_name}</span>}
        {article.source_name && <span>·</span>}
        <span className="inline-flex items-center gap-1">
          <Clock size={13} />
          {readingTime} min read
        </span>
      </div>

      <h1 className="story-page-title">{article.title}</h1>

      {hasMeaningfulSubtitle(article) && (
        <p className="story-page-dek">{subtitle}</p>
      )}

      {article.thumbnail && (
        <div className="story-page-hero">
          <ArticleImage thumbnail={article.thumbnail} title={article.title} />
        </div>
      )}

      {bodyContent ? (
        <div className="story-page-body mb-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyContent}</ReactMarkdown>
        </div>
      ) : (
        <p className="mb-8 text-sm text-[#6b7280]">
          No summary available. Read the original source.
        </p>
      )}

      {keyTakeaways.length > 0 && (
        <div className="mb-8">
          <h2 className="story-page-section-title">Key takeaways</h2>
          <div className="space-y-3">
            {keyTakeaways.map((point, index) => (
              <div key={index} className="story-page-key-point">
                <span className="story-page-key-point-dot" />
                <div className="story-page-body text-[15px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{point}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {whyItMatters && (
        <div className="story-page-card mb-8">
          <h2 className="story-page-section-title">Why it matters</h2>
          <div className="story-page-body text-[15px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{whyItMatters}</ReactMarkdown>
          </div>
        </div>
      )}

      <div className="story-page-actions">
        <ArticleFeedback articleId={article.id || article.url} />
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="story-page-btn-primary"
        >
          Read original source
          <ExternalLink size={14} />
        </a>
      </div>
    </>
  );

  return (
    <StoryPageShell
      backHref={returnHref}
      backLabel={backLabel}
      mode={isFromFeed ? "app" : "public"}
      variant={isPublicShare ? "share" : "default"}
      showBack={isFromFeed}
      ctaHref={publicCta.href}
      ctaLabel={publicCta.headerLabel}
      shareButton={isFromFeed ? shareButton : undefined}
    >
      {isPublicShare ? (
        <div className="story-share-article">
          {article.thumbnail && (
            <div className="story-share-hero">
              <ArticleImage
                thumbnail={article.thumbnail}
                title={article.title}
                fallbackWidth={1200}
                fallbackHeight={1600}
              />
            </div>
          )}
          <div className="story-share-overview">
            {overview}
          </div>
        </div>
      ) : (
        appContent
      )}
    </StoryPageShell>
  );
}
