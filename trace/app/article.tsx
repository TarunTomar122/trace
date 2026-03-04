import React, { useState, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
} from 'react-native';
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
  Flame,
  Clock,
  Crown,
  Lock,
  GraduationCap,
  Zap,
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
import { getArticleImage } from '@/lib/fallback-images';

const ACCENT = '#F59E0B';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.42;

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

const FY_TAB_CONFIG: Record<string, { label: string; Icon: typeof Clock }> = {
  hook: { label: 'Highlights', Icon: Clock },
  insight: { label: 'Key Insight', Icon: Sparkles },
  why: { label: 'Why it Matters', Icon: Flame },
  bottom_line: { label: 'Bottom Line', Icon: Zap },
};

function buildTabLabels(cards: LearningCard[]): string[] {
  const typeCounts = new Map<string, number>();
  for (const c of cards) {
    typeCounts.set(c.type, (typeCounts.get(c.type) || 0) + 1);
  }
  const typeIdx = new Map<string, number>();
  return cards.map((card) => {
    const base = FY_TAB_CONFIG[card.type]?.label || card.type;
    const count = typeCounts.get(card.type) || 1;
    if (count <= 1) return base;
    const idx = (typeIdx.get(card.type) || 0) + 1;
    typeIdx.set(card.type, idx);
    return `${base} ${idx}`;
  });
}

/* ═══════════════════════════════════════════════════════════
   ForYouArticleView — swipeable cards with tab bar
   ═══════════════════════════════════════════════════════════ */

