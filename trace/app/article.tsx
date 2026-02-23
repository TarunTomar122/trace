import { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  Image,
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
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { isBookmarked as checkBookmarked, toggleBookmark } from '@/lib/bookmarks';
import { getCurrentArticle } from '@/lib/article-store';
import { logReadingEvent } from '@/lib/reading-analytics';

const ACCENT = '#F59E0B';

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
    showToast(nowBookmarked ? 'Saved to bookmarks.' : 'Removed from bookmarks.', 'success');
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
          <View style={styles.articleBody}>
            {/* Key Takeaways */}
            {keyTakeaways && keyTakeaways.length > 0 && (
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
            {whyItMatters ? (
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
