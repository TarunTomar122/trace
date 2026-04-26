import React, { useState, useEffect, useRef, useCallback } from 'react';
import he from 'he';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  Platform,
  Share,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Youtube,
  Github,
  BookOpen,
  MessageCircle,
  Sparkles,
  Newspaper,
  ExternalLink,
  Share2,
  Flame,
  Clock,
  Crown,
  Lock,
  GraduationCap,
  Zap,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { addSnippet } from '@/lib/bookmarks';
import { getCurrentArticle, getNextArticle, navigateToNext, getArticleList, getCurrentIndex } from '@/lib/article-store';
import { isFreePreview } from '@/lib/topic-store';
import { logReadingEvent } from '@/lib/reading-analytics';
import { recordAppOpen } from '@/lib/streaks';
import { getArticleImage } from '@/lib/fallback-images';

const ACCENT = '#F59E0B';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AVATAR_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#d946ef',
];

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getSourceInitials(name: string): string {
  const value = String(name || '').trim();
  if (!value) return '??';
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase() || '??';
  return `${words[0]?.[0] || ''}${words[1]?.[0] || ''}`.toUpperCase() || '??';
}

function isSafeImageUri(uri?: string | null): uri is string {
  const value = String(uri || '').trim();
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file://');
}

function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isLikelyRealImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const value = url.trim().toLowerCase();
  if (!value.startsWith('http://') && !value.startsWith('https://')) return false;
  if (value.endsWith('.svg')) return false;
  if (value.includes('placeholder') || value.includes('ui-avatars.com')) return false;
  return true;
}

