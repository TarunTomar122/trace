import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
  Text,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
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
import {
  Flame,
  Sparkles,
  BookOpen,
  Cpu,
  ChevronRight,
} from 'lucide-react-native';

import DigestIllus from '@/components/illustrations/DigestIllus';
import { EarlyAdopterBanner } from '@/components/EarlyAdopterBanner';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  TrendingTopic,
  V3UserFeed,
  getV3UserFeed,
  recordLastActive,
} from '@/lib/firestore';
import { logReadingEvent } from '@/lib/reading-analytics';
import { setCurrentTopic } from '@/lib/topic-store';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function rankTrendingTopics(topics: TrendingTopic[]): TrendingTopic[] {
  const scored = [...topics];
  scored.sort((a, b) => {
    if (!!a.is_featured !== !!b.is_featured) return a.is_featured ? -1 : 1;
    const ap = a.popularity_score ?? 0;
    const bp = b.popularity_score ?? 0;
    if (ap !== bp) return bp - ap;
    const ac = a.article_count ?? 0;
    const bc = b.article_count ?? 0;
    if (ac !== bc) return bc - ac;
    return (b.source_count ?? 0) - (a.source_count ?? 0);
  });
  return scored;
}

export default function TrendingScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const [v3Feed, setV3Feed] = useState<V3UserFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { isProUser: isSubscribed, isEarlyAdopter, loading: rcLoading } = useRevenueCat();
  const isOnboarded = profile?.onboarded ?? false;

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
    const requestedAt = profile?.feedBuildRequestedAt as any;
    if (!requestedAt) return false;
    const ts =
      typeof requestedAt === 'string'
        ? new Date(requestedAt).getTime()
        : requestedAt?.toDate
          ? requestedAt.toDate().getTime()
          : requestedAt?.seconds
            ? requestedAt.seconds * 1000
            : 0;
    if (!ts) return false;
    return Date.now() - ts < 5 * 60 * 1000;
  })();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (!isFeedBuilding || !user) return;
    pollRef.current = setInterval(async () => {
      await refreshProfile();
      const found = await loadFeed();
      if (found && pollRef.current) clearInterval(pollRef.current);
    }, 15_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isFeedBuilding, user, isSubscribed, loadFeed, refreshProfile]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshProfile();
    await loadFeed();
    setIsRefreshing(false);
  }, [loadFeed, refreshProfile]);

  const handleTopicPress = async (topic: TrendingTopic) => {
    const firstEvent = topic.timeline?.[0];
    const firstArticle = topic.articles?.[0];
    const url = firstEvent?.article_url || firstArticle?.url || '';
    logReadingEvent({
      eventType: 'feed_open',
      itemId: topic.id,
      title: topic.title,
      url,
      tags: topic.tags,
      itemType: 'topic',
      feedCategory: 'trending_topic',
    });
    setCurrentTopic(topic);
    router.push('/topic');
  };

  const topicGroups = useMemo(
    () => rankTrendingTopics(v3Feed?.trending_topics || []),
    [v3Feed?.trending_topics]
  );
  const featuredTopic = topicGroups.length > 0
    ? (topicGroups.find((t) => t.is_featured) || topicGroups[0])
    : null;
  const remainingTopics = featuredTopic
    ? topicGroups.filter(
        (t) => t.id !== featuredTopic.id && t.title !== featuredTopic.title
      )
    : [];

  const totalItems = topicGroups.length;
  const isEmpty = totalItems === 0;

  if (!isOnboarded) return null;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors[colorScheme].foreground}
          />
        }>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText
              style={styles.headerTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}>
              {profile?.name ? `Hey, ${profile.name.split(' ')[0]}` : 'Hey there'}
            </ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: Colors[colorScheme].muted }]}>
              {getGreeting()}
            </ThemedText>
          </View>
        </View>

        {/* Early Adopter Banner */}
        <View style={styles.padded}>
          <EarlyAdopterBanner
            colorScheme={colorScheme}
            isEarlyAdopter={isEarlyAdopter}
            isSubscribed={isSubscribed}
            onPress={() => router.push('/paywall')}
          />
        </View>

        {/* Loading / Building states */}
        {(isLoading || rcLoading) ? (
          <View style={styles.padded}>
            <SkeletonLoader colorScheme={colorScheme} />
          </View>
        ) : isFeedBuilding && isEmpty ? (
          <View style={styles.padded}>
            <FeedBuildingLoader colorScheme={colorScheme} />
          </View>
        ) : isEmpty ? (
          <View style={styles.padded}>
            <View style={styles.emptyState}>
              <View style={[styles.emptyIllus, { backgroundColor: colorScheme === 'dark' ? '#1a1a2e' : '#f5f3ff' }]}>
                <DigestIllus width={44} height={44} color={Colors[colorScheme].text} />
              </View>
              <ThemedText style={[styles.emptyText, { color: Colors[colorScheme].muted }]}>
                No trending articles yet. Pull to refresh.
              </ThemedText>
            </View>
          </View>
        ) : (
          <>
            {isFeedBuilding && (
              <View style={[styles.upgradingBanner, styles.padded, { backgroundColor: '#F59E0B12' }]}>
                <ActivityIndicator size="small" color="#F59E0B" />
                <ThemedText style={[styles.upgradingText, { color: Colors[colorScheme].muted }]}>
                  Your full feed is building — pull to refresh in a minute
                </ThemedText>
              </View>
            )}

            {/* Grouped-topics layout */}
            <>
              {featuredTopic && (
                <View style={[styles.section, styles.padded]}>
                  <View style={styles.sectionHeaderRow}>
                    <Flame size={16} color="#F97316" strokeWidth={2.5} />
                    <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                      Featured
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleTopicPress(featuredTopic)}
                    style={styles.featuredCard}>
                    {featuredTopic.thumbnail ? (
                      <Image source={{ uri: featuredTopic.thumbnail }} style={styles.featuredImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.featuredImage, { backgroundColor: Colors[colorScheme].border }]} />
                    )}
                    <View style={styles.featuredContent}>
                      <Text style={[styles.featuredTitle, { color: Colors[colorScheme].text }]}>
                        {featuredTopic.title}
                      </Text>
                      <Text
                        numberOfLines={3}
                        style={[styles.featuredSummary, { color: Colors[colorScheme].muted }]}>
                        {(featuredTopic.summary || '').replace(/\*\*/g, '')}
                      </Text>
                      <Text style={[styles.featuredMeta, { color: Colors[colorScheme].muted }]}>
                        {featuredTopic.source_count ?? 0} sources · {featuredTopic.article_count ?? 0} updates
                      </Text>
                    </View>
                  </Pressable>
                </View>
              )}

              {remainingTopics.length > 0 && (
                <View style={[styles.section, styles.padded]}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                      More stories
                    </Text>
                  </View>
                  <View style={styles.topicList}>
                    {remainingTopics.map((topic) => (
                      <Pressable
                        key={topic.id}
                        onPress={() => handleTopicPress(topic)}
                        style={[
                          styles.topicRow,
                          { backgroundColor: Colors[colorScheme].card },
                        ]}>
                        {topic.thumbnail ? (
                          <Image source={{ uri: topic.thumbnail }} style={styles.topicThumb} resizeMode="cover" />
                        ) : (
                          <View style={[styles.topicThumb, { backgroundColor: Colors[colorScheme].border }]} />
                        )}
                        <View style={styles.topicBody}>
                          <Text numberOfLines={2} style={[styles.topicTitle, { color: Colors[colorScheme].text }]}>
                            {topic.title}
                          </Text>
                          <Text style={[styles.topicMeta, { color: Colors[colorScheme].muted }]}>
                            {topic.source_count ?? 0} sources · {topic.article_count ?? 0} updates
                          </Text>
                        </View>
                        <ChevronRight size={15} color={Colors[colorScheme].muted} strokeWidth={2} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </>

            {/* Footer */}
            <View style={styles.padded}>
              <ThemedText style={[styles.endText, { color: Colors[colorScheme].muted }]}>
                You{"'"}re all caught up
              </ThemedText>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Sub-components ─── */

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

  return (
    <Animated.View
      style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }, animStyle]}
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
          <View style={[styles.skeletonHero, { backgroundColor: Colors[colorScheme].border }]} />
          <View style={styles.skeletonSourceRow}>
            <View style={[styles.skeletonAvatar, { backgroundColor: Colors[colorScheme].border }]} />
            <View style={[styles.skeletonMeta, { backgroundColor: Colors[colorScheme].border }]} />
          </View>
          <View style={[styles.skeletonTitle, { backgroundColor: Colors[colorScheme].border }]} />
          <View style={[styles.skeletonSub, { backgroundColor: Colors[colorScheme].border }]} />
        </View>
      ))}
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  padded: { paddingHorizontal: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  headerSubtitle: { fontSize: 14, marginTop: 4 },

  section: { marginTop: 28 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  featuredCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  featuredImage: {
    width: '100%',
    height: 180,
  },
  featuredContent: {
    padding: 16,
    gap: 8,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  featuredSummary: {
    fontSize: 14,
    lineHeight: 20,
  },
  featuredMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  topicList: {
    marginTop: 8,
    gap: 8,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
  },
  topicThumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    flexShrink: 0,
  },
  topicBody: {
    flex: 1,
    gap: 4,
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  topicSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  topicMeta: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },
  carousel: {
    paddingLeft: 20,
    paddingRight: 8,
    paddingTop: 8,
  },

  upgradingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  upgradingText: { fontSize: 13, fontWeight: '500', flex: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIllus: {
    width: 80,
    height: 70,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyText: { textAlign: 'center', fontSize: 15, paddingHorizontal: 20 },

  endText: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: Fonts.mono,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingVertical: 32,
  },

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
  container: { paddingTop: 48, paddingBottom: 24, alignItems: 'center' },
  card: { width: '100%', borderRadius: 20, padding: 32, alignItems: 'center' },
  iconRow: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  hint: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
