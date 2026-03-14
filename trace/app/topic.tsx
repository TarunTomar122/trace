import { useMemo, useCallback, useState, useRef } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import RNShare from 'react-native-share';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Share2, Bookmark } from 'lucide-react-native';

import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentTopic } from '@/lib/topic-store';
import { setCurrentArticle } from '@/lib/article-store';
import type { FeedItem, TopicTimelineEvent } from '@/lib/firestore';

function RichText({ children, style, selectable = true }: { children: string; style?: any; selectable?: boolean }) {
  const parts = children.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return (
    <Text style={style} selectable={selectable}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <Text key={i} style={[style, { fontFamily: FontFamily.bold }]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <Text key={i} style={[style, { fontStyle: 'italic' }]}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

function formatAge(value?: string): string {
  if (!value) return '';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hours ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#0ea5e9', '#10b981', '#f59e0b'];
  return palette[Math.abs(hash) % palette.length];
}

function isSafeImageUri(uri?: string | null): uri is string {
  const value = String(uri || '').trim();
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file://');
}

function truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
  if (!text || text.length <= maxLength) return { text: text || '', truncated: false };
  return { text: text.substring(0, maxLength).trim() + '...', truncated: true };
}

function splitSummaryParagraphs(text: string): { first: string; rest: string } {
  const value = (text || '').trim();
  if (!value) return { first: '', rest: '' };
  const parts = value.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length < 2) return { first: value, rest: '' };
  return {
    first: parts[0].trim(),
    rest: parts.slice(1).join(' ').trim(),
  };
}

export default function TopicScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const topic = getCurrentTopic();

  // Scroll-hide header animation
  const lastScrollY = useSharedValue(0);
  const headerTranslateY = useSharedValue(0);
  const HEADER_HEIGHT = 60 + insets.top;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      const diff = currentY - lastScrollY.value;

      if (currentY > HEADER_HEIGHT) {
        if (diff > 0) {
          headerTranslateY.value = withTiming(-HEADER_HEIGHT, { duration: 200 });
        } else if (diff < -5) {
          headerTranslateY.value = withTiming(0, { duration: 200 });
        }
      } else {
        headerTranslateY.value = withTiming(0, { duration: 200 });
      }

      lastScrollY.value = currentY;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const timeline = useMemo(() => {
    const events = Array.isArray(topic?.timeline) ? [...topic.timeline] : [];
    events.sort((a: TopicTimelineEvent, b: TopicTimelineEvent) => {
      const at = new Date(a.timestamp || '').getTime();
      const bt = new Date(b.timestamp || '').getTime();
      return at - bt;
    });
    return events;
  }, [topic]);

  const articlesByUrl = useMemo(() => {
    const map = new Map<string, FeedItem>();
    for (const article of topic?.articles ?? []) {
      if (article.url) map.set(article.url, article);
    }
    return map;
  }, [topic]);

  const handleTimelinePress = useCallback(
    (event: TopicTimelineEvent) => {
      const url = event.article_url;
      if (!url) return;
      const article = articlesByUrl.get(url);
      if (article && article.summary && Object.keys(article.summary).length > 0) {
        setCurrentArticle(article);
        router.push('/article');
      }
    },
    [articlesByUrl, router],
  );

  if (!topic) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: Colors[colorScheme].background }]}>
        <View style={[styles.emptyState, { paddingTop: Math.max(insets.top, 24) + 24 }]}>
          <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>Topic unavailable</Text>
          <Text style={[styles.emptyBody, { color: Colors[colorScheme].muted }]}>
            This topic is no longer in memory. Go back to the feed and open it again.
          </Text>
          <Pressable style={styles.emptyButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.emptyButtonText}>Back to feed</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isSingletonTopic = (topic.source_count ?? 0) <= 1 || (topic.article_count ?? 0) <= 1;
  const primaryArticle = isSingletonTopic ? (topic.articles?.[0] ?? null) : null;
  const primaryShort = primaryArticle?.summary?.short_article;
  const displayTitle = primaryArticle?.title || topic.title;
  const displayThumbnail = primaryArticle?.thumbnail || topic.thumbnail;
  const displayBody = primaryShort?.body || topic.summary || '';
  const splitBody = useMemo(() => splitSummaryParagraphs(displayBody), [displayBody]);
  const displayKeyPoints = isSingletonTopic
    ? (primaryShort?.key_takeaways || [])
    : (topic.key_points || []);
  const readingTime = primaryArticle?.summary?.reading_time_minutes;
  const age = formatAge(topic.first_seen_at || topic.last_updated_at);
  const isDark = colorScheme === 'dark';

  const [isSharing, setIsSharing] = useState(false);
  const shareViewRef = useRef<View>(null);

  const handleShare = async () => {
    // Build share message with overview text
    const overview = splitBody.first || displayBody.slice(0, 300);
    const shareMessage = `${overview}\n\nRead more such stories at yourtrace.online`;

    // No thumbnail - share text only
    if (!displayThumbnail) {
      await Share.share({ message: shareMessage });
      return;
    }

    setIsSharing(true);
    try {
      const uri = await captureRef(shareViewRef, {
        format: 'png',
        quality: 1,
      });

      if (Platform.OS === 'ios') {
        // iOS: Use native Share API
        await Share.share({
          url: uri,
          message: shareMessage,
        });
      } else {
        // Android: Use react-native-share for image + text
        await RNShare.open({
          message: shareMessage,
          url: `file://${uri}`,
          type: 'image/png',
        });
      }
    } catch (error: any) {
      // User cancelled share is not an error
      if (error?.message !== 'User did not share') {
        console.error('Error sharing:', error);
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors[colorScheme].background }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>

        {/* Hero image */}
        <View style={styles.heroWrap}>
          {displayThumbnail && isSafeImageUri(displayThumbnail) ? (
            <Image
              source={{ uri: displayThumbnail }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: isDark ? '#1c1c1c' : '#222' }]} />
          )}

          {/* Overlay for dimming */}
          <View style={styles.heroOverlayDim} />

          {/* Bottom gradient fade to background */}
          <LinearGradient
            colors={['transparent', Colors[colorScheme].background]}
            style={styles.heroGradient}
          />
        </View>

        {/* Title section below hero */}
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]} selectable>
            {displayTitle}
          </Text>
          {age ? (
            <View style={styles.ageBadge}>
              <Text style={styles.ageBadgeText}>{age}</Text>
            </View>
          ) : null}
        </View>

        {/* Summary + meta below image, flush with background */}
        <View style={styles.summaryBlock}>
          {splitBody.first ? (
            <RichText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
              {splitBody.first}
            </RichText>
          ) : null}
          {splitBody.rest ? (
            <RichText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
              {splitBody.rest}
            </RichText>
          ) : null}

          {isSingletonTopic && primaryArticle ? (
            <Text style={[styles.meta, { color: Colors[colorScheme].muted }]}>
              {primaryArticle.source_name || 'Source'}
              {readingTime ? ` · ${readingTime} min read` : ''}
            </Text>
          ) : (
            <Text style={[styles.meta, { color: Colors[colorScheme].muted }]}>
              {topic.source_count ?? 0} SOURCES | {topic.article_count ?? 0} UPDATES
            </Text>
          )}
        </View>

        {/* Overview content */}
        <View style={styles.tabContent}>
          {Array.isArray(displayKeyPoints) && displayKeyPoints.length > 0 ? (
            displayKeyPoints.slice(0, 6).map((point, idx) => (
              <View
                key={`kp-${idx}`}
                style={[
                  styles.bulletRow,
                  { borderBottomColor: Colors[colorScheme].border },
                ]}>
                <View style={styles.bulletDot} />
                <RichText style={[styles.bulletText, { color: Colors[colorScheme].text }]}>
                  {point}
                </RichText>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: Colors[colorScheme].muted }]}>
              No overview available yet.
            </Text>
          )}

          {!isSingletonTopic && timeline.length > 0 && (
            <View style={styles.timelineSection}>
              <Text style={styles.timelineLabel}>Timeline</Text>
              {timeline.map((event, idx) => {
                const hasArticle =
                  !!event.article_url && articlesByUrl.has(event.article_url) &&
                  Object.keys(articlesByUrl.get(event.article_url)?.summary ?? {}).length > 0;
                const sourceName = event.source_name || 'Source';
                const summaryData = truncateText(event.summary || '', 100);

                return (
                  <Pressable
                    key={event.id || `ev-${idx}`}
                    onPress={() => handleTimelinePress(event)}
                    disabled={!hasArticle}
                    style={styles.timelineRow}>
                    {/* Yellow left border */}
                    <View style={styles.timelineAccent} />

                    {/* Content */}
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineSource, { color: Colors[colorScheme].muted }]}>
                        {sourceName} <Text style={styles.timelineDot}>•</Text> {formatAge(event.timestamp)}
                      </Text>

                      {/* Title */}
                      <Text style={[styles.timelineTitle, { color: Colors[colorScheme].text }]} selectable>
                        {event.title}
                      </Text>

                      {/* Summary */}
                      {summaryData.text ? (
                        <Text style={[styles.timelineSummary, { color: Colors[colorScheme].muted }]} selectable>
                          {summaryData.text}
                          {summaryData.truncated && hasArticle && (
                            <Text style={styles.readMore}>read more...</Text>
                          )}
                        </Text>
                      ) : null}
                    </View>

                    {/* Chevron */}
                    <View style={styles.timelineChevron}>
                      <ChevronRight size={16} color={Colors[colorScheme].muted} strokeWidth={2} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Floating header over hero image - animated hide on scroll */}
      <Animated.View style={[styles.floatingHeader, headerAnimatedStyle]}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }} pointerEvents="box-none">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
              <ChevronLeft size={22} color="#000" strokeWidth={2} />
            </Pressable>
            <View style={styles.headerRight}>
              <Pressable hitSlop={12} style={styles.headerBtn}>
                <Bookmark size={20} color="#000" strokeWidth={1.8} />
              </Pressable>
              <Pressable onPress={handleShare} hitSlop={12} style={styles.headerBtn} disabled={isSharing}>
                {isSharing ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Share2 size={18} color="#000" strokeWidth={1.8} />
                )}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Hidden share view for capturing */}
      <View style={styles.shareViewContainer} pointerEvents="none">
        <View ref={shareViewRef} style={styles.shareView} collapsable={false}>
          {displayThumbnail ? (
            <Image
              source={{ uri: displayThumbnail }}
              style={styles.shareImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.shareImage, { backgroundColor: '#1a1a1a' }]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.shareGradient}
          />
          <View style={styles.shareTitleContainer}>
            <Text style={styles.shareTitle} numberOfLines={3}>
              {displayTitle}
            </Text>
            <Text style={styles.shareBranding}>trace</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  emptyState: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: FontFamilySerif.bold,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 320,
  },
  emptyButton: {
    backgroundColor: '#111111',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: FontFamily.bold,
  },

  // Floating header over image
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginHorizontal: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Hero
  heroWrap: {
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 260,
  },
  heroOverlayDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(120,120,120,0.2)',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 88,
  },
  // Title section below hero
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: FontFamilySerif.bold,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  ageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff8d28',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ageBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    color: '#fff',
  },
  summaryBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: FontFamily.regular,
  },
  meta: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },

  // Content
  tabContent: {
    paddingTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: FontFamily.regular,
  },
  emptyText: {
    padding: 20,
    fontSize: 14,
  },

  // Timeline
  timelineSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  timelineLabel: {
    fontSize: 20,
    fontFamily: FontFamilySerif.bold,
    color: '#F59E0B',
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineAccent: {
    width: 1,
    backgroundColor: '#F59E0B',
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineSource: {
    marginBottom: 6,
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  timelineDot: {
    color: '#9ca3af',
  },
  timelineTitle: {
    fontSize: 16,
    fontFamily: FontFamilySerif.semiBold,
    lineHeight: 22,
    marginBottom: 4,
  },
  timelineSummary: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 21,
  },
  readMore: {
    color: '#F59E0B',
    fontFamily: FontFamily.regular,
  },
  timelineChevron: {
    justifyContent: 'center',
    paddingLeft: 8,
  },

  // Share view (hidden, for capturing)
  shareViewContainer: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },
  shareView: {
    width: 400,
    height: 500,
    backgroundColor: '#1a1a1a',
  },
  shareImage: {
    width: '100%',
    height: '100%',
  },
  shareGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
  },
  shareTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
  },
  shareTitle: {
    fontSize: 28,
    color: '#fff',
    lineHeight: 34,
    fontFamily: FontFamilySerif.bold,
    marginBottom: 12,
  },
  shareBranding: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
