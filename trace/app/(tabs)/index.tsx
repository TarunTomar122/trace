import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
  Text,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  InteractionManager,
  FlatList,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  FadeIn,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import {
  Flame,
  Compass,
  BookOpen,
  Cpu,
  User,
  ArrowUp,
  ChevronRight,
  LayoutGrid,
  List,
} from 'lucide-react-native';

import DigestIllus from '@/components/illustrations/DigestIllus';
import { DeckStoryCard } from '@/components/DeckStoryCard';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TrendingTopic,
  FeedItem,
  V3UserFeed,
  DailyPulseBucket,
  getV3UserFeed,
  getAppVersionConfig,
  recordLastActive,
} from '@/lib/firestore';
import { getArticleImage } from '@/lib/fallback-images';
import { decodeHtmlEntities } from '@/lib/text-decode';

const VIEW_MODE_KEY = '@trace:feed_view_mode';
import { logReadingEvent } from '@/lib/reading-analytics';
import { trackEvent, setUserProperty } from '@/lib/posthog';
import { setCurrentTopic } from '@/lib/topic-store';
import { buildArticleShareUrl, buildTopicCardShareUrl } from '@/lib/article-share';
import { getStreakData, recordAppOpen, StreakData } from '@/lib/streaks';
import { consumePrefetchedFeed, getPrefetchPromise } from '@/lib/feed-cache';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** Deck card: show long narrative from body (scrollable); bullets stripped */
const DECK_NARRATIVE_MAX_WORDS = 320;
/** Max width for deck cards (centered; not edge-to-edge) */
const DECK_CARD_MAX_WIDTH = 392;
/** Vertical inset around each deck card (extra bottom for breathing room) */
const DECK_CARD_MARGIN_TOP = 10;
const DECK_CARD_MARGIN_BOTTOM = 100;

// Figma design colors
const ACCENT_ORANGE = '#ff8d28';
const META_GREEN = '#5a6b35'; // Darker olive for better contrast on pastel backgrounds

const INTEREST_LABELS: Record<string, string> = {
  ai: 'AI',
  products: 'Products',
  tech: 'Tech',
  startups: 'Startups',
  engineering: 'Engineering',
  'ux-design': 'Design',
  markets: 'Markets',
  'the-world': 'The World',
  // Legacy labels kept so old stored IDs still display readable names
  'product-design': 'Design',
  marketing: 'Products',
  fintech: 'Markets',
  technology: 'Tech',
  'business-market': 'Markets',
  experience: 'UX Design',
  leadership: 'Markets',
  productivity: 'The World',
  health: 'The World',
  web3: 'Markets',
  climate: 'The World',
  business: 'Markets',
};

type FilterType = 'pulse' | 'for_you' | 'all' | 'trending' | 'discover' | string;
const PULSE_COLOR = '#6366f1';

const INTEREST_ALIASES: Record<string, string> = {
  // Canonical aliases
  'artificial-intelligence': 'ai',
  'artificial_intelligence': 'ai',
  'machine-learning': 'ai',
  // Legacy IDs -> new canonical IDs
  'technology': 'tech',
  'software': 'tech',
  'software-engineering': 'engineering',
  'software_engineering': 'engineering',
  'design': 'ux-design',
  'ux': 'ux-design',
  'user-experience': 'ux-design',
  'experience': 'ux-design',
  'product-design': 'ux-design',
  'business-market': 'markets',
  'business': 'markets',
  'leadership': 'markets',
  'management': 'markets',
  'finance': 'markets',
  'crypto': 'markets',
  'blockchain': 'markets',
  'web3': 'markets',
  'fintech': 'markets',
  'startup': 'startups',
  'entrepreneurship': 'startups',
  'growth': 'products',
  'marketing': 'products',
  'productivity': 'the-world',
  'health': 'the-world',
  'healthcare': 'the-world',
  'climate': 'the-world',
  'sustainability': 'the-world',
  'policy': 'the-world',
  'geopolitics': 'the-world',
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
  const fullName = String(profile?.name || profile?.displayName || '').trim();
  if (fullName) {
    return fullName.split(/\s+/)[0];
  }
  const email = String(profile?.email || '').trim();
  if (email) {
    return email.split('@')[0];
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
  const value = String(name || '').trim();
  if (!value) return '??';
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words[0] && words[1]) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase() || '??';
  }
  return value.slice(0, 2).toUpperCase() || '??';
}

function stripMarkdown(text?: string): string {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^##+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Paragraph is mostly bullet / numbered lines — skip on deck */
function isBulletParagraph(block: string): boolean {
  const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  let bulletish = 0;
  for (const line of lines) {
    if (/^[-*•◦▪]\s+/.test(line)) bulletish++;
    else if (/^\d+[.)]\s+/.test(line)) bulletish++;
  }
  if (lines.length >= 2 && bulletish >= Math.ceil(lines.length * 0.45)) return true;
  if (lines.length === 1 && /^[-*•◦▪]\s+/.test(lines[0])) return true;
  if (/^key\s+takeaways/im.test(block) && bulletish > 0) return true;
  return false;
}

