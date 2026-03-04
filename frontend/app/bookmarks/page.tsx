"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Trash2,
  Quote,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';

type Snippet = { key: string; content: string; label: string; savedAt: string };

function getSnippets(): Snippet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('trace_saved_snippets');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function removeSnippet(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const snippets = getSnippets();
    localStorage.setItem('trace_saved_snippets', JSON.stringify(snippets.filter(s => s.key !== key)));
  } catch { /* */ }
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

type FilterType = 'all' | 'articles' | 'snippets';

export default function BookmarksPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);

  const showArticles = activeFilter === 'all' || activeFilter === 'articles';
  const showSnippets = activeFilter === 'all' || activeFilter === 'snippets';
  const hasMultipleTypes = bookmarks.length > 0 && snippets.length > 0;

  useEffect(() => {
    if (!isAlphaMode()) { router.push(user ? '/waitlist' : '/'); return; }
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  const loadBookmarks = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      setSnippets(getSnippets());
      const token = await user.getIdToken();
      const response = await fetch('/api/bookmarks', {
        headers: { 'Authorization': `Bearer ${token}` },
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
    if (selectedSnippet?.key === key) setSelectedSnippet(null);
  };

  useEffect(() => { if (user) loadBookmarks(); }, [user, loadBookmarks]);

  const handleRemoveBookmark = async (itemId: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/bookmarks?item_id=${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) setBookmarks(prev => prev.filter(b => b.item_id !== itemId));
    } catch (error) { console.error('Error removing bookmark:', error); }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header backHref="/feed" backLabel="Back to Feed" />

      <main className="container mx-auto px-4 max-w-3xl py-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold">Saved</h1>
          {(bookmarks.length > 0 || snippets.length > 0) && (
            <p className="text-sm text-secondary/40 mt-1">
              {bookmarks.length > 0 && `${bookmarks.length} ${bookmarks.length === 1 ? 'article' : 'articles'}`}
              {bookmarks.length > 0 && snippets.length > 0 && ' · '}
              {snippets.length > 0 && `${snippets.length} ${snippets.length === 1 ? 'snippet' : 'snippets'}`}
            </p>
          )}
        </div>

        {/* Filter tabs */}
        {hasMultipleTypes && (
          <div className="flex gap-1 p-1 rounded-full bg-surface-secondary mb-6 w-fit">
            {(['all', 'articles', 'snippets'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all capitalize ${
                  activeFilter === f
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-secondary/50 hover:text-secondary'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-secondary/40" />
          </div>
        ) : (
          <>
            {/* Snippets */}
            {showSnippets && snippets.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-semibold text-secondary/40 tracking-wide mb-3">Snippets</p>
                <div className="flex flex-col gap-2">
                  <AnimatePresence>
                    {snippets.map((snippet) => (
                      <motion.button
                        key={snippet.key}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        onClick={() => setSelectedSnippet(snippet)}
                        className="text-left p-4 rounded-2xl bg-surface-secondary hover:bg-surface-secondary/70 transition-colors"
                      >
                        <p className="text-xs font-medium text-secondary/40 mb-1.5 truncate">
                          {snippet.label}
                        </p>
                        <p className="text-sm leading-relaxed line-clamp-3">
                          {snippet.content.replace(/\*\*/g, '')}
                        </p>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Articles */}
            {showArticles && bookmarks.length > 0 && (
              <div className="mb-8">
                {showSnippets && snippets.length > 0 && (
                  <p className="text-xs font-semibold text-secondary/40 tracking-wide mb-3">Articles</p>
                )}
                <div className="flex flex-col gap-2">
                  <AnimatePresence>
                    {bookmarks.map((bookmark) => (
                      <motion.div
                        key={bookmark.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-start gap-3 p-4 rounded-2xl bg-surface-secondary hover:bg-surface-secondary/70 transition-colors cursor-pointer group"
                        onClick={(e) => {
                          if (!(e.target as HTMLElement).closest('button'))
                            window.open(bookmark.item_metadata.url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-semibold leading-snug line-clamp-2 group-hover:text-foreground transition-colors mb-1">
                            {bookmark.item_metadata.title}
                          </h3>
                          {bookmark.item_metadata.why_relevant && (
                            <p className="text-xs text-secondary/40 line-clamp-2 mb-2">
                              {bookmark.item_metadata.why_relevant}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-secondary/30">
                            <span>Saved {new Date(bookmark.bookmarked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 pt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveBookmark(bookmark.item_id); }}
                            className="p-1.5 rounded-lg text-secondary/20 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={15} />
                          </button>
                          <ExternalLink size={14} className="text-secondary/20 group-hover:text-secondary/40 transition-colors" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Empty state */}
            {bookmarks.length === 0 && snippets.length === 0 && (
              <div className="text-center py-20">
                <div className="w-12 h-12 rounded-2xl bg-surface-secondary flex items-center justify-center mx-auto mb-4">
                  <Bookmark size={20} className="text-secondary/40" />
                </div>
                <p className="text-base font-semibold mb-1">Nothing saved yet</p>
                <p className="text-sm text-secondary/40">Save articles or snippets from deep dives</p>
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
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedSnippet(null)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-background rounded-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/10">
                  <p className="text-xs font-semibold text-secondary/40 tracking-wide">Snippet</p>
                  <button
                    onClick={() => handleRemoveSnippet(selectedSnippet.key)}
                    className="p-1.5 rounded-lg text-secondary/30 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="px-5 py-5 max-h-[60vh] overflow-y-auto">
                  <p className="text-xs font-medium text-secondary/40 mb-4">
                    {selectedSnippet.label}
                  </p>
                  <div className="text-base leading-relaxed whitespace-pre-wrap">
                    {selectedSnippet.content.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
                      if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
                        return <strong key={i}>{part.slice(2, -2)}</strong>;
                      if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
                        return <em key={i}>{part.slice(1, -1)}</em>;
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-border/10">
                  <button
                    onClick={() => setSelectedSnippet(null)}
                    className="w-full py-2.5 text-sm font-medium bg-surface-secondary rounded-full hover:bg-surface-secondary/70 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
