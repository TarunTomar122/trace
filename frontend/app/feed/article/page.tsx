"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Clock, Bookmark, GraduationCap, Quote } from "lucide-react";
import Header from "@/components/Header";
import { FeedItem } from "@/lib/firestore";

const ACCENT = "#F59E0B";

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
  quote?: {
    text: string;
    source: string;
  };
};

type DeepDiveContent = {
  subtitle?: string;
  tldr?: string;
  chapters?: Chapter[];
  bottom_line?: {
    title: string;
    content: string;
  };
  images?: string[];
};

type SourceRef = {
  name: string;
  title: string;
  url: string;
};

// Strip "Slide N:" prefix from slides
function cleanSlides(slides: string[]): string[] {
  return slides.map(s => s.replace(/^Slide\s*\d+:\s*/i, ''));
}

// Saved snippets (localStorage for web)
type SavedSnippet = {
  key: string;
  content: string;
  label: string;
  savedAt: string;
};

function getSavedSnippets(): SavedSnippet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('trace_saved_snippets');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSnippet(key: string, content: string, label: string) {
  if (typeof window === 'undefined') return;
  try {
    const snippets = getSavedSnippets();
    const exists = snippets.some((s) => s.key === key);
    if (exists) return;
    snippets.push({ key, content, label, savedAt: new Date().toISOString() });
    localStorage.setItem('trace_saved_snippets', JSON.stringify(snippets));
  } catch {
    // ignore
  }
}

function isSnippetSaved(key: string): boolean {
  return getSavedSnippets().some((s) => s.key === key);
}

// Toast component
function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg flex items-center gap-2">
      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      {message}
    </div>
  );
}

