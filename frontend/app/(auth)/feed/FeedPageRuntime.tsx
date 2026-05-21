"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { isAlphaMode } from '@/lib/alpha';
import {
  V3UserFeed, FeedItem, TrendingTopic,
  recordLastActive,
} from '@/lib/firestore';
import { trackPaywallShown, trackSubscriptionStarted } from '@/lib/posthog';
import Image from 'next/image';
import { applyFeedFreshnessAndDedupe } from '@/lib/feed-dedupe';
import { dedupeByStoryTitle } from '@/lib/feed-story-dedupe';
import { consumePrefetchedFeed } from '@/lib/feed-prefetch';
import FeedBootShell from './FeedBootShell';
import { normalizeInterestOrder } from './FeedEditionOrganizer';
import { type HotTweet } from './FeedOneScreen';
import FeedTwoPaneLayout from './FeedTwoPaneLayout';
import { FeedSubscribeClickLock } from './FeedPaywall';
import {
  decodeHtml,
  FeedListItem,
  getArticleSummary,
  getFeedStoryPath,
  getPreview,
  getTopicDisplay,
  prepareFeedStoryNavigation,
} from './FeedUi';
import {
  feedItemDetailSwrKey,
  type FeedItemDetailResponse,
} from '@/lib/feed-item-detail-client';

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
  });
  if (res.status === 401 && auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    const fallbackRes = await fetch(path, {
      credentials: 'same-origin',
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
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    const prefetched = consumePrefetchedFeed(auth.currentUser.uid, token);
    if (prefetched) return prefetched;
  }
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
  const res = await fetch('/api/hot-tweets');
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.items)) return [];
  return data.items;
};

