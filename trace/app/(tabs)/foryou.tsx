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
  Zap,
  BookOpen,
  Cpu,
  Compass,
  GraduationCap,
  ChevronRight,
} from 'lucide-react-native';

import DigestIllus from '@/components/illustrations/DigestIllus';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  FeedItem,
  V3UserFeed,
  getV3UserFeed,
} from '@/lib/firestore';
import { logReadingEvent } from '@/lib/reading-analytics';
import { setCurrentArticle, setArticleList } from '@/lib/article-store';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

const INTEREST_LABELS: Record<string, string> = {
  technology: 'Tech & Gadgets',
  ai: 'AI & Machine Learning',
  business: 'Business & Markets',
  startups: 'Startups',
  experience: 'Design & UX',
  engineering: 'Engineering',
  'business-market': 'Business & Markets',
  leadership: 'Leadership',
  marketing: 'Marketing & Growth',
  productivity: 'Productivity',
  fintech: 'Fintech',
  health: 'Health & Wellness',
  web3: 'Web3 & Crypto',
  climate: 'Climate & Energy',
};

const INTEREST_COLORS: Record<string, string> = {
  technology: '#6366F1',
  ai: '#8B5CF6',
  business: '#0EA5E9',
  startups: '#F59E0B',
  experience: '#EC4899',
  engineering: '#10B981',
  leadership: '#F97316',
  marketing: '#14B8A6',
  productivity: '#6366F1',
  fintech: '#0EA5E9',
  health: '#22C55E',
  web3: '#8B5CF6',
  climate: '#10B981',
};

type InterestGroup = { id: string; label: string; items: FeedItem[] };

function groupByInterest(items: FeedItem[]): InterestGroup[] {
  const groups = new Map<string, FeedItem[]>();
  for (const item of items) {
    const id = item.interest_id || '_general';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(item);
  }
  return Array.from(groups.entries()).map(([id, list]) => ({
    id,
    label: INTEREST_LABELS[id] || 'Picks for You',
    items: list,
  }));
}

function getSourceInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function isRealImage(url?: string | null): boolean {
  if (!url) return false;
  if (url.includes('placeholder') || url.includes('dicebear') || url.includes('via.placeholder')) return false;
  return true;
}

type ForYouSection =
  | { type: 'interest'; group: InterestGroup }
  | { type: 'deep_dive'; item: FeedItem };

function buildForYouSections(
  feed: V3UserFeed,
  isSubscribed: boolean,
): ForYouSection[] {
  const FREE_LIMITS = { for_you: 2, deep_dives: 1 };

  const forYouItems = isSubscribed
    ? feed.for_you
    : feed.for_you.slice(0, FREE_LIMITS.for_you);
  const deepDiveItems = isSubscribed
    ? feed.deep_dives
    : feed.deep_dives.slice(0, FREE_LIMITS.deep_dives);

  const interests = groupByInterest(forYouItems);
  const result: ForYouSection[] = [];

  let ddIdx = 0;
  for (let i = 0; i < interests.length; i++) {
    result.push({ type: 'interest', group: interests[i] });
    if (ddIdx < deepDiveItems.length) {
      result.push({ type: 'deep_dive', item: deepDiveItems[ddIdx] });
      ddIdx++;
    }
  }
  while (ddIdx < deepDiveItems.length) {
    result.push({ type: 'deep_dive', item: deepDiveItems[ddIdx] });
    ddIdx++;
  }

  return result;
}