/** Prose from short_article.body only; drops bullet blocks and takeaway lists */
function extractNarrativeFromBody(raw?: string | null): string {
  const body = stripMarkdown(raw || '');
  if (!body) return '';
  const paras = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const prose: string[] = [];
  for (const p of paras) {
    if (isBulletParagraph(p)) continue;
    const oneLine = p.replace(/\s+/g, ' ').trim();
    if (/^(key\s+takeaways|what\s+to\s+watch|the\s+bottom\s+line|sources?|read\s+more)\b/i.test(oneLine)) {
      continue;
    }
    prose.push(oneLine);
  }
  if (prose.length > 0) return prose.join('\n\n');
  const lines = body.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const keep: string[] = [];
  for (const line of lines) {
    if (/^[-*•◦▪]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) break;
    if (/^#{1,3}\s/.test(line)) continue;
    keep.push(line);
  }
  return keep.join(' ').replace(/\s+/g, ' ').trim();
}

function extractBodyPreview(item: FeedItem): string {
  const body = stripMarkdown(item.summary?.short_article?.body);
  if (!body) return stripMarkdown(item.summary?.short_article?.subtitle || item.description || '');
  const firstParagraph = body.split(/\n\n+/).map((part) => part.trim()).find(Boolean) || body;
  return firstParagraph.replace(/\s+/g, ' ').trim();
}

function truncateByWords(raw: string, maxWords: number): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const words = t.split(/\s+/);
  if (words.length <= maxWords) return t;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function getFeedItemOverview(item: FeedItem): string {
  const sa = item.summary?.short_article as any;
  const mobile = stripMarkdown(String(sa?.mobile_card_summary || '')).replace(/\s+/g, ' ').trim();
  if (mobile.length >= 40) return mobile;
  const bodyNarrative = extractNarrativeFromBody(sa?.body);
  if (bodyNarrative.length >= 40) {
    return truncateByWords(bodyNarrative, DECK_NARRATIVE_MAX_WORDS);
  }
  const fallback =
    [sa?.subtitle, sa?.why_it_matters, item.description, extractBodyPreview(item)]
      .map((s) => stripMarkdown(String(s || '')).replace(/\s+/g, ' ').trim())
      .find((s) => s.length >= 24) || bodyNarrative;
  return truncateByWords(fallback, DECK_NARRATIVE_MAX_WORDS);
}

function getTopicOverviewForDeck(topic: TrendingTopic): string {
  const display = getTopicDisplay(topic);
  const sa = display.article?.summary?.short_article as any;
  const mobile = stripMarkdown(String(sa?.mobile_card_summary || '')).replace(/\s+/g, ' ').trim();
  if (mobile.length >= 40) return mobile;
  const fromArticleBody = extractNarrativeFromBody(sa?.body);
  if (fromArticleBody.length >= 40) {
    return truncateByWords(fromArticleBody, DECK_NARRATIVE_MAX_WORDS);
  }
  const fromSummary = extractNarrativeFromBody(display.summary);
  if (fromSummary.length >= 24) {
    return truncateByWords(fromSummary, DECK_NARRATIVE_MAX_WORDS);
  }
  return truncateByWords(stripMarkdown(display.summary).replace(/\s+/g, ' ').trim(), DECK_NARRATIVE_MAX_WORDS);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Interleaved feed item type
type FeedSection =
  | { type: 'hero'; topic: TrendingTopic }
  | { type: 'trending'; topic: TrendingTopic }
  | { type: 'foryou'; item: FeedItem; label?: string; preview?: string; tapUrl?: string }
  | { type: 'section-header'; title: string; icon: 'flame' | 'compass' }
  | { type: 'pulse_empty' }
  | { type: 'deck_end' };

function isUserInterested(section: FeedSection, interestSet: Set<string>): boolean {
  const raw = section.type === 'trending'
    ? section.topic.interest_id
    : section.type === 'foryou'
      ? section.item.interest_id
      : undefined;
  if (!raw) return false;
  return interestSet.has(normalizeInterestId(raw));
}

function rankSections(sections: FeedSection[], interestSet: Set<string>): FeedSection[] {
  // The backend has already ranked canonical topics. Preserve that order
  // inside the personalized interested/suggested groups instead of replacing
  // it with a client-side recency sort.
  return sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => {
      const aInterested = isUserInterested(a.section, interestSet) ? 0 : 1;
      const bInterested = isUserInterested(b.section, interestSet) ? 0 : 1;
      return aInterested - bInterested || a.index - b.index;
    })
    .map(({ section }) => section);
}

function buildInterleavedFeed(
  trending: TrendingTopic[],
  forYou: FeedItem[],
  filter: FilterType,
  userInterests: string[]
): FeedSection[] {
  const normalizedUserInterests = userInterests.map((interest) => normalizeInterestId(interest));
  const interestSet = new Set(normalizedUserInterests);
  const normalizedFilter = typeof filter === 'string' ? normalizeInterestId(filter) : filter;
  const sections: FeedSection[] = [];

  if (filter === 'for_you') {
    const matchedTrending = trending.filter((t) => t.interest_id && interestSet.has(normalizeInterestId(t.interest_id)));
    const matchedForYou = forYou.filter((item) => item.interest_id && interestSet.has(normalizeInterestId(item.interest_id)));

    for (const topic of matchedTrending) {
      sections.push({ type: 'trending', topic });
    }
    for (const item of matchedForYou) {
      sections.push({ type: 'foryou', item });
    }
    // If user has no interests or nothing matches, fall back to all content
    if (sections.length === 0) {
      for (const topic of trending) {
        sections.push({ type: 'trending', topic });
      }
      for (const item of forYou) {
        sections.push({ type: 'foryou', item });
      }
    }
    return rankSections(sections, interestSet);
  }

  if (filter === 'trending') {
    for (const topic of trending) {
      sections.push({ type: 'trending', topic });
    }
    for (const item of forYou) {
      sections.push({ type: 'foryou', item });
    }
    return rankSections(sections, interestSet);
  }

  if (filter === 'discover') {
    const discoverTrending = trending.filter((t) => !t.interest_id || !interestSet.has(normalizeInterestId(t.interest_id)));
    const discoverForYou = forYou.filter((item) => !item.interest_id || !interestSet.has(normalizeInterestId(item.interest_id)));

    for (const topic of discoverTrending) {
      sections.push({ type: 'trending', topic });
    }
    for (const item of discoverForYou) {
      sections.push({ type: 'foryou', item });
    }
    // Discover keeps the backend order for the suggested stories.
    return sections;
  }

  if (filter !== 'all') {
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

    for (const topic of filteredTrending) {
      sections.push({ type: 'trending', topic });
    }
    for (const item of filteredForYou) {
      sections.push({ type: 'foryou', item });
    }
    // Single-interest views keep the backend order for that lane.
    return sections;
  }

  // "All" filter — interested first, then suggested, preserving backend rank.
  for (const topic of trending) {
    sections.push({ type: 'trending', topic });
  }
  for (const item of forYou) {
    sections.push({ type: 'foryou', item });
  }
  return rankSections(sections, interestSet);
}

function normalizeStoryTitle(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function storyKeyFromSection(section: FeedSection): string {
  if (section.type === 'trending') {
    const topic = section.topic;
    const primary = topic.articles?.[0];
    const url = String(primary?.url || topic.timeline?.[0]?.article_url || '').trim();
    if (url) return `url:${url}`;
    const source = String(primary?.source_name || primary?.source || topic.timeline?.[0]?.source_name || '').trim().toLowerCase();
    const title = normalizeStoryTitle(primary?.title || topic.title);
    if (source || title) return `st:${source}|${title}`;
    return `topic:${String(topic.id || topic.topic_key || '').trim()}`;
  }
  if (section.type === 'foryou') {
    const item = section.item;
    const url = String(item.url || '').trim();
    if (url) return `url:${url}`;
    const source = String(item.source_name || item.source || '').trim().toLowerCase();
    const title = normalizeStoryTitle(item.title);
    if (source || title) return `st:${source}|${title}`;
    return `item:${String(item.id || '').trim()}`;
  }
  return '';
}

function dedupeFeedSections(sections: FeedSection[]): FeedSection[] {
  const seen = new Set<string>();
  const out: FeedSection[] = [];
  for (const section of sections) {
    if (section.type !== 'trending' && section.type !== 'foryou') {
      out.push(section);
      continue;
    }
    const key = storyKeyFromSection(section);
    if (!key) {
      out.push(section);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(section);
  }
  return out;
}

export default function UnifiedFeedScreen() {
  const router = useRouter();
  const { isProUser } = useRevenueCat();
  const insets = useSafeAreaInsets();
  const {
    user,
    profile,
    refreshProfile,
  } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const [v3Feed, setV3Feed] = useState<V3UserFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('for_you');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [streak, setStreak] = useState<StreakData | null>(null);
  const v3FeedRef = useRef<V3UserFeed | null>(null);
  const deckListRef = useRef<FlatList<FeedSection>>(null);
  const listRef = useRef<any>(null);
  const [currentDeckIndex, setCurrentDeckIndex] = useState(0);
  const [deckScrolling, setDeckScrolling] = useState(false);
  const deckScrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDeckScrollBegin = useCallback(() => {
    if (deckScrollEndTimerRef.current) {
      clearTimeout(deckScrollEndTimerRef.current);
      deckScrollEndTimerRef.current = null;
    }
    setDeckScrolling(true);
  }, []);
  const onDeckScrollEnd = useCallback(() => {
    if (deckScrollEndTimerRef.current) {
      clearTimeout(deckScrollEndTimerRef.current);
    }
    deckScrollEndTimerRef.current = setTimeout(() => {
      setDeckScrolling(false);
      deckScrollEndTimerRef.current = null;
    }, 120);
  }, []);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const idx = viewableItems[0]?.index;
      if (idx != null) setCurrentDeckIndex(idx);
    },
    [],
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [deckViewportH, setDeckViewportH] = useState(() => {
    const chromeGuess = 168 + insets.top + insets.bottom;
    return Math.max(300, windowHeight - chromeGuess);
  });

  const isOnboarded = profile?.onboarded === true;
  const hasRenderableFeed = !!v3Feed && (
    (v3Feed.trending_topics?.length ?? 0) > 0 ||
    (v3Feed.trending?.length ?? 0) > 0 ||
    (v3Feed.curated?.length ?? 0) > 0
  );

  useEffect(() => {
    v3FeedRef.current = v3Feed;
  }, [v3Feed]);

  useEffect(() => {
    if (!user?.uid) {
      setV3Feed(null);
      setIsLoading(false);
      return;
    }

    const prefetchedFeed = consumePrefetchedFeed(user?.uid);
    if (prefetchedFeed) {
      setV3Feed(prefetchedFeed);
      setIsLoading(false);
      return;
    }

    const prefetchPromise = getPrefetchPromise();
    if (!prefetchPromise) return;

    let cancelled = false;
    prefetchPromise
      .then(() => {
        if (cancelled) return;
        const readyFeed = consumePrefetchedFeed(user?.uid);
        if (readyFeed) {
          setV3Feed(readyFeed);
        } else {
          console.log('[Feed] Prefetch resolved empty; continuing with direct fetch');
        }
        setIsLoading(false);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

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
    recordAppOpen().then(setStreak);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void getStreakData().then((nextStreak) => {
        if (active) {
          setStreak(nextStreak);
        }
      });

      return () => {
        active = false;
      };
    }, [])
  );

  // Load saved view mode preference
  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then((saved) => {
      if (saved === 'list' || saved === 'card') {
        setViewMode(saved);
        setUserProperty({ preferred_view_mode: saved });
      }
    });
  }, []);

  // Save view mode preference when it changes
  useEffect(() => {
    AsyncStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const loadFeed = useCallback(async (): Promise<boolean> => {
    if (!user?.uid) return false;
    const currentFeed = v3FeedRef.current;
    const hasCurrentRenderableFeed = !!currentFeed && (
      (currentFeed.trending_topics?.length ?? 0) > 0 ||
      (currentFeed.trending?.length ?? 0) > 0
    );
    if (!isOnboarded && !hasCurrentRenderableFeed) return false;
    try {
      // Always fetch fresh from Firestore
      for (let attempt = 0; attempt < 3; attempt++) {
        const v3 = await getV3UserFeed(user?.uid);
        if (v3 && ((v3.trending_topics?.length ?? 0) > 0 || (v3.trending?.length ?? 0) > 0)) {
          setV3Feed(v3);
          return true;
        }
        if (attempt < 2) {
          await sleep(900);
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading feed:', error);
      return false;
    }
  }, [user?.uid, isOnboarded]);

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

  const hasRetriedProfileRef = useRef(false);

  useEffect(() => {
    if (!isOnboarded && !hasRenderableFeed) {
      // Profile may not have refreshed yet after onboarding — retry once
      if (user?.uid && !hasRetriedProfileRef.current) {
        hasRetriedProfileRef.current = true;
        const retryAfterOnboard = async () => {
          if (!v3FeedRef.current) {
            setIsLoading(true);
          }
          await refreshProfile();
          setIsLoading(false);
        };
        retryAfterOnboard();
      } else {
        setIsLoading(false);
      }
      return;
    }
    const init = async () => {
      if (!v3FeedRef.current) {
        setIsLoading(true);
      }
      await loadFeed();
      setIsLoading(false);
    };
    init();
    if (user?.uid) recordLastActive(user.uid);
  }, [user?.uid, isOnboarded, loadFeed, user?.uid]);

  useEffect(() => {
    if (!isFeedBuilding || !user?.uid) return;
    pollRef.current = setInterval(async () => {
      await refreshProfile();
      const found = await loadFeed();
      if (found && pollRef.current) clearInterval(pollRef.current);
    }, 15_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isFeedBuilding, user?.uid, loadFeed, refreshProfile]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    trackEvent('feed_pull_to_refresh');
    await refreshProfile();
    await loadFeed();
    setIsRefreshing(false);
  }, [loadFeed, refreshProfile]);

  // Normalized user profile interests
  const userInterestIds = useMemo(() => {
    return (profile?.interests || []).map((i) => normalizeInterestId(i));
  }, [profile?.interests]);

  // Pills for interests that appear in trending content AND in the user's profile.
  // Everything else collapses into the "Suggested" pill.
  const feedInterestIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const topic of v3Feed?.trending_topics || []) {
      if (!topic.interest_id) continue;
      const normalized = normalizeInterestId(topic.interest_id);
      if (!INTEREST_LABELS[normalized]) continue;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([interest]) => interest)
      .slice(0, 4);
  }, [v3Feed?.trending_topics]);

  const availableInterests = useMemo(() => {
    const userSet = new Set(userInterestIds);
    const matched = new Set<string>();
    for (const topic of v3Feed?.trending_topics || []) {
      const raw = topic.interest_id;
      if (!raw) continue;
      const normalized = normalizeInterestId(raw);
      const canonical = INTEREST_LABELS[normalized] ? normalized : INTEREST_LABELS[raw] ? raw : normalized;
      if (userSet.has(canonical)) matched.add(canonical);
    }
    const matchedList = Array.from(matched);
    if (matchedList.length > 0) return matchedList;
    return feedInterestIds;
  }, [feedInterestIds, v3Feed?.trending_topics, userInterestIds]);

  const dailyPulse: DailyPulseBucket | null = useMemo(() => {
    const dp = v3Feed?.daily_pulse;
    if (dp && ((dp.tools?.length ?? 0) + (dp.blogs?.length ?? 0) + (dp.discussions?.length ?? 0)) > 0) {
      return dp;
    }
    // Legacy fallback: treat community + build as "reads"
    const legacyReads = [...(v3Feed?.community_pulse || []), ...(v3Feed?.build_pulse || [])];
    if (legacyReads.length > 0) return { tools: [], blogs: legacyReads, discussions: [] };
    return null;
  }, [v3Feed?.daily_pulse, v3Feed?.community_pulse, v3Feed?.build_pulse]);

  // reads → discussions → tools
  const pulseItems = useMemo(() => {
    if (!dailyPulse) return [];
    return [...dailyPulse.blogs, ...dailyPulse.discussions, ...dailyPulse.tools];
  }, [dailyPulse]);

  // Filter pills: For You → matched user interests → Suggested
  const filterPills = useMemo(() => {
    const pills: { id: FilterType; label: string }[] = [];
    pills.push({ id: 'for_you', label: 'For You' });

    for (const interest of availableInterests) {
      const label = INTEREST_LABELS[interest] ||
        interest.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      pills.push({ id: interest, label });
    }

    // Add "Suggested" pill if any trending topic falls outside the user's interests
    if (userInterestIds.length === 0) {
      return pills;
    }
    const matchedSet = new Set(availableInterests);
    const hasSuggested = (v3Feed?.trending_topics || []).some((t) => {
      if (!t.interest_id) return true;
      const normalized = normalizeInterestId(t.interest_id);
      return !matchedSet.has(normalized) && !matchedSet.has(t.interest_id);
    });
    if (hasSuggested) {
      pills.push({ id: 'discover', label: 'Suggested' });
    }

    return pills;
  }, [availableInterests, userInterestIds.length, v3Feed?.trending_topics]);

  // Trending topics are already entitlement-trimmed by backend.
  const trendingTopics = useMemo(() => v3Feed?.trending_topics || [], [v3Feed?.trending_topics]);

  // Individual trending articles NOT already grouped inside a trending_topic.
  // These are the articles the backend generated that didn't make it into a grouped topic.
  const uncoveredTrendingArticles = useMemo(() => {
    const coveredIds = new Set<string>();
    const coveredUrls = new Set<string>();
    for (const topic of trendingTopics) {
      for (const article of topic.articles || []) {
        if (article.id) coveredIds.add(article.id);
        if (article.url) coveredUrls.add(article.url);
      }
      for (const event of topic.timeline || []) {
        if (event.id) coveredIds.add(event.id);
        if (event.article_url) coveredUrls.add(event.article_url);
      }
    }
    return (v3Feed?.trending || []).filter((item) => !coveredIds.has(item.id) && !coveredUrls.has(item.url || ''));
  }, [trendingTopics, v3Feed?.trending]);

  const curatedItems = useMemo(() => v3Feed?.curated || [], [v3Feed?.curated]);

  const supplementalArticles = useMemo(() => {
    const seen = new Set<string>();
    const merged: FeedItem[] = [];
    for (const item of [...curatedItems, ...uncoveredTrendingArticles]) {
      const key = item.url || item.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged;
  }, [curatedItems, uncoveredTrendingArticles]);

  // Build interleaved feed
  const feedSections = useMemo((): FeedSection[] => {
    if (activeFilter === 'pulse') {
      if (pulseItems.length === 0) return [{ type: 'pulse_empty' }];
      return dedupeFeedSections(
        pulseItems.map((item) => ({ type: 'foryou' as const, item, tapUrl: item.url || undefined }))
      );
    }
    return dedupeFeedSections(
      buildInterleavedFeed(trendingTopics, supplementalArticles, activeFilter, userInterestIds)
    );
  }, [activeFilter, pulseItems, trendingTopics, supplementalArticles, userInterestIds]);

  const deckSections = useMemo((): FeedSection[] => {
    if (feedSections.length === 0) return [];
    const hasPulseEmpty = feedSections.some((s) => s.type === 'pulse_empty');
    if (hasPulseEmpty) return feedSections;
    return [...feedSections, { type: 'deck_end' as const }];
  }, [feedSections]);

  useEffect(() => {
    deckListRef.current?.scrollToOffset({ offset: 0, animated: false });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeFilter]);

  // The first trending topic in the feed is free for non-subscribers
  const firstFreeTrendingId = useMemo(() => {
    const first = feedSections.find((s) => s.type === 'trending');
    return first?.type === 'trending' ? first.topic.id : null;
  }, [feedSections]);

  const handleTopicPress = useCallback((topic: TrendingTopic) => {
    const isFree = topic.id === firstFreeTrendingId;
    setCurrentTopic(topic, isFree);
    router.push('/topic');
    InteractionManager.runAfterInteractions(() => {
      const firstEvent = topic.timeline?.[0];
      const firstArticle = topic.articles?.[0];
      logReadingEvent({
        eventType: 'feed_open',
        itemId: topic.id,
        title: topic.title,
        url: firstEvent?.article_url || firstArticle?.url || '',
        tags: topic.tags,
        itemType: 'topic',
        feedCategory: 'trending_topic',
      });
    });
  }, [router, firstFreeTrendingId]);

  const handleItemPress = useCallback((item: FeedItem) => {
    const patchedItem = patchForYouItem(item);
    // Convert FeedItem to TrendingTopic shape so topic.tsx can render it
    const body = patchedItem.summary?.short_article?.body || patchedItem.description || '';
    const asTopic: TrendingTopic = {
      id: patchedItem.id,
      topic_key: patchedItem.id,
      title: patchedItem.title,
      summary: body,
      key_points: patchedItem.summary?.short_article?.key_takeaways,
      thumbnail: patchedItem.thumbnail,
      source_count: 1,
      article_count: 1,
      interest_id: patchedItem.interest_id,
      tags: patchedItem.tags,
      first_seen_at: patchedItem.published_date,
      articles: [patchedItem],
      timeline: [{
        id: patchedItem.id,
        source_name: patchedItem.source_name || patchedItem.source || '',
        title: patchedItem.title,
        summary: patchedItem.description || '',
        article_url: patchedItem.url,
        timestamp: patchedItem.published_date || '',
      }],
    };
    setCurrentTopic(asTopic);
    router.push('/topic');
    InteractionManager.runAfterInteractions(() => {
      logReadingEvent({
        eventType: 'feed_open',
        itemId: patchedItem.id,
        title: patchedItem.title,
        url: patchedItem.url,
        tags: patchedItem.tags,
        itemType: patchedItem.type || patchedItem.source,
        feedCategory: patchedItem.metadata?.feed_category || patchedItem.feed_type,
      });
    });
  }, [router]);

  const isEmpty = feedSections.length === 0;



  const firstName = getFirstName(profile);

  const onDeckViewportLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setDeckViewportH(h);
  }, []);

  const refreshControlEl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      tintColor={Colors[colorScheme].foreground}
    />
  );

  const renderPills = () => (
    <View style={styles.pillsSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContainer}>
        {filterPills.map((pill) => {
          const isActive = activeFilter === pill.id;
          const isPulse = pill.id === 'pulse';
          const accent = isPulse ? PULSE_COLOR : ACCENT_ORANGE;
          return (
            <Pressable
              key={pill.id}
              onPress={() => {
                setActiveFilter(pill.id);
                trackEvent('feed_filter_changed', { filter: pill.id, label: pill.label });
              }}
              style={[
                styles.pill,
                isPulse && styles.pillPulse,
                {
                  backgroundColor: isActive ? accent : `${accent}15`,
                  borderColor: isActive ? accent : `${accent}30`,
                },
              ]}>
              <Text
                style={[
                  styles.pillText,
                  {
                    color: isActive ? '#fff' : isPulse ? PULSE_COLOR : Colors[colorScheme].text,
                    fontFamily: isActive ? FontFamily.semiBold : FontFamily.regular,
                  },
                ]}>
                {pill.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.viewToggleWrap, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f0f0f0' }]}>
        <Pressable
          onPress={() => {
            setViewMode('card');
            trackEvent('feed_view_mode_changed', { mode: 'card' });
            setUserProperty({ preferred_view_mode: 'card' });
          }}
          style={[
            styles.viewToggleBtn,
            viewMode === 'card' && { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#fff' },
          ]}>
          <LayoutGrid
            size={16}
            color={Colors[colorScheme].text}
            strokeWidth={2}
            opacity={viewMode === 'card' ? 1 : 0.55}
          />
        </Pressable>
        <Pressable
          onPress={() => {
            setViewMode('list');
            trackEvent('feed_view_mode_changed', { mode: 'list' });
            setUserProperty({ preferred_view_mode: 'list' });
          }}
          style={[
            styles.viewToggleBtn,
            viewMode === 'list' && { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#fff' },
          ]}>
          <List
            size={16}
            color={Colors[colorScheme].text}
            strokeWidth={2}
            opacity={viewMode === 'list' ? 1 : 0.55}
          />
        </Pressable>
      </View>
    </View>
  );

  const renderDeckChrome = () => (
    <View style={{ backgroundColor: Colors[colorScheme].background }}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
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
      </View>

      {Platform.OS === 'android' && showUpdateBanner && (
        <Pressable
          onPress={() =>
            WebBrowser.openBrowserAsync('https://play.google.com/store/apps/details?id=online.yourtrace.app')
          }
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

      {renderPills()}
    </View>
  );

  const deckKeyExtractor = useCallback((item: FeedSection, index: number) => {
    if (item.type === 'trending') return `t-${item.topic.id}`;
    if (item.type === 'foryou') return `f-${item.item.id}`;
    if (item.type === 'deck_end') return 'deck-end';
    if (item.type === 'pulse_empty') return 'pulse-empty';
    return `s-${index}`;
  }, []);

  const deckRowHeight = useMemo(() => Math.max(240, deckViewportH), [deckViewportH]);

  const deckCardWidth = useMemo(
    () => Math.min(DECK_CARD_MAX_WIDTH, windowWidth - 32),
    [windowWidth],
  );

  const getDeckItemLayout = useCallback(
    (_data: ArrayLike<FeedSection> | null | undefined, index: number) => {
      const len = Math.max(1, deckRowHeight);
      return { length: len, offset: len * index, index };
    },
    [deckRowHeight],
  );

  const renderDeckItem = useCallback(
    ({ item: section, index }: { item: FeedSection; index: number }) => {
      const rowH = Math.max(1, deckRowHeight);
      const nextSection = deckSections[index + 1];
      const nextTitle =
        nextSection?.type === 'trending'
          ? nextSection.topic.title
          : nextSection?.type === 'foryou'
          ? nextSection.item.title
          : undefined;
      const inset = DECK_CARD_MARGIN_TOP + DECK_CARD_MARGIN_BOTTOM;
      const cardH = Math.max(220, rowH - inset);
      const wrap = (child: React.ReactNode) => (
        <View
          style={[
            styles.deckRow,
            {
              height: rowH,
              paddingTop: DECK_CARD_MARGIN_TOP,
              paddingBottom: DECK_CARD_MARGIN_BOTTOM,
            },
          ]}>
          {child}
        </View>
      );
      if (section.type === 'deck_end') {
        return wrap(
          <View style={[styles.deckPage, { height: cardH }]}>
            <TouchGrassFooter colorScheme={colorScheme} />
          </View>,
        );
      }
      if (section.type === 'pulse_empty') {
        return wrap(
          <View style={[styles.deckPage, { height: cardH, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 }]}>
            <Text style={{ fontSize: 36 }}>⚡</Text>
            <Text style={{ fontFamily: FontFamily.semiBold, fontSize: 17, color: PULSE_COLOR, textAlign: 'center' }}>
              Pulse drops daily
            </Text>
            <Text style={{ fontFamily: FontFamily.regular, fontSize: 14, color: Colors[colorScheme].muted, textAlign: 'center', lineHeight: 21 }}>
              Top tools, reads, and discussions curated for your morning. Check back tomorrow.
            </Text>
          </View>,
        );
      }
      if (section.type === 'trending') {
        const isLocked = !isProUser && section.topic.id !== firstFreeTrendingId;
        const topic = section.topic;
        const deckOverview = getTopicOverviewForDeck(topic);
        const primaryArticle = topic.articles?.[0];
        const shareTitle = primaryArticle?.title || topic.title;
        const shareUrl = buildTopicCardShareUrl(topic, primaryArticle) || '';
        return wrap(
          <DeckStoryCard
            variant="trending"
            topic={topic}
            overviewText={deckOverview}
            colorScheme={colorScheme}
            height={cardH}
            cardWidth={deckCardWidth}
            shareTitle={shareTitle}
            shareOverview={deckOverview}
            shareUrl={shareUrl}
            onPress={() => handleTopicPress(topic)}
            pressEnabled={!deckScrolling}
            nextTitle={nextTitle}
            locked={isLocked}
          />,
        );
      }
      if (section.type === 'foryou') {
        const patched = patchForYouItem(section.item);
        const isPulseCard = !!section.tapUrl;
        const rawOverview = getFeedItemOverview(section.item);
        const deckOverview = isPulseCard
          ? truncateByWords(rawOverview, 80)
          : rawOverview;
        return wrap(
          <DeckStoryCard
            variant="foryou"
            item={section.item}
            overviewText={deckOverview}
            colorScheme={colorScheme}
            height={cardH}
            cardWidth={deckCardWidth}
            shareTitle={patched.title}
            shareOverview={deckOverview}
            shareUrl={buildArticleShareUrl(patched) || ''}
            onPress={isPulseCard
              ? () => WebBrowser.openBrowserAsync(section.tapUrl!)
              : () => handleItemPress(section.item)}
            pressEnabled={!deckScrolling}
            swipeHint={isPulseCard ? 'Tap to read full story' : undefined}
            nextTitle={nextTitle}
            locked={!isProUser}
          />,
        );
      }
      return wrap(<View style={{ height: cardH }} />);
    },
    [colorScheme, deckRowHeight, deckCardWidth, deckScrolling, firstFreeTrendingId, handleItemPress, handleTopicPress, isProUser, deckSections],
  );

  const renderListItem = useCallback(
    ({ item: section }: { item: FeedSection }) => {
      let onPress = () => {};
      if (section.type === 'trending') {
        onPress = () => handleTopicPress(section.topic);
      } else if (section.type === 'foryou') {
        const isPulseCard = !!section.tapUrl;
        onPress = isPulseCard
          ? () => WebBrowser.openBrowserAsync(section.tapUrl!)
          : () => handleItemPress(section.item);
      }
      return (
        <MemoizedListStoryItem
          section={section}
          colorScheme={colorScheme}
          onPress={onPress}
        />
      );
    },
    [colorScheme, handleItemPress, handleTopicPress],
  );

  const getListItemType = useCallback((section: FeedSection) => section.type, []);

  const showFeed = !isLoading && hasRenderableFeed && !isEmpty && !(isFeedBuilding && isEmpty);

  return (
    <View style={[styles.deckRoot, { backgroundColor: Colors[colorScheme].background }]}>
      {showFeed ? (
        <>
          {renderDeckChrome()}
          {viewMode === 'list' ? (
            <FlashList
              ref={listRef}
              data={feedSections}
              keyExtractor={deckKeyExtractor}
              renderItem={renderListItem}
              getItemType={getListItemType}
              drawDistance={320}
              showsVerticalScrollIndicator={false}
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
            />
          ) : (
            <View style={styles.deckListWrap} onLayout={onDeckViewportLayout}>
              <FlatList
                ref={deckListRef}
                data={deckSections}
                keyExtractor={deckKeyExtractor}
                renderItem={renderDeckItem}
                getItemLayout={getDeckItemLayout}
                extraData={`${deckViewportH}-${deckRowHeight}-${deckCardWidth}-${deckScrolling}`}
                snapToInterval={deckRowHeight}
                snapToAlignment="start"
                decelerationRate="fast"
                disableIntervalMomentum
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                windowSize={7}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                updateCellsBatchingPeriod={50}
                refreshControl={refreshControlEl}
                onScrollBeginDrag={onDeckScrollBegin}
                onMomentumScrollBegin={onDeckScrollBegin}
                onScrollEndDrag={onDeckScrollEnd}
                onMomentumScrollEnd={onDeckScrollEnd}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig.current}
              />
              {(() => {
                const nextSection = deckSections[currentDeckIndex + 1];
                const nextTitle =
                  nextSection?.type === 'trending'
                    ? nextSection.topic.title
                    : nextSection?.type === 'foryou'
                    ? nextSection.item.title
                    : null;
                const isDark = colorScheme === 'dark';
                return (
                  <View style={[styles.upNextBar, { backgroundColor: isDark ? '#1a1a1a' : '#ebebeb', paddingBottom: 16 + insets.bottom }]}>
                    {nextTitle ? (
                      <View style={styles.upNextRow}>
                        <Text style={[styles.upNextLabel, { color: isDark ? '#8C8C8C' : '#B8B8B8' }]}>Up next</Text>
                        <Text style={[styles.upNextTitle, { color: isDark ? '#F2F2F2' : '#1B1B1B' }]} numberOfLines={1}>
                          {nextTitle}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })()}
            </View>
          )}
        </>
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControlEl}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}>
          {renderDeckChrome()}
          {(isLoading || !hasRenderableFeed) ? (
            <SkeletonLoader colorScheme={colorScheme} viewMode={viewMode} />
          ) : isFeedBuilding && isEmpty ? (
            <View style={styles.padded}>
              <FeedBuildingLoader colorScheme={colorScheme} />
            </View>
          ) : (
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
          )}
        </Animated.ScrollView>
      )}
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

const GRASS_EMOJIS = ['🌱', '🌿', '🍃', '☘️', '🌾', '🪴'];

function FloatingEmoji({ emoji, index, onComplete }: { emoji: string; index: number; onComplete: () => void }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.5);
  const rotation = useSharedValue(0);

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * 120;
    const delay = index * 80;

    translateY.value = withDelay(
      delay,
      withTiming(-180, { duration: 1200, easing: Easing.out(Easing.cubic) })
    );
    translateX.value = withDelay(
      delay,
      withSequence(
        withTiming(randomX * 0.5, { duration: 400 }),
        withTiming(randomX, { duration: 800, easing: Easing.out(Easing.quad) })
      )
    );
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1.2, { damping: 8, stiffness: 200 }),
        withTiming(0.6, { duration: 800 })
      )
    );
    rotation.value = withDelay(
      delay,
      withTiming((Math.random() - 0.5) * 60, { duration: 1200 })
    );
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(800, withTiming(0, { duration: 400 }))
      )
    );

    const timer = setTimeout(() => {
      runOnJS(onComplete)();
    }, delay + 1300);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[grassStyles.floatingEmoji, animatedStyle]}>
      {emoji}
    </Animated.Text>
  );
}

function ListStoryItem({
  section,
  colorScheme,
  onPress,
}: {
  section: FeedSection;
  colorScheme: 'light' | 'dark';
  onPress: () => void;
}) {
  if (section.type === 'deck_end') {
    return (
      <View style={styles.listItem}>
        <TouchGrassFooter colorScheme={colorScheme} />
      </View>
    );
  }

  let sourceName = '';
  let title = '';
  let timeAgo = '';
  let imageUrl: string | null = null;

  if (section.type === 'trending') {
    const topic = section.topic;
    const primaryArticle = topic.articles?.[0];
    sourceName = primaryArticle?.source_name || primaryArticle?.source || 'Sources';
    title = decodeHtmlEntities(primaryArticle?.title || topic.title);
    timeAgo = getTimeAgo(topic.last_updated_at || topic.first_seen_at);
    imageUrl = getArticleImage(topic.thumbnail || primaryArticle?.thumbnail, title);
  } else if (section.type === 'foryou') {
    const item = section.item;
    sourceName = item.source_name || item.source || '';
    title = decodeHtmlEntities(item.title);
    timeAgo = getTimeAgo(item.published_date);
    imageUrl = getArticleImage(item.thumbnail, title);
  } else if (section.type === 'pulse_empty') {
    return (
      <View style={[styles.listItem, styles.listPulseEmpty]}>
        <Text style={{ fontSize: 28 }}>⚡</Text>
        <Text style={[styles.listPulseTitle, { color: PULSE_COLOR }]}>
          Pulse drops daily
        </Text>
        <Text style={[styles.listPulseSub, { color: Colors[colorScheme].muted }]}>
          Top tools, reads, and discussions curated for your morning. Check back tomorrow.
        </Text>
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.listItem}>
      <View style={styles.listContent}>
        <View style={styles.listTextCol}>
          <View style={styles.listSourceRow}>
            <Text style={[styles.listSourceText, { color: Colors[colorScheme].muted }]}>
              {sourceName}
            </Text>
            {timeAgo ? (
              <>
                <Text style={[styles.listDot, { color: Colors[colorScheme].border }]}> · </Text>
                <Text style={[styles.listTimeText, { color: Colors[colorScheme].muted }]}>
                  {timeAgo}
                </Text>
              </>
            ) : null}
          </View>
          <Text style={[styles.listTitle, { color: Colors[colorScheme].text }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {imageUrl && (
          <ExpoImage
            source={imageUrl}
            style={styles.listThumb}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={imageUrl}
            transition={80}
          />
        )}
      </View>
    </Pressable>
  );
}

const MemoizedListStoryItem = React.memo(
  ListStoryItem,
  (prev, next) => prev.section === next.section && prev.colorScheme === next.colorScheme,
);

function TouchGrassFooter({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const [emojis, setEmojis] = useState<{ id: number; emoji: string }[]>([]);
  const [celebrating, setCelebrating] = useState(false);
  const idCounter = useRef(0);
  const textScale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (celebrating) return;
    setCelebrating(true);

    // Animate text bounce
    textScale.value = withSequence(
      withSpring(0.9, { damping: 10, stiffness: 400 }),
      withSpring(1.1, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );

    // Spawn emojis
    const newEmojis = Array.from({ length: 8 }, () => ({
      id: idCounter.current++,
      emoji: GRASS_EMOJIS[Math.floor(Math.random() * GRASS_EMOJIS.length)],
    }));
    setEmojis(newEmojis);

    setTimeout(() => {
      setCelebrating(false);
      setEmojis([]);
    }, 1500);
  }, [celebrating, textScale]);

  const handleEmojiComplete = useCallback(() => {
    // Individual emoji animation complete
  }, []);

  const textAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: textScale.value }],
  }));

  return (
    <View style={grassStyles.container}>
      <Pressable onPress={handlePress} style={grassStyles.pressable}>
        <View style={grassStyles.emojiContainer}>
          {emojis.map((item, index) => (
            <FloatingEmoji
              key={item.id}
              emoji={item.emoji}
              index={index}
              onComplete={handleEmojiComplete}
            />
          ))}
        </View>
        <Animated.View style={textAnimatedStyle}>
          <ThemedText style={[styles.congratsTitle, { color: Colors[colorScheme].text }]}>
            You&apos;re all caught up! 🎉
          </ThemedText>
          <ThemedText style={[styles.congratsSub, { color: Colors[colorScheme].muted }]}>
            Congratulations, you&apos;ve completed all the stories for now.
          </ThemedText>
          <ThemedText style={[styles.endText, { color: Colors[colorScheme].muted, marginTop: 16 }]}>
            Time to touch some grass 🌱
          </ThemedText>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const grassStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 48,
    minHeight: 320,
    justifyContent: 'center',
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingEmoji: {
    position: 'absolute',
    fontSize: 28,
  },
});

