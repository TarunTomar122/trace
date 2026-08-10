"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, Check, Chrome, ExternalLink, Lock, Share2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/contexts/AuthContext';
import { ArticleImage } from '@/components/ArticleImage';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';
import {
  trackCheckoutClicked,
  trackFeedItemBookmarked,
  trackFeedItemClicked,
  trackPaywallShown,
  trackSummaryOpened,
} from '@/lib/posthog';
import type { SummaryAccessResult } from '@/lib/free-reads';
import { buildArticleShareUrl, buildTopicShareUrl, copyOrShareUrl } from '@/lib/article-share';
import { addReaderHistoryState, isReaderHistoryState } from '@/lib/reader-history';
import type { HotTweet } from './FeedOneScreen';
import { type FeedListItem, getTimeLabel, INTEREST_LABEL } from './FeedUi';
import { WireFeedLoadingSkeleton } from './FeedBootShell';
import { CHROME_EXTENSION_URL } from '@/lib/product-links';

const CHROME_NOTICE_DISMISSED_KEY = 'trace.chrome-extension-notice.dismissed.v1';

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <>{children}</>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
      {children}
    </a>
  ),
};

function getBody(item: FeedListItem): string {
  if (item.type === 'topic') return (item.data as TrendingTopic).summary || item.preview;
  const article = item.data as FeedItem;
  return article.summary?.short_article?.body || article.summary?.short_article?.subtitle || item.preview;
}

function getKeyPoints(item: FeedListItem): string[] {
  if (item.type === 'topic') return (item.data as TrendingTopic).key_points || [];
  return (item.data as FeedItem).summary?.short_article?.key_takeaways || [];
}

function getItemUrl(item: FeedListItem): string | undefined {
  if (item.url) return item.url;
  if (item.type === 'article') return (item.data as FeedItem).url;
  return (item.data as TrendingTopic).articles?.[0]?.url;
}

function getItemShareUrl(item: FeedListItem): string | null {
  return item.type === 'article'
    ? buildArticleShareUrl(item.data as FeedItem)
    : buildTopicShareUrl(item.data as TrendingTopic);
}

export function categoryId(item: FeedListItem): string {
  return item.interestId || item.tags?.find(Boolean) || 'tech';
}

function categoryLabel(item: FeedListItem): string {
  const id = categoryId(item);
  return INTEREST_LABEL[id] || id.replace(/[-_]+/g, ' ');
}

function BookmarkButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur transition hover:bg-background disabled:opacity-50"
    >
      <Bookmark size={16} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

