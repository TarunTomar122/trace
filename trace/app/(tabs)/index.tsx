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
import { BlurView } from 'expo-blur';
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
import { Moon, Sun, Lock, Zap, CheckCircle2, Bell } from 'lucide-react-native';

import NewspaperIllus from '@/assets/images/newspaper-svgrepo-com.svg';

import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/components/FeedCard';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { FeedItem, UserFeed, getLatestUserFeed, triggerFeedGeneration } from '@/lib/firestore';
import { logReadingEvent } from '@/lib/reading-analytics';
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
  const { toggleTheme } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedDate, setFeedDate] = useState<string>('');
  const [feedVersion, setFeedVersion] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

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

  const { isProUser: isSubscribed, loading: rcLoading } = useRevenueCat();
  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const isOnboarded = profile?.onboarded ?? false;
  const { showToast } = useToast();

  // Redirect to onboarding if not onboarded
  useEffect(() => {
    if (rcLoading) return;
    if (!isOnboarded) {
      router.replace('/onboarding');
    }
  }, [isOnboarded, rcLoading, router]);

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

    return items;
  }, [feed, activeFilter]);

  // Whether we're showing fallback content while a personalised feed is being generated
  const [isFeedGenerating, setIsFeedGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredSubscribedRefresh = useRef(false);
  const hasShownUpgradeToast = useRef(false); // Don't show upgrade toast on initial load
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
    if (hasSummary) {
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

  if (!isOnboarded) {
    return null;
  }

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


        {/* Inline paywall for unsubscribed users */}
        {!isSubscribed && !rcLoading && (
          <View style={paywallStyles.container}>
            {/* Blurred fake feed items */}
            <View style={paywallStyles.blurredFeed}>
              {[
                'How AI Is Reshaping Development',
                'The State of Cloud in 2026',
                'Building Reliable Systems at Scale',
                'Why Engineers Are Betting on Rust',
                'Modern Authentication Patterns',
              ].map((title, i) => (
                <View key={i} style={[paywallStyles.fakeCard, { borderBottomColor: Colors[colorScheme].border }]}>
                  <View style={paywallStyles.fakeCardRow}>
                    <View style={paywallStyles.fakeTextCol}>
                      <View style={[paywallStyles.fakeBadge, { backgroundColor: Colors[colorScheme].border }]} />
                      <Text style={[paywallStyles.fakeTitle, { color: Colors[colorScheme].text }]} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={[paywallStyles.fakeMeta, { backgroundColor: Colors[colorScheme].border }]} />
                    </View>
                    <View style={[paywallStyles.fakeThumb, { backgroundColor: Colors[colorScheme].border }]} />
                  </View>
                </View>
              ))}
            </View>

            {/* Blur overlay */}
            <BlurView
              intensity={25}
              tint={colorScheme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />

            {/* Paywall content */}
            <View style={[StyleSheet.absoluteFill, paywallStyles.overlay]}>
              <View style={[paywallStyles.card, { backgroundColor: colorScheme === 'dark' ? '#1a1a24' : '#ffffff' }]}>
                <View style={[paywallStyles.iconCircle, { backgroundColor: colorScheme === 'dark' ? '#052e16' : '#ecfdf5' }]}>
                  <Lock size={24} color={colorScheme === 'dark' ? '#6ee7b7' : '#059669'} />
                </View>

                <Text style={[paywallStyles.cardTitle, { color: Colors[colorScheme].text }]}>
                  Your feed is ready
                </Text>
                <Text style={[paywallStyles.cardSubtitle, { color: Colors[colorScheme].muted }]}>
                  Start a free trial to unlock your personalized feed and AI summaries.
                </Text>

                {/* Timeline */}
                <View style={paywallStyles.timeline}>
                  <View style={paywallStyles.timelineStep}>
                    <View style={[paywallStyles.stepDot, { backgroundColor: colorScheme === 'dark' ? '#6ee7b7' : '#059669' }]}>
                      <Lock size={12} color="#fff" />
                    </View>
                    <View style={paywallStyles.stepText}>
                      <Text style={[paywallStyles.stepTitle, { color: Colors[colorScheme].text }]}>Today</Text>
                      <Text style={[paywallStyles.stepDesc, { color: Colors[colorScheme].muted }]}>Full access to your feed & AI summaries.</Text>
                    </View>
                  </View>
                  <View style={paywallStyles.timelineStep}>
                    <View style={[paywallStyles.stepDot, { backgroundColor: colorScheme === 'dark' ? 'rgba(110,231,183,0.6)' : 'rgba(5,150,105,0.6)' }]}>
                      <Bell size={12} color="#fff" />
                    </View>
                    <View style={paywallStyles.stepText}>
                      <Text style={[paywallStyles.stepTitle, { color: Colors[colorScheme].text }]}>Before trial ends</Text>
                      <Text style={[paywallStyles.stepDesc, { color: Colors[colorScheme].muted }]}>We{"'"}ll remind you.</Text>
                    </View>
                  </View>
                  <View style={paywallStyles.timelineStep}>
                    <View style={[paywallStyles.stepDot, { backgroundColor: colorScheme === 'dark' ? 'rgba(110,231,183,0.3)' : 'rgba(5,150,105,0.3)' }]}>
                      <CheckCircle2 size={12} color="#fff" />
                    </View>
                    <View style={paywallStyles.stepText}>
                      <Text style={[paywallStyles.stepTitle, { color: Colors[colorScheme].text }]}>After trial</Text>
                      <Text style={[paywallStyles.stepDesc, { color: Colors[colorScheme].muted }]}>Cancel anytime before — no charge.</Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={() => router.push('/paywall')}
                  style={[paywallStyles.ctaButton, { backgroundColor: colorScheme === 'dark' ? '#6ee7b7' : '#059669' }]}
                >
                  <Zap size={16} color={colorScheme === 'dark' ? '#052e20' : '#ffffff'} />
                  <Text style={[paywallStyles.ctaText, { color: colorScheme === 'dark' ? '#052e20' : '#ffffff' }]}>
                    Start Free Trial
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Feed generating - poll in progress */}
        {isSubscribed && isFeedGenerating && !isLoading && (
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


        {/* Loading / Feed items — only for subscribed users */}
        {isSubscribed && (
          <>
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

            {!isLoading && filteredFeed.length > 0 && (
              <ThemedText style={[styles.endText, { color: Colors[colorScheme].muted }]}>
                You{"'"}re all caught up
              </ThemedText>
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
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  endText: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: Fonts.mono,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingVertical: 32,
  },
});

const paywallStyles = StyleSheet.create({
  container: {
    position: 'relative',
    minHeight: 520,
    overflow: 'hidden',
    borderRadius: 16,
    marginTop: 4,
  },
  blurredFeed: {
    opacity: 0.6,
  },
  fakeCard: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fakeCardRow: {
    flexDirection: 'row',
    gap: 14,
  },
  fakeTextCol: {
    flex: 1,
    gap: 8,
  },
  fakeBadge: {
    width: 50,
    height: 10,
    borderRadius: 4,
    opacity: 0.5,
  },
  fakeTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  fakeMeta: {
    width: 80,
    height: 10,
    borderRadius: 4,
    opacity: 0.3,
  },
  fakeThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    opacity: 0.4,
  },
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  timeline: {
    width: '100%',
    gap: 14,
    marginBottom: 24,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
