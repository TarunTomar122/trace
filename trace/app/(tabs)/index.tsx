import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Text,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Moon, Sun, Zap, Flame, BookOpen, ChevronRight, Gift } from 'lucide-react-native';

import NewspaperIllus from '@/assets/images/newspaper-svgrepo-com.svg';

import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/components/FeedCard';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  FeedItem,
  UserFeed,
  DailyInsight,
  ReadingStreak,
  getLatestUserFeed,
  getTrendingFeed,
  triggerFeedGeneration,
  recordReadingDay,
} from '@/lib/firestore';
import { logReadingEvent } from '@/lib/reading-analytics';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const ILLUS_PALETTE = {
  lavender: { light: '#f5f3ff', dark: '#22183a' },
} as const;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function FeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ feedUpdating?: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const { toggleTheme } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedDate, setFeedDate] = useState<string>('');
  const [feedVersion, setFeedVersion] = useState<string>('');

  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null);
  const [streak, setStreak] = useState<ReadingStreak | null>(null);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const { isProUser: isSubscribed, loading: rcLoading } = useRevenueCat();
  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const isOnboarded = profile?.onboarded ?? false;
  const { showToast } = useToast();

  const [trendingFeed, setTrendingFeed] = useState<FeedItem[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);

  // Record today as a reading day (opening the app counts toward streak)
  useEffect(() => {
    if (!user || !isOnboarded) return;
    recordReadingDay(user.uid).then(setStreak);
  }, [user, isOnboarded]);

  // Sectioned layout — no filter pills needed

  const hasSummary = useCallback((item: FeedItem) => {
    const sa = item.summary?.short_article;
    return !!(sa?.subtitle || sa?.body);
  }, []);

  const isLearnItem = useCallback((item: FeedItem) => {
    return (
      (item as any).feed_category === 'learn'
      || item.metadata?.feed_category === 'learn'
      || item.id?.startsWith('learn_')
    );
  }, []);

  const isTrendingItem = useCallback((item: FeedItem) => {
    return (
      item.metadata?.feed_category === 'trending_news'
      || item.metadata?.is_hot === true
    );
  }, []);

  const { learnItems, trendingItems, forYouItems } = useMemo(() => {
    const withSummary = feed.filter(hasSummary);
    const learn: FeedItem[] = [];
    const trending: FeedItem[] = [];
    const forYou: FeedItem[] = [];

    for (const item of withSummary) {
      if (isLearnItem(item)) learn.push(item);
      else if (isTrendingItem(item)) trending.push(item);
      else forYou.push(item);
    }

    return { learnItems: learn, trendingItems: trending, forYouItems: forYou };
  }, [feed, hasSummary, isLearnItem, isTrendingItem]);

  const feedSummaryLine = useMemo(() => {
    const parts: string[] = [];
    if (learnItems.length > 0) parts.push(`${learnItems.length} learning picks`);
    if (trendingItems.length > 0) parts.push(`${trendingItems.length} trending stories`);
    if (forYouItems.length > 0) parts.push(`${forYouItems.length} articles for you`);
    return parts.join(', ');
  }, [learnItems, trendingItems, forYouItems]);

  // Whether we're showing fallback content while a personalised feed is being generated
  const [isFeedGenerating, setIsFeedGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredSubscribedRefresh = useRef(false);
  const hasShownUpgradeToast = useRef(false); // Don't show upgrade toast on initial load
  const hasHandledFeedUpdatingParam = useRef(false);
  // Snapshot of the feed date when we started generating - so we can detect a NEW feed
  const feedDateOnGenStart = useRef<string | null>(null);
  // Snapshot of feed payload version when generation starts, to detect true updates.
  const feedVersionOnGenStart = useRef<string | null>(null);

  const getFeedVersion = useCallback((userFeed: (UserFeed & { generated_at?: string }) | null | undefined): string => {
    if (!userFeed) return '';
    const date = userFeed.date || '';
    const generatedAt = userFeed.generated_at || userFeed.metadata?.generated_at || '';
    const count = Array.isArray(userFeed.items) ? userFeed.items.length : 0;
    return `${date}|${generatedAt}|${count}`;
  }, []);

  const loadFeed = useCallback(async (): Promise<boolean> => {
    if (!user || !isOnboarded || !isSubscribed) return false;
    try {
      const userFeed = await getLatestUserFeed(user.uid);
      if (userFeed && userFeed.items?.length > 0) {
        setFeed(userFeed.items);
        setFeedDate(userFeed.date);
        setFeedVersion(getFeedVersion(userFeed));
        if (userFeed.daily_insight) setDailyInsight(userFeed.daily_insight);
        return true;
      } else {
        setFeed([]);
        setFeedDate('');
        setFeedVersion(getFeedVersion({ date: '', items: [] }));
        return false;
      }
    } catch (error) {
      console.error('Error loading feed:', error);
      setFeed([]);
      setFeedVersion(getFeedVersion({ date: '', items: [] }));
      return false;
    }
  }, [user, isOnboarded, isSubscribed, getFeedVersion]);

  useEffect(() => {
    const feedUpdating = Array.isArray(params.feedUpdating)
      ? params.feedUpdating[0]
      : params.feedUpdating;
    if (feedUpdating !== '1' || hasHandledFeedUpdatingParam.current) return;

    hasHandledFeedUpdatingParam.current = true;
    showToast('Feed updating in background. Pull to refresh in a bit.', 'success');
    router.replace('/(tabs)');

    if (!user || !isOnboarded || !isSubscribed) return;
    feedDateOnGenStart.current = feedDate || null;
    feedVersionOnGenStart.current = feedVersion || null;
    hasTriggeredSubscribedRefresh.current = true;
    setIsFeedGenerating(true);
  }, [
    params.feedUpdating,
    router,
    showToast,
    user,
    isOnboarded,
    isSubscribed,
    feedDate,
    feedVersion,
  ]);

  /**
   * Like loadFeed but only reports success if the feed is NEWER than when we
   * started generating (i.e., the backend has produced a fresh one).
   */
  const checkForNewFeed = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const userFeed = await getLatestUserFeed(user.uid);
      if (userFeed && userFeed.items?.length > 0) {
        setFeed(userFeed.items);
        setFeedDate(userFeed.date);
        const nextVersion = getFeedVersion(userFeed);
        setFeedVersion(nextVersion);
        if (feedVersionOnGenStart.current && nextVersion === feedVersionOnGenStart.current) {
          return false;
        }
        // If we recorded a snapshot date, only succeed if the feed date changed
        if (feedDateOnGenStart.current && userFeed.date === feedDateOnGenStart.current) {
          // For subscribed users, keep waiting until summaries are ready.
          if (isSubscribed) {
            const hasSummaries = userFeed.items.some((i: FeedItem) => !!i.summary?.short_article?.body);
            if (!hasSummaries) return false;
          }
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [user, isSubscribed, getFeedVersion]);

  // Load trending news for unsubscribed users
  useEffect(() => {
    if (rcLoading) return;
    if (!isSubscribed && isOnboarded) {
      setIsTrendingLoading(true);
      getTrendingFeed(8).then((items) => {
        setTrendingFeed(items);
        setIsTrendingLoading(false);
      });
    }
  }, [isSubscribed, isOnboarded, rcLoading]);

  useEffect(() => {
    if (!isOnboarded || !isSubscribed) {
      setIsLoading(false);
      return;
    }

    const initFeed = async () => {
      setIsLoading(true);
      const hasReal = await loadFeed();
      setIsLoading(false);

      // If onboarded but no personalised feed yet, start polling
      if (isOnboarded && !hasReal) {
        feedDateOnGenStart.current = '';
        feedVersionOnGenStart.current = null;
        setIsFeedGenerating(true);
      }
    };
    initFeed();
  }, [loadFeed, isOnboarded, isSubscribed]);

  // ─── Keep subscribed users in "generating" state until feed has summaries/new data ───
  useEffect(() => {
    if (!isOnboarded || !user || isLoading) return;

    if (!isSubscribed) {
      hasTriggeredSubscribedRefresh.current = false;
      hasShownUpgradeToast.current = false;
      return;
    }

    const hasSummaries = feed.some((item) => !!item.summary?.short_article?.body);
    const needsGeneration = feedDate === '' || !hasSummaries;
    if (!needsGeneration) {
      hasTriggeredSubscribedRefresh.current = false;
      hasShownUpgradeToast.current = false;
      setIsFeedGenerating(false);
      feedVersionOnGenStart.current = null;
      return;
    }

    // Only show upgrade toast if: (1) not shown yet this session AND (2) not initial load
    if (!hasTriggeredSubscribedRefresh.current && !hasShownUpgradeToast.current && feed.length > 0) {
      showToast('🎉 Upgrading your feed with AI summaries...', 'success');
      hasShownUpgradeToast.current = true;
    }
    
    setIsFeedGenerating(true);

    if (!hasTriggeredSubscribedRefresh.current) {
      hasTriggeredSubscribedRefresh.current = true;
      feedDateOnGenStart.current = feedDate || null;
      feedVersionOnGenStart.current = feedVersion || null;
      console.log('[Feed] Subscribed user needs upgraded feed, triggering generation...');

      // Small delay so Firestore subscription updates settle before backend reads profile.
      const timer = setTimeout(() => {
        triggerFeedGeneration(user.uid, { reason: 'subscribed_fallback' });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isOnboarded, isSubscribed, user, isLoading, feed, feedDate, feedVersion, showToast]);

  // ─── Poll for personalised feed every 15s while generating ───
  useEffect(() => {
    if (!isFeedGenerating) return;

    pollRef.current = setInterval(async () => {
      console.log('[Feed] Polling for new personalised feed...');
      const hasNew = await checkForNewFeed();
      if (hasNew) {
        console.log('[Feed] New personalised feed arrived!');
        feedDateOnGenStart.current = null;
        feedVersionOnGenStart.current = null;
        setIsFeedGenerating(false);
        
        // Show success message for subscribed users getting their AI summaries
        if (isSubscribed && hasTriggeredSubscribedRefresh.current) {
          showToast('✨ Your feed is now enhanced with AI summaries!', 'success');
          hasTriggeredSubscribedRefresh.current = false;
        }
      }
    }, 15_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isFeedGenerating, checkForNewFeed, isSubscribed, showToast]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const hadGenerating = isFeedGenerating;
    const hasReal = await loadFeed();
    if (hasReal) {
      setIsFeedGenerating(false);
      
      // If they were waiting for summaries and now have them, show success
      if (isSubscribed && hadGenerating && hasTriggeredSubscribedRefresh.current) {
        const hasSummaries = feed.some((item) => !!item.summary?.short_article?.body);
        if (hasSummaries) {
          showToast('✨ Your feed is now enhanced with AI summaries!', 'success');
          hasTriggeredSubscribedRefresh.current = false;
        }
      }
    }
    setIsRefreshing(false);
  }, [isFeedGenerating, loadFeed, isSubscribed, feed, showToast]);

  const handleFeedItemPress = (item: FeedItem) => {
    logReadingEvent({
      eventType: 'feed_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      tags: item.tags,
      itemType: item.type || item.source,
      feedCategory: item.metadata?.feed_category,
    });

    if (user) {
      recordReadingDay(user.uid).then(setStreak);
    }

    const fallbackBody =
      item.summary?.short_article?.body ||
      item.description ||
      'Open the original article to read the full story.';
    router.push({
      pathname: '/article',
      params: {
        id: item.id,
        title: item.title,
        url: item.url,
        thumbnail: item.thumbnail || '',
        type: item.type || item.source || 'blog',
        subtitle: item.summary?.short_article?.subtitle || '',
        body: fallbackBody,
        reading_time: item.summary?.reading_time_minutes?.toString() || '',
        why_relevant: item.metadata?.why_relevant || '',
        is_hot: item.metadata?.is_hot ? 'true' : 'false',
        feed_category: item.metadata?.feed_category || '',
      },
    });
  };

  const handleFreeReadPress = useCallback((item: FeedItem) => {
    logReadingEvent({
      eventType: 'feed_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      tags: item.tags,
      itemType: item.type || item.source,
      feedCategory: 'free_daily_read',
    });
    if (user) recordReadingDay(user.uid).then(setStreak);
    const fallbackBody =
      item.summary?.short_article?.body ||
      item.description ||
      'Open the original article to read the full story.';
    router.push({
      pathname: '/article',
      params: {
        id: item.id,
        title: item.title,
        url: item.url,
        thumbnail: item.thumbnail || '',
        type: item.type || item.source || 'blog',
        subtitle: item.summary?.short_article?.subtitle || '',
        body: fallbackBody,
        reading_time: item.summary?.reading_time_minutes?.toString() || '',
        why_relevant: item.metadata?.why_relevant || '',
        is_hot: item.metadata?.is_hot ? 'true' : 'false',
        feed_category: 'free_daily_read',
      },
    });
  }, [user, router]);

  if (!isOnboarded) {
    return null;
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>

      {/* ─── Main scrollable content ─── */}
      <AnimatedScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors[colorScheme].foreground}
          />
        }
        contentContainerStyle={styles.scrollContent}>

        {/* Greeting row */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.greeting}>
              {getGreeting()}, {firstName}
            </ThemedText>
            {isSubscribed && !isLoading && feedSummaryLine ? (
              <ThemedText style={[styles.feedSummaryLine, { color: Colors[colorScheme].muted }]}>
                {feedSummaryLine}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            onPress={toggleTheme}
            style={[styles.themeToggle, { backgroundColor: Colors[colorScheme].card }]}
            hitSlop={8}>
            {colorScheme === 'dark' ? (
              <Sun size={18} color={Colors[colorScheme].muted} strokeWidth={1.8} />
            ) : (
              <Moon size={18} color={Colors[colorScheme].muted} strokeWidth={1.8} />
            )}
          </Pressable>
        </View>

        {/* Streak bar — tappable, goes to Activity tab */}
        {streak && (
          <Pressable
            onPress={() => router.push('/(tabs)/analytics')}
            style={[
              streakStyles.bar,
              { backgroundColor: colorScheme === 'dark' ? '#1a1408' : '#fffbeb' },
            ]}>
            <View style={streakStyles.main}>
              <Flame size={20} color="#f97316" strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <ThemedText style={streakStyles.headline}>
                  {streak.current_streak === 0
                    ? 'Start your streak today'
                    : streak.current_streak === 1
                      ? '1 day streak — keep it going!'
                      : `${streak.current_streak} day streak`}
                </ThemedText>
                <ThemedText style={[streakStyles.sub, { color: Colors[colorScheme].muted }]}>
                  {streak.current_streak === 0
                    ? 'Read something to begin'
                    : streak.longest_streak > streak.current_streak
                      ? `Best: ${streak.longest_streak} days · ${streak.total_days_read} total`
                      : `${streak.total_days_read} total days read`}
                </ThemedText>
              </View>
              <ChevronRight size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            </View>
          </Pressable>
        )}

        {/* Daily Insight Card */}
        {dailyInsight && isSubscribed && (
          <Pressable
            style={[
              insightStyles.card,
              {
                backgroundColor: colorScheme === 'dark' ? '#0f1a0f' : '#f0fdf4',
                borderColor: colorScheme === 'dark' ? '#1a3a1a' : '#dcfce7',
              },
            ]}
            onPress={() => {
              if (dailyInsight.source_url) {
                const matchingItem = feed.find((i) => i.url === dailyInsight.source_url);
                if (matchingItem) {
                  handleFeedItemPress(matchingItem);
                }
              }
            }}
          >
            <ThemedText style={insightStyles.eyebrow}>INSIGHT OF THE DAY</ThemedText>
            <ThemedText style={insightStyles.insightText}>{dailyInsight.text}</ThemedText>
            {dailyInsight.source_title ? (
              <ThemedText style={[insightStyles.source, { color: Colors[colorScheme].muted }]}>
                From: {dailyInsight.source_title}
              </ThemedText>
            ) : null}
          </Pressable>
        )}

        {/* Trending feed for unsubscribed users */}
        {!isSubscribed && !rcLoading && (
          <>
            {isTrendingLoading ? (
              <View style={styles.loadingContainer}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.skeletonItem}>
                    <View style={styles.skeletonRow}>
                      <View style={styles.skeletonTextCol}>
                        <View style={[styles.skeletonMeta, { backgroundColor: Colors[colorScheme].border }]} />
                        <View style={[styles.skeletonTitle, { backgroundColor: Colors[colorScheme].border }]} />
                        <View style={[styles.skeletonSub, { backgroundColor: Colors[colorScheme].border }]} />
                      </View>
                      <View style={[styles.skeletonThumb, { backgroundColor: Colors[colorScheme].border }]} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.feedList}>
                {trendingFeed.map((item, index) => {
                  const isFirstWithSummary = index === trendingFeed.findIndex(
                    (i) => !!(i.summary?.short_article?.body),
                  );
                  return (
                    <View key={`trending-${item.id}-${index}`}>
                      {index > 0 && (
                        <View style={[styles.separator, { backgroundColor: Colors[colorScheme].border }]} />
                      )}
                      {isFirstWithSummary && (
                        <View style={[
                          insightStyles.freeReadBanner,
                          { backgroundColor: colorScheme === 'dark' ? '#0f1a0f' : '#f0fdf4' },
                        ]}>
                          <Gift size={14} color="#22c55e" strokeWidth={2} />
                          <ThemedText style={insightStyles.freeReadText}>
                            Today{"'"}s free read — full summary unlocked
                          </ThemedText>
                        </View>
                      )}
                      <FeedCard
                        item={item}
                        colorScheme={colorScheme}
                        onPress={() =>
                          isFirstWithSummary
                            ? handleFreeReadPress(item)
                            : handleFeedItemPress(item)
                        }
                      />
                    </View>
                  );
                })}
              </View>
            )}

            {/* Subscribe CTA banner */}
            {!isTrendingLoading && (
              <View style={[
                ctaStyles.banner,
                {
                  backgroundColor: colorScheme === 'dark' ? '#0d1f12' : '#f0fdf4',
                  borderColor: colorScheme === 'dark' ? '#166534' : '#bbf7d0',
                },
              ]}>
                <Text style={[ctaStyles.bannerEyebrow, { color: colorScheme === 'dark' ? '#6ee7b7' : '#059669' }]}>
                  YOU{"'"}RE READING TRENDING NEWS
                </Text>
                <Text style={[ctaStyles.bannerTitle, { color: Colors[colorScheme].text }]}>
                  Want stories picked just for you?
                </Text>
                <Text style={[ctaStyles.bannerBody, { color: Colors[colorScheme].muted }]}>
                  Start a free trial to unlock your personalized feed with AI summaries — built around your interests, not the crowd.
                </Text>
                <Pressable
                  onPress={() => router.push('/paywall')}
                  style={[ctaStyles.ctaButton, { backgroundColor: colorScheme === 'dark' ? '#6ee7b7' : '#059669' }]}
                >
                  <Zap size={16} color={colorScheme === 'dark' ? '#052e20' : '#ffffff'} />
                  <Text style={[ctaStyles.ctaText, { color: colorScheme === 'dark' ? '#052e20' : '#ffffff' }]}>
                    Start Free Trial
                  </Text>
                </Pressable>
                <Text style={[ctaStyles.bannerLegal, { color: Colors[colorScheme].muted }]}>
                  4-day free trial · Cancel anytime
                </Text>
              </View>
            )}
          </>
        )}

        {/* Feed generating nudge */}
        {isSubscribed && isFeedGenerating && !isLoading && (
          <View
            style={[
              styles.nudge,
              {
                borderColor: Colors[colorScheme].border,
                backgroundColor: colorScheme === 'dark' ? '#052e16' : '#f0fdf4',
              },
            ]}>
            <ActivityIndicator size="small" color="#22c55e" />
            <ThemedText
              style={[styles.nudgeSubtitle, { color: Colors[colorScheme].muted, flex: 1 }]}>
              Adding AI summaries to your feed — this takes a minute or two.
            </ThemedText>
          </View>
        )}

        {/* ─── Subscribed user: sectioned feed ─── */}
        {isSubscribed && (
          <>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.skeletonItem}>
                    <View style={styles.skeletonRow}>
                      <View style={styles.skeletonTextCol}>
                        <View style={[styles.skeletonMeta, { backgroundColor: Colors[colorScheme].border }]} />
                        <View style={[styles.skeletonTitle, { backgroundColor: Colors[colorScheme].border }]} />
                        <View style={[styles.skeletonSub, { backgroundColor: Colors[colorScheme].border }]} />
                      </View>
                      <View style={[styles.skeletonThumb, { backgroundColor: Colors[colorScheme].border }]} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <>
                {/* ── Section: Learn something new ── */}
                {learnItems.length > 0 && (
                  <View style={secStyles.section}>
                    <View style={secStyles.sectionHeader}>
                      <View style={secStyles.sectionIconWrap}>
                        <BookOpen size={16} color="#0ea5e9" strokeWidth={2} />
                      </View>
                      <ThemedText style={secStyles.sectionTitle}>Learn something new</ThemedText>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={secStyles.learnScroll}
                      style={secStyles.learnScrollOuter}
                    >
                      {learnItems.map((item) => {
                        const sourceName = item.metadata?.source_name
                          || (item.metadata?.why_relevant || '').replace('Learn something new • ', '')
                          || '';
                        return (
                          <Pressable
                            key={item.id}
                            style={[
                              secStyles.learnCard,
                              {
                                backgroundColor: colorScheme === 'dark' ? '#111827' : '#f8fafc',
                                borderColor: colorScheme === 'dark' ? '#1f2937' : '#e2e8f0',
                              },
                            ]}
                            onPress={() => handleFeedItemPress(item)}
                          >
                            {sourceName ? (
                              <ThemedText style={[secStyles.learnSource, { color: '#0ea5e9' }]} numberOfLines={1}>
                                {sourceName}
                              </ThemedText>
                            ) : null}
                            <ThemedText style={secStyles.learnTitle} numberOfLines={3}>
                              {item.title}
                            </ThemedText>
                            <ThemedText
                              style={[secStyles.learnSnippet, { color: Colors[colorScheme].muted }]}
                              numberOfLines={2}
                            >
                              {item.summary?.short_article?.subtitle || item.description || ''}
                            </ThemedText>
                            <View style={secStyles.learnFooter}>
                              <ThemedText style={[secStyles.learnReadTime, { color: Colors[colorScheme].muted }]}>
                                {item.summary?.reading_time_minutes || 2} min read
                              </ThemedText>
                              <ChevronRight size={14} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* ── Section: Trending now ── */}
                {trendingItems.length > 0 && (
                  <View style={secStyles.section}>
                    <View style={secStyles.sectionHeader}>
                      <View style={[secStyles.sectionIconWrap, { backgroundColor: '#fff7ed' }]}>
                        <Flame size={16} color="#ea580c" strokeWidth={2} />
                      </View>
                      <ThemedText style={secStyles.sectionTitle}>Trending now</ThemedText>
                    </View>
                    <View style={styles.feedList}>
                      {trendingItems.map((item, index) => (
                        <View key={`t-${item.id}-${index}`}>
                          {index > 0 && (
                            <View style={[styles.separator, { backgroundColor: Colors[colorScheme].border }]} />
                          )}
                          <FeedCard
                            item={item}
                            colorScheme={colorScheme}
                            onPress={() => handleFeedItemPress(item)}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── Section: For you ── */}
                {forYouItems.length > 0 && (
                  <View style={secStyles.section}>
                    <View style={secStyles.sectionHeader}>
                      <View style={[secStyles.sectionIconWrap, { backgroundColor: '#f0fdf4' }]}>
                        <Zap size={16} color="#22c55e" strokeWidth={2} />
                      </View>
                      <ThemedText style={secStyles.sectionTitle}>For you</ThemedText>
                    </View>
                    <View style={styles.feedList}>
                      {forYouItems.map((item, index) => (
                        <View key={`fy-${item.id}-${index}`}>
                          {index > 0 && (
                            <View style={[styles.separator, { backgroundColor: Colors[colorScheme].border }]} />
                          )}
                          <FeedCard
                            item={item}
                            colorScheme={colorScheme}
                            onPress={() => handleFeedItemPress(item)}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Empty state */}
                {learnItems.length === 0 && trendingItems.length === 0 && forYouItems.length === 0 && (
                  <View style={styles.emptyFilterState}>
                    <View
                      style={[
                        styles.emptyFilterIllus,
                        { backgroundColor: ILLUS_PALETTE.lavender[colorScheme] },
                      ]}
                    >
                      <NewspaperIllus width={44} height={44} />
                    </View>
                    <ThemedText style={[styles.emptyText, { color: Colors[colorScheme].muted }]}>
                      No articles in your feed yet. Pull to refresh.
                    </ThemedText>
                  </View>
                )}

                {(learnItems.length > 0 || trendingItems.length > 0 || forYouItems.length > 0) && (
                  <ThemedText style={[styles.endText, { color: Colors[colorScheme].muted }]}>
                    You{"'"}re all caught up
                  </ThemedText>
                )}
              </>
            )}
          </>
        )}
      </AnimatedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  feedSummaryLine: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  nudgeSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },

  loadingContainer: {
    gap: 24,
    paddingTop: 8,
  },
  skeletonItem: {
    paddingVertical: 4,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 14,
  },
  skeletonTextCol: {
    flex: 1,
    gap: 10,
  },
  skeletonMeta: {
    width: 60,
    height: 12,
    borderRadius: 4,
    opacity: 0.4,
  },
  skeletonTitle: {
    width: '90%',
    height: 16,
    borderRadius: 4,
    opacity: 0.4,
  },
  skeletonSub: {
    width: '55%',
    height: 12,
    borderRadius: 4,
    opacity: 0.3,
  },
  skeletonThumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
    opacity: 0.25,
  },

  feedList: {},
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
  },
  emptyFilterState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyFilterIllus: {
    width: 80,
    height: 70,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
  },
  endText: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: Fonts.mono,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingVertical: 32,
  },
});

const secStyles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  learnScrollOuter: {
    marginHorizontal: -20,
  },
  learnScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  learnCard: {
    width: 260,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  learnSource: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  learnTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  learnSnippet: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  learnFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  learnReadTime: {
    fontSize: 12,
    fontWeight: '500',
  },
});

const ctaStyles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    marginTop: 24,
    marginBottom: 8,
    alignItems: 'center',
  },
  bannerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 10,
  },
  bannerBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 999,
    marginBottom: 10,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
  },
  bannerLegal: {
    fontSize: 12,
    textAlign: 'center',
  },
});

const insightStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#22c55e',
    marginBottom: 10,
  },
  insightText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  source: {
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },

  freeReadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  freeReadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },
});

const streakStyles = StyleSheet.create({
  bar: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headline: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
});