function StoryCard({
  item,
  bookmarked,
  bookmarkBusy,
  locked,
  onOpen,
  onBookmark,
}: {
  item: FeedListItem;
  bookmarked: boolean;
  bookmarkBusy: boolean;
  locked: boolean;
  onOpen: () => void;
  onBookmark: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[18px] bg-surface p-3 shadow-[0_1px_0_rgba(0,0,0,0.05)] ring-1 ring-foreground/7 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.08)] dark:ring-white/10">
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Read ${item.title}`}>
          <ArticleImage
            thumbnail={item.thumbnail}
            title={item.title}
            alt=""
            loading="lazy"
            className="aspect-[16/10] w-full rounded-[12px] object-cover transition-transform duration-300 group-hover:scale-[1.015]"
          />
        </button>
        <div className="absolute right-3 top-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <BookmarkButton
            active={bookmarked}
            disabled={bookmarkBusy}
            onClick={onBookmark}
            label={bookmarked ? `Remove bookmark for ${item.title}` : `Bookmark ${item.title}`}
          />
        </div>
      </div>
      <button type="button" onClick={onOpen} className="block min-h-[132px] w-full px-2 pb-3 pt-5 text-left sm:px-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-accent">{categoryLabel(item)}</p>
          {locked && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-secondary"><Lock size={11} /> Pro</span>}
        </div>
        <h2 className="mt-3 text-[19px] font-semibold leading-[1.28] tracking-[-0.025em] text-foreground sm:text-[20px]">
          {item.title}
        </h2>
      </button>
    </article>
  );
}

export function ReaderModal({
  item,
  locked,
  bookmarked,
  bookmarkBusy,
  onBookmark,
  onClose,
  restoreFocusTo,
}: {
  item: FeedListItem;
  locked: boolean;
  bookmarked: boolean;
  bookmarkBusy: boolean;
  onBookmark: () => void;
  onClose: () => void;
  restoreFocusTo: HTMLElement | null;
}) {
  const body = getBody(item);
  const keyPoints = getKeyPoints(item);
  const url = getItemUrl(item);
  const shareUrl = getItemShareUrl(item);
  const source = item.source || (item.data as FeedItem).source_name;
  const dialogRef = useRef<HTMLDivElement>(null);
  const readerHistoryActiveRef = useRef(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const closeReader = useCallback(() => {
    const consumeHistory = readerHistoryActiveRef.current && isReaderHistoryState(window.history.state);
    readerHistoryActiveRef.current = false;
    onClose();
    if (consumeHistory) window.history.back();
  }, [onClose]);

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await copyOrShareUrl(shareUrl);
      setShareStatus('copied');
    } catch {
      setShareStatus('error');
    }
    window.setTimeout(() => setShareStatus('idle'), 2000);
  };

  useEffect(() => {
    if (!isReaderHistoryState(window.history.state)) {
      window.history.pushState(addReaderHistoryState(window.history.state, item.id), '', window.location.href);
    }
    readerHistoryActiveRef.current = true;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handlePopState = () => {
      if (!readerHistoryActiveRef.current) return;
      readerHistoryActiveRef.current = false;
      closeReader();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeReader();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKey);
      restoreFocusTo?.focus();
    };
  }, [closeReader, item.id, restoreFocusTo]);

  return (
    <div
      role="dialog"
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="feed-reader-title"
      className="fixed inset-0 z-[120] flex items-stretch justify-stretch bg-surface p-0 sm:items-center sm:justify-center sm:bg-black/[0.62] sm:p-6 sm:backdrop-blur-[4px]"
      onMouseDown={closeReader}
    >
      <article
        className="h-[100dvh] w-full overflow-x-hidden overflow-y-auto break-words bg-surface sm:h-auto sm:max-h-[min(780px,calc(100vh-40px))] sm:max-w-[720px] sm:rounded-[14px] sm:border sm:border-border sm:shadow-[0_26px_90px_rgb(0_0_0/28%)]"
        style={{ fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden sm:rounded-t-[14px]">
          <ArticleImage
            thumbnail={item.thumbnail}
            title={item.title}
            alt=""
            className="max-h-[248px] min-h-[150px] w-full object-cover"
          />
          <div className="absolute right-[14px] top-[14px] flex gap-2 [&>button]:size-[38px] [&>button]:border [&>button]:border-white/[0.18] [&>button]:bg-[#0e0e0fc7] [&>button]:text-white [&>button]:ring-0 [&>button:hover]:!bg-[#0e0e0feb] [&_svg]:size-[18px]">
            <BookmarkButton
              active={bookmarked}
              disabled={bookmarkBusy}
              onClick={onBookmark}
              label={bookmarked ? `Remove bookmark for ${item.title}` : `Bookmark ${item.title}`}
            />
            <button
              type="button"
              autoFocus
              aria-label="Close story"
              onClick={closeReader}
              className="inline-flex items-center justify-center rounded-full backdrop-blur hover:!bg-[#0e0e0feb]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-[22px] pb-[34px] pt-[26px] sm:p-[clamp(24px,4vw,44px)]">
          <h1 id="feed-reader-title" className="max-w-[620px] text-balance text-[clamp(21px,2.6vw,30px)] font-medium leading-[1.12] tracking-[-0.025em] text-foreground">
            {item.title}
          </h1>

          {locked ? (
            <div className="relative mt-5 overflow-hidden rounded-[18px] bg-background p-[22px] ring-1 ring-border">
              <div className="mb-5 flex items-center gap-3">
                <Image src="/tarat-avatar.jpg" width={38} height={38} alt="Tarat" className="size-[38px] rounded-full object-cover ring-2 ring-background" />
                <div>
                  <p className="text-[12px] font-semibold text-foreground">A note from Tarat</p>
                  <p className="text-[12px] text-secondary">The human making Trace</p>
                </div>
              </div>
              <p className="text-[18px] font-semibold text-foreground">You have used today&rsquo;s five free summaries.</p>
              <p className="mt-2 max-w-[580px] text-pretty text-[14px] leading-[1.7] text-secondary">Trace is a one-person project. I read every piece of feedback and keep improving it based on what people need. Pro helps me keep building while I start my AI master&rsquo;s at Edinburgh this September.</p>
              <div className="mt-[18px] flex flex-wrap items-center gap-3">
                <Link
                  href="/profile?tab=subscription&intent=checkout"
                  onClick={() => trackCheckoutClicked('feed_reader_limit')}
                  className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-foreground px-[15px] py-[10px] text-[13px] font-semibold text-background transition-opacity hover:opacity-85"
                >
                  Try Pro free for 3 days
                </Link>
              </div>
            </div>
          ) : (
            <>
              {body && (
                <div className="mt-5 text-pretty text-[16px] font-normal leading-[1.68] text-foreground/88">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{body}</ReactMarkdown>
                </div>
              )}
              {keyPoints.length > 0 && (
                <ul className="mt-6 space-y-2.5">
                  {keyPoints.map((point) => (
                    <li key={point} className="flex gap-2.5 text-pretty text-[15px] font-normal leading-[1.65] text-secondary">
                      <span aria-hidden="true" className="mt-[0.02em] shrink-0 text-accent">•</span>
                      <span><ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{point}</ReactMarkdown></span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            {!locked && url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-accent px-[14px] py-[10px] text-[13px] font-semibold text-accent hover:bg-accent/10">
                Read original source <ExternalLink size={14} />
              </a>
            ) : <span />}
            <div className="ml-auto flex items-center gap-2.5">
              <p className="text-right text-[12px] text-secondary">{[source, item.timestamp ? getTimeLabel(item.timestamp) : null].filter(Boolean).join(' · ')}</p>
              {!locked && shareUrl && (
                <button
                  type="button"
                  onClick={copyShareLink}
                  aria-label={shareStatus === 'copied' ? 'Link copied' : 'Copy story link'}
                  title={shareStatus === 'copied' ? 'Link copied' : shareStatus === 'error' ? 'Could not copy link' : 'Copy story link'}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-secondary hover:text-foreground active:scale-[0.96]"
                >
                  {shareStatus === 'copied' ? <Check size={16} className="text-green-600" /> : <Share2 size={16} />}
                </button>
              )}
              <span className="sr-only" aria-live="polite">{shareStatus === 'copied' ? 'Link copied' : shareStatus === 'error' ? 'Could not copy link' : ''}</span>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function SupportingCard({
  item,
  tag,
  bookmarked,
  bookmarkBusy,
  onOpen,
  onBookmark,
}: {
  item: FeedListItem;
  tag: string;
  bookmarked: boolean;
  bookmarkBusy: boolean;
  onOpen: () => void;
  onBookmark: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[16px] bg-surface text-left ring-1 ring-foreground/7 transition hover:shadow-lg dark:ring-white/10">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Read ${item.title}`}>
        <ArticleImage thumbnail={item.thumbnail} title={item.title} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
        <div className="min-h-[126px] p-5">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">{tag}</p>
          <h2 className="mt-3 text-[17px] font-semibold leading-[1.35] tracking-[-0.02em] text-foreground group-hover:underline">{item.title}</h2>
        </div>
      </button>
      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <BookmarkButton
          active={bookmarked}
          disabled={bookmarkBusy}
          onClick={onBookmark}
          label={bookmarked ? `Remove bookmark for ${item.title}` : `Bookmark ${item.title}`}
        />
      </div>
    </article>
  );
}

