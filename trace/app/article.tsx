import React, { useState, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Youtube,
  Github,
  BookOpen,
  MessageCircle,
  Sparkles,
  Newspaper,
  Bookmark,
  ExternalLink,
  Flame,
  Clock,
  Crown,
  Lock,
  GraduationCap,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { isBookmarked as checkBookmarked, toggleBookmark, addSnippet } from '@/lib/bookmarks';
import { getCurrentArticle } from '@/lib/article-store';
import { logReadingEvent } from '@/lib/reading-analytics';

const ACCENT = '#F59E0B';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH;
const FULL_CARD_HEIGHT = SCREEN_HEIGHT - 120; // Full screen minus safe areas

const CARD_TYPE_LABELS: Record<string, string> = {
  hook: 'THE STORY',
  insight: 'KEY INSIGHT',
  why: 'WHY IT MATTERS',
  bottom_line: 'THE BOTTOM LINE',
};

const CARD_COLORS: Record<string, { bg: string; accent: string }> = {
  hook: { bg: '#FFF7ED', accent: '#F97316' },
  insight: { bg: '#EFF6FF', accent: '#3B82F6' },
  why: { bg: '#F0FDF4', accent: '#22C55E' },
  bottom_line: { bg: '#FEF3C7', accent: '#F59E0B' },
};

const SOURCE_CONFIG: Record<
  string,
  { icon: typeof Youtube; color: string; bgColor: { light: string; dark: string }; label: string }
> = {
  video: { icon: Youtube, color: '#ef4444', bgColor: { light: '#fef2f2', dark: '#2a1515' }, label: 'Video' },
  repo: { icon: Github, color: '#8b5cf6', bgColor: { light: '#f5f3ff', dark: '#1f1a2e' }, label: 'Repo' },
  paper: { icon: BookOpen, color: '#3b82f6', bgColor: { light: '#eff6ff', dark: '#1a2332' }, label: 'Paper' },
  blog: { icon: BookOpen, color: '#10b981', bgColor: { light: '#ecfdf5', dark: '#1a2e23' }, label: 'Article' },
  discussion: { icon: MessageCircle, color: '#f59e0b', bgColor: { light: '#fffbeb', dark: '#2e2416' }, label: 'Discussion' },
  tweet: { icon: MessageCircle, color: '#0ea5e9', bgColor: { light: '#f0f9ff', dark: '#1a272e' }, label: 'Thread' },
  launch: { icon: Sparkles, color: '#d946ef', bgColor: { light: '#fdf4ff', dark: '#2a1a2e' }, label: 'Launch' },
  model: { icon: Sparkles, color: '#6366f1', bgColor: { light: '#eef2ff', dark: '#1f1f2e' }, label: 'Model' },
  news: { icon: Newspaper, color: '#f97316', bgColor: { light: '#fff7ed', dark: '#2e2216' }, label: 'News' },
};

function isLikelyRealImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const value = url.trim().toLowerCase();
  if (!value.startsWith('http://') && !value.startsWith('https://')) return false;
  if (value.endsWith('.svg')) return false;
  if (value.includes('placeholder') || value.includes('ui-avatars.com')) return false;
  return true;
}