function FeedPageContent({ initialFeed }: { initialFeed: V3UserFeed | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, profileResolved, refreshProfile } = useAuth();
  const checkoutReturned = searchParams.get('subscription') === 'success';
  const trackedPaywalls = React.useRef<Set<string>>(new Set());
  const trackedCheckoutSuccess = React.useRef(false);

  const [showProWelcome, setShowProWelcome] = useState(false);
  const refreshProfileRef = React.useRef(refreshProfile);
  const phasePerfRef = React.useRef({
    startedAt: 0,
    authReady: false,
    listReady: false,
  });

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  useEffect(() => {
    phasePerfRef.current.startedAt = performance.now();
  }, []);

  const hasInitialFeed = Boolean(initialFeed);
  const shouldBootstrapFeed = Boolean(user) || (loading && !hasInitialFeed);
  const feedKey = shouldBootstrapFeed
    ? (user?.uid ? `feed-session-${user.uid}` : 'feed-session-bootstrap')
    : null;

  // SSR already shipped the bootstrap feed. Don't re-fetch on mount — the
  // server data is fresh (bootstrap cache TTL is 10 min). mutateFeed() can
  // still trigger a background revalidation when we explicitly need it
  // (e.g. after checkout completes).
  const { data: v3Feed, isLoading: feedLoading, mutate: mutateFeed } = useSWR<V3UserFeed | null>(
    feedKey,
    feedFetcher,
    {
      fallbackData: initialFeed ?? undefined,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      dedupingInterval: 60000,
      refreshInterval: 120000,
      refreshWhenHidden: false,
    }
  );

  const baseFeed = v3Feed ?? initialFeed ?? null;
  const effectiveFeed = baseFeed;

  const shouldLoadFallbackTrending = Boolean(user) && !feedLoading && (
    !effectiveFeed || (
      (effectiveFeed.trending_topics?.length ?? 0) === 0
      && (effectiveFeed.trending?.length ?? 0) === 0
    )
  );

  const { data: fallbackTrending = [], isLoading: fallbackTrendingLoading } = useSWR<FeedItem[]>(
    shouldLoadFallbackTrending ? 'public-trending' : null,
    trendingFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const { data: hotTweets = [] } = useSWR<HotTweet[]>(
    'hot-tweets',
    hotTweetsFetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 10800000 },
  );

  const isSubscribedFromProfile = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial'
    || profile?.appSubscriptionStatus === 'active' || profile?.appSubscriptionStatus === 'trial';
  const isSubscribedFromFeed = effectiveFeed?.viewer_profile?.has_access === true
    || effectiveFeed?.viewer_profile?.subscription_status === 'active'
    || effectiveFeed?.viewer_profile?.subscription_status === 'trial'
    || effectiveFeed?.viewer_profile?.app_subscription_status === 'active'
    || effectiveFeed?.viewer_profile?.app_subscription_status === 'trial';
  // Keep /feed access simple: once Firebase has a signed-in user, do not let
  // stale profile cookies, local cache, or delayed Firestore reads re-lock the UI.
  const isSubscribed = Boolean(user) || isSubscribedFromProfile || isSubscribedFromFeed;

  /** Guests get the sign-in/upgrade lock. Signed-in users get the full feed. */
  const feedInteractionLocked = !user && !loading;

  const isItemLocked = useCallback(
    (_itemId: string) => !isSubscribed,
    [isSubscribed],
  );

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
    if (user && !loading && viewerOnboarded === false) router.push('/onboarding');
  }, [user, loading, router, viewerProfileResolved, viewerOnboarded, hasInitialFeed]);

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


  useEffect(() => {
    if (!checkoutReturned || !user) return;
    let attempts = 0;
    const refreshAccess = async () => {
      attempts += 1;
      await refreshProfileRef.current();
      await mutateFeed();
    };
    refreshAccess();
    const interval = setInterval(() => {
      if (attempts >= 6) { clearInterval(interval); return; }
      refreshAccess();
    }, 4000);
    return () => clearInterval(interval);
  }, [checkoutReturned, user, mutateFeed]);

  const trendingTopics = useMemo(() => {
    const topics = effectiveFeed?.trending_topics || [];
    return [...topics].sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return (b.popularity_score || 0) - (a.popularity_score || 0);
    });
  }, [effectiveFeed?.trending_topics]);

  const effectiveInterests = useMemo(() => {
    const fromProfile = Array.isArray(profile?.interests)
      ? profile.interests.filter((interest): interest is string => typeof interest === 'string' && interest.trim().length > 0)
      : [];
    const fromFeedViewerProfile = Array.isArray(effectiveFeed?.viewer_profile?.interests)
      ? effectiveFeed.viewer_profile.interests.filter(
          (interest): interest is string => typeof interest === 'string' && interest.trim().length > 0
        )
      : [];
    const merged = fromProfile.length > 0 ? fromProfile : fromFeedViewerProfile;
    return normalizeInterestOrder(merged);
  }, [profile?.interests, effectiveFeed?.viewer_profile?.interests]);

  const userInterests = useMemo(() => new Set(effectiveInterests), [effectiveInterests]);

  const visibleTrendingTopics = useMemo(() => trendingTopics, [trendingTopics]);

  useEffect(() => {
    if (checkoutReturned && isSubscribed && !trackedCheckoutSuccess.current) {
      trackedCheckoutSuccess.current = true;
      trackSubscriptionStarted('pro_monthly');
    }
  }, [checkoutReturned, isSubscribed]);

  useEffect(() => {
    if (!profileResolved || isSubscribed) return;
    try {
      if (sessionStorage.getItem('trace-show-pro-welcome') === '1') {
        sessionStorage.removeItem('trace-show-pro-welcome');
        setShowProWelcome(true);
      }
    } catch { /* ignore */ }
  }, [profileResolved, isSubscribed]);

  const freshNewsSlices = useMemo(
    () =>
      applyFeedFreshnessAndDedupe({
        for_you: effectiveFeed?.for_you || [],
        trending: effectiveFeed?.trending || [],
        trending_topics: effectiveFeed?.trending_topics || [],
      }),
    [effectiveFeed?.for_you, effectiveFeed?.trending, effectiveFeed?.trending_topics],
  );

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

    const roleBasedForYou = freshNewsSlices.for_you || [];
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

    const freshTopics = freshNewsSlices.trending_topics || [];
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

    const allTrending = freshNewsSlices.trending || [];
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
      const freshFallback =
        applyFeedFreshnessAndDedupe({ trending: fallbackTrending }).trending || [];
      for (const item of freshFallback) {
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

    return dedupeByStoryTitle(sorted);
  }, [freshNewsSlices, fallbackTrending]);

  const newsFeedList = useMemo(
    () => currentList.filter((item) => !isTraceBriefFeedItem(item)),
    [currentList],
  );

  const discussions = useMemo((): FeedListItem[] => {
    const raw = effectiveFeed?.daily_pulse?.discussions ?? [];
    return raw.map((item): FeedListItem => ({
      id: item.id,
      type: 'article',
      pulseSection: 'discussions',
      title: decodeHtml(item.title || ''),
      preview: getPreview(getArticleSummary(item), 140),
      timestamp: item.published_date,
      source: item.source_name || item.source,
      sourceCount: 1,
      thumbnail: item.thumbnail,
      url: item.url,
      signalCount: item.metadata?.signal_count,
      data: item,
    }));
  }, [effectiveFeed?.daily_pulse?.discussions]);

  const tools = useMemo((): FeedListItem[] => {
    const raw = effectiveFeed?.daily_pulse?.tools ?? [];
    return raw.map((item): FeedListItem => ({
      id: item.id,
      type: 'article',
      pulseSection: 'tools',
      title: decodeHtml(item.title || ''),
      preview: getPreview(getArticleSummary(item), 140),
      timestamp: item.published_date,
      source: item.source_name || item.source,
      sourceCount: 1,
      thumbnail: item.thumbnail,
      url: item.url,
      signalCount: item.metadata?.signal_count,
      data: item,
    }));
  }, [effectiveFeed?.daily_pulse?.tools]);

  useEffect(() => {
    if (isSubscribed) return;
    if (currentList.length > 0 && !trackedPaywalls.current.has('trending')) {
      trackedPaywalls.current.add('trending');
      trackPaywallShown('feed_trending', { story_count: currentList.length });
    }
  }, [isSubscribed, currentList.length]);

  const handleSelectStory = useCallback((item: FeedListItem) => {
    prepareFeedStoryNavigation(item, newsFeedList);
    router.push(getFeedStoryPath(item));
  }, [router, newsFeedList]);

  // ── Seed SWR cache with inline detail data ──
  // Bootstrap now ships every item fully hydrated, so every click should be
  // instant. We just prime the SWR cache for each item so the detail hook
  // hits a cache entry instead of firing /api/feed/item.
  const { mutate: globalMutate } = useSWRConfig();
  const prefetchedRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isSubscribed) return;
    if (!effectiveFeed) return;

    const seed = (id: string, kind: 'article' | 'topic', item: FeedItem | TrendingTopic) => {
      if (!id || prefetchedRef.current.has(id)) return;
      prefetchedRef.current.add(id);
      globalMutate(
        feedItemDetailSwrKey(id),
        { kind, item } as FeedItemDetailResponse,
        { revalidate: false },
      );
    };

    const articleBuckets: FeedItem[][] = [
      effectiveFeed.for_you || [],
      effectiveFeed.trending || [],
    ];
    for (const bucket of articleBuckets) {
      for (const item of bucket) seed(item.id, 'article', item);
    }
    for (const topic of effectiveFeed.trending_topics || []) {
      seed(topic.id, 'topic', topic);
    }
  }, [isSubscribed, effectiveFeed, globalMutate]);

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
    <div className="flex flex-col bg-white">
      <header className="shrink-0 border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" prefetch={false} className="flex items-center gap-2.5 no-underline" style={{ color: 'inherit' }}>
            <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
            <span className="text-[13px] font-bold tracking-[0.14em] text-[#111827]">TRACE</span>
          </Link>
          {user?.photoURL ? (
            <Link href="/profile" prefetch={false}>
              <img src={user.photoURL} alt="Profile" className="h-8 w-8 rounded-full border border-[#e5e7eb]" />
            </Link>
          ) : (
            <Link
              href="/profile"
              prefetch={false}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111827] text-white"
            >
              <span className="text-[12px] font-semibold">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
            </Link>
          )}
        </div>
      </header>

      {checkoutReturned && (
        <div className="shrink-0 mx-4 mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:mx-6">
          <div className="flex items-center gap-3">
            <Loader2 size={16} className={`text-amber-600 ${isSubscribed ? '' : 'animate-spin'}`} />
            <div>
              <p className="text-sm font-medium text-[#111827]">
                {isSubscribed ? 'Trace Pro is active.' : 'Activating your Pro access...'}
              </p>
              <p className="text-xs text-[#6b7280]">
                {isSubscribed
                  ? 'Your full feed is unlocked.'
                  : 'Your payment went through. Your full feed should unlock in a moment.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* feed panel — fixed viewport height so left/right panes scroll internally */}
      <div className="h-[calc(100vh-61px)] min-h-0 relative overflow-hidden border-b border-[#e5e7eb]">
        <FeedTwoPaneLayout
          isLoading={isLoading}
          storyList={newsFeedList as FeedListItem[]}
          hotTweets={hotTweets}
          discussions={discussions}
          tools={tools}
          interestOrder={effectiveInterests}
          onSelectStory={handleSelectStory}
          isItemLocked={isItemLocked}
        />
        <FeedSubscribeClickLock active={feedInteractionLocked} defaultOpen={showProWelcome} />
      </div>

      {/* footer — matches homepage style */}
      <footer className="relative overflow-hidden border-t border-[#e5e7eb] px-4 py-14 sm:px-6">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 select-none text-center">
          <p className="text-[clamp(4rem,15vw,10rem)] font-bold leading-none tracking-[-0.04em] text-[#f3f4f6]">
            TRACE
          </p>
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <Image src="/trace.webp" alt="Trace" width={18} height={18} className="h-[18px] w-auto" />
              <span className="text-[12px] font-bold tracking-[0.12em] text-[#9ca3af]">TRACE</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[#9ca3af]">
              <Link href="/blog" className="hover:text-[#111827] transition-colors">Blog</Link>
              <Link href="/compare" className="hover:text-[#111827] transition-colors">Compare</Link>
              <a href="https://stocksbrew.online/?utm_source=trace&utm_medium=feed_footer&utm_campaign=cross_product_nav" target="_blank" rel="noopener noreferrer" className="hover:text-[#111827] transition-colors">StocksBrew</a>
              <Link href="/privacy-policy" className="hover:text-[#111827] transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-[#111827] transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-[#111827] transition-colors">Contact</Link>
            </div>
          </div>
          <p className="mt-8 text-center text-[12px] text-[#9ca3af]">
            © {new Date().getFullYear()} Trace. All rights reserved.
          </p>
        </div>
      </footer>
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
