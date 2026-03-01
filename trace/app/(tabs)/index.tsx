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
import { MilestoneCelebration } from '@/components/MilestoneCelebration';
import { EarlyAdopterBanner } from '@/components/EarlyAdopterBanner';

import { ThemedText } from '@/components/themed-text';
import { TrendingCard, ForYouCard, DeepDiveCard } from '@/components/FeedCard';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  FeedItem,
  V3UserFeed,
  getV3UserFeed,
  recordLastActive,
} from '@/lib/firestore';
import { logReadingEvent, getReadingAnalytics } from '@/lib/reading-analytics';
import { setCurrentArticle } from '@/lib/article-store';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { updateStreak, getStreakStatus } from '@/lib/streaks';
import { initializeNotifications, onArticleRead } from '@/lib/notifications';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type FeedTab = 'trending' | 'for_you' | 'deep_dives';

const TAB_CONFIG: { key: FeedTab; label: string; Icon: typeof Flame; color: string }[] = [
  { key: 'trending', label: 'Trending', Icon: Flame, color: '#F97316' },
  { key: 'for_you', label: 'For You', Icon: Crosshair, color: '#F59E0B' },
  { key: 'deep_dives', label: 'Deep Dives', Icon: GraduationCap, color: '#0EA5E9' },
];

function getActiveTabColor(tab: FeedTab): string {
  return TAB_CONFIG.find((t) => t.key === tab)?.color ?? '#F59E0B';
}

