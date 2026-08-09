"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, Loader2, Newspaper, Trash2 } from 'lucide-react';
import { ArticleImage } from '@/components/ArticleImage';
import { useAuth } from '@/contexts/AuthContext';
import type { FeedItem } from '@/lib/firestore';
import { ReaderModal } from '../feed/FeedTwoPaneLayout';
import type { FeedListItem } from '../feed/FeedUi';
import PublicHeader from '@/components/PublicHeader';

type BookmarkItem = {
  id: string;
  item_id: string;
  item_metadata: {
    type?: string;
    title: string;
    description?: string;
    url?: string;
    thumbnail?: string | null;
    tags?: string[];
    source?: string;
    timestamp?: string;
  };
  bookmarked_at: string;
};

function toFeedItem(bookmark: BookmarkItem, article?: FeedItem): FeedListItem {
  const metadata = bookmark.item_metadata;
  const data: FeedItem = article || {
    id: bookmark.item_id,
    title: metadata.title,
    description: metadata.description,
    url: metadata.url || '',
    thumbnail: metadata.thumbnail,
    tags: metadata.tags,
    source_name: metadata.source,
    published_at: metadata.timestamp,
    summary: { short_article: { body: metadata.description } },
  };
  return {
    id: bookmark.item_id,
    type: 'article',
    title: data.title || metadata.title,
    preview: data.summary?.short_article?.subtitle || data.description || metadata.description || '',
    timestamp: data.published_date || metadata.timestamp,
    source: data.source_name || data.source || metadata.source,
    sourceCount: 1,
    thumbnail: data.thumbnail || metadata.thumbnail,
    tags: data.tags || metadata.tags,
    url: data.url || metadata.url,
    data,
  };
}

export default function BookmarksPage() {
  const { user, loading } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedBookmark, setSelectedBookmark] = useState<BookmarkItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<FeedListItem | null>(null);
  const messageTimer = useRef<number | null>(null);
  const readerOpener = useRef<HTMLElement | null>(null);

  const showMessage = useCallback((value: string) => {
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    setMessage(value);
    messageTimer.current = window.setTimeout(() => setMessage(null), 3000);
  }, []);

  useEffect(() => () => {
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
  }, []);

  const loadBookmarks = useCallback(async (cursor?: string) => {
    if (!user) return;
    if (cursor) setLoadingMore(true);
    else setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const response = await fetch(`/api/bookmarks${suffix}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Bookmark request failed (${response.status})`);
      const data = await response.json() as { bookmarks?: BookmarkItem[]; nextCursor?: string | null };
      setBookmarks((current) => cursor ? [...current, ...(data.bookmarks || [])] : data.bookmarks || []);
      setNextCursor(data.nextCursor || null);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      setError('Your saved stories could not be loaded. Try again.');
      if (cursor) setNextCursor(null);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) window.location.replace('/');
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    void loadBookmarks();
  }, [loadBookmarks, user]);

  const removeBookmark = async (itemId: string): Promise<boolean> => {
    if (!user) return false;
    setError(null);
    setRemovingIds((current) => new Set(current).add(itemId));
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/bookmarks?item_id=${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Bookmark removal failed (${response.status})`);
      setBookmarks((current) => current.filter((item) => item.item_id !== itemId));
      showMessage('Removed from your library.');
      return true;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      setError('That story could not be removed. Try again.');
      return false;
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
    }
  };

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-secondary" /></div>;
  }

  const openBookmark = async (bookmark: BookmarkItem) => {
    readerOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const savedItem = toFeedItem(bookmark);
    try {
      const response = await fetch(`/api/public/articles/${encodeURIComponent(bookmark.item_id)}`);
      if (!response.ok) throw new Error(`Article request failed (${response.status})`);
      const data = await response.json() as { article?: FeedItem };
      if (!data.article) throw new Error('Article response was incomplete');
      setSelectedItem(toFeedItem(bookmark, data.article));
    } catch (error) {
      console.error('Error loading saved article:', error);
      setSelectedItem(savedItem);
    }
    setSelectedBookmark(bookmark);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader showMobileNav={false} rightSlot={<div className="flex items-center gap-2"><Link href="/feed" aria-label="Open feed" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-secondary hover:bg-surface-secondary hover:text-foreground"><Newspaper size={17} aria-hidden="true" /></Link>{user.photoURL && <Image src={user.photoURL} alt="" width={32} height={32} className="rounded-full" />}</div>} />

      <section className="mx-auto mt-5 max-w-[1440px] px-3 sm:px-5 lg:px-7">
        <div role="status" aria-live="polite" aria-atomic="true" className={message ? 'mb-4 rounded-[14px] bg-foreground px-4 py-3 text-[13px] font-medium text-background' : 'sr-only'}>
          {message || ''}
        </div>
        {error && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-red-500/10 px-4 py-3 text-[13px] text-red-700 dark:text-red-300">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadBookmarks()}
              className="font-semibold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-secondary" /></div>
        ) : bookmarks.length === 0 ? (
          <div className="rounded-[20px] bg-surface px-6 py-24 text-center ring-1 ring-foreground/7 dark:ring-white/10">
            <Bookmark className="mx-auto text-secondary" />
            <h2 className="mt-4 text-[20px] font-semibold">Nothing saved yet</h2>
            <p className="mt-2 text-[14px] text-secondary">Bookmark stories from your feed and they will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bookmarks.map((bookmark) => (
              <article key={bookmark.id} className="group relative overflow-hidden rounded-[18px] bg-surface ring-1 ring-foreground/7 transition hover:-translate-y-0.5 hover:shadow-xl dark:ring-white/10">
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => void openBookmark(bookmark)}
                  aria-label={`Read saved story ${bookmark.item_metadata.title}`}
                >
                  <ArticleImage thumbnail={bookmark.item_metadata.thumbnail} title={bookmark.item_metadata.title} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                  <div className="min-h-[138px] p-5">
                    <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.17em] text-accent">{bookmark.item_metadata.tags?.[0] || 'Saved'}</p>
                    <h2 className="mt-3 text-[18px] font-semibold leading-[1.3] tracking-[-0.025em]">{bookmark.item_metadata.title}</h2>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${bookmark.item_metadata.title} from bookmarks`}
                  disabled={removingIds.has(bookmark.item_id)}
                  onClick={() => void removeBookmark(bookmark.item_id)}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-secondary opacity-100 shadow-sm ring-1 ring-foreground/10 transition hover:text-red-500 disabled:opacity-50 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                >
                  {removingIds.has(bookmark.item_id) ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </article>
            ))}
          </div>
        )}

        {nextCursor && (
          <div className="flex justify-center py-8">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadBookmarks(nextCursor || undefined)}
              className="rounded-full bg-surface px-5 py-3 text-[12px] font-semibold ring-1 ring-foreground/10 hover:bg-surface-secondary disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </section>

      {selectedBookmark && selectedItem && (
        <ReaderModal
          item={selectedItem}
          locked={false}
          bookmarked={true}
          bookmarkBusy={removingIds.has(selectedBookmark.item_id)}
          onBookmark={() => void removeBookmark(selectedBookmark.item_id).then((removed) => {
            if (removed) setSelectedBookmark(null);
          })}
          onClose={() => {
            setSelectedBookmark(null);
            setSelectedItem(null);
          }}
          restoreFocusTo={readerOpener.current}
        />
      )}
    </main>
  );
}
