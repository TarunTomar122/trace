"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Youtube,
  Github,
  BookOpen,
  Bookmark,
  Sparkles,
  ArrowUpRight,
  MessageCircle,
  Trash2,
  Quote
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';

// Snippet type from localStorage
type Snippet = {
  key: string;
  content: string;
  label: string;
  savedAt: string;
};

// Get snippets from localStorage
function getSnippets(): Snippet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('trace_saved_snippets');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Remove a snippet from localStorage
function removeSnippet(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const snippets = getSnippets();
    const updated = snippets.filter(s => s.key !== key);
    localStorage.setItem('trace_saved_snippets', JSON.stringify(updated));
  } catch {
    // ignore
  }
}

type BookmarkItem = {
  id: string;
  item_id: string;
  item_metadata: {
    type?: string;
    title: string;
    description?: string;
    url: string;
    thumbnail?: string | null;
    tags?: string[];
    why_relevant?: string;
  };
  bookmarked_at: string;
};

const sourceConfig: Record<string, { icon: typeof Youtube; color: string; label: string; accent: string }> = {
  video: { icon: Youtube, color: 'text-red-500', label: 'Video', accent: 'bg-red-500' },
  repo: { icon: Github, color: 'text-violet-500', label: 'Repo', accent: 'bg-violet-500' },
  paper: { icon: BookOpen, color: 'text-blue-500', label: 'Paper', accent: 'bg-blue-500' },
  blog: { icon: BookOpen, color: 'text-emerald-500', label: 'Article', accent: 'bg-emerald-500' },
  discussion: { icon: MessageCircle, color: 'text-amber-500', label: 'Discussion', accent: 'bg-amber-500' },
  tweet: { icon: MessageCircle, color: 'text-sky-500', label: 'Thread', accent: 'bg-sky-500' },
  launch: { icon: Sparkles, color: 'text-fuchsia-500', label: 'Launch', accent: 'bg-fuchsia-500' },
  model: { icon: Sparkles, color: 'text-indigo-500', label: 'Model', accent: 'bg-indigo-500' },
};