function ForYouArticleView({
  cards,
  title,
  sourceName,
  thumbnail,
  readingTime,
  colorScheme,
  onBack,
  onReadOriginal,
  onBookmark,
  isBookmarked,
}: {
  cards: LearningCard[];
  title: string;
  sourceName: string;
  thumbnail?: string;
  readingTime?: number;
  sources?: SourceRef[];
  colorScheme: 'light' | 'dark';
  onBack: () => void;
  onReadOriginal: () => void;
  onBookmark: () => void;
  isBookmarked: boolean;
}) {
  const [currentCard, setCurrentCard] = useState(0);
  const isDark = colorScheme === 'dark';
  const showHero = isLikelyRealImageUrl(thumbnail);
  const tabLabels = buildTabLabels(cards);
  const cardWidth = SCREEN_WIDTH - 40;

  return (
    <View style={[fyStyles.root, { backgroundColor: Colors[colorScheme].background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}>

        {/* Hero image — full bleed to top */}
        <View style={fyStyles.heroWrap}>
          {showHero ? (
            <Image source={{ uri: thumbnail }} style={fyStyles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[fyStyles.heroImage, { backgroundColor: isDark ? '#1c1c1c' : '#222' }]} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent']}
            style={fyStyles.heroGradientTop}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.35)', Colors[colorScheme].background]}
            locations={[0, 0.5, 1]}
            style={fyStyles.heroGradientBottom}
          />
          <View style={fyStyles.heroOverlay}>
            <Text style={fyStyles.heroTitle}>{title}</Text>
            <View style={fyStyles.heroMeta}>
              <Text style={fyStyles.heroSource}>{sourceName}</Text>
              {readingTime != null && (
                <Text style={fyStyles.heroReadTime}>· {readingTime} min read</Text>
              )}
            </View>
          </View>
        </View>

        {/* Counter */}
        {cards.length > 1 && (
          <Text style={[fyStyles.counter, { color: Colors[colorScheme].muted }]}>
            {currentCard + 1} / {cards.length}
          </Text>
        )}

        {/* Horizontally swipeable learning cards */}
        <ScrollView
          horizontal
          pagingEnabled={false}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardWidth + 12}
          snapToAlignment="start"
          contentInset={{ left: 0, right: 20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          onScroll={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 12));
            if (idx >= 0 && idx < cards.length && idx !== currentCard) setCurrentCard(idx);
          }}
          scrollEventThrottle={16}>
          {cards.map((card, idx) => (
            <View
              key={idx}
              style={[
                fyStyles.card,
                {
                  backgroundColor: isDark ? '#1a1a1a' : '#f7f7f5',
                  width: cardWidth,
                },
              ]}>
              <Text style={[fyStyles.cardLabel, { color: Colors[colorScheme].muted }]}>
                {tabLabels[idx]}
              </Text>
              {card.content.split(/\.\s+/).filter(Boolean).map((sentence, si, arr) => (
                <RichText
                  key={si}
                  style={[fyStyles.cardContent, { color: Colors[colorScheme].text }]}>
                  {sentence.trim() + (si < arr.length - 1 && !sentence.endsWith('.') ? '.' : '')}
                </RichText>
              ))}
            </View>
          ))}
        </ScrollView>

        {cards.length > 1 && currentCard < cards.length - 1 && (
          <Text style={[fyStyles.swipeHint, { color: Colors[colorScheme].muted }]}>
            Swipe for more →
          </Text>
        )}

      </ScrollView>

      {/* Floating header */}
      <SafeAreaView edges={['top']} style={fyStyles.floatingHeader} pointerEvents="box-none">
        <View style={fyStyles.headerRow}>
          <Pressable onPress={onBack} hitSlop={12} style={fyStyles.headerBtn}>
            <ChevronLeft size={24} color="#fff" strokeWidth={2.5} />
          </Pressable>
          <View style={fyStyles.headerRight}>
            <Pressable onPress={onBookmark} hitSlop={12} style={fyStyles.headerBtn}>
              <Bookmark
                size={20}
                color="#fff"
                strokeWidth={isBookmarked ? 2.5 : 1.5}
                fill={isBookmarked ? '#fff' : 'transparent'}
              />
            </Pressable>
            <Pressable onPress={onReadOriginal} hitSlop={12} style={fyStyles.headerBtn}>
              <ExternalLink size={20} color="#fff" strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const fyStyles = StyleSheet.create({
  root: { flex: 1 },

  // Floating header
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    marginHorizontal: 4,
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
    height: 320,
  },
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
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
  heroSource: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  heroReadTime: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },

  // Counter
  counter: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 10,
    letterSpacing: 0.5,
  },

  // Learning cards
  card: {
    borderRadius: 22,
    padding: 32,
    paddingTop: 28,
    gap: 14,
    minHeight: 260,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardContent: {
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  swipeHint: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 8,
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
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [openChapter, setOpenChapter] = useState<number | null>(null);
  const isDark = colorScheme === 'dark';
  const showHero = isLikelyRealImageUrl(thumbnail);
  const chapters = deepDive.chapters || [];
  const cardBg = isDark ? '#1a1a1a' : '#f7f7f5';

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

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
            <Text style={dd.heroTitle}>{title}</Text>
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
      </ScrollView>

      {/* Floating back button */}
      <SafeAreaView edges={['top']} style={dd.floatingHeader} pointerEvents="box-none">
        <View style={dd.floatingHeaderRow}>
          <Pressable onPress={onBack} hitSlop={12} style={dd.floatingBtn}>
            <ChevronLeft size={24} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>
      </SafeAreaView>
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
    paddingHorizontal: 20,
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
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
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
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },

  // Sections
  section: {
    paddingHorizontal: 20,
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
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: 17,
    lineHeight: 28,
  },
  subtitleText: {
    fontSize: 16,
    lineHeight: 24,
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
    fontWeight: '700',
  },
  tocTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
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
    fontWeight: '600',
  },
  chDetailScroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 60,
  },
  chDetailTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.4,
    marginBottom: 24,
  },
  chDetailPara: {
    fontSize: 17,
    lineHeight: 28,
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
    fontSize: 16,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  quoteSource: {
    fontSize: 13,
    fontWeight: '600',
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
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  chNavLabel: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '600',
  },
  sourceTitle: {
    fontSize: 13,
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

  // Route: for-you with learning cards (not trending)
  if (hasAccess && hasLearningCards && !isTrending) {
    return (
      <ForYouArticleView
        cards={learningCards as LearningCard[]}
        title={item.title}
        sourceName={sourceName}
        thumbnail={item.thumbnail ?? undefined}
        readingTime={readingTime}
        sources={item.sources}
        colorScheme={colorScheme}
        onBack={() => router.back()}
        onReadOriginal={handleReadOriginal}
        onBookmark={handleToggleBookmark}
        isBookmarked={bookmarked}
      />
    );
  }

  // Route: immersive news/trending view (also serves as default + paywall)
  return (
    <View style={[nStyles.container, { backgroundColor: isDark ? '#0a0a0a' : '#fff' }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Full-bleed hero */}
        <View style={nStyles.heroSection}>
          <Image
            source={{ uri: imageUrl }}
            style={nStyles.heroImg}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.75)']}
            locations={[0, 0.3, 1]}
            style={nStyles.heroGradient}
          />

          {/* Overlay controls */}
          <View style={[nStyles.heroTopBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={nStyles.heroBtn}>
              <ChevronLeft size={24} color="#fff" strokeWidth={2.5} />
            </Pressable>
            <View style={nStyles.heroTopRight}>
              <Pressable onPress={handleToggleBookmark} hitSlop={12} style={nStyles.heroBtn}>
                <Bookmark
                  size={20}
                  color={bookmarked ? '#fff' : 'rgba(255,255,255,0.8)'}
                  strokeWidth={bookmarked ? 2.5 : 1.5}
                />
              </Pressable>
              <Pressable onPress={handleReadOriginal} hitSlop={12} style={nStyles.heroBtn}>
                <ExternalLink size={20} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
              </Pressable>
            </View>
          </View>

          {/* Time badge on hero */}
          <View style={nStyles.heroBottom}>
            {timeAgo !== '' && (
              <View style={nStyles.timeBadge}>
                <Zap size={12} color="#F59E0B" strokeWidth={2.5} />
                <Text style={nStyles.timeBadgeText}>{timeAgo}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={nStyles.content}>
          <Text style={[nStyles.title, { color: Colors[colorScheme].text }]}>
            {item.title}
          </Text>

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
            </Text>
            {readingTime != null && (
              <>
                <Text style={[nStyles.sourceDot, { color: Colors[colorScheme].border }]}>·</Text>
                <Clock size={12} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                <Text style={[nStyles.readTime, { color: Colors[colorScheme].muted }]}>{readingTime} min</Text>
              </>
            )}
          </View>

          {/* Overview tab indicator */}
          <View style={nStyles.tabBar}>
            <View style={[nStyles.activeTab, { borderBottomColor: ACCENT }]}>
              <Text style={[nStyles.activeTabText, { color: Colors[colorScheme].text }]}>Overview</Text>
            </View>
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

      {/* Bottom action bar */}
      {hasAccess && (
        <View
          style={[
            nStyles.bottomBar,
            {
              backgroundColor: isDark ? '#0a0a0a' : '#fff',
              borderTopColor: Colors[colorScheme].border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <Pressable onPress={handleReadOriginal} style={nStyles.bottomBarBtn}>
            <ExternalLink size={18} color={Colors[colorScheme].text} strokeWidth={1.5} />
            <Text style={[nStyles.bottomBarText, { color: Colors[colorScheme].text }]}>Read Original</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const nStyles = StyleSheet.create({
  container: { flex: 1 },

  heroSection: {
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  heroTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottom: {
    position: 'absolute',
    bottom: 16,
    left: 20,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  timeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
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
    fontWeight: '800',
    color: '#fff',
  },
  sourceName: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  sourceDot: { fontSize: 12 },
  readTime: { fontSize: 12, fontWeight: '500' },

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
    fontWeight: '600',
  },

  body: { gap: 14, marginBottom: 24 },
  bodyH2: { fontSize: 20, fontWeight: '700', lineHeight: 28, marginTop: 8 },
  bodyH3: { fontSize: 17, fontWeight: '600', lineHeight: 24, marginTop: 4 },
  bodyText: { fontSize: 16, lineHeight: 26 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F97316',
    marginTop: 10,
  },
  bulletNum: { fontSize: 16, lineHeight: 26, width: 20, fontWeight: '600' },
  bulletText: { fontSize: 16, lineHeight: 26, flex: 1 },

  takeawaysCard: {
    borderRadius: 16,
    padding: 18,
    gap: 10,
    marginBottom: 8,
  },
  takeawaysLabel: {
    fontSize: 11,
    fontWeight: '800',
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
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  whyText: {
    fontSize: 16,
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
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  paywallDesc: {
    fontSize: 14,
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
  paywallBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  readOriginalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  readOriginalLinkText: { fontSize: 14, fontWeight: '500' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
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
    fontWeight: '600',
  },
});
