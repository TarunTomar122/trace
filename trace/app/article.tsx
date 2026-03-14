import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Bookmark,
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
import { isBookmarked as checkBookmarked, toggleBookmark, addSnippet } from '@/lib/bookmarks';
import { getCurrentArticle, getNextArticle, navigateToNext, getArticleList, getCurrentIndex } from '@/lib/article-store';
import { logReadingEvent } from '@/lib/reading-analytics';
import { updateStreak } from '@/lib/streaks';
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

type LearningCard = {
  type: 'hook' | 'insight' | 'why' | 'bottom_line';
  emoji: string;
  content: string;
};

type SourceRef = {
  name: string;
  title: string;
  url: string;
};

type Chapter = {
  title: string;
  content: string;
  quote?: {
    text: string;
    source: string;
  };
};

type DeepDiveContent = {
  subtitle?: string;
  tldr?: string;
  chapters?: Chapter[];
  bottom_line?: {
    title: string;
    content: string;
  };
  images?: string[];
};

type WorthReadingContent = {
  paragraphs?: string[];
};

function buildWorthReadingParagraphsFromBody(body: string, fallbacks?: string[]): string[] {
  const normalized = String(body || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (normalized) {
    const paragraphs = normalized
      .split(/\n\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (paragraphs.length > 0) return paragraphs.slice(0, 8);
  }
  return (fallbacks || []).filter(Boolean).slice(0, 8);
}


function WorthReadingArticleView({
  content,
  title,
  sourceName,
  thumbnail,
  publishedDate,
  colorScheme,
  onBack,
  onReadOriginal,
  onBookmark,
  isBookmarked,
  nextArticle,
  onNextArticle,
}: {
  content: WorthReadingContent;
  title: string;
  sourceName: string;
  thumbnail?: string;
  publishedDate?: string;
  colorScheme: 'light' | 'dark';
  onBack: () => void;
  onReadOriginal: () => void;
  onBookmark: () => void;
  isBookmarked: boolean;
  nextArticle?: { title: string; sourceName: string; thumbnail?: string } | null;
  onNextArticle?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const imageUrl = getArticleImage(thumbnail ?? null, title);
  const timeAgo = getTimeAgo(publishedDate);
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);

  // Scroll-hide header
  const scrollY = useSharedValue(0);
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
      scrollY.value = currentY;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const renderWorthReadingLine = (line: string, key: string | number) => {
    if (line.startsWith('### ')) {
      return (
        <RichText key={key} style={[wrStyles.sectionH3, { color: Colors[colorScheme].text }]}>
          {line.replace(/^###\s*/, '')}
        </RichText>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <RichText key={key} style={[wrStyles.sectionH2, { color: Colors[colorScheme].text }]}>
          {line.replace(/^##\s*/, '')}
        </RichText>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <View key={key} style={wrStyles.listRow}>
          <View style={[wrStyles.listDot, { backgroundColor: ACCENT }]} />
          <RichText style={[wrStyles.listText, { color: Colors[colorScheme].text }]}>
            {line.replace(/^[-*]\s*/, '')}
          </RichText>
        </View>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      return (
        <View key={key} style={wrStyles.listRow}>
          <Text style={[wrStyles.listNumber, { color: Colors[colorScheme].muted }]}>
            {line.match(/^(\d+)\./)?.[1]}.
          </Text>
          <RichText style={[wrStyles.listText, { color: Colors[colorScheme].text }]}>
            {line.replace(/^\d+\.\s*/, '')}
          </RichText>
        </View>
      );
    }
    return (
      <RichText key={key} style={[wrStyles.paragraphText, { color: Colors[colorScheme].text }]}>
        {line}
      </RichText>
    );
  };

  return (
    <View style={[wrStyles.root, { backgroundColor: Colors[colorScheme].background }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 84 }}>
        {/* Hero image */}
        <View style={wrStyles.heroWrap}>
          <Image source={{ uri: imageUrl }} style={wrStyles.heroImage} resizeMode="cover" />
          {/* Overlay for dimming */}
          <View style={wrStyles.heroOverlayDim} />
          {/* Bottom gradient fade to background */}
          <LinearGradient
            colors={['transparent', Colors[colorScheme].background]}
            style={wrStyles.heroGradient}
          />
        </View>

        {/* Title section below hero */}
        <View style={wrStyles.titleSection}>
          <Text numberOfLines={4} style={[wrStyles.heroTitle, { color: Colors[colorScheme].text }]}>
            {title}
          </Text>
          <View style={wrStyles.sourceRow}>
            <View style={[wrStyles.sourceAvatar, { backgroundColor: avatarBg }]}>
              <Text style={wrStyles.sourceAvatarText}>{initials}</Text>
            </View>
            <Text style={[wrStyles.sourceText, { color: Colors[colorScheme].muted }]}>
              {sourceName || 'Source'}
              {timeAgo ? ` · ${timeAgo}` : ''}
            </Text>
          </View>
        </View>

        <View style={wrStyles.content}>

          {content.paragraphs && content.paragraphs.length > 0 ? (
            <View style={[wrStyles.sectionCard, { backgroundColor: isDark ? '#111827' : '#f8fafc' }]}>
              {content.paragraphs.map((paragraph, index) => {
                const lines = paragraph
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean);
                return (
                  <View
                    key={index}
                    style={index < content.paragraphs!.length - 1 ? wrStyles.blockGap : null}>
                    {lines.map((line, lineIndex) => renderWorthReadingLine(line, `${index}-${lineIndex}`))}
                  </View>
                );
              })}
            </View>
          ) : null}

          {nextArticle && onNextArticle ? (
            <Pressable
              onPress={onNextArticle}
              style={[wrStyles.nextBtn, { backgroundColor: Colors[colorScheme].card }]}>
              <View style={wrStyles.nextBtnContent}>
                <Text style={[wrStyles.nextLabel, { color: Colors[colorScheme].muted }]}>UP NEXT</Text>
                <Text numberOfLines={1} style={[wrStyles.nextTitle, { color: Colors[colorScheme].text }]}>
                  {nextArticle.title}
                </Text>
              </View>
              <ChevronRight size={20} color={Colors[colorScheme].muted} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* Floating header */}
      <Animated.View style={[wrStyles.floatingHeader, headerAnimatedStyle]}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={wrStyles.floatingHeaderRow}>
            <Pressable onPress={onBack} hitSlop={12} style={wrStyles.floatingBtn}>
              <ChevronLeft size={22} color="#000" strokeWidth={2} />
            </Pressable>
            <View style={wrStyles.floatingHeaderRight}>
              <Pressable onPress={onBookmark} hitSlop={12} style={wrStyles.floatingBtn}>
                <Bookmark
                  size={20}
                  color="#000"
                  strokeWidth={isBookmarked ? 2 : 1.8}
                  fill={isBookmarked ? '#000' : 'transparent'}
                />
              </Pressable>
              <Pressable onPress={onReadOriginal} hitSlop={12} style={wrStyles.floatingBtn}>
                <ExternalLink size={18} color="#000" strokeWidth={1.8} />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      </View>
  );
}

const wrStyles = StyleSheet.create({
  root: { flex: 1 },
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
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  heroTitle: {
    fontSize: 25,
    lineHeight: 32,
    letterSpacing: -0.4,
    fontFamily: FontFamilySerif.bold,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sourceAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceAvatarText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: FontFamily.bold,
  },
  sourceText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  sectionCard: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 6,
    gap: 10,
  },
  sectionH2: {
    fontSize: 19,
    fontFamily: FontFamilySerif.semiBold,
    lineHeight: 25,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  sectionH3: {
    fontSize: 15,
    fontFamily: FontFamilySerif.semiBold,
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  paragraphText: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 25,
  },
  blockGap: {
    marginBottom: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
  },
  listDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
  },
  listNumber: {
    width: 18,
    fontSize: 13,
    lineHeight: 22,
    fontFamily: FontFamily.regular,
    textAlign: 'right',
  },
  listText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 24,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  nextBtnContent: {
    flex: 1,
    gap: 2,
  },
  nextLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.2,
  },
  nextTitle: {
    fontSize: 15,
    fontFamily: FontFamilySerif.semiBold,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  bottomButtonText: {
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

/* ═══════════════════════════════════════════════════════════
   ChapterDeepDive — overview page + chapter detail views
   ═══════════════════════════════════════════════════════════ */

function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
}

function ChapterDeepDive({
  title,
  thumbnail,
  deepDive,
  sources,
  readingTime,
  colorScheme,
  onBack,
  onSaveSnippet,
}: {
  title: string;
  thumbnail?: string;
  deepDive: DeepDiveContent;
  sources?: SourceRef[];
  readingTime?: number;
  colorScheme: 'light' | 'dark';
  onBack: () => void;
  onSaveSnippet: (content: string, label: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [openChapter, setOpenChapter] = useState<number | null>(null);
  const isDark = colorScheme === 'dark';
  const showHero = isLikelyRealImageUrl(thumbnail);
  const chapters = deepDive.chapters || [];
  const cardBg = isDark ? '#1a1a1a' : '#f7f7f5';

  // Scroll-hide header animation
  const scrollY = useSharedValue(0);
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
      scrollY.value = currentY;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const handleSave = (key: string, content: string, label: string) => {
    if (savedSections.has(key)) return;
    setSavedSections(prev => new Set(prev).add(key));
    onSaveSnippet(content, label);
  };

  /* ── Chapter detail view ── */
  if (openChapter !== null && chapters[openChapter]) {
    const chapter = chapters[openChapter];
    const idx = openChapter;
    const chapterKey = `chapter_${idx}`;
    const chapterContent = chapter.quote
      ? `${chapter.content}\n\n"${chapter.quote.text}" — ${chapter.quote.source}`
      : chapter.content;
    const paragraphs = splitParagraphs(chapter.content);

    return (
      <View style={[dd.root, { backgroundColor: Colors[colorScheme].background }]}>
        {/* Top bar */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors[colorScheme].background }}>
          <View style={dd.chDetailBar}>
            <Pressable onPress={() => setOpenChapter(null)} hitSlop={12} style={dd.chDetailBackBtn}>
              <ChevronLeft size={22} color={Colors[colorScheme].text} strokeWidth={2} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[dd.chDetailBarLabel, { color: Colors[colorScheme].muted }]}>
                Chapter {idx + 1} of {chapters.length}
              </Text>
            </View>
            <Pressable
              onPress={() => handleSave(chapterKey, chapterContent, `${title} - ${chapter.title}`)}
              hitSlop={8}
              style={dd.chDetailBackBtn}>
              <Bookmark
                size={20}
                color={savedSections.has(chapterKey) ? ACCENT : Colors[colorScheme].muted}
                strokeWidth={savedSections.has(chapterKey) ? 2.5 : 1.5}
              />
            </Pressable>
          </View>
        </SafeAreaView>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={dd.chDetailScroll}>
          <Text style={[dd.chDetailTitle, { color: Colors[colorScheme].text }]}>
            {chapter.title}
          </Text>

          {paragraphs.map((para, pi) => (
            <RichText
              key={pi}
              style={[
                dd.chDetailPara,
                { color: Colors[colorScheme].text },
              ]}>
              {para}
            </RichText>
          ))}

          {chapter.quote && (
            <View style={[dd.quoteBlock, { borderLeftColor: isDark ? '#444' : '#d4d4d4' }]}>
              <Text style={[dd.quoteText, { color: Colors[colorScheme].text }]}>
                "{chapter.quote.text}"
              </Text>
              <Text style={[dd.quoteSource, { color: Colors[colorScheme].muted }]}>
                — {chapter.quote.source}
              </Text>
            </View>
          )}

          {/* Prev / Next navigation */}
          <View style={dd.chNav}>
            {idx > 0 ? (
              <Pressable
                style={[dd.chNavBtn, { backgroundColor: cardBg }]}
                onPress={() => setOpenChapter(idx - 1)}>
                <ChevronLeft size={18} color={Colors[colorScheme].muted} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={[dd.chNavHint, { color: Colors[colorScheme].muted }]}>Previous</Text>
                  <Text style={[dd.chNavLabel, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                    {chapters[idx - 1].title}
                  </Text>
                </View>
              </Pressable>
            ) : <View style={{ flex: 1 }} />}
            {idx < chapters.length - 1 ? (
              <Pressable
                style={[dd.chNavBtn, dd.chNavBtnRight, { backgroundColor: cardBg }]}
                onPress={() => setOpenChapter(idx + 1)}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[dd.chNavHint, { color: Colors[colorScheme].muted }]}>Next</Text>
                  <Text style={[dd.chNavLabel, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                    {chapters[idx + 1].title}
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors[colorScheme].muted} strokeWidth={2} />
              </Pressable>
            ) : (
              <Pressable
                style={[dd.chNavBtn, dd.chNavBtnRight, { backgroundColor: cardBg }]}
                onPress={() => setOpenChapter(null)}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[dd.chNavHint, { color: Colors[colorScheme].muted }]}>Done</Text>
                  <Text style={[dd.chNavLabel, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                    Back to overview
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors[colorScheme].muted} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ── Overview page ── */
  return (
    <View style={[dd.root, { backgroundColor: Colors[colorScheme].background }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>

        {/* Hero */}
        <View style={dd.heroWrap}>
          {showHero ? (
            <Image source={{ uri: thumbnail }} style={dd.heroImage} resizeMode="cover" />
          ) : (
            <View style={[dd.heroImage, { backgroundColor: isDark ? '#1c1c1c' : '#222' }]} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent']}
            style={dd.heroGradientTop}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', Colors[colorScheme].background]}
            locations={[0, 0.5, 1]}
            style={dd.heroGradientBottom}
          />
          <View style={dd.heroOverlay}>
            <View style={dd.heroBadge}>
              <GraduationCap size={12} color="#fff" strokeWidth={2.5} />
              <Text style={dd.heroBadgeText}>Deep Dive</Text>
            </View>
            <Text numberOfLines={3} style={dd.heroTitle}>{title}</Text>
            <View style={dd.heroMeta}>
              {readingTime != null && (
                <Text style={dd.heroMetaText}>{readingTime} min read</Text>
              )}
              {chapters.length > 0 && (
                <Text style={dd.heroMetaText}>· {chapters.length} chapters</Text>
              )}
            </View>
          </View>
        </View>

        {/* TL;DR */}
        {deepDive.tldr && (
          <View style={dd.section}>
            <View style={dd.sectionHeaderRow}>
              <Text style={[dd.sectionLabel, { color: Colors[colorScheme].muted }]}>TL;DR</Text>
              <Pressable
                onPress={() => handleSave('tldr', deepDive.tldr!, `${title} - TL;DR`)}
                hitSlop={8}>
                <Bookmark
                  size={18}
                  color={savedSections.has('tldr') ? ACCENT : Colors[colorScheme].muted}
                  strokeWidth={savedSections.has('tldr') ? 2.5 : 1.5}
                />
              </Pressable>
            </View>
            <RichText style={[dd.sectionBody, { color: Colors[colorScheme].text }]}>
              {deepDive.tldr}
            </RichText>
          </View>
        )}

        {deepDive.subtitle && (
          <View style={dd.section}>
            <Text style={[dd.subtitleText, { color: Colors[colorScheme].muted }]}>
              {deepDive.subtitle}
            </Text>
          </View>
        )}

        {/* Chapter list */}
        {chapters.length > 0 && (
          <View style={dd.section}>
            <Text style={[dd.sectionLabel, { color: Colors[colorScheme].muted, marginBottom: 14 }]}>
              Chapters
            </Text>
            {chapters.map((ch, i) => (
              <Pressable
                key={i}
                onPress={() => setOpenChapter(i)}
                style={[dd.tocRow, { backgroundColor: cardBg }]}>
                <View style={[dd.tocNum, { backgroundColor: isDark ? '#2a2a2a' : '#e8e8e6' }]}>
                  <Text style={[dd.tocNumText, { color: Colors[colorScheme].text }]}>{i + 1}</Text>
                </View>
                <Text style={[dd.tocTitle, { color: Colors[colorScheme].text }]} numberOfLines={2}>
                  {ch.title}
                </Text>
                <ChevronRight size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Bottom line */}
        {deepDive.bottom_line && (
          <View style={dd.section}>
            <View style={dd.sectionHeaderRow}>
              <Text style={[dd.sectionLabel, { color: Colors[colorScheme].muted }]}>
                {deepDive.bottom_line.title || 'The Bottom Line'}
              </Text>
              <Pressable
                onPress={() => handleSave('bottom_line', deepDive.bottom_line!.content, `${title} - Bottom Line`)}
                hitSlop={8}>
                <Bookmark
                  size={18}
                  color={savedSections.has('bottom_line') ? ACCENT : Colors[colorScheme].muted}
                  strokeWidth={savedSections.has('bottom_line') ? 2.5 : 1.5}
                />
              </Pressable>
            </View>
            <RichText style={[dd.sectionBody, { color: Colors[colorScheme].text }]}>
              {deepDive.bottom_line.content}
            </RichText>
          </View>
        )}

        {/* Sources */}
        {sources && sources.length > 0 && (
          <View style={dd.section}>
            <Text style={[dd.sectionLabel, { color: Colors[colorScheme].muted, marginBottom: 12 }]}>
              Sources
            </Text>
            {sources.map((src, i) => (
              <Pressable
                key={i}
                onPress={() => WebBrowser.openBrowserAsync(src.url)}
                style={[dd.sourceRow, { backgroundColor: cardBg }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[dd.sourceName, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                    {src.name}
                  </Text>
                  <Text style={[dd.sourceTitle, { color: Colors[colorScheme].muted }]} numberOfLines={2}>
                    {src.title}
                  </Text>
                </View>
                <ExternalLink size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
              </Pressable>
            ))}
          </View>
        )}
      </Animated.ScrollView>

      {/* Floating back button - animated hide on scroll */}
      <Animated.View style={[dd.floatingHeader, headerAnimatedStyle]}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }} pointerEvents="box-none">
          <View style={dd.floatingHeaderRow}>
            <Pressable onPress={onBack} hitSlop={12} style={dd.floatingBtn}>
              <ChevronLeft size={24} color="#fff" strokeWidth={2.5} />
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const dd = StyleSheet.create({
  root: { flex: 1 },

  // Floating header (overview)
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
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  floatingBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    marginHorizontal: 4,
  },

  // Hero
  heroWrap: { position: 'relative' },
  heroImage: { width: '100%', height: 320 },
  heroGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 1,
  },
  heroGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  heroBadgeText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: FontFamilySerif.bold,
    lineHeight: 31,
    letterSpacing: -0.4,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255,255,255,0.7)',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 26,
  },
  subtitleText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // TOC rows
  tocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  tocNum: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tocNumText: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
  },
  tocTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamilySerif.semiBold,
    lineHeight: 20,
  },

  // Chapter detail
  chDetailBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chDetailBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chDetailBarLabel: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  chDetailScroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 60,
  },
  chDetailTitle: {
    fontSize: 26,
    fontFamily: FontFamilySerif.bold,
    lineHeight: 34,
    letterSpacing: -0.4,
    marginBottom: 24,
  },
  chDetailPara: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 26,
    marginBottom: 16,
  },

  // Quote
  quoteBlock: {
    borderLeftWidth: 3,
    paddingLeft: 16,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 15,
    fontFamily: FontFamilySerif.regular,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  quoteSource: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    marginTop: 8,
  },

  // Chapter prev/next nav
  chNav: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 32,
  },
  chNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
  },
  chNavBtnRight: {},
  chNavHint: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  chNavLabel: {
    fontSize: 14,
    fontFamily: FontFamilySerif.semiBold,
    lineHeight: 19,
  },

  // Sources
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 8,
  },
  sourceName: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  sourceTitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
});

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

  const [bookmarked, setBookmarked] = useState(false);
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
      setBookmarked(false);
      checkBookmarked(next.id).then(setBookmarked);
    }
  };

  useEffect(() => {
    if (!item) {
      return;
    }
    checkBookmarked(item.id).then(setBookmarked);
    logReadingEvent({
      eventType: 'summary_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      itemType: item.type || item.source,
      feedCategory: item.metadata?.feed_category || item.feed_type,
    });
    updateStreak();
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

  const handleToggleBookmark = async () => {
    if (!isProUser) {
      presentPaywall();
      return;
    }
    const nowBookmarked = await toggleBookmark(item);
    setBookmarked(nowBookmarked);
    showToast(nowBookmarked ? 'Saved' : 'Removed', 'success');
  };

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
  const learningCards = item.summary?.short_article?.learning_cards;
  const worthReadingParagraphs = buildWorthReadingParagraphsFromBody(
    rawBody,
    keyTakeaways && keyTakeaways.length > 0 ? keyTakeaways : undefined,
  );
  const worthReadingSummary = (
    worthReadingParagraphs.length > 0
      ? { paragraphs: worthReadingParagraphs }
      : item.summary?.worth_reading
  ) as WorthReadingContent | undefined;
  const hasWorthReadingSummary = Boolean(
    worthReadingSummary
    && worthReadingSummary.paragraphs
    && worthReadingSummary.paragraphs.length > 0
  );
  const hasLearningCards = learningCards && learningCards.length > 0;
  const deepDiveContent = item.summary?.deep_dive as DeepDiveContent | undefined;
  const isChapterDeepDive = deepDiveContent?.chapters && deepDiveContent.chapters.length > 0;
  const hasAccess = isProUser || item.feed_type === 'trending';

  const imageUrl = getArticleImage(item.thumbnail ?? null, item.title);
  const sourceName = item.source_name || item.source || '';
  const timeAgo = getTimeAgo(item.published_date);
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const isDark = colorScheme === 'dark';

  const bodyLines: string[] = [];
  for (const block of body.split(/\n\n+/)) {
    const lines = block.split(/\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) bodyLines.push(trimmed);
    }
  }

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
        <RichText key={index} style={[nStyles.bodyH2, { color: textColor }]}>{line.replace(/^##\s*/, '')}</RichText>
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

  // Route: deep dive
  if (hasAccess && isChapterDeepDive) {
    return (
      <ChapterDeepDive
        title={item.title}
        thumbnail={item.thumbnail ?? undefined}
        deepDive={deepDiveContent!}
        sources={item.sources}
        readingTime={readingTime}
        colorScheme={colorScheme}
        onBack={() => router.back()}
        onSaveSnippet={async (content, label) => {
          await addSnippet(content, label);
          showToast('Saved', 'success');
        }}
      />
    );
  }

  if (hasAccess && (hasWorthReadingSummary || hasLearningCards) && !isTrending) {
    // Convert learning cards to paragraphs if no worth_reading content
    const content: WorthReadingContent = worthReadingSummary
      || { paragraphs: (learningCards as LearningCard[])?.map(c => c.content) || [] };
    return (
      <WorthReadingArticleView
        content={content}
        title={item.title}
        sourceName={sourceName}
        thumbnail={item.thumbnail ?? undefined}
        publishedDate={item.published_date}
        colorScheme={colorScheme}
        onBack={() => router.back()}
        onReadOriginal={handleReadOriginal}
        onBookmark={handleToggleBookmark}
        isBookmarked={bookmarked}
        nextArticle={nextArticleData}
        onNextArticle={handleNextArticle}
      />
    );
  }

  // Route: immersive news/trending view (also serves as default + paywall)
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
            {item.title}
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

              {bodyLines.map((line, i) => renderLine(line, i))}

              {whyItMatters && (
                <View style={[nStyles.whyCard, { backgroundColor: isDark ? '#1a1a1a' : '#f9fafb' }]}>
                  <Text style={[nStyles.whyLabel, { color: ACCENT }]}>WHY IT MATTERS</Text>
                  <RichText style={[nStyles.whyText, { color: Colors[colorScheme].text }]}>
                    {whyItMatters}
                  </RichText>
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
                    <Crown size={16} color="#fff" strokeWidth={2} />
                    <Text style={nStyles.paywallBtnText}>Unlock full access</Text>
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
            <Pressable onPress={handleToggleBookmark} hitSlop={12} style={nStyles.floatingBtn}>
              <Bookmark
                size={20}
                color="#000"
                strokeWidth={bookmarked ? 2 : 1.8}
                fill={bookmarked ? '#000' : 'transparent'}
              />
            </Pressable>
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
    backgroundColor: '#F59E0B',
    paddingHorizontal: 28,
    paddingVertical: 14,
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
