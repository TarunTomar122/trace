"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Bookmark, GraduationCap,
  ChevronLeft, ChevronRight, Loader2, Share2, Check, Download,
} from "lucide-react";
import Header from "@/components/Header";
import { FeedItem } from "@/lib/firestore";
import { getArticleImage } from "@/lib/fallback-images";


const CARD_TYPE_LABELS: Record<string, string> = {
  hook: "The Story",
  insight: "Key Insight",
  why: "Why It Matters",
  bottom_line: "The Bottom Line",
};

type LearningCard = {
  type: "hook" | "insight" | "why" | "bottom_line";
  emoji: string;
  content: string;
};

type Chapter = {
  title: string;
  content: string;
  quote?: { text: string; source: string };
};

type DeepDiveContent = {
  subtitle?: string;
  tldr?: string;
  chapters?: Chapter[];
  bottom_line?: { title: string; content: string };
  images?: string[];
};

type SourceRef = { name: string; title: string; url: string };
const ARTICLE_RETURN_TO_KEY = "trace_article_returnTo";

function cleanSlides(slides: string[]): string[] {
  return slides.map(s => s.replace(/^Slide\s*\d+:\s*/i, ''));
}

type SavedSnippet = { key: string; content: string; label: string; savedAt: string };

function getSavedSnippets(): SavedSnippet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('trace_saved_snippets');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSnippet(key: string, content: string, label: string) {
  if (typeof window === 'undefined') return;
  try {
    const snippets = getSavedSnippets();
    if (snippets.some((s) => s.key === key)) return;
    snippets.push({ key, content, label, savedAt: new Date().toISOString() });
    localStorage.setItem('trace_saved_snippets', JSON.stringify(snippets));
  } catch { /* */ }
}

function isSnippetSaved(key: string): boolean {
  return getSavedSnippets().some((s) => s.key === key);
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-foreground text-background text-sm font-medium rounded-full shadow-lg">
      {message}
    </div>
  );
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
}

function getSafeReturnTo(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/feed")) return null;
  return value;
}

/* ─── Inline article sections ─── */
function ArticleSections({ cards }: { cards: LearningCard[] }) {
  const typeCount: Record<string, number> = {};
  return (
    <div className="mb-8 flex flex-col gap-6">
      {cards.map((card, i) => {
        const baseLabel = CARD_TYPE_LABELS[card.type] || card.type;
        typeCount[card.type] = (typeCount[card.type] || 0) + 1;
        const count = typeCount[card.type];
        const label = count > 1 ? `${baseLabel} ${count}` : baseLabel;
        return (
          <div key={i}>
            <p className="text-[11px] font-semibold text-secondary/40 uppercase tracking-[0.12em] mb-2">
              {card.emoji} {label}
            </p>
            <div className="prose prose-base dark:prose-invert max-w-none leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.content}</ReactMarkdown>
            </div>
            {i < cards.length - 1 && (
              <div className="mt-6 border-b border-border/10" />
            )}
          </div>
        );
      })}
    </div>
  );
}

const FEED_TYPE_PREFIX: Record<string, string> = {
  for_you: 'fy',
  deep_dives: 'dd',
  trending: 'tr',
};

function buildShareUrl(item: FeedItem): string | null {
  const feedType = item.feed_type || item.metadata?.feed_type;
  const prefix = feedType ? FEED_TYPE_PREFIX[feedType] : null;
  if (!prefix || !item.id) return null;
  return `https://www.yourtrace.online/articles/${prefix}_${item.id}`;
}

