import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
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
import { Bookmark, ArrowRight } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/components/FeedCard';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { FeedItem, SAMPLE_FEED_ITEMS, getLatestUserFeed } from '@/lib/firestore';

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

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated style for the greeting row — fades & shrinks away
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

  // Animated style for the big heading — shrinks to compact
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

  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const isOnboarded = profile?.onboarded ?? false;

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
    if (activeFilter === 'all') return feed;
    if (activeFilter === 'curated') {
      return feed.filter(
        (item) =>
          item.metadata?.why_relevant?.toLowerCase().includes('curated') ||
          item.metadata?.why_relevant?.toLowerCase().includes('for you')
      );
    }
    return feed.filter((item) => {
      const tags = item.tags || [];
      return tags.includes(activeFilter) || item.metadata?.feed_category === activeFilter;
    });
  }, [feed, activeFilter]);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    try {
      if (isOnboarded) {
        const userFeed = await getLatestUserFeed(user.uid);
        if (userFeed && userFeed.items?.length > 0) {
          setFeed(userFeed.items);
          setFeedDate(userFeed.date);
        } else {
          setFeed(SAMPLE_FEED_ITEMS);
          setFeedDate('');
        }
      } else {
        setFeed(SAMPLE_FEED_ITEMS);
        setFeedDate('');
      }
    } catch (error) {
      console.error('Error loading feed:', error);
      setFeed(SAMPLE_FEED_ITEMS);
    }
  }, [user, isOnboarded]);

  useEffect(() => {
    const initFeed = async () => {
      setIsLoading(true);
      await loadFeed();
      setIsLoading(false);
    };
    initFeed();
  }, [loadFeed]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadFeed();
    setIsRefreshing(false);
  };

  const handleFeedItemPress = (item: FeedItem) => {
    const hasSummary = !!item.summary?.short_article?.body;
    const subStatus = profile?.subscriptionStatus || 'none';
    const isSubscribed = subStatus === 'active' || subStatus === 'trial';

    // Subscribed users: open article if summary exists, else open URL
    // Unsubscribed users: always open article screen (they'll see the paywall)
    if (hasSummary || !isSubscribed) {
      router.push({
        pathname: '/article',
        params: {
          id: item.id,
          title: item.title,
          url: item.url,
          type: item.type || item.source || 'blog',
          subtitle: item.summary?.short_article?.subtitle || '',
          body: item.summary?.short_article?.body || '',
          reading_time: item.summary?.reading_time_minutes?.toString() || '',
          why_relevant: item.metadata?.why_relevant || '',
          is_hot: item.metadata?.is_hot ? 'true' : 'false',
        },
      });
    } else if (item.url) {
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
        <View style={styles.stickyHeaderRow}>
          <ThemedText style={styles.stickyTitle}>Your feed</ThemedText>
          <Pressable
            onPress={() => router.push('/bookmarks')}
            style={[styles.stickyBookmark, { backgroundColor: Colors[colorScheme].card }]}
            hitSlop={8}>
            <Bookmark size={18} color={Colors[colorScheme].muted} strokeWidth={1.8} />
          </Pressable>
        </View>
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
        <Animated.View style={[styles.topBar, greetingStyle]}>
          <ThemedText style={[styles.greeting, { color: Colors[colorScheme].muted }]}>
            {getGreeting()}, {firstName}
          </ThemedText>
          <Pressable
            onPress={() => router.push('/bookmarks')}
            style={[styles.bookmarkButton, { backgroundColor: Colors[colorScheme].card }]}
            hitSlop={8}>
            <Bookmark size={20} color={Colors[colorScheme].muted} strokeWidth={1.8} />
          </Pressable>
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
            style={[styles.nudge, { borderColor: Colors[colorScheme].border }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText style={styles.nudgeTitle}>Personalize your feed</ThemedText>
              <ThemedText style={[styles.nudgeSubtitle, { color: Colors[colorScheme].muted }]}>
                Tell us what you like and we{"'"}ll curate it for you.
              </ThemedText>
            </View>
            <ArrowRight size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </Pressable>
        )}

        {/* Feed generating */}
        {isOnboarded && feed === SAMPLE_FEED_ITEMS && !isLoading && (
          <View style={[styles.nudge, { borderColor: Colors[colorScheme].border }]}>
            <ActivityIndicator size="small" color={Colors[colorScheme].muted} />
            <ThemedText
              style={[styles.nudgeSubtitle, { color: Colors[colorScheme].muted, flex: 1 }]}>
              Building your feed... showing popular content in the meantime.
            </ThemedText>
          </View>
        )}

        {/* Loading */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonItem}>
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
            ))}
          </View>
        ) : (
          /* Feed items */
          <View style={styles.feedList}>
            {filteredFeed.map((item, index) => (
              <View key={item.id}>
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
            {filteredFeed.length === 0 && !isLoading && (
              <ThemedText style={[styles.emptyText, { color: Colors[colorScheme].muted }]}>
                No items match this filter.
              </ThemedText>
            )}
          </View>
        )}

        {/* End */}
        {!isLoading && filteredFeed.length > 0 && (
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
    paddingTop: 54, // safe area offset — adjust if needed
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
    gap: 8,
  },
  skeletonMeta: {
    width: 60,
    height: 12,
    borderRadius: 4,
    opacity: 0.4,
  },
  skeletonTitle: {
    width: '85%',
    height: 18,
    borderRadius: 4,
    opacity: 0.4,
  },
  skeletonSub: {
    width: '55%',
    height: 12,
    borderRadius: 4,
    opacity: 0.3,
  },

  // ─── Feed list ───
  feedList: {},
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    paddingVertical: 40,
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