export default function ArticlePage() {
  const router = useRouter();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("trace_article");
      if (raw) {
        setItem(JSON.parse(raw));
      } else {
        router.replace("/feed");
      }
    } catch {
      router.replace("/feed");
    }
  }, [router]);

  // Load saved state
  useEffect(() => {
    if (!item) return;
    const saved = new Set<string>();
    ['tldr', 'bottom_line', ...Array.from({ length: 10 }, (_, i) => `chapter_${i}`)].forEach(key => {
      if (isSnippetSaved(`${item.id}_${key}`)) saved.add(key);
    });
    setSavedSections(saved);
  }, [item]);

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
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: ACCENT, borderTopColor: "transparent" }}
        />
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

  // Deep dive content
  const deepDive = item.summary?.deep_dive as DeepDiveContent | undefined;
  const isChapterDeepDive = deepDive?.chapters && deepDive.chapters.length > 0;
  const sources = item.sources as SourceRef[] | undefined;

  const readingTime = item.summary?.reading_time_minutes || 3;
  const hasImage = item.thumbnail && typeof item.thumbnail === 'string' && item.thumbnail.length > 10;

  // Chapter-style Deep Dive
  if (isChapterDeepDive) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <Toast message={toast || ""} visible={!!toast} />

        <main className="container mx-auto px-4 max-w-2xl py-6">
          {/* Header badge */}
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap size={16} style={{ color: ACCENT }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
              Deep Dive
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold leading-tight mb-2">{item.title}</h1>

          {/* Subtitle */}
          {deepDive.subtitle && (
            <p className="text-base text-secondary/60 italic mb-4">{deepDive.subtitle}</p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-secondary/50 mb-6">
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {readingTime} min read
            </span>
            {sources && sources.length > 0 && (
              <span>{sources.length} sources</span>
            )}
          </div>

          {/* Hero image */}
          {hasImage && (
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-8">
              <img src={item.thumbnail!} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* TL;DR */}
          {deepDive.tldr && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5 mb-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>TL;DR</p>
                <button
                  onClick={() => handleSave('tldr', deepDive.tldr!, `${item.title} - TL;DR`)}
                  className="p-1 hover:opacity-70 transition-opacity"
                >
                  <Bookmark
                    size={16}
                    className={savedSections.has('tldr') ? 'fill-current' : ''}
                    style={{ color: savedSections.has('tldr') ? ACCENT : '#9ca3af' }}
                  />
                </button>
              </div>
              <p className="text-sm leading-relaxed">{deepDive.tldr}</p>
            </div>
          )}

          {/* Chapters */}
          {deepDive.chapters!.map((chapter, idx) => {
            const chapterKey = `chapter_${idx}`;
            const chapterContent = chapter.quote
              ? `${chapter.content}\n\n"${chapter.quote.text}" — ${chapter.quote.source}`
              : chapter.content;

            return (
              <div key={idx} className="mb-10">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-secondary/60">{idx + 1}</span>
                    </div>
                    <h2 className="text-lg font-semibold">{chapter.title}</h2>
                  </div>
                  <button
                    onClick={() => handleSave(chapterKey, chapterContent, `${item.title} - ${chapter.title}`)}
                    className="p-1 hover:opacity-70 transition-opacity flex-shrink-0 mt-1"
                  >
                    <Bookmark
                      size={16}
                      className={savedSections.has(chapterKey) ? 'fill-current' : ''}
                      style={{ color: savedSections.has(chapterKey) ? ACCENT : '#9ca3af' }}
                    />
                  </button>
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapter.content}</ReactMarkdown>
                </div>

                {chapter.quote && (
                  <div className="border-l-2 pl-4 py-1" style={{ borderColor: ACCENT }}>
                    <p className="text-sm italic text-secondary/80">"{chapter.quote.text}"</p>
                    <p className="text-xs font-medium text-secondary/50 mt-2">— {chapter.quote.source}</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom Line */}
          {deepDive.bottom_line && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-5 mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Quote size={14} style={{ color: ACCENT }} />
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                    {deepDive.bottom_line.title || "The Bottom Line"}
                  </p>
                </div>
                <button
                  onClick={() => handleSave('bottom_line', deepDive.bottom_line!.content, `${item.title} - Bottom Line`)}
                  className="p-1 hover:opacity-70 transition-opacity"
                >
                  <Bookmark
                    size={16}
                    className={savedSections.has('bottom_line') ? 'fill-current' : ''}
                    style={{ color: savedSections.has('bottom_line') ? ACCENT : '#9ca3af' }}
                  />
                </button>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{deepDive.bottom_line.content}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Sources */}
          {sources && sources.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary/50 mb-3">Sources</p>
              <div className="space-y-2">
                {sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{src.name}</p>
                      <p className="text-xs text-secondary/50 truncate">{src.title}</p>
                    </div>
                    <ExternalLink size={14} className="text-secondary/40 group-hover:text-secondary/60 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <button
              onClick={() => router.back()}
              className="text-sm text-secondary/60 hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Back to feed
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Learning Cards (For You) or Traditional Article
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Toast message={toast || ""} visible={!!toast} />

      <main className="container mx-auto px-4 max-w-2xl py-6">
        <h1 className="text-2xl font-bold leading-tight mb-3">{item.title}</h1>

        <div className="flex items-center gap-3 text-sm text-secondary/60 mb-6">
          {item.source_name && <span>{item.source_name}</span>}
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {readingTime} min read
          </span>
        </div>

        {/* Thumbnail */}
        {hasImage && (
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-6">
            <img src={item.thumbnail!} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {hasLearningCards ? (
          /* Learning Cards as Article Sections */
          <div className="space-y-8 mb-6">
            {learningCards!.map((card, i) => {
              const label = CARD_TYPE_LABELS[card.type] || card.type;
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{card.emoji}</span>
                    <p className="text-xs font-semibold uppercase tracking-wider text-secondary/50">
                      {label}
                    </p>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.content}</ReactMarkdown>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Traditional Article Format */
          <>
            {!isTrending && keyTakeaways && keyTakeaways.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-5 mb-6">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-3">
                  Key Takeaways
                </p>
                <ul className="space-y-2">
                  {keyTakeaways.map((t: string, i: number) => (
                    <li key={i} className="flex gap-2.5 items-start text-sm">
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: ACCENT }}
                      />
                      <span className="prose prose-sm dark:prose-invert [&>p]:m-0 [&>p]:inline">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{t}</ReactMarkdown>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {body ? (
              <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-secondary/60 mb-6">
                No summary available. Read the original article.
              </p>
            )}

            {!isTrending && whyItMatters && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5 mb-6">
                <p className="text-xs font-semibold text-secondary/60 uppercase tracking-wider mb-1.5">
                  Why it matters
                </p>
                <div className="prose prose-sm dark:prose-invert max-w-none italic text-secondary/70">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{whyItMatters}</ReactMarkdown>
                </div>
              </div>
            )}
          </>
        )}

        <div className="border-t border-gray-100 dark:border-gray-800 pt-5 mt-2 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-sm text-secondary/60 hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            Back to feed
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            Read Original <ExternalLink size={14} />
          </a>
        </div>
      </main>
    </div>
  );
}
