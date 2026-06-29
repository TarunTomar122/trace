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
import FeedFooter from '@/components/FeedFooter';
import Image from 'next/image';
import FeedBootShell from './FeedBootShell';
import { normalizeInterestOrder } from './FeedEditionOrganizer';
import { type HotTweet } from './FeedOneScreen';
import FeedTwoPaneLayout from './FeedTwoPaneLayout';
import { FeedSubscribeClickLock } from './FeedPaywall';
import { FREE_READS_LIMIT } from '@/lib/free-reads';
import { pulseLiveToFeedItem } from '@/lib/pulse-live';
import {
  decodeHtml,
  FeedListItem,
  getArticleSummary,
  getFeedStoryPath,
  getPreview,
  getTopicDisplay,
  prepareFeedStoryNavigation,
} from './FeedUi';
import { FEED_RESTORE_SCROLL_KEY } from './FeedPulse';
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
    preview: getPreview(getArticleSummary(item), 140),
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
  const { user, profile, loading, profileResolved, refreshProfile } = useAuth();
  const checkoutReturned = searchParams.get('subscription') === 'success';
  const trackedPaywalls = React.useRef<Set<string>>(new Set());
  const trackedCheckoutSuccess = React.useRef(false);

  const [showProWelcome, setShowProWelcome] = useState(false);
  const [pulseTabActive, setPulseTabActive] = useState(false);
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

  const isSubscribedFromProfile = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial'
    || profile?.appSubscriptionStatus === 'active' || profile?.appSubscriptionStatus === 'trial';
  const isSubscribedFromFeed = baseFeed?.viewer_profile?.has_access === true
    || baseFeed?.viewer_profile?.subscription_status === 'active'
    || baseFeed?.viewer_profile?.subscription_status === 'trial'
    || baseFeed?.viewer_profile?.app_subscription_status === 'active'
    || baseFeed?.viewer_profile?.app_subscription_status === 'trial';
  const isSubscribed = isSubscribedFromProfile || isSubscribedFromFeed;
  const pulseDataEnabled = pulseTabActive && isSubscribed;

  const { data: pulseFeed } = useSWR<Partial<V3UserFeed> | null>(
    pulseDataEnabled && user ? 'feed-pulse' : null,
    pulseFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 },
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

  const { data: fallbackTrending = [], isLoading: fallbackTrendingLoading } = useSWR<FeedItem[]>(
    shouldLoadFallbackTrending ? 'public-trending' : null,
    trendingFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const { data: hotTweets = [], isLoading: hotTweetsLoading, mutate: mutateHotTweets } = useSWR<HotTweet[]>(
    pulseDataEnabled ? 'hot-tweets' : null,
    hotTweetsFetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 60_000 },
  );

  useEffect(() => {
    if (pulseTabActive) {
      void mutateHotTweets();
    }
  }, [pulseTabActive, mutateHotTweets]);

  /** Guests get the sign-in/upgrade lock. Signed-in free users can browse the list. */
  const feedInteractionLocked = !user && !loading;

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

  const freeStoryIds = useMemo(
    () => new Set(newsFeedList.slice(0, FREE_READS_LIMIT).map((item) => item.id)),
    [newsFeedList],
  );

  const isItemLocked = useCallback(
    (itemId: string) => {
      if (isSubscribed) return false;
      return !freeStoryIds.has(itemId);
    },
    [isSubscribed, freeStoryIds],
  );

  const discussions = useMemo((): FeedListItem[] => {
    const merged = dedupePulseItems([
      ...(effectiveFeed?.daily_pulse?.discussions ?? []),
      ...(effectiveFeed?.community_pulse ?? []),
    ]);
    if (merged.length === 0 && effectiveFeed?.pulse?.length) {
      return effectiveFeed.pulse.map(toPulseListItem);
    }
    return merged.map(toPulseListItem);
  }, [effectiveFeed?.daily_pulse?.discussions, effectiveFeed?.community_pulse, effectiveFeed?.pulse]);

  const tools = useMemo((): FeedListItem[] => {
    const merged = dedupePulseItems([
      ...(effectiveFeed?.daily_pulse?.tools ?? []),
      ...(effectiveFeed?.build_pulse ?? []),
    ]);
    return merged.map(toPulseListItem);
  }, [effectiveFeed?.daily_pulse?.tools, effectiveFeed?.build_pulse]);

  const blogs = useMemo((): FeedListItem[] => {
    const merged = dedupePulseItems(effectiveFeed?.daily_pulse?.blogs ?? []);
    return merged.map(toPulseListItem);
  }, [effectiveFeed?.daily_pulse?.blogs]);

  const needsLiveDiscussions = pulseDataEnabled && discussions.length === 0;
  const needsLiveTools = pulseDataEnabled && tools.length === 0;
  const { data: livePulse, isLoading: livePulseLoading } = useSWR<PulseLiveResponse | null>(
    pulseDataEnabled && (needsLiveDiscussions || needsLiveTools) ? 'pulse-live' : null,
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

  const pulseTweetsLoading = pulseDataEnabled && hotTweetsLoading && hotTweets.length === 0;
  const pulseDiscussionsLoading = pulseDataEnabled && needsLiveDiscussions && livePulseLoading && pulseDiscussions.length === 0;
  const pulseToolsLoading = pulseDataEnabled && needsLiveTools && livePulseLoading && pulseTools.length === 0;

  const pulseRole = profile?.role || effectiveFeed?.viewer_profile?.role || undefined;

  useEffect(() => {
    if (isSubscribed) return;
    if (currentList.length > 0 && !trackedPaywalls.current.has('trending')) {
      trackedPaywalls.current.add('trending');
      trackPaywallShown('feed_trending', { story_count: currentList.length });
    }
  }, [isSubscribed, currentList.length]);

  const handleSelectStory = useCallback((item: FeedListItem) => {
    prepareFeedStoryNavigation(item, newsFeedList, { locked: isItemLocked(item.id) });
    router.push(getFeedStoryPath(item));
  }, [router, newsFeedList, isItemLocked]);

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
          discussions={pulseDiscussions}
          tools={pulseTools}
          blogs={blogs}
          isSubscribed={isSubscribed}
          pulseRole={pulseRole}
          pulseInterests={effectiveInterests}
          pulseTweetsLoading={pulseTweetsLoading}
          pulseDiscussionsLoading={pulseDiscussionsLoading}
          pulseToolsLoading={pulseToolsLoading}
          interestOrder={effectiveInterests}
          onSelectStory={handleSelectStory}
          isItemLocked={isItemLocked}
          onTabChange={(tab) => {
            if (tab === 'pulse') setPulseTabActive(true);
          }}
        />
        <FeedSubscribeClickLock active={feedInteractionLocked} defaultOpen={showProWelcome} />
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
