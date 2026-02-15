import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowRight, Sparkles, X } from 'lucide-react-native';

import NewspaperIllus from '@/assets/images/newspaper-svgrepo-com.svg';

import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/components/FeedCard';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { FeedItem, SAMPLE_FEED_ITEMS, getLatestUserFeed, triggerFeedGeneration } from '@/lib/firestore';
import { logReadingEvent } from '@/lib/reading-analytics';
import { ILLUS_PALETTE } from '@/app/(auth)/welcome';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Threshold where the sticky header kicks in
const COLLAPSE_THRESHOLD = 70;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function FeedScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedDate, setFeedDate] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [proBannerDismissed, setProBannerDismissed] = useState(false);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated style for the greeting row - fades and shrinks away
  const greetingStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, COLLAPSE_THRESHOLD * 0.6],
      [1, 0],
      Extrapolation.CLAMP
    );
    const height = interpolate(
      scrollY.value,
      [0, COLLAPSE_THRESHOLD],
      [44, 0],
      Extrapolation.CLAMP
    );
    return { opacity, height, overflow: 'hidden' as const };
  });

  // Animated style for the big heading - shrinks to compact
  const headingStyle = useAnimatedStyle(() => {
    const fontSize = interpolate(
      scrollY.value,
      [0, COLLAPSE_THRESHOLD],
      [30, 20],
      Extrapolation.CLAMP
    );
    const paddingTop = interpolate(
      scrollY.value,
      [0, COLLAPSE_THRESHOLD],
      [18, 4],
      Extrapolation.CLAMP
    );
    const marginBottom = interpolate(
      scrollY.value,
      [0, COLLAPSE_THRESHOLD],
      [12, 4],
      Extrapolation.CLAMP
    );
    return { fontSize, paddingTop, marginBottom };
  });

  // Animated style for the sticky header that appears on scroll
  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [COLLAPSE_THRESHOLD * 0.8, COLLAPSE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [COLLAPSE_THRESHOLD * 0.8, COLLAPSE_THRESHOLD],
      [-10, 0],
      Extrapolation.CLAMP
    );
    return { opacity, transform: [{ translateY }] };
  });

  // Animated style to hide the original header when sticky one is visible
  const originalHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [COLLAPSE_THRESHOLD * 0.6, COLLAPSE_THRESHOLD],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const { isProUser: isSubscribed, presentPaywall } = useRevenueCat();
  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const isOnboarded = profile?.onboarded ?? false;
  const { showToast } = useToast();

  const normalizeInterest = useCallback((interest: string) => {
    return interest
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/&/g, 'and')
      .replace(/[\\/]/g, '-')
      .replace(/[()]/g, '');
  }, []);

  const topicFilters = useMemo(() => {
    const availableTags = new Set(
      feed.flatMap((item) => [
        ...(item.tags || []),
        ...(item.metadata?.feed_category ? [item.metadata.feed_category] : []),
      ])
    );

    const profileTopics = [
      ...(profile?.interests || []),
      ...(profile?.hobbies || []),
    ].filter((i): i is string => typeof i === 'string' && i.trim().length > 0);

    const profileFilters = profileTopics.map((topic) => ({
      id: normalizeInterest(topic),
      label: topic.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }));

    const matched = profileFilters.filter((f) => availableTags.has(f.id));
    if (matched.length > 0) return matched;

    return Array.from(availableTags).map((tag) => ({
      id: tag,
      label: tag.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  }, [feed, profile, normalizeInterest]);

  const filteredFeed = useMemo(() => {
    let items: FeedItem[];
    if (activeFilter === 'all') {
      items = feed;
    } else if (activeFilter === 'curated') {
      items = feed.filter(
        (item) =>
          item.metadata?.why_relevant?.toLowerCase().includes('curated') ||
          item.metadata?.why_relevant?.toLowerCase().includes('for you')
      );
    } else {
      items = feed.filter((item) => {
        const tags = item.tags || [];
        return tags.includes(activeFilter) || item.metadata?.feed_category === activeFilter;
      });
    }

    // For unsubscribed users: promote the first item with a summary to the
    // top and tag it as sample_summary (free preview), matching the web app.
    if (!isSubscribed) {
      const copy = [...items];
      const promoted: FeedItem[] = [];
      for (let i = 0; i < copy.length && promoted.length < 1; i++) {
        if (copy[i].summary?.short_article?.body) {
          promoted.push({
            ...copy[i],
            metadata: { ...(copy[i].metadata || {}), feed_category: 'sample_summary' },
          });
          copy.splice(i, 1);
          i--;
        }
      }
      
      // For free users: randomly select 5 items (including the promoted one)
      const fullList = [...promoted, ...copy];
      const randomItems: FeedItem[] = [];
      const shuffled = [...fullList].sort(() => Math.random() - 0.5);
      
      // Keep the promoted item first if we have one, then add 4 more random items
      if (promoted.length > 0) {
        randomItems.push(promoted[0]);
        const remaining = shuffled.filter(item => item.id !== promoted[0].id);
        randomItems.push(...remaining.slice(0, 4));
      } else {
        randomItems.push(...shuffled.slice(0, 5));
      }
      
      return randomItems;
    }

    return items;
  }, [feed, activeFilter, isSubscribed]);

  // Whether we're showing fallback content while a personalised feed is being generated
  const [isFeedGenerating, setIsFeedGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredSubscribedRefresh = useRef(false);
  const hasShownUpgradeToast = useRef(false); // Don't show upgrade toast on initial load
  // Snapshot of the feed date when we started generating - so we can detect a NEW feed
  const feedDateOnGenStart = useRef<string | null>(null);

  const loadFeed = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      if (isOnboarded) {
        const userFeed = await getLatestUserFeed(user.uid);
        if (userFeed && userFeed.items?.length > 0) {
          setFeed(userFeed.items);
          setFeedDate(userFeed.date);
          return true; // real feed loaded
        } else {
          setFeed(SAMPLE_FEED_ITEMS);
          setFeedDate('');
          return false; // still fallback
        }
      } else {
        setFeed(SAMPLE_FEED_ITEMS);
        setFeedDate('');
        return false;
      }
    } catch (error) {
      console.error('Error loading feed:', error);
      setFeed(SAMPLE_FEED_ITEMS);
      return false;
    }
  }, [user, isOnboarded]);

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
        // If we recorded a snapshot date, only succeed if the feed date changed
        if (feedDateOnGenStart.current && userFeed.date === feedDateOnGenStart.current) {
          // Same feed as before - check if summaries appeared (upgraded tier)
          const hasSummaries = userFeed.items.some((i: FeedItem) => !!i.summary?.short_article?.body);
          if (!hasSummaries) return false; // still the old unsummarised feed
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [user]);

  useEffect(() => {
    const initFeed = async () => {
      setIsLoading(true);
      const hasReal = await loadFeed();
      setIsLoading(false);

      // If onboarded but no personalised feed yet, start polling
      if (isOnboarded && !hasReal) {
        feedDateOnGenStart.current = '';
        setIsFeedGenerating(true);
      }
    };
    initFeed();
  }, [loadFeed, isOnboarded]);

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
      console.log('[Feed] Subscribed user needs upgraded feed, triggering generation...');

      // Small delay so Firestore subscription updates settle before backend reads profile.
      const timer = setTimeout(() => {
        triggerFeedGeneration(user.uid, { reason: 'subscribed_fallback' });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isOnboarded, isSubscribed, user, isLoading, feed, feedDate, showToast]);

  useEffect(() => {
    if (!isSubscribed) {
      if (!isOnboarded) {
        feedDateOnGenStart.current = null;
      } else if (feedDate === '') {
        feedDateOnGenStart.current = '';
      }
    }
  }, [isSubscribed, isOnboarded, feedDate]);

  // ─── Poll for personalised feed every 15s while generating ───
  useEffect(() => {
    if (!isFeedGenerating) return;

    pollRef.current = setInterval(async () => {
      console.log('[Feed] Polling for new personalised feed...');
      const hasNew = await checkForNewFeed();
      if (hasNew) {
        console.log('[Feed] New personalised feed arrived!');
        feedDateOnGenStart.current = null;
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
    const hasSummary = !!item.summary?.short_article?.body;

    logReadingEvent({
      eventType: 'feed_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      tags: item.tags,
      itemType: item.type || item.source,
      feedCategory: item.metadata?.feed_category,
    });

    // Subscribed users: open article if summary exists, else open URL
    // Unsubscribed users: always open article screen (they'll see the paywall)
    if (hasSummary || !isSubscribed) {
      router.push({
        pathname: '/article',
        params: {
          id: item.id,
          title: item.title,
          url: item.url,
          thumbnail: item.thumbnail || '',
          type: item.type || item.source || 'blog',
          subtitle: item.summary?.short_article?.subtitle || '',
          body: item.summary?.short_article?.body || '',
          reading_time: item.summary?.reading_time_minutes?.toString() || '',
          why_relevant: item.metadata?.why_relevant || '',
          is_hot: item.metadata?.is_hot ? 'true' : 'false',
          feed_category: item.metadata?.feed_category || '',
        },
      });
    } else if (item.url) {
      logReadingEvent({
        eventType: 'external_open',
        itemId: item.id,
        title: item.title,
        url: item.url,
        tags: item.tags,
        itemType: item.type || item.source,
        feedCategory: item.metadata?.feed_category,
      });
      WebBrowser.openBrowserAsync(item.url);
    }
  };

  const renderFilterPill = (id: string, label: string) => {
    const isActive = activeFilter === id;
    return (
      <Pressable
        key={id}
        onPress={() => setActiveFilter(id === activeFilter && id !== 'all' ? 'all' : id)}
        style={[
          styles.filterPill,
          isActive
            ? { backgroundColor: Colors[colorScheme].foreground }
            : { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border, borderWidth: 1 },
        ]}>
        <ThemedText
          style={[
            styles.filterPillText,
            { color: isActive ? Colors[colorScheme].background : Colors[colorScheme].text },
          ]}>
          {label}
        </ThemedText>
      </Pressable>
    );
  };

  const filterPillsContent = (
    <>
      {renderFilterPill('all', 'All')}
      {isOnboarded && renderFilterPill('curated', 'For you')}
      {topicFilters.map((filter) => renderFilterPill(filter.id, filter.label))}
    </>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>

      {/* ─── Sticky compact header (appears on scroll) ─── */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { backgroundColor: Colors[colorScheme].background, borderBottomColor: Colors[colorScheme].border },
          stickyHeaderStyle,
        ]}
        pointerEvents="box-none">
        {/* <View style={styles.stickyHeaderRow}>
          <ThemedText style={styles.stickyTitle}>Your feed</ThemedText>
          <Pressable
            onPress={() => router.push('/bookmarks')}
            style={[styles.stickyBookmark, { backgroundColor: Colors[colorScheme].card }]}
            hitSlop={8}>
            <Bookmark size={18} color={Colors[colorScheme].muted} strokeWidth={1.8} />
          </Pressable>
        </View> */}
        {topicFilters.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stickyFiltersRow}>
            {filterPillsContent}
          </ScrollView>
        )}
      </Animated.View>

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

        {/* Greeting row (collapses) */}
        <Animated.View 
          style={[styles.topBar, greetingStyle]}
          pointerEvents="box-none">
          <ThemedText style={[styles.greeting, { color: Colors[colorScheme].muted }]}>
            {getGreeting()}, {firstName}
          </ThemedText>
        </Animated.View>

        {/* Heading + filters (scroll with content, hidden by sticky bar) */}
        <Animated.View style={originalHeaderStyle}>
          <ThemedText style={styles.heading}>Your feed</ThemedText>

          {topicFilters.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              style={styles.filtersScroll}>
              {filterPillsContent}
            </ScrollView>
          )}
        </Animated.View>

        {/* ─── Onboarding nudge ─── */}
        {!isOnboarded && (
          <Pressable
            onPress={() => router.push('/onboarding')}
            style={[
              styles.nudge,
              {
                borderColor: Colors[colorScheme].border,
                backgroundColor: ILLUS_PALETTE.coral[colorScheme],
              },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText style={styles.nudgeTitle}>Make every morning count</ThemedText>
              <ThemedText style={[styles.nudgeSubtitle, { color: Colors[colorScheme].muted }]}>
                2 minutes to set up, smarter mornings forever.
              </ThemedText>
            </View>
            <ArrowRight size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </Pressable>
        )}

        {/* Feed generating - poll in progress */}
        {isFeedGenerating && !isLoading && (
          <View
            style={[
              styles.nudge,
              {
                borderColor: Colors[colorScheme].border,
                backgroundColor: isSubscribed 
                  ? (colorScheme === 'dark' ? '#052e16' : '#f0fdf4')
                  : ILLUS_PALETTE.gold[colorScheme],
              },
            ]}>
            <ActivityIndicator size="small" color={isSubscribed ? '#22c55e' : Colors[colorScheme].muted} />
            <ThemedText
              style={[styles.nudgeSubtitle, { color: Colors[colorScheme].muted, flex: 1 }]}>
              {isSubscribed 
                ? 'Adding AI summaries to your feed - this takes a minute or two. Your current feed is below.'
                : "Building your personalised feed - this can take a minute or two. Here's what's trending meanwhile."
              }
            </ThemedText>
          </View>
        )}

        {/* ─── Pro upgrade banner for free users ─── */}
        {isOnboarded && !isSubscribed && !proBannerDismissed && !isLoading && (
          <View
            style={[
              styles.proBanner,
              {
                backgroundColor: colorScheme === 'dark' ? '#1a1625' : '#F5F3FF',
                borderColor: colorScheme === 'dark' ? '#2d2640' : '#E9E5F5',
              },
            ]}>
            <Pressable
              onPress={() => setProBannerDismissed(true)}
              hitSlop={10}
              style={styles.proBannerClose}>
              <X size={14} color={Colors[colorScheme].muted} strokeWidth={2} />
            </Pressable>
            <View style={styles.proBannerContent}>
              <View style={[styles.proBannerIconWrap, { backgroundColor: colorScheme === 'dark' ? '#2d2640' : '#EDE9FE' }]}>
                <Sparkles size={18} color="#7c3aed" strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <ThemedText style={styles.proBannerTitle}>
                  Unlock notes & lessons from your feed
                </ThemedText>
                <ThemedText style={[styles.proBannerSub, { color: Colors[colorScheme].muted }]}>
                  Get AI summaries, key takeaways, and actionable notes for every article.
                </ThemedText>
              </View>
            </View>
            <Pressable
              onPress={() => presentPaywall()}
              style={[styles.proBannerButton, { backgroundColor: '#7c3aed' }]}>
              <ThemedText style={styles.proBannerButtonText}>
                See plans
              </ThemedText>
              <ArrowRight size={14} color="#fff" strokeWidth={2} />
            </Pressable>
          </View>
        )}

        {/* Loading */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonItem}>
                <View style={styles.skeletonRow}>
                  <View style={styles.skeletonTextCol}>
                    <View
                      style={[styles.skeletonMeta, { backgroundColor: Colors[colorScheme].border }]}
                    />
                    <View
                      style={[styles.skeletonTitle, { backgroundColor: Colors[colorScheme].border }]}
                    />
                    <View
                      style={[styles.skeletonSub, { backgroundColor: Colors[colorScheme].border }]}
                    />
                  </View>
                  <View
                    style={[styles.skeletonThumb, { backgroundColor: Colors[colorScheme].border }]}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          /* Feed items */
          <View style={styles.feedList}>
            {filteredFeed.map((item, index) => (
              <View key={`${item.id}-${item.url || 'no-url'}-${index}`}>
                {index > 0 && (
                  <View
                    style={[styles.separator, { backgroundColor: Colors[colorScheme].border }]}
                  />
                )}
                <FeedCard
                  item={item}
                  colorScheme={colorScheme}
                  onPress={() => handleFeedItemPress(item)}
                />
              </View>
            ))}
            
            {/* Free user callout: Limited feed preview */}
            {!isSubscribed && filteredFeed.length > 0 && (
              <View style={styles.limitedFeedCallout}>
                <ThemedText style={[styles.limitedFeedText, { color: Colors[colorScheme].muted }]}>
                  Upgrade to Pro for your full personalized feed
                </ThemedText>
                <Pressable
                  onPress={() => presentPaywall()}
                  style={[styles.limitedFeedButton, { backgroundColor: '#22c55e' }]}
                >
                  <ThemedText style={styles.limitedFeedButtonText}>
                    See plans
                  </ThemedText>
                </Pressable>
              </View>
            )}
            
            {filteredFeed.length === 0 && !isLoading && (
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
                  No items match this filter.
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {/* End */}
        {!isLoading && filteredFeed.length > 0 && isSubscribed && (
          <ThemedText style={[styles.endText, { color: Colors[colorScheme].muted }]}>
            You{"'"}re all caught up
          </ThemedText>
        )}
      </AnimatedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // ─── Sticky compact header (overlay) ───
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 68, // safe area offset - adjust if needed
  },
  stickyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  stickyTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  stickyBookmark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },

  // ─── Original top bar (greeting) ───
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingTop: 8,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '500',
  },
  bookmarkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Content ───
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 12,
    paddingTop: 18,
  },

  // ─── Filters ───
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: -20, // bleed to edges
    marginBottom: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // ─── Nudges ───
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
  nudgeTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  nudgeSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },

  // ─── Loading ───
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

  // ─── Feed list ───
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
  
  // ─── Limited feed callout (free users) ───
  limitedFeedCallout: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
    gap: 16,
  },
  limitedFeedText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  limitedFeedButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  limitedFeedButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  
  endText: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: Fonts.mono,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingVertical: 32,
  },

  // ─── Pro upgrade banner ───
  proBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  proBannerClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    padding: 4,
  },
  proBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 20,
  },
  proBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  proBannerSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  proBannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  proBannerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
