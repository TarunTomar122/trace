"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { isAlphaMode } from '@/lib/alpha';
import {
  V3UserFeed, FeedItem, TrendingTopic,
  recordLastActive, ONBOARDING_INTERESTS,
} from '@/lib/firestore';
import { trackPaywallShown, trackSubscriptionStarted } from '@/lib/posthog';
import {
  fetchFeedItemDetail,
  feedItemDetailSwrKey,
  type FeedItemDetailResponse,
} from '@/lib/feed-item-detail-client';
import { consumePrefetchedFeed } from '@/lib/feed-prefetch';
import FeedBootShell from './FeedBootShell';
import FeedBriefingView, { BriefingLayoutToggle, BRIEFING_PULSE_TAB_KEY } from './FeedBriefingView';
import { InlineUnlockBanner } from './FeedPaywall';
import {
  ContentData,
  DailyPulseView,
  decodeHtml,
  FEED_TYPE_PREFIX,
  FeedListItem,
  getArticleSummary,
  getContentFromFeedListItem,
  getPreview,
  getTimeLabel,
  getTopicDisplay,
  PULSE_MAIN_SHELL,
} from './FeedUi';

const BRIEFING_LAYOUT_STORAGE_KEY = 'trace.briefingLayout';

/** Desktop (md+) → compact scroll; phone → classic split, until the user picks otherwise (localStorage). */
function briefingLayoutDefaultForViewport(): 'panel' | 'scroll' {
  if (typeof window === 'undefined') return 'scroll';
  return window.matchMedia('(min-width: 768px)').matches ? 'scroll' : 'panel';
}

/** Aggregated daily digest row — excluded from the main news list */
function isTraceBriefFeedItem(item: { source?: string }): boolean {
  return (item.source || '').trim().toLowerCase() === 'trace brief';
}

