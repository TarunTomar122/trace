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
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  Extrapolation,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Application from 'expo-application';
import {
  Flame,
  Compass,
  BookOpen,
  Cpu,
  User,
  ArrowUp,
  ChevronRight,
} from 'lucide-react-native';

import DigestIllus from '@/components/illustrations/DigestIllus';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  TrendingTopic,
  FeedItem,
  V3UserFeed,
  getV3UserFeed,
  getAppVersionConfig,
  recordLastActive,
} from '@/lib/firestore';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { logReadingEvent } from '@/lib/reading-analytics';
import { setCurrentTopic } from '@/lib/topic-store';
import { setCurrentArticle, setArticleList } from '@/lib/article-store';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { getStreakData, StreakData } from '@/lib/streaks';

// Figma design colors
const CARD_COLORS = ['#e8ffc9', '#c9d2ff']; // Just lime green and lavender
const ACCENT_ORANGE = '#ff8d28';
const META_GREEN = '#5a6b35'; // Darker olive for better contrast on pastel backgrounds

const INTEREST_LABELS: Record<string, string> = {
  technology: 'Tech',
  ai: 'AI',
  business: 'Business',
  'business-market': 'Markets',
  startups: 'Startups',
  experience: 'Design',
  engineering: 'Engineering',
  leadership: 'Leadership',
  marketing: 'Marketing',
  productivity: 'Productivity',
  fintech: 'Fintech',
  health: 'Health',
  web3: 'Web3',
  climate: 'Climate',
};

type FilterType = 'all' | 'trending' | 'discover' | string;

const INTEREST_ALIASES: Record<string, string> = {
  // Map various formats to our canonical keys
  'artificial-intelligence': 'ai',
  'artificial_intelligence': 'ai',
  'machine-learning': 'ai',
  'tech': 'technology',
  'software': 'technology',
  'software-engineering': 'engineering',
  'software_engineering': 'engineering',
  'design': 'experience',
  'ux': 'experience',
  'user-experience': 'experience',
  'product-design': 'experience',
  // 'business-market' is now a canonical ID, not aliased
  'finance': 'fintech',
  'crypto': 'web3',
  'blockchain': 'web3',
  'startup': 'startups',
  'entrepreneurship': 'startups',
  'management': 'leadership',
  'growth': 'marketing',
  'healthcare': 'health',
  'sustainability': 'climate',
};