function SkeletonLoader({ colorScheme, viewMode }: { colorScheme: 'light' | 'dark'; viewMode: 'card' | 'list' }) {
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

  if (viewMode === 'list') {
    return (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.skeletonListItem, { borderBottomColor: colorScheme === 'dark' ? '#1a1a1a' : '#f0f0f0' }]}>
            <View style={{ flex: 1, gap: 8 }}>
              <Animated.View style={[{ width: 80, height: 10, borderRadius: 4, backgroundColor: skeletonBg }, shimmerStyle]} />
              <Animated.View style={[{ width: '90%', height: 14, borderRadius: 4, backgroundColor: skeletonBg }, shimmerStyle]} />
            </View>
            <Animated.View style={[{ width: 72, height: 72, borderRadius: 10, backgroundColor: skeletonBg }, shimmerStyle]} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.skeletonContainer}>
      <Animated.View
        style={[
          styles.skeletonDeckCard,
          { backgroundColor: skeletonBg },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  deckRoot: { flex: 1 },
  deckListWrap: { flex: 1, position: 'relative' },
  upNextBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 22,
  },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upNextLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    letterSpacing: 0.06,
    flexShrink: 0,
  },
  upNextTitle: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.06,
    flex: 1,
    minWidth: 0,
  },

  // List view styles
  listItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  listContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  listTextCol: {
    flex: 1,
    gap: 5,
  },
  listSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  listSourceText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  listDot: {
    fontSize: 11,
  },
  listTimeText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
  },
  listTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  listThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  listPulseEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  listPulseTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    textAlign: 'center',
  },
  listPulseSub: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },

  deckPage: {
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  deckRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingBottom: 60, flexGrow: 1 },
  padded: { paddingHorizontal: 20, },

  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 50,
  },
  syncBannerText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },

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
    fontFamily: FontFamily.semiBold,
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
    gap: 2,
  },
  headerGreeting: {
    fontSize: 24,
    fontFamily: FontFamilySerif.bold,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
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
    fontFamily: FontFamily.bold,
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
    fontFamily: FontFamily.bold,
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
    fontFamily: FontFamily.semiBold,
  },
  updateBannerSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
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
    width: SCREEN_WIDTH - 80,
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
    color: 'rgba(0,0,0,0.95)',
    fontFamily: FontFamilySerif.semiBold,
    lineHeight: 24,
  },
  forYouCardPreview: {
    fontSize: 13,
    color: 'rgba(55,55,55,0.8)',
    fontFamily: FontFamily.regular,
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
    fontFamily: FontFamily.semiBold,
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
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  pillsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillPulse: {
    paddingHorizontal: 16,
  },
  pillText: {
    fontSize: 13,
  },
  viewToggleWrap: {
    marginLeft: 8,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  viewToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Ongoing Section - Figma style
  ongoingHeader: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 4,
  },
  ongoingTitle: {
    fontSize: 19,
    fontFamily: FontFamilySerif.semiBold,
    marginBottom: 10,
  },
  ongoingList: {
    paddingHorizontal: 20,
  },
  ongoingRowPadded: {
    paddingHorizontal: 20,
  },
  ongoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  ongoingBody: {
    flex: 1,
    gap: 8,
  },
  ongoingTitle2: {
    fontSize: 15,
    fontFamily: FontFamilySerif.semiBold,
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
    fontFamily: FontFamily.semiBold,
  },
  ongoingMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: META_GREEN,
  },
  ongoingThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
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
  errorTitle: { fontSize: 20, fontFamily: FontFamily.bold, marginBottom: 8 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryButton: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 140,
    alignItems: 'center',
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontFamily: FontFamily.semiBold },

  endText: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: FontFamily.regular,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingVertical: 32,
  },
  congratsTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontFamily: FontFamily.semiBold,
    letterSpacing: -0.3,
    lineHeight: 28,
    marginBottom: 8,
  },
  congratsSub: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
    paddingHorizontal: 24,
  },

  // Skeleton styles
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    minHeight: 360,
  },
  skeletonDeckCard: {
    flex: 1,
    minHeight: 420,
    borderRadius: 20,
    marginBottom: 12,
  },
  skeletonListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 14,
    borderBottomWidth: 1,
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
    letterSpacing: -0.3,
    marginBottom: 8,
    fontFamily: FontFamily.bold,
  },
  subtitle: { fontSize: 15, fontFamily: FontFamily.regular, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  dots: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  hint: { fontSize: 13, fontFamily: FontFamily.regular, lineHeight: 20, textAlign: 'center' },
});