async function fetchWithAuthFallback<T>(path: string): Promise<T | null> {
  const res = await fetch(path, {
    credentials: 'same-origin',
  });
  if (res.status === 401 && auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    const fallbackRes = await fetch(path, {
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fallbackRes.ok) return null;
    return fallbackRes.json();
  }
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

const pulseFetcher = async (): Promise<Partial<V3UserFeed> | null> =>
  fetchWithAuthFallback('/api/feed/pulse');

const itemDetailFetcher = (id: string) => fetchFeedItemDetail(id);

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

function FeedPageContent({ initialFeed }: { initialFeed: V3UserFeed | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, profileResolved, refreshProfile } = useAuth();
  const checkoutReturned = searchParams.get('subscription') === 'success';
  const trackedPaywalls = React.useRef<Set<string>>(new Set());
  const trackedCheckoutSuccess = React.useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('for_you');
  const [feedView, setFeedView] = useState<'pulse' | 'briefing'>(
    searchParams.get('view') === 'pulse' ? 'pulse' : 'briefing'
  );
  const [briefingLayout, setBriefingLayoutState] = useState<'panel' | 'scroll'>('scroll');
  /** Tailwind `md` — layout toggle only applies at this breakpoint and up. */
  const [mdUp, setMdUp] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  /** Weekly Pulse only: filter sidebar/list by tools / blogs / discussions. */
  const [pulseSectionFilter, setPulseSectionFilter] = useState<
    'all' | 'tools' | 'blogs' | 'discussions'
  >('all');
  const refreshProfileRef = React.useRef(refreshProfile);

  useEffect(() => {
    const requested = searchParams.get('view') === 'pulse' ? 'pulse' : 'briefing';
    setFeedView(requested);
  }, [searchParams]);

  useEffect(() => {
    if (feedView !== 'pulse') setPulseSectionFilter('all');
  }, [feedView]);

  useEffect(() => {
    const onPopState = () => setShowMobileContent(false);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openMobileArticle = useCallback((id: string) => {
    setSelectedId(id);
    setShowMobileContent(true);
    window.history.pushState({ article: id }, '');
  }, []);

  const closeMobileArticle = useCallback(() => {
    setShowMobileContent(false);
    if (window.history.state?.article) window.history.back();
  }, []);

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  useEffect(() => {
    if (!showMobileContent) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showMobileContent]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) setIsExpanded(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isExpanded]);


  const shouldBootstrapFeed = loading || Boolean(user);
  const feedKey = shouldBootstrapFeed
    ? (user?.uid ? `feed-session-${user.uid}` : 'feed-session-bootstrap')
    : null;

  const { data: v3Feed, isLoading: feedLoading, mutate: mutateFeed } = useSWR<V3UserFeed | null>(
    feedKey,
    feedFetcher,
    {
      fallbackData: initialFeed ?? undefined,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    }
  );

  const shouldLoadPulse = Boolean(user) && (
    feedView === 'pulse'
    || (feedView === 'briefing' && activeFilter === BRIEFING_PULSE_TAB_KEY)
  );
  const { data: pulseFeed, isLoading: pulseLoading } = useSWR<Partial<V3UserFeed> | null>(
    shouldLoadPulse ? 'feed-pulse' : null,
    pulseFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000,
    }
  );

  const effectiveFeed = useMemo(() => {
    if (!v3Feed) return v3Feed;
    if (!pulseFeed) return v3Feed;
    return {
      ...v3Feed,
      pulse: pulseFeed.pulse ?? v3Feed.pulse,
      daily_pulse: pulseFeed.daily_pulse ?? v3Feed.daily_pulse,
      weekly_pulse: pulseFeed.weekly_pulse ?? v3Feed.weekly_pulse,
      community_pulse: pulseFeed.community_pulse ?? v3Feed.community_pulse,
      build_pulse: pulseFeed.build_pulse ?? v3Feed.build_pulse,
    };
  }, [v3Feed, pulseFeed]);

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

  const isSubscribedFromProfile = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial'
    || profile?.appSubscriptionStatus === 'active' || profile?.appSubscriptionStatus === 'trial';
  const isSubscribedFromFeed = effectiveFeed?.viewer_profile?.has_access === true
    || effectiveFeed?.viewer_profile?.subscription_status === 'active'
    || effectiveFeed?.viewer_profile?.subscription_status === 'trial'
    || effectiveFeed?.viewer_profile?.app_subscription_status === 'active'
    || effectiveFeed?.viewer_profile?.app_subscription_status === 'trial';
  const isSubscribed = isSubscribedFromProfile || isSubscribedFromFeed;

  const setBriefingLayout = useCallback((next: 'panel' | 'scroll') => {
    setBriefingLayoutState(next);
    try {
      localStorage.setItem(BRIEFING_LAYOUT_STORAGE_KEY, next);
    } catch {
      /* quota / private mode */
    }
  }, []);

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(BRIEFING_LAYOUT_STORAGE_KEY);
      if (raw === 'panel' || raw === 'scroll') {
        setBriefingLayoutState(raw);
        return;
      }
    } catch {
      /* ignore */
    }
    setBriefingLayoutState(briefingLayoutDefaultForViewport());
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setMdUp(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const viewerProfile = effectiveFeed?.viewer_profile;
  const viewerOnboarded = typeof viewerProfile?.onboarded === 'boolean'
    ? viewerProfile.onboarded
    : profile?.onboarded;
  const viewerProfileResolved = profileResolved || typeof viewerProfile?.onboarded === 'boolean';
  const lastActiveMarkedRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!isSubscribed && feedView === 'pulse') {
      setFeedView('briefing');
      const params = new URLSearchParams(searchParams.toString());
      params.delete('view');
      const query = params.toString();
      router.replace(query ? `/feed?${query}` : '/feed', { scroll: false });
    }
  }, [isSubscribed, feedView, router, searchParams]);


  useEffect(() => {
    if (!isAlphaMode()) { router.push(user ? '/waitlist' : '/'); return; }
    if (!loading && !user) { router.push('/'); return; }
    if (user && !viewerProfileResolved) return;
    if (user && !loading && viewerOnboarded === false) router.push('/onboarding');
  }, [user, loading, router, viewerProfileResolved, viewerOnboarded]);

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
    if (fromProfile.length > 0) return fromProfile;
    const fromFeedViewerProfile = Array.isArray(effectiveFeed?.viewer_profile?.interests)
      ? effectiveFeed.viewer_profile.interests.filter(
          (interest): interest is string => typeof interest === 'string' && interest.trim().length > 0
        )
      : [];
    return fromFeedViewerProfile;
  }, [profile?.interests, effectiveFeed?.viewer_profile?.interests]);

  const userInterests = useMemo(() => new Set(effectiveInterests), [effectiveInterests]);

  const visibleTrendingTopics = useMemo(() => trendingTopics, [trendingTopics]);

  useEffect(() => {
    if (checkoutReturned && isSubscribed && !trackedCheckoutSuccess.current) {
      trackedCheckoutSuccess.current = true;
      trackSubscriptionStarted('pro_monthly');
    }
  }, [checkoutReturned, isSubscribed]);

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
    const coveredUrls = new Set<string>();

    const roleBasedForYou = effectiveFeed?.for_you || [];
    for (const item of roleBasedForYou) {
      list.push({
        id: item.id,
        type: 'article',
        title: decodeHtml(item.title || ''),
        preview: getPreview(getArticleSummary(item)),
        timestamp: item.published_date,
        source: item.source_name || item.source,
        sourceCount: item.metadata?.source_count || (item.sources?.length || 0),
        thumbnail: item.thumbnail,
        interestId: item.interest_id,
        tags: item.tags,
        data: item,
      });
      coveredArticleIds.add(item.id);
      if (item.url) coveredUrls.add(item.url);
    }

    if (visibleTrendingTopics.length > 0) {
      for (const topic of visibleTrendingTopics) {
        const display = getTopicDisplay(topic);
        list.push({
          id: topic.id,
          type: 'topic',
          title: decodeHtml(display.title || ''),
          preview: getPreview(display.subtitle || display.summary),
          timestamp: topic.articles?.[0]?.published_date,
          source: display.isSingleton ? display.article?.source_name : undefined,
          sourceCount: topic.source_count || 0,
          thumbnail: display.isSingleton ? display.article?.thumbnail : topic.thumbnail,
          interestId: topic.interest_id,
          tags: topic.tags,
          data: topic,
        });
        for (const a of topic.articles || []) {
          coveredArticleIds.add(a.id);
          if (a.url) coveredUrls.add(a.url);
        }
        for (const event of topic.timeline || []) {
          if (event.id) coveredArticleIds.add(event.id);
          if (event.article_url) coveredUrls.add(event.article_url);
        }
      }
    }

    const allTrending = effectiveFeed?.trending || [];
    const remaining = allTrending.filter(
      (item) => !coveredArticleIds.has(item.id) && !coveredUrls.has(item.url || '')
    );
    for (const item of remaining) {
      list.push({
        id: item.id,
        type: 'article',
        title: decodeHtml(item.title || ''),
        preview: getPreview(getArticleSummary(item)),
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
          preview: getPreview(getArticleSummary(item)),
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

    return list.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
  }, [effectiveFeed?.for_you, visibleTrendingTopics, effectiveFeed?.trending, fallbackTrending]);

  const newsFeedList = useMemo(
    () => currentList.filter((item) => !isTraceBriefFeedItem(item)),
    [currentList],
  );

  useEffect(() => {
    if (isSubscribed) return;
    if (currentList.length > 0 && !trackedPaywalls.current.has('trending')) {
      trackedPaywalls.current.add('trending');
      trackPaywallShown('feed_trending', { story_count: currentList.length });
    }
  }, [isSubscribed, currentList.length]);

  const pulseStoryList = useMemo((): FeedListItem[] => {
    const weekly = effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse;
    if (weekly) {
      const sections: Array<{ key: 'tools' | 'blogs' | 'discussions'; items: FeedItem[] }> = [
        { key: 'tools', items: weekly.tools || [] },
        { key: 'blogs', items: weekly.blogs || [] },
        { key: 'discussions', items: weekly.discussions || [] },
      ];
      return sections.flatMap(({ key, items }) =>
        items.map((item) => ({
          id: item.id,
          type: 'article' as const,
          pulseSection: key,
          title: decodeHtml(item.title || ''),
          preview: getArticleSummary(item).trim(),
          timestamp: item.published_date,
          source: item.source_name || item.source,
          sourceCount: item.metadata?.signal_count || (item.sources?.length || 0),
          thumbnail: item.thumbnail,
          interestId: item.interest_id,
          tags: item.tags,
          theme:
            key === 'tools' ? 'Top tools'
            : key === 'blogs' ? 'Top blogs'
            : 'Top discussions',
          heat: item.metadata?.heat,
          signalCount: item.metadata?.signal_count || (item.sources?.length || 0),
          url: item.url?.trim() || undefined,
          pulseSources: (item.sources || [])
            .filter((s): s is { name: string; title: string; url: string } => Boolean(s?.url?.trim()))
            .map((s) => ({
              name: (s.name || '').trim() || 'Link',
              title: (s.title || '').trim(),
              url: s.url.trim(),
            })),
          data: item,
        }))
      );
    }

    const items = effectiveFeed?.pulse || [];
    return items.map((item) => ({
      id: item.id,
      type: 'article' as const,
      title: decodeHtml(item.title || ''),
      preview: getArticleSummary(item).trim(),
      timestamp: item.published_date,
      source: item.metadata?.theme || item.summary?.short_article?.subtitle || item.source_name,
      sourceCount: item.metadata?.signal_count || (item.sources?.length || 0),
      thumbnail: item.thumbnail,
      interestId: item.interest_id,
      tags: item.tags,
      theme: item.metadata?.theme || item.summary?.short_article?.subtitle,
      heat: item.metadata?.heat,
      signalCount: item.metadata?.signal_count || (item.sources?.length || 0),
      url: item.url?.trim() || undefined,
      pulseSources: (item.sources || [])
        .filter((s): s is { name: string; title: string; url: string } => Boolean(s?.url?.trim()))
        .map((s) => ({
          name: (s.name || '').trim() || 'Link',
          title: (s.title || '').trim(),
          url: s.url.trim(),
        })),
      data: item,
    }));
  }, [effectiveFeed?.pulse, (effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse)]);

  const pulseSections = useMemo(() => {
    if ((effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse)) {
      return [
        { key: 'tools' as const, label: 'Top Tools', items: pulseStoryList.filter(item => item.pulseSection === 'tools') },
        { key: 'blogs' as const, label: 'Top Blogs', items: pulseStoryList.filter(item => item.pulseSection === 'blogs') },
        { key: 'discussions' as const, label: 'Top Discussions', items: pulseStoryList.filter(item => item.pulseSection === 'discussions') },
      ].filter(section => section.items.length > 0);
    }
    return [{ key: 'pulse' as const, label: 'Pulse', items: pulseStoryList }];
  }, [(effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse), pulseStoryList]);

  useEffect(() => {
    if (!(effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse)) setPulseSectionFilter('all');
  }, [(effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse)]);

  const pulseFilterBuckets = useMemo(() => {
    if (!(effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse)) return [];
    const labelByKey: Record<'tools' | 'blogs' | 'discussions', string> = {
      tools: 'Tools',
      blogs: 'Blogs',
      discussions: 'Discussion',
    };
    const out: Array<{ key: 'tools' | 'blogs' | 'discussions'; label: string; count: number }> = [];
    for (const s of pulseSections) {
      if (s.key === 'tools' || s.key === 'blogs' || s.key === 'discussions') {
        out.push({ key: s.key, label: labelByKey[s.key], count: s.items.length });
      }
    }
    return out;
  }, [(effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse), pulseSections]);

  const showPulseSectionFilters = pulseFilterBuckets.length >= 2;

  useEffect(() => {
    if (pulseSectionFilter === 'all') return;
    const ok = pulseFilterBuckets.some((b) => b.key === pulseSectionFilter);
    if (!ok) setPulseSectionFilter('all');
  }, [pulseFilterBuckets, pulseSectionFilter]);

  const pulseVisibleStoryList = useMemo(() => {
    if (!(effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse) || pulseSectionFilter === 'all') return pulseStoryList;
    return pulseStoryList.filter((item) => item.pulseSection === pulseSectionFilter);
  }, [(effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse), pulseSectionFilter, pulseStoryList]);

  const filteredList = useMemo(() => {
    if (activeFilter === BRIEFING_PULSE_TAB_KEY) {
      return [];
    }
    if (activeFilter === 'for_you') {
      // All items matching any of the user's interests
      return newsFeedList.filter(item => {
        const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
        const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
        return matchesInterest || matchesTags;
      });
    }
    if (activeFilter === 'suggested') {
      return newsFeedList.filter(item => {
        const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
        const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
        return !(matchesInterest || matchesTags);
      });
    }
    // Specific interest tab
    return newsFeedList.filter(item => {
      const matchesInterest = item.interestId === activeFilter;
      const matchesTags = item.tags?.includes(activeFilter) || false;
      return matchesInterest || matchesTags;
    });
  }, [newsFeedList, activeFilter, userInterests]);

  const briefingVisibleList = useMemo(() => {
    if (activeFilter === BRIEFING_PULSE_TAB_KEY) {
      return pulseVisibleStoryList;
    }
    if (filteredList.length > 0) return filteredList;
    if (activeFilter === 'for_you' && newsFeedList.length > 0) return newsFeedList;
    return filteredList;
  }, [activeFilter, filteredList, newsFeedList, pulseVisibleStoryList]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { for_you: 0, suggested: 0 };
    for (const item of newsFeedList) {
      const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
      const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
      if (matchesInterest || matchesTags) {
        counts.for_you++;
        // Count per specific interest
        const matchedInterest = item.interestId && userInterests.has(item.interestId)
          ? item.interestId
          : item.tags?.find(tag => userInterests.has(tag));
        if (matchedInterest) counts[matchedInterest] = (counts[matchedInterest] || 0) + 1;
      } else {
        counts.suggested++;
      }
    }
    return counts;
  }, [newsFeedList, userInterests]);

  const briefingFilterCounts = useMemo(
    () => ({
      ...filterCounts,
      [BRIEFING_PULSE_TAB_KEY]: pulseStoryList.length,
    }),
    [filterCounts, pulseStoryList.length],
  );

  const interestTabs = useMemo(() => {
    return ONBOARDING_INTERESTS.filter(interest =>
      userInterests.has(interest.id) && (filterCounts[interest.id] || 0) > 0
    );
  }, [userInterests, filterCounts]);

  useEffect(() => {
    if (feedView !== 'briefing') return;
    if (activeFilter === BRIEFING_PULSE_TAB_KEY) return;
    const forYouCount = filterCounts.for_you || 0;
    const suggestedCount = filterCounts.suggested || 0;
    if (activeFilter === 'for_you' && forYouCount === 0 && suggestedCount > 0) {
      setActiveFilter('suggested');
      return;
    }
    if (activeFilter === 'suggested' && suggestedCount === 0 && forYouCount > 0) {
      setActiveFilter('for_you');
    }
  }, [feedView, activeFilter, filterCounts.for_you, filterCounts.suggested]);

  useEffect(() => {
    if (isSubscribed) return;
    if (activeFilter === BRIEFING_PULSE_TAB_KEY) setActiveFilter('for_you');
  }, [isSubscribed, activeFilter]);

  useEffect(() => {
    if (feedView !== 'briefing') return;
    if (briefingVisibleList.length === 0) return;
    if (!selectedId) { setSelectedId(briefingVisibleList[0].id); return; }
    const inFiltered = briefingVisibleList.some(item => item.id === selectedId);
    if (!inFiltered) {
      setSelectedId(briefingVisibleList[0].id);
    }
  }, [feedView, briefingVisibleList, selectedId]);

  useEffect(() => {
    if (feedView !== 'pulse') return;
    if (pulseVisibleStoryList.length === 0) return;
    if (!selectedId) { setSelectedId(pulseVisibleStoryList[0].id); return; }
    const inPulse = pulseVisibleStoryList.some(item => item.id === selectedId);
    if (!inPulse) {
      setSelectedId(pulseVisibleStoryList[0].id);
    }
  }, [feedView, pulseVisibleStoryList, selectedId]);

  const defaultSelectedId = useMemo(() => {
    if (feedView === 'briefing') return briefingVisibleList[0]?.id ?? null;
    return pulseVisibleStoryList[0]?.id ?? null;
  }, [feedView, briefingVisibleList, pulseVisibleStoryList]);

  const effectiveSelectedId = selectedId ?? defaultSelectedId;

  const selectedItem = useMemo(() => {
    if (!effectiveSelectedId) return null;
    return currentList.find(item => item.id === effectiveSelectedId)
      || pulseStoryList.find(item => item.id === effectiveSelectedId)
      || null;
  }, [currentList, pulseStoryList, effectiveSelectedId]);

  const { data: selectedItemDetail, isLoading: selectedItemDetailLoading } = useSWR<FeedItemDetailResponse | null>(
    isSubscribed && effectiveSelectedId ? feedItemDetailSwrKey(effectiveSelectedId) : null,
    () => itemDetailFetcher(effectiveSelectedId!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000,
    }
  );

  // True when the feed item itself already has full content (shipped inline from bootstrap)
  const selectedItemHasFullContent = useMemo(() => {
    if (!isSubscribed) return false;
    if (!selectedItem) return false;
    if (selectedItem.type === 'article') {
      return Boolean((selectedItem.data as FeedItem).summary?.short_article?.body);
    }
    if (selectedItem.type === 'topic') {
      const topic = selectedItem.data as TrendingTopic;
      return Boolean(topic.key_points?.length || topic.timeline?.length);
    }
    return false;
  }, [isSubscribed, selectedItem]);

  const detailMatchesSelected = useMemo(() => {
    if (selectedItemHasFullContent) return true; // already have full content, no fetch needed
    if (!selectedItemDetail || !effectiveSelectedId) return false;
    return selectedItemDetail.item.id === effectiveSelectedId;
  }, [selectedItemDetail, effectiveSelectedId, selectedItemHasFullContent]);

  const hydratedSelectedItem = useMemo(() => {
    if (!selectedItem) return null;
    if (selectedItemHasFullContent) return selectedItem; // use inline data directly
    if (!selectedItemDetail || !detailMatchesSelected) return selectedItem;
    if (selectedItem.type === 'article' && selectedItemDetail.kind === 'article') {
      return { ...selectedItem, data: selectedItemDetail.item };
    }
    if (selectedItem.type === 'topic' && selectedItemDetail.kind === 'topic') {
      return { ...selectedItem, data: selectedItemDetail.item };
    }
    return selectedItem;
  }, [selectedItem, selectedItemDetail, detailMatchesSelected]);

  const selectedContent = useMemo((): ContentData | null => {
    if (!isSubscribed) return null;
    return getContentFromFeedListItem(hydratedSelectedItem);
  }, [isSubscribed, hydratedSelectedItem]);

  // ── Prefetch: seed SWR cache for inline-full items, then background-fetch the rest ──
  const { mutate: globalMutate } = useSWRConfig();
  const prefetchedRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isSubscribed) return;
    if (!effectiveFeed) return;

    // 1. Seed cache for items that arrived with full content from the bootstrap
    const inlineItems: { id: string; kind: 'article' | 'topic'; item: FeedItem | TrendingTopic }[] = [];

    for (const item of effectiveFeed.for_you || []) {
      if (item.summary?.short_article?.body) {
        inlineItems.push({ id: item.id, kind: 'article', item });
      }
    }
    for (const topic of effectiveFeed.trending_topics || []) {
      if (topic.key_points?.length || topic.timeline?.length) {
        inlineItems.push({ id: topic.id, kind: 'topic', item: topic });
      }
    }

    for (const entry of inlineItems) {
      if (prefetchedRef.current.has(entry.id)) continue;
      prefetchedRef.current.add(entry.id);
      globalMutate(
        feedItemDetailSwrKey(entry.id),
        { kind: entry.kind, item: entry.item } as FeedItemDetailResponse,
        { revalidate: false },
      );
    }

    // 2. Background-fetch remaining visible items so they're cached when clicked
    const remaining = currentList
      .filter(item => !prefetchedRef.current.has(item.id))
      .map(item => item.id);

    if (remaining.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const id of remaining) {
        if (cancelled) break;
        if (prefetchedRef.current.has(id)) continue;
        prefetchedRef.current.add(id);
        try {
          const detail = await itemDetailFetcher(id);
          if (cancelled) break;
          if (detail) {
            globalMutate(feedItemDetailSwrKey(id), detail, { revalidate: false });
          }
        } catch {
          // non-critical — user can still fetch on click
        }
      }
    })();

    return () => { cancelled = true; };
  // Only run when the feed or list changes, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubscribed, effectiveFeed, currentList.length, globalMutate, currentList]);

  const mobileContentList = useMemo(() => {
    if (feedView === 'briefing') return briefingVisibleList;
    return pulseVisibleStoryList;
  }, [feedView, briefingVisibleList, pulseVisibleStoryList]);

  const hasFeedResponse = typeof v3Feed !== 'undefined';
  const hasRenderableBootstrapFeed = Boolean(
    initialFeed && (
      (initialFeed.trending_topics?.length ?? 0) > 0 ||
      (initialFeed.trending?.length ?? 0) > 0 ||
      (initialFeed.pulse?.length ?? 0) > 0 ||
      (initialFeed.daily_pulse?.tools?.length ?? 0) > 0 ||
      (initialFeed.daily_pulse?.blogs?.length ?? 0) > 0 ||
      (initialFeed.daily_pulse?.discussions?.length ?? 0) > 0
    )
  );
  const isLoading = shouldBootstrapFeed && !hasFeedResponse && !hasRenderableBootstrapFeed;
  const showBlockingBoot = !hasRenderableBootstrapFeed && (loading || (Boolean(user) && !hasFeedResponse));
  const isPulseViewLoading = feedView === 'pulse' && shouldLoadPulse && pulseLoading && pulseStoryList.length === 0;
  const isBriefingPulseLoading =
    isSubscribed
    && activeFilter === BRIEFING_PULSE_TAB_KEY
    && shouldLoadPulse
    && pulseLoading
    && pulseStoryList.length === 0;

  if (showBlockingBoot) {
    return <FeedBootShell />;
  }

  const storyCount = briefingVisibleList.length;
  /** Below Tailwind `md`: always classic split; `md` and up: stored / toggled layout. */
  const effectiveBriefingLayout = mdUp ? briefingLayout : 'panel';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 justify-start">
              <Link href="/" prefetch={false} className="flex items-center gap-3">
                <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
                <span className="text-sm font-semibold tracking-[0.18em]">TRACE</span>
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              {feedView === 'briefing' && (
                <div className="hidden md:block">
                  <BriefingLayoutToggle layout={briefingLayout} onChange={setBriefingLayout} />
                </div>
              )}
              {user?.photoURL ? (
                <Link href="/profile" prefetch={false}>
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                </Link>
              ) : (
                <Link
                  href="/profile"
                  prefetch={false}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background"
                >
                  <span className="text-sm font-semibold">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-0 py-0 sm:px-6 sm:pt-2 sm:pb-5 lg:px-8 lg:pt-3 lg:pb-8">
        {checkoutReturned && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <Loader2 size={16} className={`text-amber-600 ${isSubscribed ? '' : 'animate-spin'}`} />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isSubscribed ? 'Trace Pro is active.' : 'Activating your Pro access...'}
                </p>
                <p className="text-xs text-secondary/50">
                  {isSubscribed
                    ? 'Your full feed is unlocked.'
                    : 'Your payment went through. Your full feed should unlock in a moment.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {!isSubscribed && !isLoading && <InlineUnlockBanner storyCount={currentList.length} />}

        {isSubscribed && feedView === 'pulse' && (
          isPulseViewLoading ? (
            <div className={`${PULSE_MAIN_SHELL} flex items-center justify-center py-20`}>
              <Loader2 size={20} className="animate-spin text-secondary/40" />
            </div>
          ) : (
            <div className={PULSE_MAIN_SHELL}>
              <DailyPulseView
                pulseSections={pulseSections}
                hasWeeklyPulse={Boolean((effectiveFeed?.daily_pulse ?? effectiveFeed?.weekly_pulse))}
                pulseStoryCount={pulseStoryList.length}
              />
            </div>
          )
        )}

        {feedView === 'briefing' && (
          <FeedBriefingView
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            storyCount={storyCount}
            interestTabs={interestTabs}
            filterCounts={briefingFilterCounts}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            isLoading={isLoading || isBriefingPulseLoading}
            isContentLoading={
              isSubscribed &&
              Boolean(effectiveSelectedId) &&
              !selectedItemHasFullContent &&
              (selectedItemDetailLoading || !detailMatchesSelected)
            }
            isContentRefreshing={isSubscribed && Boolean(selectedContent) && Boolean(effectiveSelectedId) && detailMatchesSelected && selectedItemDetailLoading}
            filteredList={briefingVisibleList}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            selectedContent={selectedContent}
            isLocked={!isSubscribed}
            lockedStory={selectedItem}
            mobileContentList={mobileContentList}
            showMobileContent={showMobileContent}
            openMobileArticle={openMobileArticle}
            closeMobileArticle={closeMobileArticle}
            briefingLayout={effectiveBriefingLayout}
            showPulseTab={isSubscribed}
          />
        )}



      </div>
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
