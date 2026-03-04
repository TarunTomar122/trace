"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Bookmark, GraduationCap,
  ChevronLeft, ChevronRight, Loader2,
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

/* ─── Horizontal swipeable learning cards ─── */
function SwipeableCards({ cards, savedSections, onSave }: {
  cards: LearningCard[];
  savedSections: Set<string>;
  onSave: (i: number, content: string, label: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIdx(idx);
  };

  const scrollTo = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="mb-8 relative">
      {/* scroll container */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-0 pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map((card, i) => {
          const label = CARD_TYPE_LABELS[card.type] || card.type;
          const key = `card_${i}`;
          return (
            <div
              key={i}
              className="snap-start shrink-0 w-full px-0 flex"
            >
              <div className="flex-1 p-6 rounded-2xl bg-surface-secondary flex flex-col mx-1">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <p className="text-xs font-semibold text-secondary/50 tracking-wide">
                    {card.emoji} {label}
                  </p>
                  <button
                    onClick={() => onSave(i, card.content, label)}
                    className="p-1 -m-1 hover:opacity-70 transition-opacity shrink-0"
                  >
                    <Bookmark
                      size={16}
                      className={savedSections.has(key) ? 'text-foreground fill-current' : 'text-secondary/30'}
                    />
                  </button>
                </div>
                <div className="prose prose-base dark:prose-invert max-w-none flex-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.content}</ReactMarkdown>
                </div>
                <p className="text-xs text-secondary/30 text-right mt-4 select-none">{i + 1} / {cards.length}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Arrow buttons (web) */}
      {cards.length > 1 && (
        <>
          <button
            onClick={() => scrollTo(activeIdx - 1)}
            disabled={activeIdx === 0}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-8 h-8 rounded-full bg-background border border-border/20 shadow-sm flex items-center justify-center transition-opacity disabled:opacity-0 hover:bg-surface-secondary"
          >
            <ChevronLeft size={16} className="text-secondary/60" />
          </button>
          <button
            onClick={() => scrollTo(activeIdx + 1)}
            disabled={activeIdx === cards.length - 1}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-8 h-8 rounded-full bg-background border border-border/20 shadow-sm flex items-center justify-center transition-opacity disabled:opacity-0 hover:bg-surface-secondary"
          >
            <ChevronRight size={16} className="text-secondary/60" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`rounded-full transition-all duration-200 ${
                i === activeIdx ? 'w-4 h-1.5 bg-foreground/60' : 'w-1.5 h-1.5 bg-foreground/20 hover:bg-foreground/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArticlePage() {
  const router = useRouter();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<number | null>(null);

  useEffect(() => {
    // always start from the top when this page loads
    window.scrollTo(0, 0);
    try {
      const raw = sessionStorage.getItem("trace_article");
      if (raw) setItem(JSON.parse(raw));
      else router.replace("/feed");
    } catch { router.replace("/feed"); }
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
          <div className="relative aspect-[2.2/1] sm:aspect-[2.4/1] rounded-2xl overflow-hidden bg-surface-secondary">
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

            {/* Floating back */}
            <div className="absolute top-4 left-4">
              <button
                onClick={() => router.back()}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                <ArrowLeft size={18} className="text-white" />
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

      {/* Hero — no top padding, no bottom radius so cards can attach flush */}
      <div className="container mx-auto px-4 max-w-3xl pt-4">
        <div className="relative aspect-[2.2/1] sm:aspect-[2.4/1] rounded-t-2xl overflow-hidden bg-surface-secondary">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          {/* darken top for back button, fade bottom to page bg for seamless card attachment */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-black/20 to-black/30" />

          <div className="absolute top-4 left-4">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug mb-1.5">{item.title}</h1>
            <div className="flex items-center gap-3 text-xs text-secondary/50">
              {item.source_name && <span>{item.source_name}</span>}
              <span>· {readingTime} min read</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards start immediately below hero, no gap */}
      <main className="container mx-auto px-4 max-w-3xl pt-3 pb-8">
        {hasLearningCards ? (
          <SwipeableCards
            cards={learningCards!}
            savedSections={savedSections}
            onSave={(i, content, label) => handleSave(`card_${i}`, content, label)}
          />
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
            onClick={() => router.back()}
            className="text-sm text-secondary/50 hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            Back to feed
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
      </main>
    </div>
  );
}