/** Renders inline markdown: **bold** and *italic* */
function RichText({ children, style }: { children: string; style?: any }) {
  const parts = children.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <Text key={i} style={[style, { fontWeight: '700' }]}>
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

/** Full-screen immersive learning cards view */
function FullScreenLearningCards({
  cards,
  title,
  sourceName,
  sources,
  colorScheme,
  onBack,
  onReadOriginal,
  onBookmark,
  isBookmarked,
}: {
  cards: LearningCard[];
  title: string;
  sourceName: string;
  sources?: SourceRef[];
  colorScheme: 'light' | 'dark';
  onBack: () => void;
  onReadOriginal: () => void;
  onBookmark: () => void;
  isBookmarked: boolean;
}) {
  const isSynthesized = sources && sources.length > 0;
  const [currentCard, setCurrentCard] = useState(0);
  const totalCards = cards.length;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / CARD_WIDTH);
    setCurrentCard(idx);
  };

  const currentType = cards[currentCard]?.type || 'hook';
  const colors = CARD_COLORS[currentType] || CARD_COLORS.hook;
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={[lcStyles.fullScreen, { backgroundColor: isDark ? '#0a0a0a' : colors.bg }]} edges={['top', 'bottom']}>
      {/* Minimal top bar */}
      <View style={lcStyles.topBar}>
        <Pressable onPress={onBack} hitSlop={12} style={lcStyles.backBtn}>
          <ChevronLeft size={24} color={isDark ? '#fff' : '#000'} strokeWidth={2} />
        </Pressable>
        <View style={lcStyles.progressDots}>
          {cards.map((_, i) => (
            <View
              key={i}
              style={[
                lcStyles.dot,
                {
                  backgroundColor: i === currentCard ? colors.accent : (isDark ? '#333' : '#ddd'),
                  width: i === currentCard ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>
        <Pressable onPress={onBookmark} hitSlop={12} style={lcStyles.bookmarkBtn}>
          <Bookmark
            size={22}
            color={isBookmarked ? colors.accent : (isDark ? '#666' : '#999')}
            strokeWidth={isBookmarked ? 2.5 : 1.5}
          />
        </Pressable>
      </View>

      {/* Cards */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH}
      >
        {cards.map((card, idx) => {
          const cardColors = CARD_COLORS[card.type] || CARD_COLORS.hook;
          return (
            <View key={idx} style={[lcStyles.card, { width: CARD_WIDTH }]}>
              {/* Main content area - everything centered */}
              <View style={lcStyles.contentArea}>
                {/* Card type label */}
                <View style={lcStyles.typeRow}>
                  <Text style={lcStyles.emoji}>{card.emoji}</Text>
                  <Text style={[lcStyles.typeLabel, { color: cardColors.accent }]}>
                    {CARD_TYPE_LABELS[card.type] || card.type.toUpperCase()}
                  </Text>
                </View>

                {/* Show title on first card */}
                {idx === 0 && (
                  <View style={lcStyles.titleSection}>
                    <Text style={[lcStyles.sourceLabel, { color: isDark ? '#888' : '#666' }]}>
                      {isSynthesized
                        ? `Synthesized from ${sources!.map(s => s.name).join(', ')}`
                        : sourceName}
                    </Text>
                    <Text style={[lcStyles.articleTitle, { color: isDark ? '#fff' : '#000' }]}>
                      {title}
                    </Text>
                  </View>
                )}

                {/* Card content */}
                <RichText style={[lcStyles.cardText, { color: isDark ? '#e5e5e5' : '#1a1a1a' }]}>
                  {card.content}
                </RichText>
              </View>

              {/* Bottom section */}
              <View style={lcStyles.bottomSection}>
                {idx === totalCards - 1 ? (
                  isSynthesized ? (
                    <View style={lcStyles.sourcesSection}>
                      <Text style={[lcStyles.sourcesLabel, { color: isDark ? '#666' : '#999' }]}>
                        Sources
                      </Text>
                      {sources!.map((src, i) => (
                        <Pressable
                          key={i}
                          onPress={() => WebBrowser.openBrowserAsync(src.url)}
                          style={lcStyles.sourceLink}
                        >
                          <Text style={[lcStyles.sourceLinkText, { color: cardColors.accent }]} numberOfLines={1}>
                            {src.name}: {src.title}
                          </Text>
                          <ExternalLink size={12} color={cardColors.accent} strokeWidth={2} />
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Pressable style={[lcStyles.readOriginalBtn, { backgroundColor: cardColors.accent }]} onPress={onReadOriginal}>
                      <ExternalLink size={18} color="#fff" strokeWidth={2} />
                      <Text style={lcStyles.readOriginalText}>Read Full Article</Text>
                    </Pressable>
                  )
                ) : (
                  <Text style={[lcStyles.swipeHint, { color: isDark ? '#555' : '#999' }]}>
                    Swipe to continue →
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Ebook-style deep dive with paginated chapters */
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
  const [currentPage, setCurrentPage] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);
  const isDark = colorScheme === 'dark';
  const showHeroImage = isLikelyRealImageUrl(thumbnail) && !imgError;

  const handleSave = (key: string, content: string, label: string) => {
    // Prevent double-saving
    if (savedSections.has(key)) return;
    setSavedSections(prev => new Set(prev).add(key));
    onSaveSnippet(content, label);
  };

  const chapters = deepDive.chapters || [];
  // Pages: Cover (0), Chapters (1 to n), Bottom Line + Sources (n+1)
  const totalPages = 1 + chapters.length + 1;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / CARD_WIDTH);
    setCurrentPage(idx);
  };

  const goToPage = (page: number) => {
    scrollViewRef.current?.scrollTo({ x: page * CARD_WIDTH, animated: true });
  };

  return (
    <SafeAreaView style={[ddStyles.container, { backgroundColor: isDark ? '#0a0a0a' : '#fff' }]} edges={['top', 'bottom']}>
      {/* Top bar */}
      <View style={ddStyles.topBar}>
        <Pressable onPress={onBack} hitSlop={12} style={ddStyles.backBtn}>
          <ChevronLeft size={24} color={Colors[colorScheme].foreground} strokeWidth={2} />
        </Pressable>
        <View style={ddStyles.topBarLabel}>
          <GraduationCap size={16} color={ACCENT} strokeWidth={2} />
          <Text style={[ddStyles.topBarLabelText, { color: ACCENT }]}>Deep Dive</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Page indicator */}
      <View style={ddStyles.pageIndicator}>
        {Array.from({ length: totalPages }).map((_, i) => (
          <Pressable key={i} onPress={() => goToPage(i)} hitSlop={8}>
            <View
              style={[
                ddStyles.pageIndicatorDot,
                {
                  backgroundColor: i === currentPage ? ACCENT : (isDark ? '#333' : '#ddd'),
                  width: i === currentPage ? 20 : 8,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* Paginated content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH}
      >
        {/* Page 0: Cover */}
        <View style={[ddStyles.page, { width: CARD_WIDTH }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ddStyles.pageContent}>
            {showHeroImage && (
              <Image
                source={{ uri: thumbnail! }}
                style={ddStyles.coverImage}
                resizeMode="cover"
                onError={() => setImgError(true)}
              />
            )}
            <Text style={[ddStyles.coverTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
            {deepDive.subtitle && (
              <Text style={[ddStyles.coverSubtitle, { color: Colors[colorScheme].secondary }]}>
                {deepDive.subtitle}
              </Text>
            )}
            <View style={ddStyles.coverMeta}>
              {readingTime && (
                <View style={ddStyles.coverMetaItem}>
                  <Clock size={14} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                  <Text style={[ddStyles.coverMetaText, { color: Colors[colorScheme].muted }]}>
                    {readingTime} min
                  </Text>
                </View>
              )}
              {chapters.length > 0 && (
                <View style={ddStyles.coverMetaItem}>
                  <BookOpen size={14} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                  <Text style={[ddStyles.coverMetaText, { color: Colors[colorScheme].muted }]}>
                    {chapters.length} chapters
                  </Text>
                </View>
              )}
            </View>

            {/* TL;DR */}
            {deepDive.tldr && (
              <View style={[ddStyles.tldrCard, { backgroundColor: isDark ? '#1a1a1a' : '#f9fafb' }]}>
                <View style={ddStyles.sectionHeader}>
                  <Text style={[ddStyles.tldrLabel, { color: ACCENT }]}>TL;DR</Text>
                  <Pressable
                    onPress={() => handleSave('tldr', deepDive.tldr!, `${title} - TL;DR`)}
                    hitSlop={8}
                    style={ddStyles.saveBtn}
                  >
                    <Bookmark
                      size={18}
                      color={savedSections.has('tldr') ? ACCENT : Colors[colorScheme].muted}
                      strokeWidth={savedSections.has('tldr') ? 2.5 : 1.5}
                    />
                  </Pressable>
                </View>
                <RichText style={[ddStyles.tldrText, { color: Colors[colorScheme].text }]}>
                  {deepDive.tldr}
                </RichText>
              </View>
            )}

            {/* Table of contents */}
            <View style={ddStyles.toc}>
              <Text style={[ddStyles.tocTitle, { color: Colors[colorScheme].muted }]}>Chapters</Text>
              {chapters.map((ch, i) => (
                <Pressable key={i} onPress={() => goToPage(i + 1)} style={ddStyles.tocItem}>
                  <View style={[ddStyles.tocNumber, { backgroundColor: isDark ? '#262626' : '#f3f4f6' }]}>
                    <Text style={[ddStyles.tocNumberText, { color: Colors[colorScheme].muted }]}>{i + 1}</Text>
                  </View>
                  <Text style={[ddStyles.tocItemText, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                    {ch.title}
                  </Text>
                  <ChevronLeft size={16} color={Colors[colorScheme].muted} style={{ transform: [{ rotate: '180deg' }] }} />
                </Pressable>
              ))}
            </View>

            <Text style={[ddStyles.swipeHint, { color: Colors[colorScheme].muted }]}>
              Swipe to start reading →
            </Text>
          </ScrollView>
        </View>

        {/* Chapter pages */}
        {chapters.map((chapter, idx) => {
          const chapterKey = `chapter_${idx}`;
          const chapterContent = chapter.quote
            ? `${chapter.content}\n\n"${chapter.quote.text}" — ${chapter.quote.source}`
            : chapter.content;
          return (
            <View key={idx} style={[ddStyles.page, { width: CARD_WIDTH }]}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ddStyles.pageContent}>
                <View style={ddStyles.chapterHeaderRow}>
                  <View style={ddStyles.chapterHeader}>
                    <Text style={[ddStyles.chapterLabel, { color: ACCENT }]}>Chapter {idx + 1}</Text>
                    <Text style={[ddStyles.chapterTitle, { color: Colors[colorScheme].text }]}>
                      {chapter.title}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleSave(chapterKey, chapterContent, `${title} - ${chapter.title}`)}
                    hitSlop={8}
                    style={ddStyles.saveBtn}
                  >
                    <Bookmark
                      size={20}
                      color={savedSections.has(chapterKey) ? ACCENT : Colors[colorScheme].muted}
                      strokeWidth={savedSections.has(chapterKey) ? 2.5 : 1.5}
                    />
                  </Pressable>
                </View>
                <RichText style={[ddStyles.chapterContent, { color: Colors[colorScheme].text }]}>
                  {chapter.content}
                </RichText>
                {chapter.quote && (
                  <View style={[ddStyles.quoteCard, { borderLeftColor: ACCENT }]}>
                    <Text style={[ddStyles.quoteText, { color: Colors[colorScheme].text }]}>
                      "{chapter.quote.text}"
                    </Text>
                    <Text style={[ddStyles.quoteSource, { color: Colors[colorScheme].muted }]}>
                      — {chapter.quote.source}
                    </Text>
                  </View>
                )}
                <Text style={[ddStyles.swipeHint, { color: Colors[colorScheme].muted }]}>
                  {idx < chapters.length - 1 ? 'Swipe for next chapter →' : 'Swipe to finish →'}
                </Text>
              </ScrollView>
            </View>
          );
        })}

        {/* Final page: Bottom line + Sources */}
        <View style={[ddStyles.page, { width: CARD_WIDTH }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ddStyles.pageContent}>
            {deepDive.bottom_line && (
              <View style={[ddStyles.bottomLine, { backgroundColor: isDark ? '#1c1917' : '#fffbeb' }]}>
                <View style={ddStyles.sectionHeader}>
                  <View style={ddStyles.bottomLineHeader}>
                    <Sparkles size={18} color={ACCENT} strokeWidth={2} />
                    <Text style={[ddStyles.bottomLineLabel, { color: ACCENT }]}>
                      {deepDive.bottom_line.title || 'The Bottom Line'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleSave('bottom_line', deepDive.bottom_line!.content, `${title} - Bottom Line`)}
                    hitSlop={8}
                    style={ddStyles.saveBtn}
                  >
                    <Bookmark
                      size={18}
                      color={savedSections.has('bottom_line') ? ACCENT : Colors[colorScheme].muted}
                      strokeWidth={savedSections.has('bottom_line') ? 2.5 : 1.5}
                    />
                  </Pressable>
                </View>
                <RichText style={[ddStyles.bottomLineText, { color: Colors[colorScheme].text }]}>
                  {deepDive.bottom_line.content}
                </RichText>
              </View>
            )}

            {sources && sources.length > 0 && (
              <View style={ddStyles.sourcesSection}>
                <Text style={[ddStyles.sourcesLabel, { color: Colors[colorScheme].muted }]}>Sources</Text>
                {sources.map((src, i) => (
                  <Pressable
                    key={i}
                    onPress={() => WebBrowser.openBrowserAsync(src.url)}
                    style={[ddStyles.sourceCard, { backgroundColor: isDark ? '#1a1a1a' : '#f9fafb' }]}
                  >
                    <View style={ddStyles.sourceInfo}>
                      <Text style={[ddStyles.sourceName, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                        {src.name}
                      </Text>
                      <Text style={[ddStyles.sourceTitle, { color: Colors[colorScheme].secondary }]} numberOfLines={2}>
                        {src.title}
                      </Text>
                    </View>
                    <ExternalLink size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                  </Pressable>
                ))}
              </View>
            )}

            <View style={ddStyles.finishSection}>
              <Text style={[ddStyles.finishText, { color: Colors[colorScheme].text }]}>
                You've completed this deep dive
              </Text>
              <Pressable style={ddStyles.finishBtn} onPress={onBack}>
                <Text style={ddStyles.finishBtnText}>Done</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ddStyles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topBarLabelText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bookmarkBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  pageIndicatorDot: {
    height: 6,
    borderRadius: 3,
  },
  page: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    minHeight: FULL_CARD_HEIGHT - 60,
  },
  coverImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 17,
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  coverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  coverMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coverMetaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tldrCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  saveBtn: {
    padding: 4,
  },
  tldrLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  tldrText: {
    fontSize: 16,
    lineHeight: 24,
  },
  toc: {
    gap: 8,
    marginBottom: 24,
  },
  tocTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  tocNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tocNumberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tocItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  swipeHint: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },
  chapterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  chapterHeader: {
    flex: 1,
  },
  chapterLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  chapterTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  chapterContent: {
    fontSize: 17,
    lineHeight: 28,
    marginBottom: 24,
  },
  quoteCard: {
    borderLeftWidth: 3,
    paddingLeft: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  quoteSource: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  bottomLine: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  bottomLineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  bottomLineLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottomLineText: {
    fontSize: 17,
    lineHeight: 28,
  },
  sourcesSection: {
    gap: 12,
    marginBottom: 32,
  },
  sourcesLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  sourceInfo: {
    flex: 1,
    gap: 2,
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '600',
  },
  sourceTitle: {
    fontSize: 13,
  },
  finishSection: {
    alignItems: 'center',
    gap: 16,
    marginTop: 'auto',
    paddingTop: 24,
  },
  finishText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  finishBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  finishBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

const lcStyles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  bookmarkBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  emoji: {
    fontSize: 28,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    textAlign: 'center',
    padding: 8,
  },
  titleSection: {
    marginBottom: 32,
  },
  sourceLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  articleTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  cardText: {
    fontSize: 20,
    lineHeight: 32,
    fontWeight: '400',
  },
  bottomSection: {
    paddingTop: 96,
  },
  readOriginalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  readOriginalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sourcesSection: {
    gap: 8,
  },
  sourcesLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceLinkText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default function ArticleScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const colorScheme = useColorScheme() ?? 'light';
  const { isProUser, presentPaywall } = useRevenueCat();
  const { user } = useAuth();

  const item = getCurrentArticle();

  const [bookmarked, setBookmarked] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!item) {
      router.back();
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
  }, [item, router]);

  if (!item) return null;

  const handleToggleBookmark = async () => {
    if (!isProUser) {
      presentPaywall();
      return;
    }
    const nowBookmarked = await toggleBookmark(item);
    setBookmarked(nowBookmarked);
    showToast(nowBookmarked ? 'Saved' : 'Removed', 'success');
  };

  const itemType = item.type || item.source || 'blog';
  const config = SOURCE_CONFIG[itemType] || SOURCE_CONFIG.blog;
  const Icon = config.icon;
  const isHot = item.metadata?.is_hot;
  const readingTime = item.summary?.reading_time_minutes;
  const showHeroImage = isLikelyRealImageUrl(item.thumbnail) && !imgError;

  const body = item.summary?.short_article?.body || '';
  const subtitle = item.summary?.short_article?.subtitle;
  const keyTakeaways = item.summary?.short_article?.key_takeaways;
  const whyItMatters = item.summary?.short_article?.why_it_matters;
  const learningCards = item.summary?.short_article?.learning_cards;
  const hasLearningCards = learningCards && learningCards.length > 0;
  const isTrending = item.feed_type === 'trending' || item.metadata?.feed_type === 'trending';
  const isForYou = item.feed_type === 'for_you' || item.metadata?.feed_type === 'for_you';
  const deepDiveContent = item.summary?.deep_dive as DeepDiveContent | undefined;
  const isChapterDeepDive = deepDiveContent?.chapters && deepDiveContent.chapters.length > 0;

  // Split on double newlines first, then split each block on single newlines
  // so that headings on their own line don't merge with body text.
  const bodyLines: string[] = [];
  for (const block of body.split(/\n\n+/)) {
    const lines = block.split(/\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) bodyLines.push(trimmed);
    }
  }

  const renderLine = (line: string, index: number) => {
    if (line.startsWith('### ')) {
      return (
        <RichText key={index} style={[styles.bodyH3, { color: Colors[colorScheme].text }]}>
          {line.replace(/^###\s*/, '')}
        </RichText>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <RichText key={index} style={[styles.bodyH2, { color: Colors[colorScheme].text }]}>
          {line.replace(/^##\s*/, '')}
        </RichText>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <View key={index} style={styles.listItem}>
          <ThemedText style={[styles.listBullet, { color: Colors[colorScheme].muted }]}>•</ThemedText>
          <RichText style={[styles.bodyText, { color: Colors[colorScheme].text }]}>
            {line.replace(/^[-*]\s*/, '')}
          </RichText>
        </View>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      return (
        <View key={index} style={styles.listItem}>
          <ThemedText style={[styles.listBullet, { color: Colors[colorScheme].muted }]}>
            {line.match(/^(\d+)\./)?.[1]}.
          </ThemedText>
          <RichText style={[styles.bodyText, { color: Colors[colorScheme].text }]}>
            {line.replace(/^\d+\.\s*/, '')}
          </RichText>
        </View>
      );
    }
    return (
      <RichText key={index} style={[styles.bodyText, { color: Colors[colorScheme].text }]}>
        {line}
      </RichText>
    );
  };

  const hasAccess = isProUser || item.feed_type === 'trending';

  // Chapter-style deep dive view
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

  // Full-screen learning cards view for For You articles
  if (hasAccess && hasLearningCards) {
    return (
      <FullScreenLearningCards
        cards={learningCards as LearningCard[]}
        title={item.title}
        sourceName={item.source_name || item.source || ''}
        sources={item.sources}
        colorScheme={colorScheme}
        onBack={() => router.back()}
        onReadOriginal={() => {
          if (!item.url) return;
          logReadingEvent({
            eventType: 'external_open',
            itemId: item.id,
            title: item.title,
            url: item.url,
            itemType: item.type || item.source || 'blog',
          });
          WebBrowser.openBrowserAsync(item.url);
        }}
        onBookmark={handleToggleBookmark}
        isBookmarked={bookmarked}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors[colorScheme].foreground} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={handleToggleBookmark} hitSlop={12} style={styles.topAction}>
          <Bookmark
            size={20}
            color={bookmarked ? Colors[colorScheme].foreground : Colors[colorScheme].muted}
            strokeWidth={bookmarked ? 2.5 : 1.5}
          />
        </Pressable>
        <Pressable
          onPress={() => {
            if (!item.url) return;
            logReadingEvent({
              eventType: 'external_open',
              itemId: item.id,
              title: item.title,
              url: item.url,
              itemType: item.type || item.source || 'blog',
            });
            WebBrowser.openBrowserAsync(item.url);
          }}
          hitSlop={12}
          style={styles.topAction}>
          <ExternalLink size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.articleHeader}>
          <View style={styles.metaRow}>
            <View style={[styles.typeBadge, { backgroundColor: config.bgColor[colorScheme] }]}>
              <Icon size={14} color={config.color} strokeWidth={2} />
              <ThemedText style={[styles.typeLabel, { color: config.color }]}>
                {config.label}
              </ThemedText>
            </View>
            {isHot && itemType !== 'news' && (
              <View style={[styles.hotBadge, { backgroundColor: colorScheme === 'dark' ? '#2e2216' : '#fff7ed' }]}>
                <Flame size={11} color="#ea580c" strokeWidth={2.5} />
                <ThemedText style={styles.hotText}>Hot</ThemedText>
              </View>
            )}
            {readingTime && (
              <View style={styles.readingTime}>
                <Clock size={12} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                <ThemedText style={[styles.readingTimeText, { color: Colors[colorScheme].muted }]}>
                  {readingTime} min read
                </ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={styles.articleTitle}>{item.title}</ThemedText>

          {subtitle ? (
            <ThemedText style={[styles.articleSubtitle, { color: Colors[colorScheme].secondary }]}>
              {subtitle}
            </ThemedText>
          ) : null}

          {showHeroImage && (
            <Image
              source={{ uri: item.thumbnail! }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          )}

          {item.source_name ? (
            <ThemedText style={[styles.sourceName, { color: Colors[colorScheme].muted }]}>
              {item.source_name}
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />

        {hasAccess ? (
            /* Traditional prose view */
            <View style={styles.articleBody}>
              {/* Key Takeaways */}
              {!isTrending && keyTakeaways && keyTakeaways.length > 0 && (
                <View style={[styles.takeawaysCard, { backgroundColor: '#fffbeb' }]}>
                  <ThemedText style={styles.takeawaysLabel}>Key Takeaways</ThemedText>
                  {keyTakeaways.map((t: string, i: number) => (
                    <View key={i} style={styles.takeawayRow}>
                      <View style={styles.takeawayDot} />
                      <RichText style={[styles.takeawayText, { color: Colors[colorScheme].text }]}>
                        {t}
                      </RichText>
                    </View>
                  ))}
                </View>
              )}

              {/* Body */}
              {bodyLines.map((line: string, index: number) => renderLine(line, index))}

              {/* Why it matters */}
              {!isTrending && whyItMatters ? (
                <View style={[styles.whyItMattersCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
                  <ThemedText style={[styles.whyItMattersLabel, { color: Colors[colorScheme].muted }]}>
                    Why it matters
                  </ThemedText>
                  <RichText style={[styles.whyItMattersText, { color: Colors[colorScheme].secondary }]}>
                    {whyItMatters}
                  </RichText>
                </View>
              ) : null}
            </View>
        ) : (
          <>
            <View style={styles.articleBody}>
              {bodyLines.length > 0 ? (
                renderLine(bodyLines[0], 0)
              ) : (
                <ThemedText style={[styles.bodyText, { color: Colors[colorScheme].muted }]}>
                  The full breakdown is just a tap away for subscribers.
                </ThemedText>
              )}
            </View>

            <View style={styles.blurredSection}>
              <View style={{ opacity: 0.12 }}>
                <View style={[styles.fakeLine, { width: '100%', backgroundColor: Colors[colorScheme].foreground }]} />
                <View style={[styles.fakeLine, { width: '88%', backgroundColor: Colors[colorScheme].foreground }]} />
                <View style={[styles.fakeLine, { width: '55%', backgroundColor: Colors[colorScheme].foreground }]} />
              </View>
              <View style={styles.gradientOverlay}>
                <View style={[styles.gradientStep, { backgroundColor: Colors[colorScheme].background, opacity: 0.3 }]} />
                <View style={[styles.gradientStep, { backgroundColor: Colors[colorScheme].background, opacity: 0.7 }]} />
                <View style={[styles.gradientStep, { backgroundColor: Colors[colorScheme].background, opacity: 1 }]} />
              </View>
            </View>

            <View style={styles.paywallContainer}>
              <View style={[styles.paywallCard, { backgroundColor: '#f8f9fa' }]}>
                <View style={[styles.paywallIconCircle, { backgroundColor: '#fffbeb' }]}>
                  <Lock size={22} color={ACCENT} strokeWidth={2} />
                </View>
                <ThemedText style={styles.paywallTitle}>
                  Read the key takeaways in 2 minutes
                </ThemedText>
                <ThemedText style={[styles.paywallDesc, { color: Colors[colorScheme].muted }]}>
                  Every article, distilled to what matters most — so you learn more, faster.
                </ThemedText>
                <Pressable style={styles.subscribeButton} onPress={() => presentPaywall()}>
                  <Crown size={16} color="#fff" strokeWidth={2} />
                  <Text style={styles.subscribeButtonText}>Unlock full access</Text>
                </Pressable>
                <Pressable
                  style={styles.openOriginalLink}
                  onPress={() => {
                    if (!item.url) return;
                    WebBrowser.openBrowserAsync(item.url);
                  }}>
                  <ExternalLink size={14} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                  <ThemedText style={[styles.openOriginalLinkText, { color: Colors[colorScheme].muted }]}>
                    Read original article instead
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backButton: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 20,
  },
  topAction: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroImage: {
    width: '100%', height: 220,
    borderRadius: 16, marginBottom: 4,
  },
  articleHeader: { gap: 12, marginBottom: 24 },
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
  },
  typeLabel: { fontSize: 12, fontWeight: '600' },
  hotBadge: {
    flexDirection: 'row', alignItems: 'center',
    gap: 3, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999,
  },
  hotText: { fontSize: 11, fontWeight: '600', color: '#ea580c' },
  readingTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readingTimeText: { fontSize: 12, fontWeight: '500' },
  articleTitle: {
    fontSize: 26, fontWeight: '700',
    lineHeight: 34, letterSpacing: -0.3,
  },
  articleSubtitle: {
    fontSize: 17, lineHeight: 24, fontStyle: 'italic',
  },
  sourceName: { fontSize: 13, fontWeight: '500' },
  divider: { height: 1, marginBottom: 24 },
  articleBody: { gap: 16, marginBottom: 32 },

  // Key Takeaways
  takeawaysCard: {
    borderRadius: 16, padding: 18, gap: 10,
    marginBottom: 8,
  },
  takeawaysLabel: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    color: '#b45309', marginBottom: 2,
  },
  takeawayRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  takeawayDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#F59E0B', marginTop: 8,
  },
  takeawayText: { fontSize: 15, lineHeight: 22, flex: 1 },

  // Why it matters
  whyItMattersCard: {
    borderRadius: 16, padding: 18,
    borderWidth: 1, marginTop: 8,
  },
  whyItMattersLabel: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 6,
  },
  whyItMattersText: {
    fontSize: 15, lineHeight: 23, fontStyle: 'italic',
  },

  // Body text
  bodyH2: { fontSize: 20, fontWeight: '700', lineHeight: 28, marginTop: 8 },
  bodyH3: { fontSize: 17, fontWeight: '600', lineHeight: 24, marginTop: 4 },
  bodyText: { fontSize: 16, lineHeight: 26 },
  listContainer: { gap: 6, paddingLeft: 4 },
  listItem: { flexDirection: 'row', gap: 8 },
  listBullet: { fontSize: 16, lineHeight: 26, width: 16 },

  // Paywall
  blurredSection: { position: 'relative', marginBottom: 0 },
  fakeLine: { height: 14, borderRadius: 7, marginBottom: 10 },
  gradientOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 120, flexDirection: 'column',
  },
  gradientStep: { flex: 1 },
  paywallContainer: { marginTop: -20, marginBottom: 32 },
  paywallCard: {
    borderRadius: 20, padding: 28,
    alignItems: 'center', gap: 14,
  },
  paywallIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  paywallTitle: {
    fontSize: 20, fontWeight: '700',
    textAlign: 'center', letterSpacing: -0.3,
  },
  paywallDesc: {
    fontSize: 14, lineHeight: 21,
    textAlign: 'center', paddingHorizontal: 8,
  },
  subscribeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#F59E0B',
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 999, marginTop: 6, width: '100%',
  },
  subscribeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  openOriginalLink: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingVertical: 8, marginTop: 4,
  },
  openOriginalLinkText: { fontSize: 14, fontWeight: '500' },
});
