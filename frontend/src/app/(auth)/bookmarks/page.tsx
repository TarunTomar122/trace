"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Trash2,
  ExternalLink,
  Loader2,
  FileText,
  Quote,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';

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

type FilterType = 'articles' | 'snippets';

export default function BookmarksPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('articles');
  const [selectedItem, setSelectedItem] = useState<BookmarkItem | Snippet | null>(null);
  const [selectedType, setSelectedType] = useState<'article' | 'snippet' | null>(null);

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
    if (selectedType === 'snippet' && (selectedItem as Snippet)?.key === key) {
      setSelectedItem(null);
      setSelectedType(null);
    }
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
      if (response.ok) {
        setBookmarks(prev => prev.filter(b => b.item_id !== itemId));
        if (selectedType === 'article' && (selectedItem as BookmarkItem)?.item_id === itemId) {
          setSelectedItem(null);
          setSelectedType(null);
        }
      }
    } catch (error) { console.error('Error removing bookmark:', error); }
  };

  // Auto-select first item when list changes
  useEffect(() => {
    if (activeFilter === 'articles' && bookmarks.length > 0 && !selectedItem) {
      setSelectedItem(bookmarks[0]);
      setSelectedType('article');
    } else if (activeFilter === 'snippets' && snippets.length > 0 && !selectedItem) {
      setSelectedItem(snippets[0]);
      setSelectedType('snippet');
    }
  }, [activeFilter, bookmarks, snippets, selectedItem]);

  // Switch selection when changing tabs
  useEffect(() => {
    if (activeFilter === 'articles' && bookmarks.length > 0) {
      setSelectedItem(bookmarks[0]);
      setSelectedType('article');
    } else if (activeFilter === 'snippets' && snippets.length > 0) {
      setSelectedItem(snippets[0]);
      setSelectedType('snippet');
    } else {
      setSelectedItem(null);
      setSelectedType(null);
    }
  }, [activeFilter]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    );
  }

  const currentList = activeFilter === 'articles' ? bookmarks : snippets;
  const isEmpty = bookmarks.length === 0 && snippets.length === 0;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      {/* Folder Tabs */}
      <div className="flex items-end">
        <button
          onClick={() => setActiveFilter('articles')}
          className={`
            relative px-6 py-2.5 text-sm font-medium transition-colors flex items-center gap-2
            ${activeFilter === 'articles' ? 'text-foreground bg-surface z-10' : 'text-tab-inactive bg-surface-tertiary hover:text-foreground'}
            rounded-tl-lg
          `}
          style={{
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)',
          }}
        >
          <FileText size={16} />
          Articles
          {bookmarks.length > 0 && (
            <span className="text-xs text-secondary/50">({bookmarks.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('snippets')}
          className={`
            relative px-6 py-2.5 text-sm font-medium transition-colors flex items-center gap-2
            ${activeFilter === 'snippets' ? 'text-foreground bg-surface z-10' : 'text-tab-inactive bg-surface-tertiary hover:text-foreground'}
          `}
          style={{
            clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)',
            marginLeft: '-6px',
          }}
        >
          <Quote size={16} />
          Snippets
          {snippets.length > 0 && (
            <span className="text-xs text-secondary/50">({snippets.length})</span>
          )}
        </button>
      </div>

      {/* Main Container */}
      <div className="split-layout" style={{ height: 'calc(100vh - 100px)' }}>
        {/* Sidebar */}
        <div className="split-sidebar">
          <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
            <h2 className="text-[15px] font-semibold text-foreground">
              {activeFilter === 'articles' ? 'Saved Articles' : 'Saved Snippets'}
            </h2>
            <a
              href="/feed"
              className="text-xs text-secondary/50 hover:text-foreground transition-colors"
            >
              ← Feed
            </a>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-secondary/40" />
              </div>
            ) : currentList.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-secondary/50">
                  {activeFilter === 'articles' ? 'No saved articles yet' : 'No saved snippets yet'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-sidebar-border/50">
                {activeFilter === 'articles' && bookmarks.map((bookmark) => {
                  const isSelected = selectedType === 'article' && (selectedItem as BookmarkItem)?.id === bookmark.id;
                  return (
                    <button
                      key={bookmark.id}
                      onClick={() => { setSelectedItem(bookmark); setSelectedType('article'); }}
                      className={`article-list-item w-full text-left ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] text-secondary/50">
                          {new Date(bookmark.bookmarked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-[0.9375rem] font-semibold text-foreground leading-snug line-clamp-2">
                        {bookmark.item_metadata.title}
                      </h3>
                      {bookmark.item_metadata.why_relevant && (
                        <p className="text-[13px] text-secondary/60 line-clamp-1 leading-relaxed mt-1">
                          {bookmark.item_metadata.why_relevant}
                        </p>
                      )}
                    </button>
                  );
                })}

                {activeFilter === 'snippets' && snippets.map((snippet) => {
                  const isSelected = selectedType === 'snippet' && (selectedItem as Snippet)?.key === snippet.key;
                  return (
                    <button
                      key={snippet.key}
                      onClick={() => { setSelectedItem(snippet); setSelectedType('snippet'); }}
                      className={`article-list-item w-full text-left ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] text-secondary/50">
                          {new Date(snippet.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-[0.9375rem] font-semibold text-foreground leading-snug line-clamp-2">
                        {snippet.label}
                      </h3>
                      <p className="text-[13px] text-secondary/60 line-clamp-1 leading-relaxed mt-1">
                        {snippet.content.replace(/\*\*/g, '').slice(0, 80)}...
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="split-main">
          {isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-lg bg-surface-secondary flex items-center justify-center mb-4">
                <Bookmark size={24} className="text-secondary/40" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Nothing saved yet</h2>
              <p className="text-sm text-secondary/50 max-w-sm">
                Save articles or snippets from your feed to read them later.
              </p>
              <a
                href="/feed"
                className="mt-6 px-5 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                Go to Feed
              </a>
            </div>
          ) : !selectedItem ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-secondary/50 text-sm">Select an item to view</p>
            </div>
          ) : selectedType === 'article' ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[13px] text-secondary/50">
                  Saved {new Date((selectedItem as BookmarkItem).bookmarked_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRemoveBookmark((selectedItem as BookmarkItem).item_id)}
                    className="p-2 rounded-lg text-secondary/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={18} />
                  </button>
                  <a
                    href={(selectedItem as BookmarkItem).item_metadata.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-secondary/40 hover:text-foreground hover:bg-surface-secondary transition-colors"
                    title="Open original"
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>

              <h1 className="text-[2rem] font-semibold text-foreground leading-tight mb-6">
                {(selectedItem as BookmarkItem).item_metadata.title}
              </h1>

              {(selectedItem as BookmarkItem).item_metadata.why_relevant && (
                <p className="text-lg text-secondary leading-relaxed mb-6">
                  {(selectedItem as BookmarkItem).item_metadata.why_relevant}
                </p>
              )}

              {(selectedItem as BookmarkItem).item_metadata.description && (
                <p className="text-secondary leading-relaxed">
                  {(selectedItem as BookmarkItem).item_metadata.description}
                </p>
              )}

              <div className="pt-6 mt-8 border-t border-sidebar-border">
                <a
                  href={(selectedItem as BookmarkItem).item_metadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-secondary/60 hover:text-foreground transition-colors"
                >
                  Read original article →
                </a>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[13px] text-secondary/50">
                  Saved {new Date((selectedItem as Snippet).savedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <button
                  onClick={() => handleRemoveSnippet((selectedItem as Snippet).key)}
                  className="p-2 rounded-lg text-secondary/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Remove"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="text-xs font-medium text-secondary/40 uppercase tracking-wide mb-4">
                {(selectedItem as Snippet).label}
              </div>

              <div className="text-lg leading-relaxed whitespace-pre-wrap">
                {(selectedItem as Snippet).content.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
                  if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
                    return <strong key={i}>{part.slice(2, -2)}</strong>;
                  if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
                    return <em key={i}>{part.slice(1, -1)}</em>;
                  return <span key={i}>{part}</span>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