function BookmarkCard({ bookmark, onRemove }: { 
  bookmark: BookmarkItem; 
  onRemove: () => void;
}) {
  const itemKind = bookmark.item_metadata.type || 'blog';
  const config = sourceConfig[itemKind] || sourceConfig.blog;
  const Icon = config.icon;
  const relevance = bookmark.item_metadata.why_relevant;

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="group p-4 md:p-5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('button')) {
          window.open(bookmark.item_metadata.url, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      {/* Top row: icon + source + context */}
      <div className="flex items-start gap-3 md:gap-4">
        {/* Source icon - hidden on mobile, matches feed */}
        <div className={`hidden md:flex w-12 h-12 rounded-xl items-center justify-center shrink-0 ${
          itemKind === 'video' ? 'bg-red-50 dark:bg-red-950' :
          itemKind === 'repo' ? 'bg-violet-50 dark:bg-violet-950' :
          itemKind === 'paper' ? 'bg-blue-50 dark:bg-blue-950' :
          itemKind === 'discussion' ? 'bg-amber-50 dark:bg-amber-950' :
          itemKind === 'tweet' ? 'bg-sky-50 dark:bg-sky-950' :
          itemKind === 'launch' ? 'bg-fuchsia-50 dark:bg-fuchsia-950' :
          itemKind === 'model' ? 'bg-indigo-50 dark:bg-indigo-950' :
          'bg-emerald-50 dark:bg-emerald-950'
        }`}>
          <Icon size={20} className={config.color} strokeWidth={1.5} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Source label */}
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <span className={`text-[10px] font-medium uppercase tracking-wider ${config.color}`}>{config.label}</span>
          </div>
          
          {/* Title - the main focus */}
          <div className="mb-2 md:mb-3">
            <h3 className="text-base md:text-lg font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {bookmark.item_metadata.title}
              <ArrowUpRight 
                size={14} 
                className="inline ml-1 opacity-40 md:opacity-0 group-hover:opacity-60 transition-opacity" 
              />
            </h3>
          </div>

          {/* Relevance below title (no clamp) */}
          {relevance && (
            <p className="text-xs text-secondary/70 mb-3 md:mb-4">
              {relevance}
            </p>
          )}
          
          {/* Actions row - only remove button */}
          <div className="flex items-center gap-1 md:gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="flex items-center gap-1.5 p-2 rounded-lg text-secondary/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors active:scale-95"
              title="Remove bookmark"
            >
              <Trash2 size={18} className="md:hidden" strokeWidth={1.5} />
              <Trash2 size={16} className="hidden md:block" strokeWidth={1.5} />
            </button>
            <div className="ml-auto text-[11px] text-secondary/50">
              Saved {new Date(bookmark.bookmarked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

type FilterType = 'all' | 'articles' | 'snippets';

export default function BookmarksPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);

  // Show articles based on filter
  const showArticles = activeFilter === 'all' || activeFilter === 'articles';
  const showSnippets = activeFilter === 'all' || activeFilter === 'snippets';

  // Only show filter tabs if there are both articles and snippets
  const hasMultipleTypes = bookmarks.length > 0 && snippets.length > 0;

  useEffect(() => {
    // Alpha mode check
    if (!isAlphaMode()) {
      if (user) {
        router.push('/waitlist');
      } else {
        router.push('/');
      }
      return;
    }

    if (!loading && !user) {
      router.push('/');
      return;
    }
  }, [user, loading, router]);

  const loadBookmarks = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Load snippets from localStorage
      setSnippets(getSnippets());

      const token = await user.getIdToken();
      const response = await fetch('/api/bookmarks', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleRemoveSnippet = (key: string) => {
    removeSnippet(key);
    setSnippets(getSnippets());
    if (selectedSnippet?.key === key) {
      setSelectedSnippet(null);
    }
  };

  useEffect(() => {
    if (user) {
      loadBookmarks();
    }
  }, [user, loadBookmarks]);

  const handleRemoveBookmark = async (itemId: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/bookmarks?item_id=${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setBookmarks(prev => prev.filter(b => b.item_id !== itemId));
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header backHref="/feed" backLabel="Back to Feed" />

      <main className="w-full mt-6 md:mt-8">
        {/* Page title */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Saved</h1>
          {(bookmarks.length > 0 || snippets.length > 0) && (
            <p className="text-sm text-secondary/60 mt-1">
              {bookmarks.length > 0 && `${bookmarks.length} ${bookmarks.length === 1 ? 'article' : 'articles'}`}
              {bookmarks.length > 0 && snippets.length > 0 && ' · '}
              {snippets.length > 0 && `${snippets.length} ${snippets.length === 1 ? 'snippet' : 'snippets'}`}
            </p>
          )}
        </div>
        {/* Mobile filters - horizontal scroll (only show if both types exist) */}
        {hasMultipleTypes && (
          <div className="md:hidden overflow-x-auto mb-4 px-4 scrollbar-hide">
            <div className="flex items-center gap-2 pb-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'articles', label: 'Articles' },
                { id: 'snippets', label: 'Snippets' },
              ].map(filter => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id as FilterType)}
                    className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all rounded-full ${
                      isActive
                        ? 'bg-foreground text-background'
                        : 'bg-slate-100 dark:bg-gray-800 text-secondary hover:bg-slate-200 dark:hover:bg-gray-700 active:bg-slate-200 dark:active:bg-gray-700'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 md:flex md:gap-12">
          {/* Filters - left sidebar, sticky (desktop only) - only show if both types exist */}
          {hasMultipleTypes && (
            <aside className="hidden md:block w-48 shrink-0 sticky top-24 h-fit">
              <nav className="space-y-1.5 bg-white dark:bg-gray-950 rounded-xl border border-slate-200/60 dark:border-gray-800 p-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-secondary/60 mb-3 px-2">
                  Filters
                </h2>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'articles', label: 'Articles' },
                  { id: 'snippets', label: 'Snippets' },
                ].map(filter => {
                  const isActive = activeFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id as FilterType)}
                      className={`w-full text-left px-3 py-2 text-sm font-medium transition-all rounded-lg ${
                        isActive
                          ? 'text-foreground bg-gray-100 dark:bg-gray-800'
                          : 'text-secondary hover:text-foreground hover:bg-slate-50 dark:hover:bg-gray-900'
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </nav>
            </aside>
          )}

          {/* Bookmarks content */}
          <div className="flex-1 max-w-2xl mx-auto md:mx-0 w-full">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-secondary">
                  Loading your saved items...
                </p>
              </div>
            ) : (
              <>
                {/* Snippets section */}
                {showSnippets && snippets.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Quote size={16} className="text-secondary/60" strokeWidth={2} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-secondary/60">
                        Snippets
                      </span>
                    </div>
                    <div className="space-y-3">
                      <AnimatePresence>
                        {snippets.map((snippet) => (
                          <motion.div
                            key={snippet.key}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, height: 0 }}
                            onClick={() => setSelectedSnippet(snippet)}
                            className="group p-4 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                          >
                            <p className="text-xs font-medium text-secondary/60 mb-2 truncate">
                              {snippet.label}
                            </p>
                            <p className="text-sm text-foreground line-clamp-3">
                              {snippet.content.replace(/\*\*/g, '')}
                            </p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Articles section */}
                {showArticles && bookmarks.length > 0 && (
                  <div className="space-y-3">
                    {snippets.length > 0 && showSnippets && (
                      <div className="flex items-center gap-2 mb-4">
                        <Bookmark size={16} className="text-secondary/60" strokeWidth={2} />
                        <span className="text-xs font-semibold uppercase tracking-wider text-secondary/60">
                          Articles
                        </span>
                      </div>
                    )}
                    <AnimatePresence>
                      {bookmarks.map((bookmark) => (
                        <BookmarkCard
                          key={bookmark.id}
                          bookmark={bookmark}
                          onRemove={() => handleRemoveBookmark(bookmark.item_id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Empty state */}
                {bookmarks.length === 0 && snippets.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 md:py-20 px-4"
                  >
                    <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Bookmark size={24} className="text-foreground" />
                    </div>
                    <p className="text-lg font-semibold text-foreground mb-2">
                      Nothing saved yet
                    </p>
                    <p className="text-sm text-secondary mb-4">
                      Save articles or snippets from deep dives
                    </p>
                  </motion.div>
                )}

                {/* End indicator */}
                {(bookmarks.length > 0 || snippets.length > 0) && (
                  <div className="py-8 md:py-12 text-center">
                    <p className="text-xs text-secondary/60">
                      {bookmarks.length > 0 && `${bookmarks.length} ${bookmarks.length === 1 ? 'article' : 'articles'}`}
                      {bookmarks.length > 0 && snippets.length > 0 && ' · '}
                      {snippets.length > 0 && `${snippets.length} ${snippets.length === 1 ? 'snippet' : 'snippets'}`}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Snippet modal */}
            <AnimatePresence>
              {selectedSnippet && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                  onClick={() => setSelectedSnippet(null)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg bg-background rounded-2xl overflow-hidden shadow-xl"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <Quote size={16} className="text-secondary/60" strokeWidth={2} />
                        <span className="text-xs font-semibold uppercase tracking-wider text-secondary/60">
                          Snippet
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveSnippet(selectedSnippet.key)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                      >
                        <Trash2 size={18} strokeWidth={2} />
                      </button>
                    </div>
                    <div className="p-5 max-h-[60vh] overflow-y-auto">
                      <p className="text-xs font-medium text-secondary/60 mb-4">
                        {selectedSnippet.label}
                      </p>
                      <div className="text-base leading-relaxed whitespace-pre-wrap">
                        {selectedSnippet.content.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
                          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                            return <strong key={i}>{part.slice(2, -2)}</strong>;
                          }
                          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                            return <em key={i}>{part.slice(1, -1)}</em>;
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </div>
                    </div>
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                      <button
                        onClick={() => setSelectedSnippet(null)}
                        className="w-full py-2.5 text-sm font-medium text-foreground bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Empty right sidebar for layout consistency */}
          <aside className="hidden md:block w-48 shrink-0"></aside>
        </div>
      </main>
    </div>
  );
}