export default function FeedScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const [activeTab, setActiveTab] = useState<FeedTab>('for_you');
  const [v3Feed, setV3Feed] = useState<V3UserFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [todayReads, setTodayReads] = useState(0);
  const [milestoneToShow, setMilestoneToShow] = useState<number | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);

  // Load today's reading count & init notifications
  useEffect(() => {
    getReadingAnalytics(1).then((stats) => {
      setTodayReads(stats.totalInteractions);
    });
    // Check streak on mount
    updateStreak().then(({ newMilestone, data }) => {
      if (newMilestone) {
        setMilestoneToShow(newMilestone);
      }
      setCurrentStreak(data.currentStreak);
    });
    // Also get latest streak status
    getStreakStatus().then((status) => {
      setCurrentStreak(status.currentStreak);
    });
    // Initialize push notifications
    initializeNotifications().catch(() => {});
  }, []);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const { isProUser: isSubscribed, isEarlyAdopter, loading: rcLoading } = useRevenueCat();
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

  // Initial feed load + record activity
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
    if (user?.uid) recordLastActive(user.uid);
  }, [loadFeed, isOnboarded, user?.uid]);

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

  const handleFeedItemPress = async (item: FeedItem) => {
    logReadingEvent({
      eventType: 'feed_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      tags: item.tags,
      itemType: item.type || item.source,
      feedCategory: item.metadata?.feed_category || item.feed_type,
    });

    // Update streak and check for milestone
    const { newMilestone, data } = await updateStreak();
    if (newMilestone) {
      setMilestoneToShow(newMilestone);
    }
    setCurrentStreak(data.currentStreak);
    setTodayReads((r) => r + 1);

    // Cancel today's reminder notification
    onArticleRead().catch(() => {});

    setCurrentArticle(item);
    router.push('/article');
  };

  if (!isOnboarded) return null;

  return (
    <>
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
            <ThemedText
              style={styles.headerTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}>
              {profile?.name ? `Hey, ${profile.name.split(' ')[0]}` : 'Hey there'}
            </ThemedText>
            <View style={styles.headerMetaRow}>
              <ThemedText style={[styles.headerSubtitle, { color: Colors[colorScheme].muted }]}>
                {getGreeting()}
              </ThemedText>
              {todayReads > 0 && (
                <View style={[styles.readsBadge, { backgroundColor: getActiveTabColor(activeTab) + '18' }]}>
                  <BookOpen size={12} color={getActiveTabColor(activeTab)} strokeWidth={2} />
                  <Text style={[styles.readsBadgeText, { color: getActiveTabColor(activeTab) }]}>
                    {todayReads} read today
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/preferences')}
            style={[styles.profileBtn, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <User size={18} color={Colors[colorScheme].foreground} strokeWidth={2} />
            {currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Flame size={10} color="#fff" fill="#fff" strokeWidth={2} />
                <Text style={styles.streakBadgeText}>{currentStreak}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ─── Early Adopter Banner ─── */}
        <EarlyAdopterBanner
          colorScheme={colorScheme}
          isEarlyAdopter={isEarlyAdopter}
          isSubscribed={isSubscribed}
          onPress={() => router.push('/paywall')}
        />

        {/* ─── Tab bar (all users) ─── */}
        <View style={styles.tabBar}>
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.key;
            const tabColor = isActive ? tab.color : Colors[colorScheme].muted;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  isActive && {
                    backgroundColor: tab.color + '15',
                    borderColor: tab.color + '30',
                  },
                ]}>
                <View style={styles.tabInner}>
                  <tab.Icon size={15} color={tabColor} strokeWidth={isActive ? 2.5 : 1.8} />
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
              <View style={[styles.upgradingBanner, { backgroundColor: getActiveTabColor(activeTab) + '12' }]}>
                <ActivityIndicator size="small" color={getActiveTabColor(activeTab)} />
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
                const accentColor = getActiveTabColor(activeTab);
                const showDivider = index < currentItems.length - 1;

                if (activeTab === 'trending') {
                  return (
                    <View key={`t-${item.id}-${index}`}>
                      <TrendingCard
                        item={item}
                        colorScheme={colorScheme}
                        accentColor={accentColor}
                      />
                      {showDivider && <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />}
                    </View>
                  );
                }
                if (activeTab === 'for_you') {
                  return (
                    <View key={`fy-${item.id}-${index}`}>
                      <ForYouCard
                        item={item}
                        colorScheme={colorScheme}
                        onPress={() => handleFeedItemPress(item)}
                        accentColor={accentColor}
                      />
                      {showDivider && <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />}
                    </View>
                  );
                }
                return (
                  <View key={`dd-${item.id}-${index}`}>
                    <DeepDiveCard
                      item={item}
                      colorScheme={colorScheme}
                      onPress={() => handleFeedItemPress(item)}
                      accentColor={accentColor}
                    />
                    {showDivider && <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />}
                  </View>
                );
              })}
            </View>

            {/* Upgrade CTA for free users on limited tabs */}
            {isTabLimited && (
              <View style={[
                ctaStyles.banner,
                {
                  backgroundColor: getActiveTabColor(activeTab) + '10',
                  borderColor: getActiveTabColor(activeTab) + '30',
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
                  style={[ctaStyles.ctaButton, { backgroundColor: getActiveTabColor(activeTab) }]}
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

    {/* Milestone Celebration Modal */}
    <MilestoneCelebration
      visible={milestoneToShow !== null}
      milestone={milestoneToShow ?? 0}
      onClose={() => setMilestoneToShow(null)}
    />
    </>
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
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonItem}>
          {/* Hero image skeleton */}
          <View style={[styles.skeletonHero, { backgroundColor: Colors[colorScheme].border }]} />
          {/* Source row skeleton */}
          <View style={styles.skeletonSourceRow}>
            <View style={[styles.skeletonAvatar, { backgroundColor: Colors[colorScheme].border }]} />
            <View style={[styles.skeletonMeta, { backgroundColor: Colors[colorScheme].border }]} />
          </View>
          {/* Title skeleton */}
          <View style={[styles.skeletonTitle, { backgroundColor: Colors[colorScheme].border }]} />
          <View style={[styles.skeletonSub, { backgroundColor: Colors[colorScheme].border }]} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  readsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F97316',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 1,
  },
  streakBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 4,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Section header
  sectionHeader: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 14,
    marginBottom: 6,
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
  feedList: { marginTop: 8 },
  divider: {
    height: 1,
    marginVertical: 16,
    opacity: 0.4,
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
  skeletonContainer: { gap: 20, paddingTop: 16 },
  skeletonItem: { marginBottom: 8 },
  skeletonHero: { width: '100%', height: 180, borderRadius: 16, opacity: 0.2, marginBottom: 12 },
  skeletonSourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  skeletonAvatar: { width: 24, height: 24, borderRadius: 12, opacity: 0.3 },
  skeletonMeta: { width: 100, height: 14, borderRadius: 6, opacity: 0.25 },
  skeletonTitle: { width: '90%', height: 20, borderRadius: 6, opacity: 0.3, marginBottom: 8 },
  skeletonSub: { width: '70%', height: 16, borderRadius: 6, opacity: 0.2 },
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