function RichText({ children, style }: { children: string; style?: any }) {
  const parts = children.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return (
    <Text style={style}>
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
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

type SourceRef = {
  name: string;
  title: string;
  url: string;
};

/* ═══════════════════════════════════════════════════════════
   ArticleScreen — main routing + immersive news view
   ═══════════════════════════════════════════════════════════ */

export default function ArticleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const colorScheme = useColorScheme() ?? 'light';
  const { isProUser, presentPaywall } = useRevenueCat();
  const { user } = useAuth();

  const [imgError, setImgError] = useState(false);
  const [articleKey, setArticleKey] = useState(0);
  const [item, setItem] = useState(getCurrentArticle());

  // Get next article for "continue reading" feature
  const nextItem = getNextArticle();
  const nextArticleData = nextItem ? {
    title: nextItem.title,
    sourceName: nextItem.source_name || nextItem.source || '',
    thumbnail: nextItem.thumbnail ?? undefined,
  } : null;

  const handleNextArticle = () => {
    const next = navigateToNext();
    if (next) {
      setItem(next);
      setArticleKey((k) => k + 1);
    }
  };

  useEffect(() => {
    if (!item) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        await logReadingEvent({
          eventType: 'summary_open',
          itemId: item.id,
          title: item.title,
          url: item.url,
          itemType: item.type || item.source,
          feedCategory: item.metadata?.feed_category || item.feed_type,
        });
        await recordAppOpen();
      })();
    });
    return () => handle.cancel();
  }, [item, router]);

  if (!item) {
    return (
      <SafeAreaView style={[nStyles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <View style={[nStyles.emptyState, { paddingTop: Math.max(insets.top, 24) + 24 }]}>
          <Text style={[nStyles.emptyTitle, { color: Colors[colorScheme].text }]}>Article unavailable</Text>
          <Text style={[nStyles.emptyBody, { color: Colors[colorScheme].muted }]}>
            This article is no longer in memory. Go back to the feed and open it again.
          </Text>
          <Pressable style={nStyles.emptyButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={nStyles.emptyButtonText}>Back to feed</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleReadOriginal = () => {
    if (!item.url) return;
    logReadingEvent({
      eventType: 'external_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      itemType: item.type || item.source || 'blog',
    });
    WebBrowser.openBrowserAsync(item.url);
  };

  // Share card capture
  const shareCardRef = useRef<ViewShot>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!shareCardRef.current || isSharing) return;
    setIsSharing(true);

    // Build share message with overview text
    const overview = item.summary?.short_article?.subtitle
      || item.summary?.short_article?.body?.slice(0, 300)
      || item.description
      || '';
    const shareMessage = `${overview}\n\nRead more such stories at yourtrace.online`;

    try {
      const uri = await shareCardRef.current.capture?.();
      if (!uri) {
        // Fallback to text only
        await Share.share({ message: shareMessage });
        return;
      }

      if (Platform.OS === 'ios') {
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
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        console.warn('Share failed:', e);
      }
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, item]);

  const readingTime = item.summary?.reading_time_minutes;
  const rawSlides = item.summary?.short_article?.slides as string[] | undefined;
  const slides = rawSlides?.length
    ? rawSlides.map((s: string) => s.replace(/^Slide\s*\d+:\s*/i, ''))
    : [];
  const rawBody = item.summary?.short_article?.body || '';
  const isTrending = item.feed_type === 'trending' || item.metadata?.feed_type === 'trending';
  const body = (isTrending && slides.length)
    ? slides.join('\n\n')
    : (rawBody.length > 100 ? rawBody : (slides.length ? slides.join('\n\n') : rawBody));
  const subtitle = item.summary?.short_article?.subtitle;
  const keyTakeaways = item.summary?.short_article?.key_takeaways;
  const whyItMatters = item.summary?.short_article?.why_it_matters;
  const hasAccess = isProUser || isFreePreview();

  const imageUrl = getArticleImage(item.thumbnail ?? null, item.title);
  const sourceName = item.source_name || item.source || '';
  const timeAgo = getTimeAgo(item.published_date);
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const isDark = colorScheme === 'dark';

  // Split body into slide blocks (separated by double newlines), then lines within each block
  const bodyBlocks: string[][] = [];
  for (const block of body.split(/\n\n+/)) {
    const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) bodyBlocks.push(lines);
  }

  // For daily briefs (from slides), group consecutive blocks into stories.
  // A new story starts when a block's first line is entirely bold (**...**).
  const storyGroups: string[][][] = [];
  let currentGroup: string[][] = [];
  for (const block of bodyBlocks) {
    const firstLine = block[0] || '';
    const isBoldTitle = /^\*\*[^*]+\*\*$/.test(firstLine.trim());
    if (isBoldTitle && currentGroup.length > 0) {
      storyGroups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(block);
  }
  if (currentGroup.length > 0) storyGroups.push(currentGroup);

  const bodyLines = bodyBlocks.flat();

  const textColor = Colors[colorScheme].text;
  const mutedColor = Colors[colorScheme].muted;

  const renderLine = (line: string, index: number) => {
    if (line.startsWith('### ')) {
      return (
        <RichText key={index} style={[nStyles.bodyH3, { color: textColor }]}>{line.replace(/^###\s*/, '')}</RichText>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <View key={index}>
          {index > 0 && <View style={[nStyles.storyDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8' }]} />}
          <RichText style={[nStyles.bodyH2, { color: textColor }]}>{line.replace(/^##\s*/, '')}</RichText>
        </View>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <View key={index} style={nStyles.bulletRow}>
          <View style={nStyles.bulletDot} />
          <RichText style={[nStyles.bulletText, { color: textColor }]}>{line.replace(/^[-*]\s*/, '')}</RichText>
        </View>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      return (
        <View key={index} style={nStyles.bulletRow}>
          <Text style={[nStyles.bulletNum, { color: mutedColor }]}>{line.match(/^(\d+)\./)?.[1]}.</Text>
          <RichText style={[nStyles.bulletText, { color: textColor }]}>{line.replace(/^\d+\.\s*/, '')}</RichText>
        </View>
      );
    }
    return <RichText key={index} style={[nStyles.bodyText, { color: textColor }]}>{line}</RichText>;
  };

  // Single article view for all trending/for-you content
  return (
    <View style={[nStyles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Hero image */}
        <View style={nStyles.heroSection}>
          {isSafeImageUri(imageUrl) ? (
            <Image
              source={{ uri: imageUrl }}
              style={nStyles.heroImg}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={[nStyles.heroImg, { backgroundColor: isDark ? '#1c1c1c' : '#ece7df' }]} />
          )}
          {/* Overlay for dimming */}
          <View style={nStyles.heroOverlayDim} />
          {/* Bottom gradient fade to background */}
          <LinearGradient
            colors={['transparent', Colors[colorScheme].background]}
            style={nStyles.heroGradient}
          />
        </View>

        {/* Title section below hero */}
        <View style={nStyles.titleSection}>
          <Text numberOfLines={4} style={[nStyles.title, { color: Colors[colorScheme].text }]}>
            {he.decode(item.title)}
          </Text>
          {timeAgo !== '' && (
            <View style={nStyles.ageBadge}>
              <Text style={nStyles.ageBadgeText}>{timeAgo}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={nStyles.content}>
          {subtitle && (
            <Text style={[nStyles.subtitle, { color: Colors[colorScheme].muted }]}>
              {subtitle}
            </Text>
          )}

          {/* Source row */}
          <View style={nStyles.sourceRow}>
            <View style={[nStyles.sourceAvatar, { backgroundColor: avatarBg }]}>
              <Text style={nStyles.sourceAvatarText}>{initials}</Text>
            </View>
            <Text style={[nStyles.sourceName, { color: Colors[colorScheme].muted }]} numberOfLines={1}>
              {sourceName}
              {readingTime != null ? ` · ${readingTime} min` : ''}
            </Text>
          </View>

          {hasAccess ? (
            <View style={nStyles.body}>
              {keyTakeaways && keyTakeaways.length > 0 && (
                <View style={[nStyles.takeawaysCard, { backgroundColor: isDark ? '#1a1a1a' : '#fffbeb' }]}>
                  <Text style={nStyles.takeawaysLabel}>KEY TAKEAWAYS</Text>
                  {keyTakeaways.map((t: string, i: number) => (
                    <View key={i} style={nStyles.bulletRow}>
                      <View style={[nStyles.bulletDot, { backgroundColor: ACCENT }]} />
                      <RichText style={[nStyles.bulletText, { color: Colors[colorScheme].text }]}>
                        {t}
                      </RichText>
                    </View>
                  ))}
                </View>
              )}

              {storyGroups.map((group, groupIdx) => (
                <View key={`story-${groupIdx}`}>
                  {groupIdx > 0 && (
                    <View style={[nStyles.storyDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8' }]} />
                  )}
                  {group.flat().map((line, lineIdx) => renderLine(line, groupIdx * 1000 + lineIdx))}
                </View>
              ))}

              {whyItMatters && (
                <View style={[nStyles.whyCard, { backgroundColor: isDark ? '#1a1a1a' : '#f9fafb' }]}>
                  <Text style={[nStyles.whyLabel, { color: ACCENT }]}>WHY IT MATTERS</Text>
                  <RichText style={[nStyles.whyText, { color: Colors[colorScheme].text }]}>
                    {whyItMatters}
                  </RichText>
                </View>
              )}

              {item.sources && item.sources.length > 0 && (
                <View style={nStyles.inlineSourcesSection}>
                  <Text style={[nStyles.inlineSourcesLabel, { color: mutedColor }]}>Sources</Text>
                  {item.sources.map((src, i) => (
                    <Pressable
                      key={`${src.url}-${i}`}
                      onPress={() => src.url ? WebBrowser.openBrowserAsync(src.url) : undefined}
                      style={[nStyles.inlineSourceCard, { backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa' }]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[nStyles.inlineSourceName, { color: textColor }]} numberOfLines={1}>
                          {src.name}
                        </Text>
                        <Text style={[nStyles.inlineSourceTitle, { color: mutedColor }]} numberOfLines={2}>
                          {he.decode(src.title ?? '')}
                        </Text>
                      </View>
                      <ExternalLink size={16} color={mutedColor} strokeWidth={1.5} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <>
              <View style={nStyles.body}>
                {bodyLines.length > 0 && renderLine(bodyLines[0], 0)}
              </View>

              <View style={nStyles.blurredSection}>
                <View style={{ opacity: 0.12 }}>
                  <View style={[nStyles.fakeLine, { width: '100%', backgroundColor: Colors[colorScheme].foreground }]} />
                  <View style={[nStyles.fakeLine, { width: '88%', backgroundColor: Colors[colorScheme].foreground }]} />
                  <View style={[nStyles.fakeLine, { width: '55%', backgroundColor: Colors[colorScheme].foreground }]} />
                </View>
              </View>

              <View style={nStyles.paywallContainer}>
                <View style={[nStyles.paywallCard, { backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa' }]}>
                  <View style={[nStyles.paywallIcon, { backgroundColor: isDark ? '#2e2216' : '#fffbeb' }]}>
                    <Lock size={22} color={ACCENT} strokeWidth={2} />
                  </View>
                  <Text style={[nStyles.paywallTitle, { color: Colors[colorScheme].text }]}>
                    Read the key takeaways in 2 minutes
                  </Text>
                  <Text style={[nStyles.paywallDesc, { color: Colors[colorScheme].muted }]}>
                    Every article, distilled to what matters most — so you learn more, faster.
                  </Text>
                  <Pressable style={nStyles.paywallBtn} onPress={() => presentPaywall()}>
                    <Text style={nStyles.paywallBtnText}>Start 3-day free trial</Text>
                  </Pressable>
                  <Pressable style={nStyles.readOriginalLink} onPress={handleReadOriginal}>
                    <ExternalLink size={14} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                    <Text style={[nStyles.readOriginalLinkText, { color: Colors[colorScheme].muted }]}>
                      Read original article instead
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating header */}
      <SafeAreaView style={nStyles.floatingHeader} edges={['top']} pointerEvents="box-none">
        <View style={nStyles.floatingHeaderRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={nStyles.floatingBtn}>
            <ChevronLeft size={22} color="#000" strokeWidth={2} />
          </Pressable>
          <View style={nStyles.floatingHeaderRight}>
            {isTrending && (
              <Pressable onPress={handleShare} hitSlop={12} style={nStyles.floatingBtn}>
                <Share2 size={18} color="#000" strokeWidth={1.8} />
              </Pressable>
            )}
            <Pressable onPress={handleReadOriginal} hitSlop={12} style={nStyles.floatingBtn}>
              <ExternalLink size={18} color="#000" strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Hidden share card for capture */}
      <View style={nStyles.shareCardContainer}>
        <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
          <View style={nStyles.shareCard}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={nStyles.shareCardImage} resizeMode="cover" />
            ) : (
              <View style={[nStyles.shareCardImage, { backgroundColor: avatarBg }]} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={nStyles.shareCardGradient}
            />
            <View style={nStyles.shareCardContent}>
              <Text style={nStyles.shareCardTitle} numberOfLines={3}>{item.title}</Text>
              <View style={nStyles.shareCardMeta}>
                <Text style={nStyles.shareCardSource}>{sourceName}</Text>
                <Text style={nStyles.shareCardBrand}>via Trace</Text>
              </View>
            </View>
          </View>
        </ViewShot>
      </View>
    </View>
  );
}

const nStyles = StyleSheet.create({
  container: { flex: 1 },
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

  // Floating header
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  floatingHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingBtn: {
    width: 32,
    height: 32,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginHorizontal: 6,
  },

  // Hero
  heroSection: {
    position: 'relative',
  },
  heroImg: {
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
  ageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff8d28',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ageBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: '#fff',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  title: {
    fontSize: 25,
    lineHeight: 32,
    letterSpacing: -0.4,
    fontFamily: FontFamilySerif.bold,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FontFamily.semiBold,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sourceAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceAvatarText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    color: '#fff',
  },
  sourceName: { fontSize: 13, fontFamily: FontFamily.semiBold, flexShrink: 1 },
  sourceDot: { fontSize: 12 },
  readTime: { fontSize: 12, fontFamily: FontFamily.semiBold },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    marginBottom: 20,
  },
  activeTab: {
    borderBottomWidth: 2,
    paddingBottom: 10,
    marginBottom: -1,
  },
  activeTabText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },

  body: { gap: 14, marginBottom: 24 },
  storyDivider: { height: 1, marginVertical: 20 },
  bodyH2: { fontSize: 19, fontFamily: FontFamilySerif.semiBold, lineHeight: 25, marginTop: 8 },
  bodyH3: { fontSize: 15, fontFamily: FontFamilySerif.semiBold, lineHeight: 20, marginTop: 4 },
  bodyText: { fontSize: 15, fontFamily: FontFamily.regular, lineHeight: 24 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F97316',
    marginTop: 10,
  },
  bulletNum: { fontSize: 15, lineHeight: 24, width: 20, fontFamily: FontFamily.regular },
  bulletText: { fontSize: 15, lineHeight: 24, flex: 1, fontFamily: FontFamily.regular },

  takeawaysCard: {
    borderRadius: 16,
    padding: 18,
    gap: 10,
    marginBottom: 8,
  },
  takeawaysLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.5,
    color: '#b45309',
    marginBottom: 2,
  },
  whyCard: {
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
  },
  whyLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  whyText: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  inlineSourcesSection: {
    marginTop: 10,
    gap: 10,
  },
  inlineSourcesLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  inlineSourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
  },
  inlineSourceName: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  inlineSourceTitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },

  blurredSection: { position: 'relative', marginBottom: 0 },
  fakeLine: { height: 14, borderRadius: 7, marginBottom: 10 },

  paywallContainer: { marginTop: 8, marginBottom: 32 },
  paywallCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  paywallIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  paywallTitle: {
    fontSize: 20,
    fontFamily: FontFamilySerif.bold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  paywallDesc: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  paywallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 999,
    marginTop: 6,
    width: '100%',
  },
  paywallBtnText: { color: '#fff', fontSize: 16, fontFamily: FontFamily.semiBold },
  readOriginalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  readOriginalLinkText: { fontSize: 14, fontFamily: FontFamily.semiBold },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  bottomBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  bottomBarText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  // Share card styles
  shareCardContainer: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  shareCard: {
    width: 400,
    height: 500,
    backgroundColor: '#000',
    position: 'relative',
  },
  shareCardImage: {
    width: '100%',
    height: '100%',
  },
  shareCardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
  },
  shareCardContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
  },
  shareCardTitle: {
    fontSize: 28,
    color: '#fff',
    lineHeight: 36,
    marginBottom: 16,
    fontFamily: FontFamilySerif.bold,
  },
  shareCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareCardSource: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: FontFamily.semiBold,
  },
  shareCardBrand: {
    fontSize: 14,
    color: '#F59E0B',
    fontFamily: FontFamily.semiBold,
  },
});