export default function ArticlePage() {
  const router = useRouter();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    // always start from the top when this page loads
    window.scrollTo(0, 0);
    const returnToFromUrl = getSafeReturnTo(
      new URLSearchParams(window.location.search).get("returnTo")
    );
    try {
      const raw = sessionStorage.getItem("trace_article");
      if (raw) setItem(JSON.parse(raw));
      else router.replace(returnToFromUrl || "/feed");
    } catch { router.replace(returnToFromUrl || "/feed"); }
  }, [router]);

  useEffect(() => {
    if (!item) return;
    const saved = new Set<string>();
    ['tldr', 'bottom_line', ...Array.from({ length: 10 }, (_, i) => `chapter_${i}`), ...Array.from({ length: 10 }, (_, i) => `card_${i}`)].forEach(key => {
      if (isSnippetSaved(`${item.id}_${key}`)) saved.add(key);
    });
    setSavedSections(saved);
  }, [item]);

  // scroll to top whenever we switch chapters
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [openChapter]);

  const handleSave = (key: string, content: string, label: string) => {
    if (savedSections.has(key)) return;
    saveSnippet(`${item?.id}_${key}`, content, label);
    setSavedSections(prev => new Set(prev).add(key));
    setToast("Saved");
    setTimeout(() => setToast(null), 2000);
  };

  const handleBack = () => {
    const returnToFromUrl = getSafeReturnTo(
      new URLSearchParams(window.location.search).get("returnTo")
    );
    const storedReturnTo = getSafeReturnTo(sessionStorage.getItem(ARTICLE_RETURN_TO_KEY));
    const returnTo = storedReturnTo || returnToFromUrl;
    if (returnTo) {
      sessionStorage.removeItem(ARTICLE_RETURN_TO_KEY);
      router.replace(returnTo);
    } else {
      router.back();
    }
  };

  const handleShare = async () => {
    if (!item) return;
    setShareLoading(true);
    const shareUrl = buildShareUrl(item) || item.url;

    try {
      // Generate share image
      const params = new URLSearchParams({
        headline: item.title,
        imageUrl: item.thumbnail || '',
        url: shareUrl,
        format: 'square',
      });
      const imageResponse = await fetch(`/api/share/render?${params.toString()}`);

      if (!imageResponse.ok) {
        throw new Error('Failed to generate image');
      }

      const blob = await imageResponse.blob();
      const file = new File([blob], 'trace-story.png', { type: 'image/png' });

      // Try Web Share API with file
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: item.title,
          text: `Read the full story on Trace: ${shareUrl}`,
        });
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trace-story.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      // Fallback to just copying the URL
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch { /* nothing */ }
    } finally {
      setShareLoading(false);
    }
  };

  if (!item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    );
  }

  const isTrending = item.feed_type === "trending" || item.metadata?.feed_type === "trending";
  const rawSlides = item.summary?.short_article?.slides;
  const slides = rawSlides?.length ? cleanSlides(rawSlides) : [];
  const rawBody = item.summary?.short_article?.body || '';
  const body = (isTrending && slides.length) ? slides.join('\n\n') : (rawBody.length > 100 ? rawBody : (slides.length ? slides.join('\n\n') : rawBody));
  const keyTakeaways = item.summary?.short_article?.key_takeaways;
  const whyItMatters = item.summary?.short_article?.why_it_matters;
  const learningCards = item.summary?.short_article?.learning_cards as LearningCard[] | undefined;
  const hasLearningCards = learningCards && learningCards.length > 0;

  const deepDive = item.summary?.deep_dive as DeepDiveContent | undefined;
  const isChapterDeepDive = deepDive?.chapters && deepDive.chapters.length > 0;
  const sources = item.sources as SourceRef[] | undefined;
  const readingTime = item.summary?.reading_time_minutes || 3;
  const hasImage = item.thumbnail && typeof item.thumbnail === 'string' && item.thumbnail.length > 10;
  const imageUrl = hasImage ? item.thumbnail! : getArticleImage(null, item.title);

  /* ═══════════════════════════════════════════════════════
     Deep Dive — Chapter detail view
     ═══════════════════════════════════════════════════════ */
  if (isChapterDeepDive && openChapter !== null && deepDive!.chapters![openChapter]) {
    const chapters = deepDive!.chapters!;
    const chapter = chapters[openChapter];
    const idx = openChapter;
    const chapterKey = `chapter_${idx}`;
    const chapterContent = chapter.quote
      ? `${chapter.content}\n\n"${chapter.quote.text}" — ${chapter.quote.source}`
      : chapter.content;
    const paragraphs = splitParagraphs(chapter.content);

    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <Toast message={toast || ""} visible={!!toast} />

        {/* Chapter breadcrumb bar */}
        <div className="sticky top-14 bg-background/95 backdrop-blur-md z-40 border-b border-border/10">
          <div className="container mx-auto px-4 max-w-3xl flex items-center justify-between h-11">
            <button
              onClick={() => setOpenChapter(null)}
              className="flex items-center gap-1.5 text-sm text-secondary hover:text-foreground transition-colors"
            >
              <ChevronLeft size={18} />
              <span>Chapters</span>
            </button>
            <span className="text-xs text-secondary/50 font-medium">
              {idx + 1} of {chapters.length}
            </span>
            <button
              onClick={() => handleSave(chapterKey, chapterContent, `${item.title} - ${chapter.title}`)}
              className="p-1.5 hover:opacity-70 transition-opacity"
            >
              <Bookmark
                size={18}
                className={savedSections.has(chapterKey) ? 'text-foreground fill-current' : 'text-secondary/40'}
              />
            </button>
          </div>
        </div>

        <main className="container mx-auto px-4 max-w-3xl py-8">
          <h2 className="text-2xl font-bold leading-tight mb-6">{chapter.title}</h2>

          <div className="space-y-4">
            {paragraphs.map((para, pi) => (
              <div key={pi} className="prose prose-base dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{para}</ReactMarkdown>
              </div>
            ))}
          </div>

          {chapter.quote && (
            <div className="border-l-2 border-border/30 pl-5 py-2 mt-8">
              <p className="text-base italic text-secondary/70 leading-relaxed">
                &ldquo;{chapter.quote.text}&rdquo;
              </p>
              <p className="text-sm font-medium text-secondary/50 mt-2">
                — {chapter.quote.source}
              </p>
            </div>
          )}

          {/* Prev / Next */}
          <div className="flex gap-3 mt-12">
            {idx > 0 ? (
              <button
                onClick={() => setOpenChapter(idx - 1)}
                className="flex-1 flex items-center gap-3 p-4 rounded-2xl bg-surface-secondary hover:bg-surface-secondary/80 transition-colors text-left"
              >
                <ChevronLeft size={18} className="text-secondary/40 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-secondary/40 mb-0.5">Previous</p>
                  <p className="text-sm font-medium truncate">{chapters[idx - 1].title}</p>
                </div>
              </button>
            ) : <div className="flex-1" />}
            {idx < chapters.length - 1 ? (
              <button
                onClick={() => setOpenChapter(idx + 1)}
                className="flex-1 flex items-center justify-end gap-3 p-4 rounded-2xl bg-surface-secondary hover:bg-surface-secondary/80 transition-colors text-right"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-secondary/40 mb-0.5">Next</p>
                  <p className="text-sm font-medium truncate">{chapters[idx + 1].title}</p>
                </div>
                <ChevronRight size={18} className="text-secondary/40 shrink-0" />
              </button>
            ) : (
              <button
                onClick={() => setOpenChapter(null)}
                className="flex-1 flex items-center justify-end gap-3 p-4 rounded-2xl bg-surface-secondary hover:bg-surface-secondary/80 transition-colors text-right"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-secondary/40 mb-0.5">Done</p>
                  <p className="text-sm font-medium">Back to overview</p>
                </div>
                <ChevronRight size={18} className="text-secondary/40 shrink-0" />
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     Deep Dive — Overview page
     ═══════════════════════════════════════════════════════ */
  if (isChapterDeepDive) {
    const chapters = deepDive!.chapters!;

    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <Toast message={toast || ""} visible={!!toast} />

        <div className="container mx-auto px-4 max-w-3xl pt-6">
          {/* Hero image */}
          <div className="relative aspect-[1.6/1] sm:aspect-[1.8/1] rounded-2xl overflow-hidden bg-surface-secondary">
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

            {/* Floating back + share */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <button
                onClick={handleBack}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                <ArrowLeft size={18} className="text-white" />
              </button>
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors text-white text-xs font-medium disabled:opacity-50"
              >
                {shareLoading ? <Loader2 size={14} className="animate-spin" /> : shareCopied ? <Check size={14} className="text-green-400" /> : <Share2 size={14} />}
                {shareLoading ? 'Generating...' : shareCopied ? 'Shared!' : 'Share'}
              </button>
            </div>

            {/* Overlay content */}
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap size={13} className="text-white/70" />
                <span className="text-[11px] font-semibold text-white/70 tracking-wide">Deep Dive</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-2">{item.title}</h1>
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span>{readingTime} min read</span>
                <span>· {chapters.length} chapters</span>
              </div>
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 max-w-3xl py-6">
          {/* TL;DR */}
          {deepDive!.tldr && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-secondary/50 tracking-wide">TL;DR</p>
                <button
                  onClick={() => handleSave('tldr', deepDive!.tldr!, `${item.title} - TL;DR`)}
                  className="p-1 hover:opacity-70 transition-opacity"
                >
                  <Bookmark
                    size={16}
                    className={savedSections.has('tldr') ? 'text-foreground fill-current' : 'text-secondary/40'}
                  />
                </button>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{deepDive!.tldr}</ReactMarkdown>
              </div>
            </div>
          )}

          {deepDive!.subtitle && (
            <p className="text-base text-secondary/50 italic mb-6">{deepDive!.subtitle}</p>
          )}

          {/* Chapter list */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-secondary/50 tracking-wide mb-3">Chapters</p>
            <div className="flex flex-col gap-2">
              {chapters.map((ch, i) => (
                <button
                  key={i}
                  onClick={() => setOpenChapter(i)}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface-secondary hover:bg-surface-secondary/70 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-secondary/60">{i + 1}</span>
                  </div>
                  <span className="flex-1 text-[15px] font-semibold leading-snug line-clamp-2 group-hover:text-foreground">
                    {ch.title}
                  </span>
                  <ChevronRight size={16} className="text-secondary/30 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Bottom line */}
          {deepDive!.bottom_line && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-secondary/50 tracking-wide">
                  {deepDive!.bottom_line.title || "The Bottom Line"}
                </p>
                <button
                  onClick={() => handleSave('bottom_line', deepDive!.bottom_line!.content, `${item.title} - Bottom Line`)}
                  className="p-1 hover:opacity-70 transition-opacity"
                >
                  <Bookmark
                    size={16}
                    className={savedSections.has('bottom_line') ? 'text-foreground fill-current' : 'text-secondary/40'}
                  />
                </button>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{deepDive!.bottom_line.content}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Sources */}
          {sources && sources.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-semibold text-secondary/50 tracking-wide mb-3">Sources</p>
              <div className="flex flex-col gap-2">
                {sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-secondary hover:bg-surface-secondary/70 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{src.name}</p>
                      <p className="text-xs text-secondary/40 truncate">{src.title}</p>
                    </div>
                    <ExternalLink size={14} className="text-secondary/30 group-hover:text-secondary/50 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     For You / Traditional article
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Toast message={toast || ""} visible={!!toast} />

      {/* Hero image */}
      <div className="container mx-auto px-4 max-w-3xl pt-4">
        <div className="relative aspect-[1.6/1] sm:aspect-[1.8/1] rounded-2xl overflow-hidden bg-surface-secondary">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20" />

          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors text-white text-xs font-medium disabled:opacity-50"
            >
              {shareLoading ? <Loader2 size={14} className="animate-spin" /> : shareCopied ? <Check size={14} className="text-green-400" /> : <Share2 size={14} />}
              {shareLoading ? 'Generating...' : shareCopied ? 'Shared!' : 'Share'}
            </button>
          </div>
        </div>

        {/* Title + meta below image */}
        <div className="pt-4 pb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug mb-2">{item.title}</h1>
          <div className="flex items-center gap-2 text-xs text-secondary/50">
            {item.source_name && <span>{item.source_name}</span>}
            {item.source_name && <span>·</span>}
            <span>{readingTime} min read</span>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 max-w-3xl pt-5 pb-8">
        {hasLearningCards ? (
          <ArticleSections cards={learningCards!} />
        ) : (
          <>
            {!isTrending && keyTakeaways && keyTakeaways.length > 0 && (
              <div className="p-5 rounded-2xl bg-surface-secondary mb-6">
                <p className="text-xs font-semibold text-secondary/50 tracking-wide mb-3">
                  Key Takeaways
                </p>
                <ul className="space-y-2">
                  {keyTakeaways.map((t: string, i: number) => (
                    <li key={i} className="flex gap-2.5 items-start text-sm">
                      <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-secondary/30" />
                      <span className="prose prose-sm dark:prose-invert [&>p]:m-0 [&>p]:inline">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{t}</ReactMarkdown>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {body ? (
              <div className="prose prose-base dark:prose-invert max-w-none mb-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-secondary/50 mb-6">
                No summary available. Read the original article.
              </p>
            )}

            {!isTrending && whyItMatters && (
              <div className="p-5 rounded-2xl bg-surface-secondary mb-6">
                <p className="text-xs font-semibold text-secondary/50 tracking-wide mb-2">
                  Why it matters
                </p>
                <div className="prose prose-sm dark:prose-invert max-w-none text-secondary/70">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{whyItMatters}</ReactMarkdown>
                </div>
              </div>
            )}
          </>
        )}

        <div className="border-t border-border/10 pt-5 mt-2 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-sm text-secondary/50 hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            Back to feed
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-border hover:bg-surface-secondary transition-colors disabled:opacity-50"
            >
              {shareLoading ? <Loader2 size={14} className="animate-spin" /> : shareCopied ? <Check size={14} className="text-green-500" /> : <Share2 size={14} />}
              {shareLoading ? 'Generating...' : shareCopied ? 'Shared!' : 'Share'}
            </button>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              Read Original <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
