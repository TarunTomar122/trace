"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Flame,
  Crosshair,
  GraduationCap,
  Bookmark,
  BookmarkCheck,
  Clock,
  Loader2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';
import { getV3UserFeed, V3UserFeed, FeedItem, recordLastActive } from '@/lib/firestore';

type FeedTab = 'trending' | 'for_you' | 'deep_dives';

const ACCENT = '#F59E0B';

const TAB_CONFIG: { key: FeedTab; label: string; icon: typeof Flame }[] = [
  { key: 'trending', label: 'Trending', icon: Flame },
  { key: 'for_you', label: 'For You', icon: Crosshair },
  { key: 'deep_dives', label: 'Deep Dives', icon: GraduationCap },
];

const FREE_LIMITS: Record<FeedTab, number> = { trending: 5, for_you: 2, deep_dives: 1 };

function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function getSourceInitials(name?: string): string {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function isValidImage(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.length < 10) return false;
  if (url.includes('placeholder') || url.includes('default')) return false;
  return true;
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

function TrendingCard({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const hasImage = isValidImage(item.thumbnail);
  return (
    <button onClick={onPress} className="w-full text-left p-4 rounded-xl transition-all group hover:bg-gray-50 dark:hover:bg-gray-900">
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[9px] font-bold text-secondary/70">
              {getSourceInitials(item.source_name)}
            </div>
            <span className="text-xs text-secondary/60 font-medium">{item.source_name}</span>
            <span className="text-xs text-secondary/40">·</span>
            <span className="text-xs text-secondary/40">{getTimeAgo(item.published_at || item.fetched_at)}</span>
            {item.tags?.[0] && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
                {item.tags[0]}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-amber-600 transition-colors">
            {item.title}
          </h3>
          {item.summary?.short_article?.subtitle && (
            <p className="text-sm text-secondary/60 mt-1.5 line-clamp-2 leading-relaxed">
              {item.summary.short_article.subtitle}
            </p>
          )}
        </div>
        {hasImage && (
          <img
            src={item.thumbnail!}
            alt=""
            className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
          />
        )}
      </div>
    </button>
  );
}

function ForYouCard({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const hasImage = isValidImage(item.thumbnail);
  return (
    <button onClick={onPress} className="w-full text-left p-4 rounded-xl transition-all group hover:bg-gray-50 dark:hover:bg-gray-900">
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[9px] font-bold text-secondary/70">
              {getSourceInitials(item.source_name)}
            </div>
            <span className="text-xs text-secondary/60 font-medium">{item.source_name}</span>
            <span className="text-xs text-secondary/40">·</span>
            <span className="text-xs text-secondary/40">{getTimeAgo(item.published_at || item.fetched_at)}</span>
          </div>
          <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-amber-600 transition-colors">
            {item.title}
          </h3>
          {item.summary?.short_article?.subtitle && (
            <p className="text-sm text-secondary/60 mt-1.5 line-clamp-2 leading-relaxed">
              {item.summary.short_article.subtitle}
            </p>
          )}
        </div>
        {hasImage && (
          <img
            src={item.thumbnail!}
            alt=""
            className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
          />
        )}
      </div>
    </button>
  );
}

function DeepDiveCard({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const hasImage = isValidImage(item.thumbnail);
  const readMins = item.summary?.reading_time_minutes || 5;
  const keyTakeaways = item.summary?.short_article?.key_takeaways;
  const whyItMatters = item.summary?.short_article?.why_it_matters;

  const stripMd = (s: string) => s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

  return (
    <button onClick={onPress} className="w-full text-left p-4 pb-6 rounded-xl transition-all group hover:bg-gray-50 dark:hover:bg-gray-900">
      {hasImage && (
        <img
          src={item.thumbnail!}
          alt=""
          className="w-full h-48 rounded-xl object-cover mb-3"
        />
      )}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[9px] font-bold text-secondary/70">
          {getSourceInitials(item.source_name)}
        </div>
        <span className="text-xs text-secondary/60 font-medium">{item.source_name}</span>
        <span className="text-xs text-secondary/40">·</span>
        <Clock size={11} className="text-secondary/40" />
        <span className="text-xs text-secondary/40">{readMins} min read</span>
      </div>
      <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-amber-600 transition-colors">
        {item.title}
      </h3>
      {item.summary?.short_article?.subtitle && (
        <p className="text-sm text-secondary/60 mt-1.5 line-clamp-3 leading-relaxed">
          {item.summary.short_article.subtitle}
        </p>
      )}
      {keyTakeaways && keyTakeaways.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {keyTakeaways.slice(0, 3).map((t: string, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: ACCENT }} />
              <span className="text-xs text-secondary/70 line-clamp-1">{stripMd(t)}</span>
            </div>
          ))}
        </div>
      )}
      {whyItMatters && (
        <p className="text-xs text-secondary/50 italic mt-2 line-clamp-2">{stripMd(whyItMatters)}</p>
      )}
    </button>
  );
}

function FeedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<FeedTab>('trending');
  const [v3Feed, setV3Feed] = useState<V3UserFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadFeed();
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header/>
      <main className="container mx-auto px-4 max-w-2xl py-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold">
            {profile?.name ? `Welcome back, ${profile.name.split(' ')[0]}` : 'Your feed'}
          </h1>
          <p className="text-sm text-secondary/60">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                  active
                    ? 'border-amber-500 text-foreground'
                    : 'border-transparent text-secondary/60 hover:text-secondary/80 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Feed building banner */}
        {isFeedBuilding && currentItems.length > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-4"
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
        ) : isFeedBuilding && currentItems.length === 0 ? (
          <FeedBuildingLoader />
        ) : currentItems.length > 0 ? (
          <>
            <p className="text-sm text-secondary/50 mb-4">
              {activeTab === 'trending'
                ? `${currentItems.length} stories buzzing right now`
                : activeTab === 'for_you'
                  ? 'Matched to your interests and career goals'
                  : 'In-depth content from sources you trust'}
            </p>

                <div className={activeTab === 'deep_dives' ? 'divide-y divide-gray-100 dark:divide-gray-800' : 'space-y-1'}>
              {currentItems.map((item, i) => {
                if (activeTab === 'trending') {
                  return <TrendingCard key={`t-${item.id || i}`} item={item} onPress={() => openArticle(item)} />;
                }
                if (activeTab === 'for_you') {
                  return <ForYouCard key={`fy-${item.id || i}`} item={item} onPress={() => openArticle(item)} />;
                }
                return <DeepDiveCard key={`dd-${item.id || i}`} item={item} onPress={() => openArticle(item)} />;
              })}
            </div>

            {/* Upgrade CTA for limited tabs */}
            {isTabLimited && (
              <div className="mt-6 p-5 rounded-2xl text-center"
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
            <p className="text-sm text-secondary/60">No items yet. Pull down to refresh.</p>
          </div>
        )}
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