export default function ForYouScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const [v3Feed, setV3Feed] = useState<V3UserFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { isProUser: isSubscribed, loading: rcLoading } = useRevenueCat();
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
  }, [loadFeed, isOnboarded]);

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

  const handleItemPress = async (item: FeedItem, index?: number) => {
    logReadingEvent({
      eventType: 'feed_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      tags: item.tags,
      itemType: item.type || item.source,
      feedCategory: item.metadata?.feed_category || item.feed_type,
    });
    // Set article list for "next article" navigation
    const idx = index ?? allForYouItems.findIndex((i) => i.id === item.id);
    setArticleList(allForYouItems, idx >= 0 ? idx : 0);
    setCurrentArticle(item);
    router.push('/article');
  };

  const allForYouItems = useMemo(() => {
    if (!v3Feed) return [];
    return isSubscribed ? v3Feed.for_you : v3Feed.for_you.slice(0, 2);
  }, [v3Feed, isSubscribed]);

  const featuredItem = allForYouItems.length > 0 ? allForYouItems[0] : null;

  const sections = useMemo(() => {
    if (!v3Feed) return [];
    const built = buildForYouSections(v3Feed, isSubscribed);
    if (!featuredItem) return built;
    return built.map((s) => {
      if (s.type !== 'interest') return s;
      const filtered = s.group.items.filter((i) => i.id !== featuredItem.id);
      if (filtered.length === 0) return null;
      return { ...s, group: { ...s.group, items: filtered } };
    }).filter(Boolean) as ForYouSection[];
  }, [v3Feed, isSubscribed, featuredItem]);

  const totalItems = sections.reduce((sum, s) => {
    if (s.type === 'interest') return sum + s.group.items.length;
    return sum + 1;
  }, 0);
  const isEmpty = totalItems === 0;
  const isTabLimited = !isSubscribed && v3Feed != null;

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
          <ThemedText style={styles.headerTitle}>For You</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: Colors[colorScheme].muted }]}>
            Matched to your interests
          </ThemedText>
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
                No articles yet. Pull to refresh.
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

            {/* Featured item */}
            {featuredItem && (
              <View style={[styles.section, styles.padded]}>
                <View style={styles.sectionHeaderRow}>
                  <Compass size={16} color="#8B5CF6" strokeWidth={2.5} />
                  <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                    Top Pick
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleItemPress(featuredItem)}
                  style={styles.featuredCard}>
                  {isRealImage(featuredItem.thumbnail) ? (
                    <Image source={{ uri: featuredItem.thumbnail! }} style={styles.featuredImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.featuredImage, { backgroundColor: Colors[colorScheme].border }]} />
                  )}
                  <View style={styles.featuredContent}>
                    <Text style={[styles.featuredTitle, { color: Colors[colorScheme].text }]}>
                      {featuredItem.title}
                    </Text>
                    <Text
                      numberOfLines={3}
                      style={[styles.featuredSummary, { color: Colors[colorScheme].muted }]}>
                      {(featuredItem.summary?.short_article?.subtitle || featuredItem.description || '').replace(/\*\*/g, '')}
                    </Text>
                    <View style={styles.featuredMetaRow}>
                      <View style={[styles.sourceChip, { backgroundColor: hashColor(featuredItem.source_name || '') + '20' }]}>
                        <Text style={[styles.sourceChipText, { color: hashColor(featuredItem.source_name || '') }]}>
                          {featuredItem.source_name || featuredItem.source || ''}
                        </Text>
                      </View>
                      {featuredItem.published_date ? (
                        <Text style={[styles.timeMeta, { color: Colors[colorScheme].muted }]}>
                          {getTimeAgo(featuredItem.published_date)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              </View>
            )}

            {/* Sections: interest groups + deep dives */}
            {sections.map((section) => {
              if (section.type === 'interest') {
                const { group } = section;
                const accent = INTEREST_COLORS[group.id] || '#6366F1';
                return (
                  <View key={`interest-${group.id}`} style={[styles.section, styles.padded]}>
                    <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                      {group.label}
                    </Text>
                    <View style={styles.itemList}>
                      {group.items.map((item) => {
                        const sourceName = item.source_name || item.source || '';
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => handleItemPress(item)}
                            style={[
                              styles.itemRow,
                              { backgroundColor: Colors[colorScheme].card },
                            ]}>
                            {isRealImage(item.thumbnail) ? (
                              <Image source={{ uri: item.thumbnail! }} style={styles.itemThumb} resizeMode="cover" />
                            ) : (
                              <View style={[styles.itemThumb, { backgroundColor: accent + '18' }]}>
                                <Text style={[styles.itemThumbInitials, { color: accent }]}>
                                  {getSourceInitials(sourceName)}
                                </Text>
                              </View>
                            )}
                            <View style={styles.itemBody}>
                              <Text numberOfLines={2} style={[styles.itemTitle, { color: Colors[colorScheme].text }]}>
                                {item.title}
                              </Text>
                              <Text style={[styles.itemMeta, { color: Colors[colorScheme].muted }]}>
                                {sourceName}{getTimeAgo(item.published_date) ? ` · ${getTimeAgo(item.published_date)}` : ''}
                              </Text>
                            </View>
                            <ChevronRight size={15} color={Colors[colorScheme].muted} strokeWidth={2} />
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              }

              if (section.type === 'deep_dive') {
                const item = section.item;
                const sourceName = item.source_name || item.source || '';
                return (
                  <View key={`dd-${item.id}`} style={[styles.section, styles.padded]}>
                    <View style={styles.sectionHeaderRow}>
                      <GraduationCap size={16} color="#0EA5E9" strokeWidth={2.5} />
                      <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                        Deep Dive
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleItemPress(item)}
                      style={[styles.deepDiveCard, { backgroundColor: Colors[colorScheme].card }]}>
                      {isRealImage(item.thumbnail) ? (
                        <Image source={{ uri: item.thumbnail! }} style={styles.ddImage} resizeMode="cover" />
                      ) : null}
                      <View style={styles.ddContent}>
                        <Text numberOfLines={2} style={[styles.ddTitle, { color: Colors[colorScheme].text }]}>
                          {item.title}
                        </Text>
                        <Text numberOfLines={2} style={[styles.ddSummary, { color: Colors[colorScheme].muted }]}>
                          {(item.summary?.short_article?.subtitle || item.description || '').replace(/\*\*/g, '')}
                        </Text>
                        <Text style={[styles.itemMeta, { color: Colors[colorScheme].muted }]}>
                          {sourceName}{getTimeAgo(item.published_date) ? ` · ${getTimeAgo(item.published_date)}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              }

              return null;
            })}

            {/* Footer */}
            <View style={styles.padded}>
              {isTabLimited && (
                <View style={[
                  ctaStyles.banner,
                  { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' },
                ]}>
                  <Text style={[ctaStyles.bannerTitle, { color: Colors[colorScheme].text }]}>
                    Unlock your full personalized feed
                  </Text>
                  <Text style={[ctaStyles.bannerBody, { color: Colors[colorScheme].muted }]}>
                    You{"'"}re seeing a preview. Go Pro for unlimited articles, deep dives, and bookmarks.
                  </Text>
                  <Pressable
                    onPress={() => router.push('/paywall')}
                    style={[ctaStyles.ctaButton, { backgroundColor: '#F59E0B' }]}>
                    <Zap size={16} color="#fff" />
                    <Text style={ctaStyles.ctaText}>Start Free Trial</Text>
                  </Pressable>
                  <Text style={[ctaStyles.bannerLegal, { color: Colors[colorScheme].muted }]}>
                    4-day free trial · Cancel anytime
                  </Text>
                </View>
              )}
              {isSubscribed && !isEmpty && (
                <ThemedText style={[styles.endText, { color: Colors[colorScheme].muted }]}>
                  You{"'"}re all caught up
                </ThemedText>
              )}
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
  const StepIcon = step.icon === 'sparkles' ? Compass : step.icon === 'cpu' ? Cpu : BookOpen;

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

  // Featured card (matches trending)
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
    paddingTop: 12,
    gap: 6,
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
  featuredMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  sourceChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeMeta: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Clean item rows (matches trending "More stories")
  itemList: {
    marginTop: 8,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
  },
  itemThumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemThumbInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  itemMeta: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },

  // Deep dive card
  deepDiveCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  ddImage: {
    width: '100%',
    height: 140,
  },
  ddContent: {
    padding: 14,
    gap: 6,
  },
  ddTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  ddSummary: {
    fontSize: 13,
    lineHeight: 19,
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
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  bannerLegal: { fontSize: 12, textAlign: 'center' },
});
