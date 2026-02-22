import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
  ScrollView,
  Text,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Flame, Zap, Sparkles, BookOpen, Cpu, User, Crosshair, GraduationCap } from 'lucide-react-native';

import DigestIllus from '@/components/illustrations/DigestIllus';

import { ThemedText } from '@/components/themed-text';
import { TrendingCard, ForYouCard, DeepDiveCard } from '@/components/FeedCard';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  FeedItem,
  V3UserFeed,
  getV3UserFeed,
} from '@/lib/firestore';
import { logReadingEvent } from '@/lib/reading-analytics';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type FeedTab = 'trending' | 'for_you' | 'deep_dives';

const TAB_CONFIG: { key: FeedTab; label: string; Icon: typeof Flame }[] = [
  { key: 'trending', label: 'Trending', Icon: Flame },
  { key: 'for_you', label: 'For You', Icon: Crosshair },
  { key: 'deep_dives', label: 'Deep Dives', Icon: GraduationCap },
];

export default function FeedScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const [activeTab, setActiveTab] = useState<FeedTab>('trending');
  const [v3Feed, setV3Feed] = useState<V3UserFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const { isProUser: isSubscribed, loading: rcLoading } = useRevenueCat();
  const isOnboarded = profile?.onboarded ?? false;

  const FREE_LIMITS = { trending: 5, for_you: 2, deep_dives: 1 };

  // ─── Feed items for current tab ───
  const currentItems: FeedItem[] = (() => {
    if (!v3Feed) return [];
    const all =
      activeTab === 'trending' ? v3Feed.trending :
      activeTab === 'for_you' ? v3Feed.for_you :
      activeTab === 'deep_dives' ? v3Feed.deep_dives : [];
    if (isSubscribed) return all;
    const limit = FREE_LIMITS[activeTab] ?? 2;
    return all.slice(0, limit);
  })();

  const isTabLimited = !isSubscribed && activeTab !== 'trending' && v3Feed != null;

  // ─── Load v3 feed for ALL users (free + pro) ───
  const loadFeed = useCallback(async (): Promise<boolean> => {
    if (!user || !isOnboarded) return false;
    try {
      const v3 = await getV3UserFeed(user.uid);
      if (v3) {
        setV3Feed(v3);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading feed:', error);
      return false;
    }
  }, [user, isOnboarded]);

  const isFeedBuilding = (() => {
    if (profile?.feedBuildStatus !== 'building') return false;
    const requestedAt = profile?.feedBuildRequestedAt;
    if (!requestedAt) return false;
    const ts = typeof requestedAt === 'string' ? new Date(requestedAt).getTime()
      : requestedAt?.toDate ? requestedAt.toDate().getTime()
      : requestedAt?.seconds ? requestedAt.seconds * 1000
      : 0;
    if (!ts) return false;
    return Date.now() - ts < 5 * 60 * 1000;
  })();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial feed load
  useEffect(() => {
    if (!isOnboarded) {
      setIsLoading(false);
      return;
    }
    const init = async () => {
      setIsLoading(true);
      await loadFeed();
      setIsLoading(false);
    };
    init();
  }, [loadFeed, isOnboarded]);

  // Poll for feed when build is in progress
  useEffect(() => {
    if (!isFeedBuilding || !user) return;

    pollRef.current = setInterval(async () => {
      await refreshProfile();
      const found = await loadFeed();
      if (found) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 15_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isFeedBuilding, user, isSubscribed, loadFeed, refreshProfile]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFeed();
    setIsRefreshing(false);
  }, [loadFeed]);

  const handleFeedItemPress = (item: FeedItem) => {
    logReadingEvent({
      eventType: 'feed_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      tags: item.tags,
      itemType: item.type || item.source,
      feedCategory: item.metadata?.feed_category || item.feed_type,
    });


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
        feed_category: item.metadata?.feed_category || item.feed_type || '',
        key_takeaways: JSON.stringify(item.summary?.short_article?.key_takeaways || []),
        why_it_matters: item.summary?.short_article?.why_it_matters || '',
      },
    });
  };

  if (!isOnboarded) return null;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>

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

        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.headerTitle}>
              {profile?.name ? `Welcome, ${profile.name.split(' ')[0]}` : 'Welcome'}
            </ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: Colors[colorScheme].muted }]}>
              {getGreeting()}
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/(tabs)/explore')}
              style={[styles.profileBtn, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
              <User size={16} color={Colors[colorScheme].muted} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* ─── Tab bar (all users) ─── */}
        <View style={styles.tabBar}>
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.key;
            const tabColor = isActive ? Colors[colorScheme].foreground : Colors[colorScheme].muted;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  isActive && {
                    borderBottomColor: '#F59E0B',
                    borderBottomWidth: 2,
                  },
                ]}>
                <View style={styles.tabInner}>
                  <tab.Icon size={14} color={tabColor} strokeWidth={isActive ? 2.5 : 1.8} />
                  <ThemedText
                    style={[
                      styles.tabLabel,
                      { color: tabColor },
                      isActive && { fontWeight: '700' },
                    ]}>
                    {tab.label}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Feed content ─── */}
        {isLoading || rcLoading ? (
          <SkeletonLoader colorScheme={colorScheme} />
        ) : (isFeedBuilding && currentItems.length === 0) ? (
          <FeedBuildingLoader colorScheme={colorScheme} />
        ) : currentItems.length > 0 ? (
          <>
            {isFeedBuilding && (
              <View style={[styles.upgradingBanner, { backgroundColor: '#F59E0B12' }]}>
                <ActivityIndicator size="small" color="#F59E0B" />
                <ThemedText style={[styles.upgradingText, { color: Colors[colorScheme].muted }]}>
                  Your full feed is building — pull to refresh in a minute
                </ThemedText>
              </View>
            )}
            <ThemedText style={[styles.sectionHeader, { color: Colors[colorScheme].muted }]}>
              {activeTab === 'trending'
                ? `${currentItems.length} stories buzzing right now`
                : activeTab === 'for_you'
                  ? 'Based on your interests'
                  : 'From your trusted sources'}
            </ThemedText>

            <View style={styles.feedList}>
              {currentItems.map((item, index) => {
                if (activeTab === 'trending') {
                  return (
                    <View key={`t-${item.id}-${index}`}>
                      {index > 0 && (
                        <View style={[styles.separator, { backgroundColor: Colors[colorScheme].border }]} />
                      )}
                      <TrendingCard
                        item={item}
                        colorScheme={colorScheme}
                        onPress={() => handleFeedItemPress(item)}
                      />
                    </View>
                  );
                }
                if (activeTab === 'for_you') {
                  return (
                    <View key={`fy-${item.id}-${index}`}>
                      {index > 0 && (
                        <View style={[styles.separator, { backgroundColor: Colors[colorScheme].border }]} />
                      )}
                      <ForYouCard
                        item={item}
                        colorScheme={colorScheme}
                        onPress={() => handleFeedItemPress(item)}
                      />
                    </View>
                  );
                }
                return (
                  <DeepDiveCard
                    key={`dd-${item.id}-${index}`}
                    item={item}
                    colorScheme={colorScheme}
                    onPress={() => handleFeedItemPress(item)}
                  />
                );
              })}
            </View>

            {/* Upgrade CTA for free users on limited tabs */}
            {isTabLimited && (
              <View style={[
                ctaStyles.banner,
                {
                  backgroundColor: colorScheme === 'dark' ? '#1a1408' : '#fffbeb',
                  borderColor: colorScheme === 'dark' ? '#92400e' : '#fde68a',
                },
              ]}>
                <Text style={[ctaStyles.bannerTitle, { color: Colors[colorScheme].text }]}>
                  {activeTab === 'for_you'
                    ? 'Unlock all personalized stories'
                    : 'Unlock all deep dives'}
                </Text>
                <Text style={[ctaStyles.bannerBody, { color: Colors[colorScheme].muted }]}>
                  {activeTab === 'for_you'
                    ? 'You\'re seeing a preview. Go Pro for unlimited articles matched to your interests.'
                    : 'You get 1 free deep dive. Go Pro for unlimited expert reads from your trusted sources.'}
                </Text>
                <Pressable
                  onPress={() => router.push('/paywall')}
                  style={[ctaStyles.ctaButton, { backgroundColor: '#F59E0B' }]}
                >
                  <Zap size={16} color="#fff" />
                  <Text style={[ctaStyles.ctaText, { color: '#fff' }]}>
                    Start Free Trial
                  </Text>
                </Pressable>
                <Text style={[ctaStyles.bannerLegal, { color: Colors[colorScheme].muted }]}>
                  4-day free trial · Cancel anytime
                </Text>
              </View>
            )}

            {isSubscribed && (
              <ThemedText style={[styles.endText, { color: Colors[colorScheme].muted }]}>
                You{"'"}re all caught up
              </ThemedText>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <View
              style={[styles.emptyIllus, { backgroundColor: colorScheme === 'dark' ? '#1a1a2e' : '#f5f3ff' }]}
            >
              <DigestIllus width={44} height={44} color={Colors[colorScheme].text} />
            </View>
            <ThemedText style={[styles.emptyText, { color: Colors[colorScheme].muted }]}>
              {activeTab === 'for_you'
                ? 'No articles for you yet. Pull to refresh.'
                : activeTab === 'deep_dives'
                  ? 'No deep dives yet. Your sources are being indexed.'
                  : 'No trending stories right now. Pull to refresh.'}
            </ThemedText>
          </View>
        )}
      </AnimatedScrollView>
    </SafeAreaView>
  );
}

