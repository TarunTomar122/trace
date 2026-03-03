"use client";

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import useSWR, { preload } from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';
import { getV3UserFeed, V3UserFeed, FeedItem, recordLastActive } from '@/lib/firestore';
import { getArticleImage } from '@/lib/fallback-images';

type FeedTab = 'trending' | 'for_you' | 'deep_dives';

const ACCENT = '#F59E0B';

const TAB_CONFIG: { key: FeedTab; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'for_you', label: 'For You' },
  { key: 'deep_dives', label: 'Deep Dives' },
];

const FREE_LIMITS: Partial<Record<FeedTab, number>> = { for_you: 2, deep_dives: 1 };

// SWR fetcher for user feed
const feedFetcher = (uid: string) => getV3UserFeed(uid);

// SWR fetcher for public trending
const trendingFetcher = async () => {
  const res = await fetch('/api/public/trending');
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.items)) return [];
  return data.items.map((item: any): FeedItem => ({
    id: item.id,
    title: item.title,
    url: item.url,
    thumbnail: item.thumbnail,
    source_name: item.source,
    summary: { short_article: { subtitle: item.summary } },
  }));
};

// SWR fetcher for global deep dives fallback
const globalDeepDivesFetcher = async () => {
  const res = await fetch('/api/public/deep-dives');
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.items)) return [];
  return data.items as FeedItem[];
};

function stripMarkdown(text: string): string {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*#+\s*/gm, "")
    .trim();
}

function FeedBuildingLoader() {
  const steps = [
    'Scanning sources for fresh content...',
    'Matching articles to your interests...',
    'Generating personalized summaries...',
    'Almost there, assembling your feed...',
  ];
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setStepIdx((i) => (i + 1) % steps.length), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Loader2 size={32} className="animate-spin mb-4" style={{ color: ACCENT }} />
      <p className="text-sm text-secondary/70 font-medium">{steps[stepIdx]}</p>
      <p className="text-xs text-secondary/50 mt-2">This usually takes about a minute</p>
    </div>
  );
}

