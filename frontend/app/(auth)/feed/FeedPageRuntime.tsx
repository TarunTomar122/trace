"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, Loader2, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { isAlphaMode } from '@/lib/alpha';
import {
  V3UserFeed, FeedItem, TrendingTopic,
  recordLastActive,
} from '@/lib/firestore';
import { trackFeedViewed } from '@/lib/posthog';
import FeedFooter from '@/components/FeedFooter';
import PublicHeader from '@/components/PublicHeader';
import Image from 'next/image';
import FeedBootShell from './FeedBootShell';
import { type HotTweet } from './FeedOneScreen';
import FeedTwoPaneLayout, { categoryId } from './FeedTwoPaneLayout';
import {
  canReadArticle,
  getLocalFreeReads,
  recordLocalFreeRead,
  recordServerFreeRead,
  syncFreeReadsFromServer,
  type FreeReadsState,
  type SummaryAccessState,
} from '@/lib/free-reads';
import { pulseLiveToFeedItem } from '@/lib/pulse-live';
import {
  decodeHtml,
  FeedListItem,
  getArticleSummary,
  getPreview,
  getTopicDisplay,
  INTEREST_LABEL,
} from './FeedUi';
import { FEED_RESTORE_SCROLL_KEY } from './FeedPulse';

const FEED_DEBUG_LOGS = process.env.NODE_ENV !== 'production';

function feedDebugLog(...args: unknown[]) {
  if (!FEED_DEBUG_LOGS) return;
  console.log('[feed-debug]', ...args);
}

/** Aggregated daily digest row — excluded from the main news list */
function isTraceBriefFeedItem(item: { source?: string }): boolean {
  return (item.source || '').trim().toLowerCase() === 'trace brief';
}

async function fetchWithAuthFallback<T>(path: string): Promise<T | null> {
  const startedAt = performance.now();
  const res = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (res.status === 401 && auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    const fallbackRes = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    feedDebugLog('request', path, {
      status: fallbackRes.status,
      authFallback: true,
      serverTiming: fallbackRes.headers.get('server-timing'),
      elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
    });
    if (!fallbackRes.ok) return null;
    return fallbackRes.json();
  }
  feedDebugLog('request', path, {
    status: res.status,
    authFallback: false,
    serverTiming: res.headers.get('server-timing'),
    elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
  });
  if (!res.ok) return null;
  return res.json();
}

const feedFetcher = async (): Promise<V3UserFeed | null> => {
  return fetchWithAuthFallback('/api/feed');
};

const trendingFetcher = async () => {
  const res = await fetch('/api/public/trending');
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.items)) return [];
  return data.items.map((item: Record<string, unknown>): FeedItem => ({
    id: String(item.id || ''),
    title: decodeHtml(String(item.title || '')),
    url: String(item.url || ''),
    thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : null,
    source_name: typeof item.source === 'string' ? item.source : undefined,
    summary: { short_article: { subtitle: typeof item.summary === 'string' ? item.summary : '' } },
  }));
};

const hotTweetsFetcher = async (): Promise<HotTweet[]> => {
  const res = await fetch('/api/hot-tweets', { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.items)) return [];
  return data.items;
};

const pulseFetcher = async (): Promise<Partial<V3UserFeed> | null> =>
  fetchWithAuthFallback('/api/feed/pulse');

type PulseLiveResponse = {
  discussions?: Array<{ id: string; title: string; url: string; source: string; preview?: string; signal?: string; published_date?: string }>;
  tools?: Array<{ id: string; title: string; url: string; source: string; preview?: string; signal?: string; published_date?: string }>;
};

const pulseLiveFetcher = async (): Promise<PulseLiveResponse | null> => {
  const res = await fetch('/api/pulse/live');
  if (!res.ok) return null;
  return res.json();
};

