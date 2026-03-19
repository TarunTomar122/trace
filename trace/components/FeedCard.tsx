import { useState, useRef } from 'react';
import he from 'he';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Clock,
  ChevronRight,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { FeedItem } from '@/lib/firestore';
import { getArticleImage } from '@/lib/fallback-images';

/* ─── Shared utilities ────────────────────────────────────── */

function getSourceInitials(name: string): string {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
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

const ACCENT = '#F59E0B';

function stripMd(text: string): string {
  return (text || '')
    .replace(/^Slide\s*\d+:\s*/i, '') // Strip "Slide N:" prefix
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function splitParagraphs(text?: string): string[] {
  if (!text) return [];
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  return normalized.split(/\n\s*\n/).filter(Boolean);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ─── Types ───────────────────────────────────────────────── */

type CardProps = {
  item: FeedItem;
  colorScheme: 'light' | 'dark';
  onPress?: () => void;
  accentColor?: string;
};

/* ═══════════════════════════════════════════════════════════
   0. TrendingStoryCard — compact card for horizontal carousel
   ═══════════════════════════════════════════════════════════ */

export const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CAROUSEL_CARD_HEIGHT = 300;

export function TrendingStoryCard({ item, colorScheme, onPress }: CardProps) {
  const sourceName = item.source_name || item.source || '';
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(item.published_date);
  const fallbackUrl = getArticleImage(null, item.title);
  const [imageUrl, setImageUrl] = useState(getArticleImage(item.thumbnail, item.title));

  return (
    <Pressable onPress={onPress} style={csStyles.card}>
      <Image
        source={{ uri: imageUrl }}
        style={csStyles.image}
        resizeMode="cover"
        onError={() => setImageUrl(fallbackUrl)}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={csStyles.gradient}
      />
      <View style={csStyles.overlay}>
        <View style={csStyles.sourceRow}>
          <View style={[csStyles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={csStyles.avatarText}>{initials}</Text>
          </View>
          <Text style={csStyles.sourceName} numberOfLines={1}>
            {sourceName}
          </Text>
          {timeAgo !== '' && (
            <>
              <Text style={csStyles.dot}>·</Text>
              <Text style={csStyles.time}>{timeAgo}</Text>
            </>
          )}
        </View>
        <Text style={csStyles.title} numberOfLines={3}>
          {he.decode(item.title)}
        </Text>
      </View>
    </Pressable>
  );
}

const csStyles = StyleSheet.create({
  card: {
    width: CAROUSEL_CARD_WIDTH,
    height: CAROUSEL_CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 1,
  },
  dot: { fontFamily: FontFamily.regular, fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  time: { fontFamily: FontFamily.regular, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  title: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 18,
    color: '#fff',
    lineHeight: 24,
    letterSpacing: -0.3,
  },
});

/* ═══════════════════════════════════════════════════════════
   1. TrendingCard — Instagram-style carousel with swipe
   ═══════════════════════════════════════════════════════════ */

const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = 420;

export function TrendingCard({ item, colorScheme, onPress, accentColor = '#F97316' }: CardProps) {
  const sourceName = item.source_name || item.source || '';
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(item.published_date);
  const fallbackUrl = getArticleImage(null, item.title); // Always get fallback based on title
  const [imageUrl, setImageUrl] = useState(getArticleImage(item.thumbnail, item.title));
  const handleImageError = () => setImageUrl(fallbackUrl);

  // Get carousel data from summary
  const headline = stripMd(item.summary?.short_article?.headline || item.summary?.short_article?.subtitle || '');
  const slides: string[] = item.summary?.short_article?.slides || [];
  // Fallback for old format: split body into slides
  const fallbackSlides = (() => {
    if (slides.length > 0) return slides;
    const body = item.summary?.short_article?.body || '';
    if (!body) return item.description ? [item.description] : [];
    return splitParagraphs(body).slice(0, 3);
  })();

  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 1 + fallbackSlides.length; // image slide + text slides

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const slide = Math.round(x / CARD_WIDTH);
    setCurrentSlide(slide);
  };

  const textBg = colorScheme === 'dark' ? '#1a1a1a' : '#fff';

  return (
    <View style={tStyles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH}
        contentContainerStyle={{ paddingRight: 0 }}
      >
        {/* Slide 0: Hero image with headline overlay */}
        <View style={[tStyles.slide, { width: CARD_WIDTH }]}>
          <View style={tStyles.heroWrap}>
            <Image source={{ uri: imageUrl }} style={tStyles.heroImg} resizeMode="cover" onError={handleImageError} />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={tStyles.gradient}
            />
            <View style={tStyles.overlayContent}>
              {/* Source badge */}
              <View style={tStyles.sourceBadge}>
                <View style={[tStyles.avatar, { backgroundColor: avatarBg }]}>
                  <Text style={tStyles.avatarText}>{initials}</Text>
                </View>
                <Text style={tStyles.sourceNameOverlay} numberOfLines={1}>
                  {sourceName}
                </Text>
                {timeAgo !== '' && (
                  <>
                    <Text style={tStyles.dotOverlay}>·</Text>
                    <Text style={tStyles.timeOverlay}>{timeAgo}</Text>
                  </>
                )}
              </View>
              {/* Title */}
              <Text style={tStyles.titleOverlay} numberOfLines={4}>
                {he.decode(item.title)}
              </Text>
              {/* Headline hook */}
              {headline !== '' && (
                <Text style={tStyles.headlineOverlay} numberOfLines={2}>
                  {headline}
                </Text>
              )}
              {/* Swipe hint */}
              {fallbackSlides.length > 0 && (
                <View style={tStyles.swipeHint}>
                  <Text style={tStyles.swipeText}>Swipe for more</Text>
                  <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Slides 1-3: Text detail slides */}
        {fallbackSlides.map((slideText, idx) => {
          const slideBg = colorScheme === 'dark'
            ? `rgba(249, 115, 22, 0.06)` // subtle orange tint dark
            : `rgba(249, 115, 22, 0.03)`; // subtle orange tint light
          return (
            <View
              key={idx}
              style={[tStyles.slide, tStyles.textSlide, { width: CARD_WIDTH, backgroundColor: slideBg }]}
            >
              <View style={tStyles.textSlideInner}>
                {/* Header row */}
                <View style={tStyles.slideHeader}>
                  <View style={tStyles.slideHeaderLeft}>
                    <View style={[tStyles.avatar, { backgroundColor: avatarBg }]}>
                      <Text style={tStyles.avatarText}>{initials}</Text>
                    </View>
                    <View>
                      <Text style={[tStyles.sourceName, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                        {sourceName}
                      </Text>
                      <Text style={[tStyles.slideLabel, { color: accentColor }]}>
                        TOP STORY
                      </Text>
                    </View>
                  </View>
                  <Text style={[tStyles.slideNum, { color: Colors[colorScheme].muted }]}>
                    {idx + 2}/{totalSlides}
                  </Text>
                </View>

                {/* Main text content */}
                <Text style={[tStyles.slideText, { color: Colors[colorScheme].text }]}>
                  {stripMd(slideText)}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Pagination dots */}
      <View style={tStyles.pagination}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <View
            key={i}
            style={[
              tStyles.dot,
              {
                backgroundColor: i === currentSlide ? accentColor : Colors[colorScheme].border,
                width: i === currentSlide ? 16 : 6,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const tStyles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  slide: {
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 0,
  },
  heroWrap: {
    flex: 1,
    position: 'relative',
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  overlayContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceNameOverlay: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    flexShrink: 1,
  },
  dotOverlay: { fontFamily: FontFamily.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  timeOverlay: { fontFamily: FontFamily.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  titleOverlay: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 22,
    color: '#fff',
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  headlineOverlay: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 21,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  swipeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  textSlide: {
    padding: 0,
  },
  textSlideInner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  slideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  slideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sourceName: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
  slideLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 2,
  },
  slideNum: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    opacity: 0.6,
  },
  slideText: {
    fontFamily: FontFamily.regular,
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});

/* ═══════════════════════════════════════════════════════════
   2. ForYouCard — accent left bar, match badges, actions
   ═══════════════════════════════════════════════════════════ */

export function ForYouCard({ item, colorScheme, onPress, accentColor = ACCENT }: CardProps) {
  const sourceName = item.source_name || (item.type === 'video' ? 'Video Brief' : item.source || '');
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(item.published_date);
  const snippet = item.summary?.short_article?.subtitle || item.description || '';
  const takeaways = (item.summary?.short_article?.key_takeaways || [])
    .map((point) => stripMd(String(point)))
    .filter(Boolean)
    .slice(0, 2);
  const readTime = item.summary?.reading_time_minutes;
  const fallbackUrl = getArticleImage(null, item.title);
  const [imageUrl, setImageUrl] = useState(getArticleImage(item.thumbnail, item.title));
  const handleImageError = () => setImageUrl(fallbackUrl);

  return (
    <Pressable onPress={onPress} style={fyStyles.container}>
      {/* Hero image at top */}
      <View style={fyStyles.heroWrap}>
        <Image
          source={{ uri: imageUrl }}
          style={fyStyles.heroImg}
          resizeMode="cover"
          onError={handleImageError}
        />
      </View>

      {/* Source row */}
      <View style={fyStyles.sourceRow}>
        <View style={[fyStyles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={fyStyles.avatarText}>{initials}</Text>
        </View>
        <Text
          style={[fyStyles.sourceName, { color: Colors[colorScheme].muted }]}
          numberOfLines={1}>
          {sourceName}
        </Text>
        {timeAgo !== '' && (
          <>
            <Text style={[fyStyles.dot, { color: Colors[colorScheme].border }]}>·</Text>
            <Text style={[fyStyles.time, { color: Colors[colorScheme].muted }]}>{timeAgo}</Text>
          </>
        )}
      </View>

      {/* Title */}
      <Text
        style={[fyStyles.title, { color: Colors[colorScheme].text }]}
        numberOfLines={3}>
        {item.title}
      </Text>

      {/* Snippet */}
      {snippet !== '' && (
        <Text
          style={[fyStyles.snippet, { color: Colors[colorScheme].muted }]}
          numberOfLines={2}>
          {stripMd(snippet)}
        </Text>
      )}

      {takeaways.length > 0 && (
        <View style={fyStyles.takeawaysWrap}>
          {takeaways.map((point, index) => (
            <View key={`${item.id}-takeaway-${index}`} style={fyStyles.takeawayRow}>
              <View style={[fyStyles.takeawayDot, { backgroundColor: accentColor }]} />
              <Text
                style={[fyStyles.takeawayText, { color: Colors[colorScheme].text }]}
                numberOfLines={2}>
                {point}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer: read time */}
      {readTime != null && (
        <View style={fyStyles.footerRow}>
          <View style={fyStyles.readTimePill}>
            <Clock size={12} color={Colors[colorScheme].muted} strokeWidth={1.8} />
            <Text style={[fyStyles.readTimeText, { color: Colors[colorScheme].muted }]}>
              {readTime} min read
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const fyStyles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  heroWrap: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    flexShrink: 1,
  },
  dot: { fontFamily: FontFamily.regular, fontSize: 12 },
  time: { fontFamily: FontFamily.regular, fontSize: 12 },
  title: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  snippet: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  takeawaysWrap: {
    gap: 8,
    marginTop: 8,
  },
  takeawayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  takeawayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  takeawayText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  readTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  readTimeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
  },
  actionBtn: {
    padding: 6,
    marginLeft: 12,
  },
});

/* ═══════════════════════════════════════════════════════════
   3. DeepDiveCard — elevated card, key sections, longer reads
   ═══════════════════════════════════════════════════════════ */

export function DeepDiveCard({ item, colorScheme, onPress, accentColor = '#0EA5E9' }: CardProps) {
  const sourceName = item.source_name || item.source || '';
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(item.published_date);
  const snippet = item.summary?.short_article?.subtitle || item.description || '';
  const readTime = item.summary?.reading_time_minutes;
  const sections = item.summary?.short_article?.outline;
  const fallbackUrl = getArticleImage(null, item.title);
  const [imageUrl, setImageUrl] = useState(getArticleImage(item.thumbnail, item.title));
  const handleImageError = () => setImageUrl(fallbackUrl);
  const accent = accentColor;

  const cardBg = colorScheme === 'dark' ? '#161616' : '#f5f5f0';

  return (
    <Pressable onPress={onPress} style={[ddStyles.card, { backgroundColor: cardBg }]}>
      {/* Hero image - always shown */}
      <View style={ddStyles.heroWrap}>
        <Image
          source={{ uri: imageUrl }}
          style={ddStyles.heroImg}
          resizeMode="cover"
          onError={handleImageError}
        />
      </View>

      {/* Header: avatar + source + read time */}
      <View style={ddStyles.topRow}>
        <View style={ddStyles.sourceGroup}>
          <View style={[ddStyles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={ddStyles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={[ddStyles.sourceName, { color: Colors[colorScheme].text }]}>
              {sourceName}
            </Text>
            <Text style={[ddStyles.date, { color: Colors[colorScheme].muted }]}>
              {timeAgo || 'Today'}
            </Text>
          </View>
        </View>
        <View style={ddStyles.topActions}>
          {readTime != null && (
            <View style={[ddStyles.readTimeBadge, { borderColor: accent }]}>
              <Clock size={12} color={accent} strokeWidth={2} />
              <Text style={[ddStyles.readTimeText, { color: accent }]}>{readTime} min</Text>
            </View>
          )}
        </View>
      </View>

      {/* Title */}
      <Text
        style={[ddStyles.title, { color: Colors[colorScheme].text }]}
        numberOfLines={3}>
        {item.title}
      </Text>

      {/* Snippet */}
      {snippet !== '' && (
        <Text
          style={[ddStyles.snippet, { color: Colors[colorScheme].muted }]}
          numberOfLines={3}>
          {snippet}
        </Text>
      )}

      {/* One-line sections preview */}
      {sections && sections.length > 0 && (
        <Text
          style={[ddStyles.sectionsPreview, { color: Colors[colorScheme].muted }]}
          numberOfLines={1}>
          {sections.slice(0, 3).join(' · ')}
        </Text>
      )}
    </Pressable>
  );
}

const ddStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  heroWrap: {
    height: 180,
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sourceGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
  date: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    marginTop: 2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  readTimeText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
  },
  title: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  snippet: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  sectionsPreview: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },
});

/* ═══════════════════════════════════════════════════════════
   Legacy FeedCard — kept for unsubscribed/fallback feed
   ═══════════════════════════════════════════════════════════ */

export function FeedCard({ item, colorScheme, onPress }: CardProps) {
  const sourceName = item.source_name || item.source || '';
  const snippet = item.summary?.short_article?.subtitle || item.description || '';
  const readTime = item.summary?.reading_time_minutes;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (item.url) {
      WebBrowser.openBrowserAsync(item.url);
    }
  };

  return (
    <Pressable style={legacyStyles.container} onPress={handlePress}>
      <View style={legacyStyles.textContent}>
        <ThemedText
          style={[legacyStyles.sourceLabel, { color: Colors[colorScheme].muted }]}
          numberOfLines={1}>
          {sourceName || 'Article'}
        </ThemedText>
        <ThemedText style={legacyStyles.title} numberOfLines={3}>
          {he.decode(item.title)}
        </ThemedText>
        {snippet !== '' && (
          <ThemedText
            style={[legacyStyles.snippet, { color: Colors[colorScheme].muted }]}
            numberOfLines={2}>
            {snippet}
          </ThemedText>
        )}
        {readTime != null && (
          <View style={legacyStyles.footer}>
            <Clock size={11} color={Colors[colorScheme].muted} strokeWidth={1.8} />
            <ThemedText style={[legacyStyles.readTime, { color: Colors[colorScheme].muted }]}>
              {readTime} min read
            </ThemedText>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const legacyStyles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  textContent: {
    gap: 6,
  },
  sourceLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
  },
  title: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  snippet: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  readTime: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
  },
});