function normalizeInterestId(value?: string | null): string {
  const normalized = String(value || '').trim().toLowerCase();
  return INTEREST_ALIASES[normalized] || normalized;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(profile: any): string {
  if (profile?.displayName) {
    return profile.displayName.split(' ')[0];
  }
  return 'there';
}

function getTopicDisplay(topic: TrendingTopic) {
  const isSingleton = (topic.source_count ?? 0) <= 1 || (topic.article_count ?? 0) <= 1;
  const article = isSingleton ? (topic.articles?.[0] ?? null) : null;
  return {
    isSingleton,
    article,
    title: article?.title || topic.title,
    summary: article?.summary?.short_article?.subtitle || article?.summary?.short_article?.body || topic.summary || '',
    thumbnail: article?.thumbnail || topic.thumbnail,
    readingTime: article?.summary?.reading_time_minutes,
  };
}

function isRealImage(url?: string | null): boolean {
  if (!url) return false;
  if (url.includes('placeholder') || url.includes('dicebear') || url.includes('via.placeholder')) return false;
  return true;
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

function getSourceInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function stripMarkdown(text?: string): string {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^##+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractBodyPreview(item: FeedItem): string {
  const body = stripMarkdown(item.summary?.short_article?.body);
  if (!body) return stripMarkdown(item.summary?.short_article?.subtitle || item.description || '');
  const firstParagraph = body.split(/\n\n+/).map((part) => part.trim()).find(Boolean) || body;
  return firstParagraph.replace(/\s+/g, ' ').trim();
}

function isNoisyItem(item: FeedItem): boolean {
  const title = (item.title || '').toLowerCase();
  const body = item.summary?.short_article?.body || '';
  const preview = extractBodyPreview(item);
  const sectionPatterns = [
    /^(home|index|welcome to|about us|contact)/i,
    /newsletter sign[- ]?up/i,
    /subscribe to our/i,
  ];
  if (sectionPatterns.some((p) => p.test(title))) return true;
  const roundupPatterns = [
    /^(weekly|daily|monthly)\s+(roundup|digest|recap)/i,
    /^(podcast|episode)\s*[:#\d]/i,
    /^links?\s*(for|of)\s*(the\s+)?(week|day)/i,
  ];
  if (roundupPatterns.some((p) => p.test(title))) return true;
  if (preview.length < 50 && body.length < 100) return true;
  return false;
}

function buildWorthReadingParagraphs(item: FeedItem): string[] {
  const body = stripMarkdown(item.summary?.short_article?.body);
  if (body) {
    const paragraphs = body
      .split(/\n\n+/)
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (paragraphs.length > 0) return paragraphs.slice(0, 6);
  }
  const takeawayParagraphs = (item.summary?.short_article?.key_takeaways || [])
    .map((part) => stripMarkdown(part))
    .filter(Boolean);
  if (takeawayParagraphs.length > 0) return takeawayParagraphs.slice(0, 6);
  const subtitle = stripMarkdown(item.summary?.short_article?.subtitle || item.description || '');
  return subtitle ? [subtitle] : [];
}

function patchForYouItem(item: FeedItem): FeedItem {
  const paragraphs = buildWorthReadingParagraphs(item);
  return {
    ...item,
    summary: {
      ...(item.summary || {}),
      short_article: {
        ...(item.summary?.short_article || {}),
        learning_cards: undefined,
      },
      worth_reading: paragraphs.length > 0 ? { paragraphs } : item.summary?.worth_reading,
    },
  };
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

// Interleaved feed item type
type FeedSection =
  | { type: 'hero'; topic: TrendingTopic }
  | { type: 'trending'; topic: TrendingTopic }
  | { type: 'foryou'; item: FeedItem; label?: string; preview?: string }
  | { type: 'section-header'; title: string; icon: 'flame' | 'compass' };

function buildInterleavedFeed(
  trending: TrendingTopic[],
  forYou: FeedItem[],
  filter: FilterType,
  userInterests: string[]
): FeedSection[] {
  const normalizedUserInterests = userInterests.map((interest) => normalizeInterestId(interest));
  const normalizedFilter = typeof filter === 'string' ? normalizeInterestId(filter) : filter;
  const sections: FeedSection[] = [];

  if (filter === 'trending') {
    // Only trending
    if (trending.length > 0) {
      // Sort by source_count for hero
      const sorted = [...trending].sort((a, b) => (b.source_count ?? 0) - (a.source_count ?? 0));
      sections.push({ type: 'hero', topic: sorted[0] });
      sections.push({ type: 'section-header', title: 'More trending', icon: 'flame' });
      for (let i = 1; i < sorted.length; i++) {
        sections.push({ type: 'trending', topic: sorted[i] });
      }
    }
    return sections;
  }

  if (filter === 'discover') {
    // Show content OUTSIDE user's main interests
    const discoverTrending = trending.filter((t) => !t.interest_id || !normalizedUserInterests.includes(normalizeInterestId(t.interest_id)));
    const discoverForYou = forYou.filter((item) => !item.interest_id || !normalizedUserInterests.includes(normalizeInterestId(item.interest_id)));

    const sortedTrending = [...discoverTrending].sort((a, b) => (b.source_count ?? 0) - (a.source_count ?? 0));

    if (sortedTrending.length > 0) {
      sections.push({ type: 'hero', topic: sortedTrending[0] });
      for (let i = 1; i < sortedTrending.length; i++) {
        sections.push({ type: 'trending', topic: sortedTrending[i] });
      }
    }

    for (const item of discoverForYou) {
      sections.push({ type: 'foryou', item });
    }

    return sections;
  }

  if (filter !== 'all') {
    // Interest filter - filter BOTH trending and for_you by interest_id
    // Match both raw and normalized values
    const filteredTrending = trending.filter((t) => {
      const raw = t.interest_id;
      const normalized = normalizeInterestId(raw);
      return raw === filter || normalized === filter || normalized === normalizedFilter;
    });
    const filteredForYou = forYou.filter((item) => {
      const raw = item.interest_id;
      const normalized = normalizeInterestId(raw);
      return raw === filter || normalized === filter || normalized === normalizedFilter;
    });

    // Sort trending by source_count - all as 'trending' type (no hero for filtered views)
    const sortedTrending = [...filteredTrending].sort((a, b) => (b.source_count ?? 0) - (a.source_count ?? 0));

    for (const topic of sortedTrending) {
      sections.push({ type: 'trending', topic });
    }

    for (const item of filteredForYou) {
      sections.push({ type: 'foryou', item });
    }

    return sections;
  }

  // "All" filter - show all trending items
  const sortedTrending = [...trending].sort((a, b) => (b.source_count ?? 0) - (a.source_count ?? 0));

  for (const topic of sortedTrending) {
    sections.push({ type: 'trending', topic });
  }

  return sections;
}

export default function UnifiedFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile, profileLoadError, retryProfileLoad } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const [v3Feed, setV3Feed] = useState<V3UserFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [streak, setStreak] = useState<StreakData | null>(null);

  // Scroll animation for sticky header
  const scrollY = useSharedValue(0);
  const STICKY_THRESHOLD = 80; // When sticky header appears

  const { isProUser: isSubscribed, loading: rcLoading } = useRevenueCat();
  const isOnboarded = profile?.onboarded ?? false;

  useEffect(() => {
    const currentVersion = Application.nativeApplicationVersion || '1.0.0';
    const compareVersion = (current: string, target: string): boolean => {
      const c = current.split('.').map(Number);
      const t = target.split('.').map(Number);
      for (let i = 0; i < Math.max(c.length, t.length); i++) {
        const cv = c[i] || 0;
        const tv = t[i] || 0;
        if (cv < tv) return false;
        if (cv > tv) return true;
      }
      return true;
    };

    getAppVersionConfig().then((config) => {
      if (!config?.latest_version) return;
      setShowUpdateBanner(!compareVersion(currentVersion, config.latest_version));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getStreakData().then(setStreak);
  }, []);

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

  // Only show pills for interests that have content in trending
  const availableInterests = useMemo(() => {
    const interestsWithContent = new Set<string>();
    for (const topic of v3Feed?.trending_topics || []) {
      const rawInterest = topic.interest_id;
      if (rawInterest) {
        const normalized = normalizeInterestId(rawInterest);
        // Use normalized if it has a label, otherwise use raw
        if (INTEREST_LABELS[normalized]) {
          interestsWithContent.add(normalized);
        } else if (INTEREST_LABELS[rawInterest]) {
          interestsWithContent.add(rawInterest);
        } else {
          // Add raw value so we at least show something
          interestsWithContent.add(rawInterest);
        }
      }
    }
    return Array.from(interestsWithContent);
  }, [v3Feed?.trending_topics]);

  // Filter pills data
  const filterPills = useMemo(() => {
    const pills: { id: FilterType; label: string }[] = [
      { id: 'all', label: 'All' },
    ];
    for (const interest of availableInterests) {
      // Pretty label or capitalize the raw value
      const label = INTEREST_LABELS[interest] ||
        interest.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      pills.push({ id: interest, label });
    }
    return pills;
  }, [availableInterests]);

  const FREE_LIMITS = { trending: 3, for_you: 1 };

  // Trending topics
  const trendingTopics = useMemo(() => {
    const items = v3Feed?.trending_topics || [];
    return isSubscribed ? items : items.slice(0, FREE_LIMITS.trending);
  }, [v3Feed?.trending_topics, isSubscribed]);

  const userInterestIds = useMemo(() => (profile?.interests || []).map((interest) => normalizeInterestId(interest)), [profile?.interests]);

  // Build interleaved feed
  const feedSections = useMemo(
    () => buildInterleavedFeed(trendingTopics, [], activeFilter, userInterestIds),
    [trendingTopics, activeFilter, userInterestIds]
  );

  // Top 3 stories for carousel (sorted by source_count)
  const topStories = useMemo(() => {
    const sorted = [...trendingTopics].sort((a, b) => (b.source_count ?? 0) - (a.source_count ?? 0));
    return sorted.slice(0, 3);
  }, [trendingTopics]);

  // For You items from feed (shuffled on each app open)
  const forYouItems = useMemo(() => {
    if (!v3Feed) return [];
    const items = isSubscribed ? v3Feed.for_you : v3Feed.for_you.slice(0, FREE_LIMITS.for_you);
    const filtered = items.filter((item) => !isNoisyItem(item));
    // Fisher-Yates shuffle
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [v3Feed, isSubscribed]);

  // Scroll handler for sticky header
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated style for sticky header
  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [STICKY_THRESHOLD - 20, STICKY_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [STICKY_THRESHOLD - 20, STICKY_THRESHOLD],
      [-10, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // Animated style for main header (fade out on scroll)
  const mainHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, STICKY_THRESHOLD],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

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

  const handleItemPress = async (item: FeedItem) => {
    const patchedItem = patchForYouItem(item);
    logReadingEvent({
      eventType: 'feed_open',
      itemId: patchedItem.id,
      title: patchedItem.title,
      url: patchedItem.url,
      tags: patchedItem.tags,
      itemType: patchedItem.type || patchedItem.source,
      feedCategory: patchedItem.metadata?.feed_category || patchedItem.feed_type,
    });
    const patchedItems = forYouItems.map(patchForYouItem);
    const idx = patchedItems.findIndex((i) => i.id === patchedItem.id);
    setArticleList(patchedItems, idx >= 0 ? idx : 0);
    setCurrentArticle(patchedItem);
    router.push('/article');
  };

  const isEmpty = feedSections.length === 0;

  const handleRetry = async () => {
    setIsRetrying(true);
    await retryProfileLoad();
    setIsRetrying(false);
  };

  // Show error UI if profile failed to load (network issue)
  if (profileLoadError && !profile) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>📡</Text>
          <ThemedText style={styles.errorTitle}>Connection Issue</ThemedText>
          <ThemedText style={[styles.errorText, { color: Colors[colorScheme].muted }]}>
            Could not load your profile. Please check your internet connection.
          </ThemedText>
          <Pressable
            onPress={handleRetry}
            disabled={isRetrying}
            style={[styles.retryButton, { opacity: isRetrying ? 0.6 : 1 }]}>
            {isRetrying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.retryButtonText}>Try Again</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!isOnboarded) return null;

  const firstName = getFirstName(profile);

  return (
    <View style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}>
      {/* Sticky Header - appears on scroll */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { paddingTop: insets.top, backgroundColor: Colors[colorScheme].background },
          stickyHeaderStyle,
        ]}>
        <View style={styles.stickyHeaderContent}>
          <View style={styles.stickyHeaderLeft}>
            <Image
              source={require('@/assets/images/trace-logo.png')}
              style={styles.stickyHeaderLogo}
              resizeMode="contain"
            />
            <Text style={[styles.stickyHeaderTitle, { color: Colors[colorScheme].text }]}>TRACE</Text>
          </View>
          <View style={styles.stickyHeaderRight}>
            <Pressable
              onPress={() => router.push('/profile')}
              hitSlop={12}
              style={[styles.profileButton, { borderColor: Colors[colorScheme].border }]}>
              <User size={14} color={Colors[colorScheme].text} strokeWidth={1.8} />
              {streak && streak.currentStreak > 0 && (
                <View style={styles.profileStreakBadge}>
                  <Flame size={10} color="#fff" fill="#fff" />
                  <Text style={styles.profileStreakText}>{streak.currentStreak}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors[colorScheme].foreground}
          />
        }>
        {/* Main Header - fades out on scroll */}
        <Animated.View style={[styles.header, mainHeaderStyle]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerGreeting, { color: Colors[colorScheme].text }]}>
              Hi, {firstName}
            </Text>
            <Text style={[styles.headerSubtitle, { color: Colors[colorScheme].muted }]}>
              Trace the stories that move your world.
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => router.push('/profile')}
              hitSlop={12}
              style={[styles.profileButton, { borderColor: Colors[colorScheme].border }]}>
              <User size={18} color={Colors[colorScheme].text} strokeWidth={1.8} />
              {streak && streak.currentStreak > 0 && (
                <View style={styles.profileStreakBadge}>
                  <Flame size={10} color="#fff" fill="#fff" />
                  <Text style={styles.profileStreakText}>{streak.currentStreak}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </Animated.View>

        {/* Update Available Banner */}
        {showUpdateBanner && (
          <Pressable
            onPress={() => Linking.openURL(
              Platform.OS === 'ios'
                ? 'https://apps.apple.com/app/id6745196498'
                : 'https://play.google.com/store/apps/details?id=online.yourtrace.app'
            )}
            style={[styles.updateBanner, { backgroundColor: Colors[colorScheme].card }]}>
            <View style={styles.updateBannerContent}>
              <View style={[styles.updateBannerIcon, { backgroundColor: `${ACCENT_ORANGE}20` }]}>
                <ArrowUp size={16} color={ACCENT_ORANGE} />
              </View>
              <View style={styles.updateBannerText}>
                <Text style={[styles.updateBannerTitle, { color: Colors[colorScheme].text }]}>
                  Update Available
                </Text>
                <Text style={[styles.updateBannerSubtitle, { color: Colors[colorScheme].muted }]}>
                  A new version of Trace is available
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors[colorScheme].muted} />
          </Pressable>
        )}

        {/* For You Section - Horizontal Carousel */}
        {!isLoading && !rcLoading && forYouItems.length > 0 && (
          <View style={styles.forYouSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.forYouCarouselContainer}
              snapToInterval={SCREEN_WIDTH - 34}
              decelerationRate="fast">
              {forYouItems.slice(0, 6).map((item, index) => {
                const sourceName = item.source_name || item.source || '';
                const preview = extractBodyPreview(item);
                const cardBg = CARD_COLORS[index % CARD_COLORS.length];
                const sourceCount = 4; // Placeholder for now
                const updateCount = 7; // Placeholder for now
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleItemPress(item)}
                    style={[styles.forYouCard, { backgroundColor: cardBg }]}>
                    {/* Image placeholder area */}
                    <View style={styles.forYouCardImageArea}>
                      {isRealImage(item.thumbnail) ? (
                        <Image source={{ uri: item.thumbnail! }} style={styles.forYouCardImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.forYouCardImagePlaceholder} />
                      )}
                    </View>
                    {/* Content */}
                    <View style={styles.forYouCardContent}>
                      <Text numberOfLines={2} style={styles.forYouCardTitle}>
                        {item.title}
                      </Text>
                      {preview ? (
                        <Text numberOfLines={2} style={styles.forYouCardPreview}>
                          {preview}
                        </Text>
                      ) : null}
                      <View style={styles.forYouCardMeta}>
                        <Text style={styles.forYouCardMetaText}>{sourceCount} Sources</Text>
                        <View style={styles.forYouCardMetaDot} />
                        <Text style={styles.forYouCardMetaText}>{updateCount} Updates</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Filter Pills */}
        <View style={styles.pillsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContainer}>
            {filterPills.map((pill) => {
              const isActive = activeFilter === pill.id;
              return (
                <Pressable
                  key={pill.id}
                  onPress={() => setActiveFilter(pill.id)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: isActive ? `${ACCENT_ORANGE}28` : Colors[colorScheme].background,
                      borderColor: isActive ? ACCENT_ORANGE : Colors[colorScheme].border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: Colors[colorScheme].text,
                        fontWeight: isActive ? '600' : '400',
                      },
                    ]}>
                    {pill.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Ongoing Section Header */}
        <View style={styles.ongoingHeader}>
          <Text style={[styles.ongoingTitle, { color: Colors[colorScheme].text }]}>Trending</Text>
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
            {/* Ongoing Article List - Figma style */}
            <View style={styles.ongoingList}>
              {feedSections.map((section) => {
                if (section.type === 'trending') {
                  const topic = section.topic;
                  const display = getTopicDisplay(topic);
                  const sourceCount = topic.source_count ?? 1;
                  const articleCount = topic.article_count ?? 1;
                  return (
                    <Pressable
                      key={`trending-${topic.id}`}
                      onPress={() => handleTopicPress(topic)}
                      style={[styles.ongoingRow, { borderBottomColor: `${Colors[colorScheme].border}40` }]}>
                      <View style={styles.ongoingBody}>
                        <Text numberOfLines={2} style={[styles.ongoingTitle2, { color: Colors[colorScheme].text }]}>
                          {display.title}
                        </Text>
                        <View style={styles.ongoingMeta}>
                          <Text style={styles.ongoingMetaText}>{sourceCount} Sources</Text>
                          <View style={styles.ongoingMetaDot} />
                          <Text style={styles.ongoingMetaText}>{articleCount} Updates</Text>
                        </View>
                      </View>
                      {isRealImage(display.thumbnail) ? (
                        <Image source={{ uri: display.thumbnail! }} style={styles.ongoingThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.ongoingThumb, styles.ongoingThumbPlaceholder]} />
                      )}
                    </Pressable>
                  );
                }

                if (section.type === 'foryou') {
                  const item = section.item;
                  return (
                    <Pressable
                      key={`foryou-${item.id}`}
                      onPress={() => handleItemPress(item)}
                      style={[styles.ongoingRow, { borderBottomColor: `${Colors[colorScheme].border}40` }]}>
                      <View style={styles.ongoingBody}>
                        <Text numberOfLines={2} style={[styles.ongoingTitle2, { color: Colors[colorScheme].text }]}>
                          {item.title}
                        </Text>
                        <View style={styles.ongoingMeta}>
                          <Text style={styles.ongoingMetaText}>1 Source</Text>
                          <View style={styles.ongoingMetaDot} />
                          <Text style={styles.ongoingMetaText}>New</Text>
                        </View>
                      </View>
                      {isRealImage(item.thumbnail) ? (
                        <Image source={{ uri: item.thumbnail! }} style={styles.ongoingThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.ongoingThumb, styles.ongoingThumbPlaceholder]} />
                      )}
                    </Pressable>
                  );
                }

                return null;
              })}
            </View>

            {/* Footer */}
            <View style={styles.padded}>
              <ThemedText style={[styles.endText, { color: Colors[colorScheme].muted }]}>
                Time to touch some grass 🌱
              </ThemedText>
            </View>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

/* ─── Sub-components ─── */

const BUILD_STEPS = [
  { icon: 'compass', text: 'Analyzing your interests...' },
  { icon: 'cpu', text: 'Finding the best sources...' },
  { icon: 'book-open', text: 'Generating your summaries...' },
];

function PulsingDot({ delay }: { delay: number; colorScheme: 'light' | 'dark' }) {
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
      style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT_ORANGE }, animStyle]}
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
  const cardBg = colorScheme === 'dark' ? '#1a1a2e' : '#e8ffc9';
  const StepIcon = step.icon === 'compass' ? Compass : step.icon === 'cpu' ? Cpu : BookOpen;

  return (
    <Animated.View entering={FadeIn.duration(500)} style={buildStyles.container}>
      <View style={[buildStyles.card, { backgroundColor: cardBg }]}>
        <View style={[buildStyles.iconCircle, { backgroundColor: colorScheme === 'dark' ? '#2a2a4e' : 'rgba(255,255,255,0.6)' }]}>
          <StepIcon size={32} color={ACCENT_ORANGE} strokeWidth={1.5} />
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
          This usually takes 2-3 minutes.{'\n'}We{"'"}ll have your personalized feed ready soon.
        </Text>
      </View>
    </Animated.View>
  );
}

function SkeletonLoader({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const shimmerOpacity = useSharedValue(0.3);

  useEffect(() => {
    shimmerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [shimmerOpacity]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  const skeletonBg = colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8';

  return (
    <View style={styles.skeletonContainer}>
      {/* For You Cards Skeleton */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.skeletonCarousel}>
        {[1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[styles.skeletonCard, { backgroundColor: skeletonBg }, shimmerStyle]}
          />
        ))}
      </ScrollView>

      {/* Pills Skeleton */}
      <View style={styles.skeletonPills}>
        {[1, 2, 3, 4].map((i) => (
          <Animated.View
            key={i}
            style={[styles.skeletonPill, { backgroundColor: skeletonBg }, shimmerStyle]}
          />
        ))}
      </View>

      {/* Ongoing List Skeleton */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonRowBody}>
            <Animated.View
              style={[styles.skeletonRowTitle, { backgroundColor: skeletonBg }, shimmerStyle]}
            />
            <Animated.View
              style={[styles.skeletonRowMeta, { backgroundColor: skeletonBg }, shimmerStyle]}
            />
          </View>
          <Animated.View
            style={[styles.skeletonRowThumb, { backgroundColor: skeletonBg }, shimmerStyle]}
          />
        </View>
      ))}
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: 24 },
  scrollContent: { paddingBottom: 60 },
  padded: { paddingHorizontal: 20, },

  // Sticky Header - appears on scroll
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  stickyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stickyHeaderLogo: {
    height: 22,
    width: 22,
  },
  stickyHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  stickyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Main Header - Figma style
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 20,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  headerGreeting: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    lineHeight: 22,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: ACCENT_ORANGE,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  streakText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 50,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileStreakBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: ACCENT_ORANGE,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    pointerEvents: 'none',
  },
  profileStreakText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Update Banner
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  updateBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  updateBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateBannerText: {
    flex: 1,
    gap: 2,
  },
  updateBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  updateBannerSubtitle: {
    fontSize: 13,
  },

  // For You Horizontal Carousel - Figma style
  forYouSection: {
    marginBottom: 16,
  },
  forYouCarouselContainer: {
    paddingHorizontal: 20,
    gap: 14,
  },
  forYouCard: {
    width: SCREEN_WIDTH - 50,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  forYouCardImageArea: {
    width: '100%',
    height: 180,
    overflow: 'hidden',
  },
  forYouCardImage: {
    width: '100%',
    height: '100%',
  },
  forYouCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  forYouCardContent: {
    padding: 14,
    gap: 6,
  },
  forYouCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.95)',
    fontFamily: Fonts.serif,
    lineHeight: 24,
  },
  forYouCardPreview: {
    fontSize: 13,
    color: 'rgba(55,55,55,0.8)',
    lineHeight: 19,
  },
  forYouCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 2,
  },
  forYouCardMetaText: {
    fontSize: 11,
    color: META_GREEN,
    fontWeight: '500',
  },
  forYouCardMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: META_GREEN,
  },

  // Filter pills - Figma style
  pillsSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  pillsContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 14,
  },

  // Ongoing Section - Figma style
  ongoingHeader: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  ongoingTitle: {
    fontSize: 21,
    fontWeight: '700',
    fontStyle: 'italic',
    fontFamily: Fonts.serif,
  },
  ongoingList: {
    paddingHorizontal: 20,
  },
  ongoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  ongoingBody: {
    flex: 1,
    gap: 6,
  },
  ongoingTitle2: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Fonts.serif,
    lineHeight: 22,
  },
  ongoingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ongoingMetaText: {
    fontSize: 11,
    color: META_GREEN,
    fontWeight: '500',
  },
  ongoingMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: META_GREEN,
  },
  ongoingThumb: {
    width: 72,
    height: 64,
    borderRadius: 10,
  },
  ongoingThumbPlaceholder: {
    backgroundColor: '#e0e0e0',
  },

  // Empty state
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

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorEmoji: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryButton: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 140,
    alignItems: 'center',
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  endText: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: Fonts.mono,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingVertical: 32,
  },

  // Skeleton styles
  skeletonContainer: { paddingTop: 8 },
  skeletonCarousel: { marginBottom: 20, paddingLeft: 20 },
  skeletonCard: {
    width: SCREEN_WIDTH - 50,
    height: 300,
    borderRadius: 16,
    marginRight: 14,
  },
  skeletonPills: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  skeletonPill: {
    width: 70,
    height: 36,
    borderRadius: 20,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  skeletonRowBody: {
    flex: 1,
    gap: 8,
  },
  skeletonRowTitle: {
    width: '85%',
    height: 18,
    borderRadius: 6,
  },
  skeletonRowMeta: {
    width: 100,
    height: 12,
    borderRadius: 4,
  },
  skeletonRowThumb: {
    width: 72,
    height: 64,
    borderRadius: 10,
  },
});

const buildStyles = StyleSheet.create({
  container: { paddingTop: 60, paddingBottom: 24, alignItems: 'center', paddingHorizontal: 20 },
  card: {
    width: '100%',
    borderTopLeftRadius: 60,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
    fontFamily: Fonts.serif,
  },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  dots: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  hint: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
