"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
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

const FREE_LIMITS: Record<FeedTab, number> = { trending: 5, for_you: 2, deep_dives: 1 };

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

function FeedCard({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const subtitle = stripMarkdown(item.summary?.short_article?.subtitle || "");

  return (
    <button
      onClick={onPress}
      className="w-full text-left group"
    >
      {/* Image - always shows either thumbnail or relevant fallback */}
      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
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
    // Restore tab from sessionStorage
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('trace_feed_tab');
      if (saved === 'for_you' || saved === 'deep_dives' || saved === 'trending') {
        return saved;
      }
    }
    return 'trending';
  });

  // Persist tab to sessionStorage when it changes
  useEffect(() => {
    sessionStorage.setItem('trace_feed_tab', activeTab);
  }, [activeTab]);
  const [v3Feed, setV3Feed] = useState<V3UserFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fallbackTrending, setFallbackTrending] = useState<FeedItem[]>([]);

  // Fetch public trending as fallback while personal feed builds
  useEffect(() => {
    async function fetchFallback() {
      try {
        const res = await fetch('/api/public/trending');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            // Convert to FeedItem format
            const items: FeedItem[] = data.items.map((item: any) => ({
              id: item.id,
              title: item.title,
              url: item.url,
              thumbnail: item.thumbnail,
              source_name: item.source,
              summary: {
                short_article: {
                  subtitle: item.summary,
                },
              },
            }));
            setFallbackTrending(items);
          }
        }
      } catch (err) {
        console.error('Failed to fetch fallback trending:', err);
      }
    }
    fetchFallback();
  }, []);

  const openArticle = useCallback((item: FeedItem) => {
    sessionStorage.setItem("trace_article", JSON.stringify(item));
    router.push("/feed/article");
  }, [router]);

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

  const loadFeed = useCallback(async () => {
    if (!user) return;
    try {
      const feed = await getV3UserFeed(user.uid);
      if (feed) setV3Feed(feed);
    } catch (error) {
      console.error('Error loading feed:', error);
    }
  }, [user]);

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
      setIsLoading(true);
      loadFeed().finally(() => setIsLoading(false));
      recordLastActive(user.uid);
    } else if (user && !loading && !profile?.onboarded) {
      router.push('/onboarding');
    }
  }, [user, profile, loading, router, loadFeed]);

  useEffect(() => {
    if (!isFeedBuilding || !user) return;
    const interval = setInterval(loadFeed, 15000);
    return () => clearInterval(interval);
  }, [isFeedBuilding, user, loadFeed]);

  const currentItems: FeedItem[] = (() => {
    if (!v3Feed) return [];
    const all = activeTab === 'trending' ? v3Feed.trending
      : activeTab === 'for_you' ? v3Feed.for_you
      : v3Feed.deep_dives;
    if (isSubscribed) return all;
    const limit = FREE_LIMITS[activeTab] ?? 2;
    return all.slice(0, limit);
  })();

  const isTabLimited = !isSubscribed && activeTab !== 'trending' && v3Feed != null;

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
        ) : isFeedBuilding && isSubscribed && currentItems.length === 0 && fallbackTrending.length > 0 ? (
          <>
            {/* Show fallback trending while personal feed builds (subscribed users) */}
            <div className="flex items-center gap-3 p-4 rounded-xl mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30">
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                <Loader2 size={18} className="animate-spin text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Building your personalized feed...</p>
                <p className="text-xs text-secondary/60">Meanwhile, here's what's trending today</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              {fallbackTrending.map((item, i) => (
                <FeedCard
                  key={`fallback-${item.id || i}`}
                  item={item}
                  onPress={() => openArticle(item)}
                />
              ))}
            </div>
          </>
        ) : isFeedBuilding && isSubscribed && currentItems.length === 0 ? (
          <FeedBuildingLoader />
        ) : !isSubscribed && currentItems.length === 0 && fallbackTrending.length > 0 ? (
          <>
            {/* Free user with no feed - show trending with upgrade prompt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              {fallbackTrending.map((item, i) => (
                <FeedCard
                  key={`fallback-${item.id || i}`}
                  item={item}
                  onPress={() => openArticle(item)}
                />
              ))}
            </div>
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
          </>
        ) : currentItems.length > 0 ? (
          <>
            {/* Grid of cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              {currentItems.map((item, i) => (
                <FeedCard
                  key={`${activeTab}-${item.id || i}`}
                  item={item}
                  onPress={() => openArticle(item)}
                />
              ))}
            </div>

            {/* Upgrade CTA for limited tabs */}
            {isTabLimited && (
              <div className="mt-8 p-6 rounded-2xl text-center"
                style={{ backgroundColor: `${ACCENT}10` }}>
                <Lock size={20} className="mx-auto mb-2" style={{ color: ACCENT }} />
                <p className="font-semibold text-sm mb-1">
                  {activeTab === 'for_you' ? 'Unlock all personalized stories' : 'Unlock all deep dives'}
                </p>
                <p className="text-xs text-secondary/60 mb-3">
                  Start a free trial to get unlimited access
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