export default function FeedTwoPaneLayout({
  isLoading,
  storyList,
  hotTweets = [],
  discussions = [],
  tools = [],
  blogs = [],
  isSubscribed = false,
  freeReadsUsed = 0,
  onOpenSummary,
  isItemLocked,
  tab,
  activeInterest,
}: {
  isLoading: boolean;
  storyList: FeedListItem[];
  hotTweets?: HotTweet[];
  discussions?: FeedListItem[];
  tools?: FeedListItem[];
  blogs?: FeedListItem[];
  isSubscribed?: boolean;
  freeReadsUsed?: number;
  onOpenSummary: (item: FeedListItem) => Promise<SummaryAccessResult>;
  isItemLocked: (id: string) => boolean;
  tab: 'news' | 'pulse';
  activeInterest: string | null;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<{ item: FeedListItem; locked: boolean } | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkBusyIds, setBookmarkBusyIds] = useState<Set<string>>(new Set());
  const [bookmarkMessage, setBookmarkMessage] = useState<string | null>(null);
  const [showChromeNotice, setShowChromeNotice] = useState(false);
  const locallyChangedBookmarks = useRef(new Set<string>());
  const bookmarkMessageTimerRef = useRef<number | null>(null);
  const readerOpenerRef = useRef<HTMLElement | null>(null);

  const showBookmarkMessage = useCallback((message: string) => {
    if (bookmarkMessageTimerRef.current) window.clearTimeout(bookmarkMessageTimerRef.current);
    setBookmarkMessage(message);
    bookmarkMessageTimerRef.current = window.setTimeout(() => setBookmarkMessage(null), 3000);
  }, []);

  useEffect(() => () => {
    if (bookmarkMessageTimerRef.current) window.clearTimeout(bookmarkMessageTimerRef.current);
  }, []);

  useEffect(() => {
    setShowChromeNotice(window.localStorage.getItem(CHROME_NOTICE_DISMISSED_KEY) !== '1');
  }, []);

  const dismissChromeNotice = useCallback(() => {
    window.localStorage.setItem(CHROME_NOTICE_DISMISSED_KEY, '1');
    setShowChromeNotice(false);
  }, []);

  useEffect(() => {
    locallyChangedBookmarks.current.clear();
    if (!user) setBookmarkedIds(new Set());
  }, [user]);

  const visibleStories = useMemo(
    () => activeInterest ? storyList.filter((item) => categoryId(item) === activeInterest || item.tags?.includes(activeInterest)) : storyList,
    [activeInterest, storyList],
  );

  const supportingStories = useMemo(() => [
    ...blogs.map((item) => ({ item, tag: 'Independent writing' })),
    ...tools.map((item) => ({ item, tag: 'Tools and launches' })),
    ...discussions.map((item) => ({ item, tag: 'Discussion' })),
    ...hotTweets.map((tweet) => ({
      tag: tweet.category || 'Conversation',
      item: {
        id: tweet.id,
        type: 'article' as const,
        title: tweet.title,
        preview: tweet.description,
        timestamp: tweet.pubDate,
        source: 'X',
        sourceCount: 1,
        tags: [tweet.category || 'Conversation'],
        url: tweet.url,
        data: {
          id: tweet.id,
          title: tweet.title,
          description: tweet.description,
          url: tweet.url,
          source_name: 'X',
          published_at: tweet.pubDate,
        },
      },
    })),
  ].filter(({ item }) => getItemUrl(item)).slice(0, 18), [blogs, discussions, hotTweets, tools]);

  const visibleBookmarkIds = useMemo(
    () => [...new Set([...storyList, ...supportingStories.map(({ item }) => item)].map(({ id }) => id).filter(Boolean))].slice(0, 100),
    [storyList, supportingStories],
  );

  useEffect(() => {
    if (!user || visibleBookmarkIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const groups = Array.from({ length: Math.ceil(visibleBookmarkIds.length / 40) }, (_, index) => visibleBookmarkIds.slice(index * 40, index * 40 + 40));
        const responses = await Promise.all(groups.map((itemIds) => fetch(`/api/bookmarks?item_ids=${encodeURIComponent(itemIds.join(','))}`, { headers: { Authorization: `Bearer ${token}` } })));
        if (responses.some((response) => !response.ok)) throw new Error('Bookmark sync failed');
        const payloads = await Promise.all(responses.map((response) => response.json() as Promise<{ bookmarks?: Array<{ item_id: string }> }>));
        if (cancelled) return;
        const savedOnServer = new Set<string>(payloads.flatMap(({ bookmarks }) => bookmarks || []).map(({ item_id }) => item_id));
        setBookmarkedIds((current) => {
          const next = new Set(savedOnServer);
          for (const id of locallyChangedBookmarks.current) {
            if (current.has(id)) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      } catch {
        if (!cancelled) showBookmarkMessage('Saved stories could not be synced. Try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [showBookmarkMessage, user, visibleBookmarkIds]);

  const openStory = (item: FeedListItem) => {
    readerOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    trackFeedItemClicked(item.id, item.type, item.source || 'feed');
    setSelected({ item, locked: isItemLocked(item.id) });
    void onOpenSummary(item).then((access) => {
      if (access === 'error') {
        showBookmarkMessage('Could not verify summary access. Try again.');
        return;
      }
      if (access === 'allowed') {
        trackSummaryOpened(item.id, isSubscribed);
        setSelected((current) => current?.item.id === item.id && current.locked ? { ...current, locked: false } : current);
        return;
      }
      trackPaywallShown('feed_reader_limit', { reads_used: freeReadsUsed });
      setSelected((current) => current?.item.id === item.id ? { ...current, locked: true } : current);
    });
  };

  const closeReader = useCallback(() => setSelected(null), []);

  const openSupportingStory = (item: FeedListItem) => {
    readerOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    trackFeedItemClicked(item.id, item.type, item.source || 'pulse');
    setSelected({ item, locked: false });
  };

  const toggleBookmark = useCallback(async (item: FeedListItem) => {
    if (!user) {
      showBookmarkMessage('Sign in to save stories across Trace.');
      return;
    }
    const wasBookmarked = bookmarkedIds.has(item.id);
    locallyChangedBookmarks.current.add(item.id);
    setBookmarkBusyIds((current) => new Set(current).add(item.id));
    setBookmarkedIds((current) => {
      const next = new Set(current);
      if (wasBookmarked) next.delete(item.id); else next.add(item.id);
      return next;
    });
    try {
      const token = await user.getIdToken();
      const response = await fetch(wasBookmarked ? `/api/bookmarks?item_id=${encodeURIComponent(item.id)}` : '/api/bookmarks', {
        method: wasBookmarked ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}`, ...(wasBookmarked ? {} : { 'Content-Type': 'application/json' }) },
        body: wasBookmarked ? undefined : JSON.stringify({
          item_id: item.id,
          item_metadata: {
            type: item.type,
            title: item.title,
            description: getBody(item),
            url: getItemUrl(item) || '',
            thumbnail: item.thumbnail,
            tags: item.tags || [categoryId(item)],
            source: item.source,
            timestamp: item.timestamp,
          },
        }),
      });
      if (!response.ok) throw new Error('Bookmark request failed');
      if (!wasBookmarked) trackFeedItemBookmarked(item.id, item.type);
      showBookmarkMessage(wasBookmarked ? 'Removed from your library.' : 'Saved to your library.');
    } catch {
      setBookmarkedIds((current) => {
        const next = new Set(current);
        if (wasBookmarked) next.add(item.id); else next.delete(item.id);
        return next;
      });
      showBookmarkMessage('Could not update that bookmark. Try again.');
    } finally {
      setBookmarkBusyIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }, [bookmarkedIds, showBookmarkMessage, user]);

  if (isLoading && storyList.length === 0) return <WireFeedLoadingSkeleton />;

  return (
    <div className="bg-background">
      <div id="feed-start" className="mx-auto w-full max-w-[1540px] [overflow-anchor:none] px-4 py-5 sm:px-7 sm:py-6 lg:px-10">
        {showChromeNotice && (
          <aside className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-foreground shadow-sm ring-1 ring-foreground/10 sm:px-5" aria-label="Trace Chrome extension announcement">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Chrome size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Trace is now available for Chrome.</p>
              <p className="mt-0.5 hidden text-[12px] text-secondary sm:block">Get your AI and tech feed in every new tab.</p>
            </div>
            <a
              href={CHROME_EXTENSION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-foreground px-4 py-2 text-[12px] font-semibold text-background transition-opacity hover:opacity-80"
            >
              Add to Chrome
            </a>
            <button
              type="button"
              aria-label="Dismiss Chrome extension announcement"
              onClick={dismissChromeNotice}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition hover:bg-foreground/5 hover:text-foreground"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </aside>
        )}
        {tab === 'news' ? (
          <>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleStories.map((item) => (
                <StoryCard
                  key={item.id}
                  item={item}
                  locked={isItemLocked(item.id)}
                  bookmarked={bookmarkedIds.has(item.id)}
                  bookmarkBusy={bookmarkBusyIds.has(item.id)}
                  onOpen={() => void openStory(item)}
                  onBookmark={() => void toggleBookmark(item)}
                />
              ))}
            </div>
          </>
        ) : (
          <section className="mt-8">
            <div className="max-w-[700px]">
              <h2 className="text-[24px] font-semibold tracking-[-0.03em]">More from around technology</h2>
              <p className="mt-2 text-[14px] leading-[1.7] text-secondary">Useful launches, discussions, videos, and independent writing. News remains the main Trace feed.</p>
            </div>
            {supportingStories.length > 0 ? (
              <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {supportingStories.map(({ item, tag }) => (
                  <SupportingCard
                    key={item.id}
                    item={item}
                    tag={tag}
                    bookmarked={bookmarkedIds.has(item.id)}
                    bookmarkBusy={bookmarkBusyIds.has(item.id)}
                    onOpen={() => openSupportingStory(item)}
                    onBookmark={() => void toggleBookmark(item)}
                  />
                ))}
              </div>
            ) : <p className="mt-12 text-[14px] text-secondary">More stories are on the way.</p>}
          </section>
        )}
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={bookmarkMessage ? 'fixed bottom-5 left-1/2 z-[140] -translate-x-1/2 rounded-full bg-foreground px-4 py-2.5 text-[12px] font-semibold text-background shadow-xl' : 'sr-only'}
      >
        {bookmarkMessage || ''}
      </div>
      {selected && (
        <ReaderModal
          item={selected.item}
          locked={selected.locked}
          bookmarked={bookmarkedIds.has(selected.item.id)}
          bookmarkBusy={bookmarkBusyIds.has(selected.item.id)}
          onBookmark={() => void toggleBookmark(selected.item)}
          onClose={closeReader}
          restoreFocusTo={readerOpenerRef.current}
        />
      )}
    </div>
  );
}