const BUILD_STEPS = [
  { icon: 'sparkles', text: 'Analyzing your interests...' },
  { icon: 'cpu', text: 'Finding the best sources...' },
  { icon: 'book-open', text: 'Generating your summaries...' },
];

function PulsingDot({ delay, colorScheme }: { delay: number; colorScheme: 'light' | 'dark' }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const bg = colorScheme === 'dark' ? '#F59E0B' : '#F59E0B';

  return (
    <Animated.View
      style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: bg }, animStyle]}
    />
  );
}

function FeedBuildingLoader({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => (prev + 1) % BUILD_STEPS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const step = BUILD_STEPS[stepIdx];
  const iconColor = colorScheme === 'dark' ? '#F59E0B' : '#D97706';
  const cardBg = colorScheme === 'dark' ? '#1a1a2e' : '#fffbeb';

  const StepIcon = step.icon === 'sparkles' ? Sparkles : step.icon === 'cpu' ? Cpu : BookOpen;

  return (
    <Animated.View entering={FadeIn.duration(500)} style={buildStyles.container}>
      <View style={[buildStyles.card, { backgroundColor: cardBg }]}>
        <View style={buildStyles.iconRow}>
          <StepIcon size={28} color={iconColor} strokeWidth={1.5} />
        </View>

        <Text style={[buildStyles.title, { color: Colors[colorScheme].text }]}>
          Building your feed
        </Text>

        <Text style={[buildStyles.subtitle, { color: Colors[colorScheme].muted }]}>
          {step.text}
        </Text>

        <View style={buildStyles.dots}>
          <PulsingDot delay={0} colorScheme={colorScheme} />
          <PulsingDot delay={200} colorScheme={colorScheme} />
          <PulsingDot delay={400} colorScheme={colorScheme} />
        </View>

        <Text style={[buildStyles.hint, { color: Colors[colorScheme].muted }]}>
          This usually takes 2-3 minutes. We{"'"}ll have{'\n'}your personalized feed ready soon.
        </Text>
      </View>
    </Animated.View>
  );
}

function SkeletonLoader({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  return (
    <View style={styles.skeletonContainer}>
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
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  profileBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 4,
    gap: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Section header
  sectionHeader: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 4,
  },
  upgradingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  upgradingText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Feed
  feedList: { marginTop: 4 },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyIllus: {
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
    paddingHorizontal: 20,
  },
  endText: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: Fonts.mono,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingVertical: 32,
  },

  // Skeleton
  skeletonContainer: { gap: 24, paddingTop: 12 },
  skeletonItem: { paddingVertical: 4 },
  skeletonRow: { flexDirection: 'row', gap: 14 },
  skeletonTextCol: { flex: 1, gap: 10 },
  skeletonMeta: { width: 60, height: 12, borderRadius: 4, opacity: 0.4 },
  skeletonTitle: { width: '90%', height: 16, borderRadius: 4, opacity: 0.4 },
  skeletonSub: { width: '55%', height: 12, borderRadius: 4, opacity: 0.3 },
  skeletonThumb: { width: 88, height: 88, borderRadius: 12, opacity: 0.25 },
});

const buildStyles = StyleSheet.create({
  container: {
    paddingTop: 48,
    paddingBottom: 24,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
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