function dedupePulseItems(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const item of items) {
    const key = String(item.url || item.id || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function toPulseListItem(item: FeedItem): FeedListItem {
  const raw = item as FeedItem & { signal?: string };
  const signalFromMeta = item.metadata?.signal_count;
  const signalFromText = raw.signal
    ? Number.parseInt(String(raw.signal).replace(/[^\d]/g, ''), 10)
    : undefined;
  const signalCount = typeof signalFromMeta === 'number' && signalFromMeta > 0
    ? signalFromMeta
    : Number.isFinite(signalFromText) && (signalFromText ?? 0) > 0
      ? signalFromText
      : undefined;

  return {
    id: item.id,
    type: 'article',
    title: decodeHtml(item.title || ''),
    preview: item.summary?.short_article?.subtitle || item.description || getArticleSummary(item),
    timestamp: item.published_date,
    source: item.source_name || item.source,
    sourceCount: signalCount || (item.sources?.length || 0),
    thumbnail: item.thumbnail,
    url: item.url?.trim() || undefined,
    signalCount,
    data: item,
  };
}

function FeedPageContent({ initialFeed }: { initialFeed: V3UserFeed | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTheme } = useTheme();
  const { user, profile, loading, profileResolved } = useAuth();
  const checkoutReturned = searchParams.get('subscription') === 'success';
  const trackedFeedView = React.useRef(false);

  const [pulseTabActive, setPulseTabActive] = useState(false);
  const [feedTab, setFeedTab] = useState<'news' | 'pulse'>('news');
  const [activeInterest, setActiveInterest] = useState<string | null>(null);
  const [freeReads, setFreeReads] = useState<FreeReadsState>({
    date: new Date().toISOString().slice(0, 10),
    ids: [],
  });
  const [summaryAccess, setSummaryAccess] = useState<SummaryAccessState>('checking');
  const phasePerfRef = React.useRef({
    startedAt: 0,
    authReady: false,
    listReady: false,
  });

  useEffect(() => {
    phasePerfRef.current.startedAt = performance.now();
  }, []);

  const hasInitialFeed = Boolean(initialFeed);
  const shouldBootstrapFeed = Boolean(user) || (loading && !hasInitialFeed);
  const feedKey = shouldBootstrapFeed
    ? (user?.uid ? `feed-session-${user.uid}` : 'feed-session-bootstrap')
    : null;
  const returningFromArticle = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(FEED_RESTORE_SCROLL_KEY) === '1';
  }, []);

  const { data: v3Feed, isLoading: feedLoading, mutate: mutateFeed } = useSWR<V3UserFeed | null>(
    feedKey,
    feedFetcher,
    {
      fallbackData: initialFeed ?? undefined,
      revalidateOnMount: !hasInitialFeed && !returningFromArticle,
      revalidateOnFocus: !returningFromArticle,
      revalidateOnReconnect: true,
      revalidateIfStale: !returningFromArticle,
      dedupingInterval: returningFromArticle ? 30000 : 0,
      refreshInterval: 0,
      refreshWhenHidden: false,
    }
  );

  const baseFeed = v3Feed ?? initialFeed ?? null;

  const isSubscribed = summaryAccess === 'pro';
  const pulseDataEnabled = pulseTabActive && isSubscribed;
  const pulsePreviewEnabled = pulseTabActive;

  const { data: pulseFeed } = useSWR<Partial<V3UserFeed> | null>(
    pulseDataEnabled && user ? 'feed-pulse' : null,
    pulseFetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 300000,
      refreshInterval: 900000,
    },
  );

  const effectiveFeed = useMemo(() => {
    if (!baseFeed) return baseFeed;
    if (!pulseFeed) return baseFeed;
    return {
      ...baseFeed,
      pulse: pulseFeed.pulse ?? baseFeed.pulse,
      daily_pulse: pulseFeed.daily_pulse ?? baseFeed.daily_pulse,
      community_pulse: pulseFeed.community_pulse ?? baseFeed.community_pulse,
      build_pulse: pulseFeed.build_pulse ?? baseFeed.build_pulse,
    };
  }, [baseFeed, pulseFeed]);

  const shouldLoadFallbackTrending = Boolean(user) && !feedLoading && (
    !effectiveFeed || (
      (effectiveFeed.trending_topics?.length ?? 0) === 0
      && (effectiveFeed.trending?.length ?? 0) === 0
    )
  );

  const { data: fallbackTrending = [] } = useSWR<FeedItem[]>(
    shouldLoadFallbackTrending ? 'public-trending' : null,
    trendingFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const { data: hotTweets = [], mutate: mutateHotTweets } = useSWR<HotTweet[]>(
    pulsePreviewEnabled ? 'hot-tweets' : null,
    hotTweetsFetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 60_000 },
  );

  useEffect(() => {
    if (pulseTabActive) {
      void mutateHotTweets();
    }
  }, [pulseTabActive, mutateHotTweets]);

  const viewerProfile = effectiveFeed?.viewer_profile;
  const viewerOnboarded = typeof viewerProfile?.onboarded === 'boolean'
    ? viewerProfile.onboarded
    : profile?.onboarded;
  const viewerProfileResolved = profileResolved || typeof viewerProfile?.onboarded === 'boolean';
  const lastActiveMarkedRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!isAlphaMode()) { router.push(user ? '/waitlist' : '/'); return; }
    if (!loading && !user && !hasInitialFeed) { router.push('/'); return; }
    if (user && !viewerProfileResolved) return;
  }, [user, loading, router, viewerProfileResolved, hasInitialFeed]);

  useEffect(() => {
    if (!user || !viewerProfileResolved || viewerOnboarded !== true) {
      lastActiveMarkedRef.current = null;
      return;
    }

    if (lastActiveMarkedRef.current === user.uid) return;
    lastActiveMarkedRef.current = user.uid;

    const markLastActive = () => {
      recordLastActive(user.uid).catch(() => {
        lastActiveMarkedRef.current = null;
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => {
        globalThis.setTimeout(markLastActive, 0);
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(markLastActive, 1500);
    return () => globalThis.clearTimeout(timeoutId);
  }, [user, viewerOnboarded, viewerProfileResolved]);


  const currentList = useMemo(() => {
    const list: {
      id: string;
      type: 'topic' | 'article';
      title: string;
      preview: string;
      timestamp?: string;
      source?: string;
      sourceCount: number;
      thumbnail?: string | null;
      interestId?: string;
      tags?: string[];
      data: TrendingTopic | FeedItem;
    }[] = [];

    const coveredArticleIds = new Set<string>();

    const roleBasedForYou = effectiveFeed?.for_you || [];
    for (const item of roleBasedForYou) {
      list.push({
        id: item.id,
        type: 'article',
        title: decodeHtml(item.title || ''),
        preview: getPreview(getArticleSummary(item), 140),
        timestamp: item.published_date,
        source: item.source_name || item.source,
        sourceCount: item.metadata?.source_count || (item.sources?.length || 0),
        thumbnail: item.thumbnail,
        interestId: item.interest_id,
        tags: item.tags,
        data: item,
      });
      coveredArticleIds.add(item.id);
    }

    const freshTopics = effectiveFeed?.trending_topics || [];
    for (const topic of freshTopics) {
      const articles = topic.articles || [];
      if (articles.length === 0) continue;

      const display = getTopicDisplay(topic);
      const isSingleton = display.isSingleton;

      if (isSingleton && articles[0]) {
        const article = articles[0];
        if (coveredArticleIds.has(article.id)) continue;
        list.push({
          id: article.id,
          type: 'article',
          title: decodeHtml(article.title || topic.title || ''),
          preview: getPreview(getArticleSummary(article) || display.summary, 140),
          timestamp: article.published_date,
          source: article.source_name,
          sourceCount: 1,
          thumbnail: article.thumbnail || topic.thumbnail,
          interestId: topic.interest_id || article.interest_id,
          tags: topic.tags || article.tags,
          data: article,
        });
        coveredArticleIds.add(article.id);
        continue;
      }

      if (coveredArticleIds.has(topic.id)) continue;
      list.push({
        id: topic.id,
        type: 'topic',
        title: decodeHtml(display.title || ''),
        preview: getPreview(display.subtitle || display.summary, 140),
        timestamp: articles[0]?.published_date || topic.last_updated_at,
        source: undefined,
        sourceCount: topic.source_count || articles.length,
        thumbnail: topic.thumbnail,
        interestId: topic.interest_id,
        tags: topic.tags,
        data: topic,
      });
      for (const article of articles) {
        coveredArticleIds.add(article.id);
      }
    }

    const allTrending = effectiveFeed?.trending || [];
    const remaining = allTrending.filter(item => !coveredArticleIds.has(item.id));
    for (const item of remaining) {
      list.push({
        id: item.id,
        type: 'article',
        title: decodeHtml(item.title || ''),
        preview: getPreview(getArticleSummary(item), 140),
        timestamp: item.published_date,
        source: item.source_name,
        sourceCount: item.metadata?.source_count || (item.sources?.length || 0),
        thumbnail: item.thumbnail,
        interestId: item.interest_id,
        tags: item.tags,
        data: item,
      });
    }

    if (list.length === 0) {
      for (const item of fallbackTrending) {
        list.push({
          id: item.id,
          type: 'article',
          title: item.title,
          preview: getPreview(getArticleSummary(item), 140),
          timestamp: item.published_date,
          source: item.source_name,
          sourceCount: item.metadata?.source_count || (item.sources?.length || 0),
          thumbnail: item.thumbnail,
          interestId: item.interest_id,
          tags: item.tags,
          data: item,
        });
      }
    }

    const sorted = list.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    return sorted;
  }, [effectiveFeed?.for_you, effectiveFeed?.trending, effectiveFeed?.trending_topics, fallbackTrending]);

  const newsFeedList = useMemo(
    () => currentList.filter((item) => !isTraceBriefFeedItem(item)),
    [currentList],
  );

  const feedFilters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of newsFeedList) {
      const id = categoryId(item);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [newsFeedList]);

  const selectFeed = useCallback((tab: 'news' | 'pulse', interest: string | null = null) => {
    setFeedTab(tab);
    setActiveInterest(interest);
    if (tab === 'pulse') setPulseTabActive(true);
    requestAnimationFrame(() => document.getElementById('feed-start')?.scrollIntoView({ behavior: 'smooth' }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (loading) return () => { cancelled = true; };
    if (!user) {
      queueMicrotask(() => {
        if (!cancelled) {
          setFreeReads(getLocalFreeReads());
          setSummaryAccess('free');
        }
      });
      return () => { cancelled = true; };
    }

    queueMicrotask(() => {
      if (!cancelled) setSummaryAccess('checking');
    });
    void syncFreeReadsFromServer(() => user.getIdToken()).then((result) => {
      if (!cancelled && result) {
        setFreeReads(result.state);
        setSummaryAccess(result.access);
      }
    });
    return () => { cancelled = true; };
  }, [loading, user]);

  useEffect(() => {
    if (!checkoutReturned || !user) return;
    let cancelled = false;
    let attempts = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const refreshAccess = async () => {
      attempts += 1;
      const result = await syncFreeReadsFromServer(() => user.getIdToken());
      if (cancelled) return;
      if (result) {
        setFreeReads(result.state);
        setSummaryAccess(result.access);
      }
      await mutateFeed();
      if (!cancelled && result?.access !== 'pro' && attempts < 6) {
        timeout = setTimeout(refreshAccess, 4000);
      }
    };
    void refreshAccess();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [checkoutReturned, user, mutateFeed]);

  const isItemLocked = useCallback(
    (itemId: string) => !canReadArticle(freeReads, itemId, summaryAccess),
    [freeReads, summaryAccess],
  );

  const handleOpenSummary = useCallback(async (item: FeedListItem) => {
    if (user) {
      const result = await recordServerFreeRead(item.id, () => user.getIdToken());
      if (result.state) setFreeReads(result.state);
      if (result.access) setSummaryAccess(result.access);
      return result.status;
    }
    const status = recordLocalFreeRead(item.id);
    setFreeReads(getLocalFreeReads());
    return status;
  }, [user]);

  const discussions = useMemo((): FeedListItem[] => {
    const merged = dedupePulseItems([
      ...(effectiveFeed?.daily_pulse?.discussions ?? []),
      ...(effectiveFeed?.community_pulse ?? []),
    ]);
    if (merged.length === 0 && effectiveFeed?.pulse?.length) {
      return effectiveFeed.pulse.map(toPulseListItem);
    }
    return merged.map(toPulseListItem);
  }, [effectiveFeed]);

  const tools = useMemo((): FeedListItem[] => {
    const merged = dedupePulseItems([
      ...(effectiveFeed?.daily_pulse?.tools ?? []),
      ...(effectiveFeed?.build_pulse ?? []),
    ]);
    return merged.map(toPulseListItem);
  }, [effectiveFeed]);

  const blogs = useMemo((): FeedListItem[] => {
    const merged = dedupePulseItems(effectiveFeed?.daily_pulse?.blogs ?? []);
    return merged.map(toPulseListItem);
  }, [effectiveFeed]);

  const needsLiveDiscussions = pulsePreviewEnabled && discussions.length === 0;
  const needsLiveTools = pulsePreviewEnabled && tools.length === 0;
  const { data: livePulse } = useSWR<PulseLiveResponse | null>(
    pulsePreviewEnabled && (needsLiveDiscussions || needsLiveTools) ? 'pulse-live' : null,
    pulseLiveFetcher,
    { revalidateOnFocus: false, dedupingInterval: 900000 },
  );

  const pulseDiscussions = useMemo(() => {
    if (discussions.length > 0) return discussions;
    const live = livePulse?.discussions ?? [];
    return live.map((item) => toPulseListItem(pulseLiveToFeedItem(item)));
  }, [discussions, livePulse?.discussions]);

  const pulseTools = useMemo(() => {
    if (tools.length > 0) return tools;
    const live = livePulse?.tools ?? [];
    return live.map((item) => toPulseListItem(pulseLiveToFeedItem(item)));
  }, [tools, livePulse?.tools]);

  useEffect(() => {
    if (trackedFeedView.current || currentList.length === 0) return;
    trackedFeedView.current = true;
    trackFeedViewed(currentList.length, !isSubscribed);
  }, [isSubscribed, currentList.length]);

  const hasFeedResponse = typeof v3Feed !== 'undefined';
  // Any feed payload (SSR or SWR) with at least one rendered section is enough
  // to paint the UI. Check both initialFeed and v3Feed so that SWR refreshes
  // don't flash back to the skeleton.
  const feedForRenderCheck = v3Feed ?? initialFeed;
  const hasRenderableBootstrapFeed = Boolean(
    feedForRenderCheck && (
      (feedForRenderCheck.for_you?.length ?? 0) > 0 ||
      (feedForRenderCheck.trending_topics?.length ?? 0) > 0 ||
      (feedForRenderCheck.trending?.length ?? 0) > 0
    )
  );
  const isLoading = shouldBootstrapFeed && !hasFeedResponse && !hasRenderableBootstrapFeed;
  const showBlockingBoot = !hasRenderableBootstrapFeed && (loading || (Boolean(user) && !hasFeedResponse));
  useEffect(() => {
    if (phasePerfRef.current.authReady) return;
    if (loading) return;
    phasePerfRef.current.authReady = true;
    feedDebugLog('phase', 'auth-ready', {
      elapsedMs: Number((performance.now() - phasePerfRef.current.startedAt).toFixed(1)),
      user: Boolean(user),
      profileResolved,
    });
  }, [loading, user, profileResolved]);

  useEffect(() => {
    if (phasePerfRef.current.listReady) return;
    if (showBlockingBoot) return;
    phasePerfRef.current.listReady = true;
    feedDebugLog('phase', 'list-ready', {
      elapsedMs: Number((performance.now() - phasePerfRef.current.startedAt).toFixed(1)),
      stories: newsFeedList.length,
      hasFeedResponse,
      hasRenderableBootstrapFeed,
    });
  }, [showBlockingBoot, newsFeedList.length, hasFeedResponse, hasRenderableBootstrapFeed]);

  if (showBlockingBoot) {
    return <FeedBootShell />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader
        centerSlot={
          <nav aria-label="Feed filters" className="scrollbar-hide flex w-max items-center gap-2">
            <button type="button" aria-pressed={feedTab === 'news' && activeInterest === null} onClick={() => selectFeed('news')} className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-semibold ${feedTab === 'news' && activeInterest === null ? 'bg-foreground text-background' : 'bg-surface text-secondary hover:text-foreground'}`}>All news</button>
            {feedFilters.map(([id]) => (
              <button key={id} type="button" aria-pressed={feedTab === 'news' && activeInterest === id} onClick={() => selectFeed('news', id)} className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-semibold capitalize ${feedTab === 'news' && activeInterest === id ? 'bg-foreground text-background' : 'bg-surface text-secondary hover:text-foreground'}`}>
                {INTEREST_LABEL[id] || id.replace(/[-_]+/g, ' ')}
              </button>
            ))}
            <button type="button" aria-pressed={feedTab === 'pulse'} onClick={() => selectFeed('pulse')} className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-semibold ${feedTab === 'pulse' ? 'bg-foreground text-background' : 'bg-surface text-secondary hover:text-foreground'}`}>Pulse</button>
          </nav>
        }
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')}
              aria-label="Toggle color theme"
              className="inline-flex size-10 items-center justify-center rounded-full text-secondary hover:bg-surface-secondary hover:text-foreground"
            >
              <Moon size={17} aria-hidden="true" className="dark:hidden" />
              <Sun size={17} aria-hidden="true" className="hidden dark:block" />
            </button>
            {user && (
              <Link
                href="/bookmarks"
                aria-label="Saved stories"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 text-[12px] font-semibold text-secondary hover:bg-surface-secondary hover:text-foreground"
              >
                <Bookmark size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Saved</span>
              </Link>
            )}
            {user?.photoURL ? (
              <Link href="/profile" prefetch={false}>
                <Image src={user.photoURL} width={36} height={36} alt="Profile" className="h-9 w-9 rounded-full border border-border" unoptimized />
              </Link>
            ) : (
              <Link href="/" prefetch={false} className="rounded-full border border-border bg-surface px-4 py-2 text-[12px] font-semibold text-foreground">
                Sign in
              </Link>
            )}
          </div>
        }
      />

      {checkoutReturned && (
        <div className="mx-4 mt-3 shrink-0 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:mx-6">
          <div className="flex items-center gap-3">
            <Loader2 size={16} className={`text-amber-600 ${isSubscribed ? '' : 'animate-spin'}`} />
            <div>
              <p className="text-sm font-medium text-foreground">
                {isSubscribed ? 'Trace Pro is active.' : 'Activating your Pro access...'}
              </p>
              <p className="text-xs text-secondary">
                {isSubscribed
                  ? 'Your full feed is unlocked.'
                  : 'Your payment went through. Your full feed should unlock in a moment.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="relative min-h-[calc(100vh-76px)]">
        <FeedTwoPaneLayout
          isLoading={isLoading}
          storyList={newsFeedList as FeedListItem[]}
          hotTweets={hotTweets}
          discussions={pulseDiscussions}
          tools={pulseTools}
          blogs={blogs}
          isSubscribed={isSubscribed}
          freeReadsUsed={freeReads.ids.length}
          onOpenSummary={handleOpenSummary}
          isItemLocked={isItemLocked}
          tab={feedTab}
          activeInterest={activeInterest}
        />
      </div>

      <FeedFooter />
    </div>
  );
}

export default function FeedPageRuntime({ initialFeed }: { initialFeed: V3UserFeed | null }) {
  return (
    <Suspense fallback={null}>
      <FeedPageContent initialFeed={initialFeed} />
    </Suspense>
  );
}