function FeedCard({
  item,
  onPress,
  onHover,
}: {
  item: FeedItem;
  onPress: () => void;
  onHover?: () => void;
}) {
  const fallbackUrl = getArticleImage(null, item.title);
  const [imageUrl, setImageUrl] = useState(getArticleImage(item.thumbnail, item.title));
  const [showFallback, setShowFallback] = useState(false);
  const subtitle = stripMarkdown(item.summary?.short_article?.subtitle || "");
  const hasHovered = useRef(false);

  const handleMouseEnter = () => {
    // Only trigger prefetch once per card
    if (!hasHovered.current && onHover) {
      hasHovered.current = true;
      onHover();
    }
  };

  return (
    <button
      onClick={onPress}
      onMouseEnter={handleMouseEnter}
      className="w-full text-left group"
    >
      {/* Image - always shows either thumbnail or relevant fallback */}
      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3">
        {/* Fallback image layer - always present behind main image */}
        <img
          src={fallbackUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Main image on top */}
        {!showFallback && (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setShowFallback(true)}
          />
        )}
        {/* Source badge */}
        {item.source_name && (
          <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <span className="text-[11px] font-medium text-white leading-none">{item.source_name}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-amber-600 transition-colors">
        {item.title}
      </h3>

      {/* Subtitle */}
      <p className="text-sm text-secondary/60 line-clamp-2 leading-relaxed mt-1">
        {subtitle || '\u00A0'}
      </p>
    </button>
  );
}

function FeedPageContent() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<FeedTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('trace_feed_tab');
      if (saved === 'for_you' || saved === 'deep_dives' || saved === 'trending') {
        return saved;
      }
    }
    return 'trending';
  });

  // Persist tab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('trace_feed_tab', activeTab);
  }, [activeTab]);

  // SWR for user feed - cached automatically, instant on back navigation
  const { data: v3Feed, isLoading: feedLoading, mutate: mutateFeed } = useSWR<V3UserFeed | null>(
    user?.uid ? `feed-${user.uid}` : null,
    () => feedFetcher(user!.uid),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Dedupe requests within 1 minute
    }
  );

  // SWR for fallback trending
  const { data: fallbackTrending = [] } = useSWR<FeedItem[]>(
    'public-trending',
    trendingFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min cache for public trending
    }
  );

  // SWR for fallback deep dives (from global feed)
  const { data: fallbackDeepDives = [] } = useSWR<FeedItem[]>(
    'public-deep-dives',
    globalDeepDivesFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min cache
    }
  );

  // Prefetch article data on hover
  const prefetchArticle = useCallback((item: FeedItem) => {
    // Store item in sessionStorage for instant access
    sessionStorage.setItem(`trace_article_${item.id}`, JSON.stringify(item));
  }, []);

  const openArticle = useCallback((item: FeedItem) => {
    // Save scroll position
    sessionStorage.setItem('trace_feed_scroll', String(window.scrollY));
    sessionStorage.setItem("trace_article", JSON.stringify(item));
    router.push("/feed/article");
  }, [router]);

  // Restore scroll position
  useEffect(() => {
    if (v3Feed && !feedLoading) {
      const savedScroll = sessionStorage.getItem('trace_feed_scroll');
      if (savedScroll) {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(savedScroll, 10));
          // Clear after restoring so it doesn't persist on fresh visits
          sessionStorage.removeItem('trace_feed_scroll');
        });
      }
    }
  }, [v3Feed, feedLoading]);

  const isSubscribed = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial'
    || profile?.appSubscriptionStatus === 'active' || profile?.appSubscriptionStatus === 'trial';

  const isFeedBuilding = (() => {
    if (profile?.feedBuildStatus !== 'building') return false;
    const raw = profile?.feedBuildRequestedAt;
    if (!raw) return false;
    const ts = typeof raw === 'string' ? new Date(raw).getTime()
      : raw?.toDate ? raw.toDate().getTime()
      : raw?.seconds ? raw.seconds * 1000 : 0;
    return ts > 0 && Date.now() - ts < 5 * 60 * 1000;
  })();

  // Redirect logic
  useEffect(() => {
    if (!isAlphaMode()) {
      router.push(user ? '/waitlist' : '/');
      return;
    }
    if (!loading && !user) {
      router.push('/');
      return;
    }
    if (user && profile?.onboarded) {
      recordLastActive(user.uid);
    } else if (user && !loading && !profile?.onboarded) {
      router.push('/onboarding');
    }
  }, [user, profile, loading, router]);

  // Poll for feed updates while building
  useEffect(() => {
    if (!isFeedBuilding || !user) return;
    const interval = setInterval(() => mutateFeed(), 15000);
    return () => clearInterval(interval);
  }, [isFeedBuilding, user, mutateFeed]);

  const currentItems: FeedItem[] = (() => {
    if (!v3Feed) return [];
    let all: FeedItem[];

    if (activeTab === 'trending') {
      all = v3Feed.trending;
    } else if (activeTab === 'for_you') {
      all = v3Feed.for_you;
    } else {
      // Deep dives - use global fallback if user has none
      all = v3Feed.deep_dives?.length > 0 ? v3Feed.deep_dives : fallbackDeepDives;
    }

    if (isSubscribed || activeTab === 'trending') return all;
    const limit = FREE_LIMITS[activeTab] ?? 2;
    return all.slice(0, limit);
  })();

  // Check if showing fallback deep dives
  const isShowingFallbackDeepDives = activeTab === 'deep_dives' &&
    v3Feed && (v3Feed.deep_dives?.length === 0 || !v3Feed.deep_dives) &&
    fallbackDeepDives.length > 0;

  const isTabLimited = !isSubscribed && activeTab !== 'trending' && v3Feed != null;
  const isLoading = loading || (feedLoading && !v3Feed);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getSubtitle = () => {
    if (activeTab === 'trending') return 'Top trending content for you';
    if (activeTab === 'for_you') return 'Matched to your interests';
    if (activeTab === 'deep_dives') {
      if (isShowingFallbackDeepDives) {
        return 'Popular deep dive for everyone';
      }
      return isSubscribed
        ? 'From your trusted sources'
        : 'Popular deep dive · Subscribe for personalized picks';
    }
    return 'In-depth reads worth your time';
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 max-w-3xl">
        {/* Header with title and pill tabs */}
        <div className="py-6 border-b border-gray-100 dark:border-gray-800 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold mb-0.5">Discover</h1>
              <p className="text-sm text-secondary/50">{getSubtitle()}</p>
            </div>

            {/* Pill tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800/80 rounded-full p-1 self-start sm:self-auto">
              {TAB_CONFIG.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                      active
                        ? 'bg-white dark:bg-gray-900 text-foreground shadow-sm'
                        : 'text-secondary/50 hover:text-secondary/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Feed building banner - only for subscribed users */}
        {isFeedBuilding && isSubscribed && currentItems.length > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-6"
            style={{ backgroundColor: `${ACCENT}12` }}>
            <Loader2 size={16} className="animate-spin" style={{ color: ACCENT }} />
            <p className="text-xs text-secondary/70 font-medium">
              Your full feed is building — refresh in a minute
            </p>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-secondary/40" />
          </div>
        ) : currentItems.length > 0 ? (
          <>
            {/* Grid of cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              {currentItems.map((item, i) => (
                <FeedCard
                  key={`${activeTab}-${item.id || i}`}
                  item={item}
                  onPress={() => openArticle(item)}
                  onHover={() => prefetchArticle(item)}
                />
              ))}
            </div>

            {/* Upgrade CTA for limited tabs */}
            {isTabLimited && (
              <div className="mt-8 p-6 rounded-2xl text-center"
                style={{ backgroundColor: `${ACCENT}10` }}>
                <Lock size={20} className="mx-auto mb-2" style={{ color: ACCENT }} />
                <p className="font-semibold text-sm mb-1">
                  {activeTab === 'for_you' ? 'Unlock all personalized stories' : 'Get personalized deep dives'}
                </p>
                <p className="text-xs text-secondary/60 mb-3">
                  {activeTab === 'for_you'
                    ? 'Start a free trial to get unlimited access'
                    : 'This is a popular deep dive for everyone. Go Pro to get deep dives from your trusted sources.'}
                </p>
                <Link
                  href="/profile?tab=subscription"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  Start Free Trial
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </>
        ) : fallbackTrending.length > 0 ? (
          <>
            {/* No personal feed yet - show trending as fallback */}
            {isFeedBuilding && (
              <div className="flex items-center gap-3 p-4 rounded-xl mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <Loader2 size={18} className="animate-spin text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Building your personalized feed...</p>
                  <p className="text-xs text-secondary/60">Meanwhile, here's what's trending today</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              {fallbackTrending.map((item, i) => (
                <FeedCard
                  key={`fallback-${item.id || i}`}
                  item={item}
                  onPress={() => openArticle(item)}
                  onHover={() => prefetchArticle(item)}
                />
              ))}
            </div>
            {/* Upgrade CTA for non-subscribed users */}
            {!isSubscribed && (
              <div className="mt-8 p-6 rounded-2xl text-center bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30">
                <Sparkles size={24} className="mx-auto mb-2 text-amber-500" />
                <p className="font-semibold text-sm mb-1">Get your personalized feed</p>
                <p className="text-xs text-secondary/60 mb-3">
                  Start a free trial to unlock For You & Deep Dive feeds tailored to your interests
                </p>
                <Link
                  href="/profile?tab=subscription"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  Start Free Trial
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24">
            <p className="text-sm text-secondary/60">No items yet. Check back soon.</p>
          </div>
        )}

        {/* Bottom spacing */}
        <div className="h-12" />
      </main>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FeedPageContent />
    </Suspense>
  );
}
