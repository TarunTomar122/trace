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
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Youtube,
  Github,
  BookOpen,
  MessageCircle,
  Sparkles,
  Newspaper,
  ThumbsUp,
  ThumbsDown,
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
import { useToast } from '@/contexts/ToastContext';
import { isBookmarked as checkBookmarked, toggleBookmark } from '@/lib/bookmarks';
import { FeedItem } from '@/lib/firestore';
import { logReadingEvent } from '@/lib/reading-analytics';

const SOURCE_CONFIG: Record<
  string,
  { icon: typeof Youtube; color: string; bgColor: string; label: string }
> = {
  video: { icon: Youtube, color: '#ef4444', bgColor: '#fef2f2', label: 'Video' },
  repo: { icon: Github, color: '#8b5cf6', bgColor: '#f5f3ff', label: 'Repo' },
  paper: { icon: BookOpen, color: '#3b82f6', bgColor: '#eff6ff', label: 'Paper' },
  blog: { icon: BookOpen, color: '#10b981', bgColor: '#ecfdf5', label: 'Article' },
  discussion: { icon: MessageCircle, color: '#f59e0b', bgColor: '#fffbeb', label: 'Discussion' },
  tweet: { icon: MessageCircle, color: '#0ea5e9', bgColor: '#f0f9ff', label: 'Thread' },
  launch: { icon: Sparkles, color: '#d946ef', bgColor: '#fdf4ff', label: 'Launch' },
  model: { icon: Sparkles, color: '#6366f1', bgColor: '#eef2ff', label: 'Model' },
  news: { icon: Newspaper, color: '#f97316', bgColor: '#fff7ed', label: 'News' },
};

function isLikelyRealImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const value = url.trim().toLowerCase();
  if (!value.startsWith('http://') && !value.startsWith('https://')) return false;
  if (value.endsWith('.svg')) return false;
  if (value.includes('placeholder') || value.includes('ui-avatars.com')) return false;
  return true;
}

/** Renders inline markdown: **bold** → <Text style={{fontWeight:'700'}}>bold</Text> */
function RichText({ children, style }: { children: string; style?: any }) {
  const parts = children.split(/(\*\*.*?\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={[style, { fontWeight: '700' }]}>
              {part.slice(2, -2)}
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
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    url: string;
    thumbnail: string;
    type: string;
    subtitle: string;
    body: string;
    reading_time: string;
    why_relevant: string;
    is_hot: string;
    feed_category: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const { isProUser, presentPaywall } = useRevenueCat();

  // Allow access if user is pro OR if this is a free sample summary
  const isSampleSummary = params.feed_category === 'sample_summary';
  const hasAccess = isProUser || isSampleSummary;

  const [upvoted, setUpvoted] = useState(false);
  const [downvoted, setDownvoted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Build a FeedItem from route params for bookmarking
  const feedItem: FeedItem = {
    id: params.id || params.url || params.title || '',
    title: params.title || '',
    url: params.url || '',
    thumbnail: params.thumbnail || undefined,
    type: params.type || 'blog',
    summary: {
      short_article: {
        subtitle: params.subtitle || undefined,
        body: params.body || undefined,
      },
      reading_time_minutes: params.reading_time ? parseInt(params.reading_time) : undefined,
    },
    metadata: {
      why_relevant: params.why_relevant || undefined,
      is_hot: params.is_hot === 'true',
    },
  };

  // Check bookmark state on mount
  useEffect(() => {
    checkBookmarked(feedItem.id).then(setBookmarked);
  }, [feedItem.id]);

  const handleToggleBookmark = async () => {
    if (!isProUser) {
      presentPaywall();
      return;
    }
    const nowBookmarked = await toggleBookmark(feedItem);
    setBookmarked(nowBookmarked);
    showToast(nowBookmarked ? 'Saved to bookmarks.' : 'Removed from bookmarks.', 'success');
  };

  const itemType = params.type || 'blog';
  const config = SOURCE_CONFIG[itemType] || SOURCE_CONFIG.blog;
  const Icon = config.icon;
  const isHot = params.is_hot === 'true';
  const readingTime = params.reading_time ? parseInt(params.reading_time) : null;
  const showHeroImage = isLikelyRealImageUrl(params.thumbnail) && !imgError;

  // Parse markdown body into simple paragraphs
  const bodyParagraphs = (params.body || '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const renderParagraph = (paragraph: string, index: number, cs: 'light' | 'dark') => {
    if (paragraph.startsWith('## ')) {
      return (
        <ThemedText key={index} style={styles.bodyH2}>
          {paragraph.replace(/^##\s*/, '')}
        </ThemedText>
      );
    }
    if (paragraph.startsWith('### ')) {
      return (
        <ThemedText key={index} style={styles.bodyH3}>
          {paragraph.replace(/^###\s*/, '')}
        </ThemedText>
      );
    }
    if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
      const items = paragraph.split(/\n/).filter(Boolean);
      return (
        <View key={index} style={styles.listContainer}>
          {items.map((li, liIdx) => (
            <View key={liIdx} style={styles.listItem}>
              <ThemedText style={[styles.listBullet, { color: Colors[cs].muted }]}>•</ThemedText>
              <RichText style={[styles.bodyText, { color: Colors[cs].text }]}>
                {li.replace(/^[-*]\s*/, '')}
              </RichText>
            </View>
          ))}
        </View>
      );
    }
    return (
      <RichText key={index} style={[styles.bodyText, { color: Colors[cs].text }]}>
        {paragraph}
      </RichText>
    );
  };

  const handleUpvote = () => {
    const newUpvoted = !upvoted;
    setUpvoted(newUpvoted);
    if (newUpvoted) setDownvoted(false);
  };

  const handleDownvote = () => {
    const newDownvoted = !downvoted;
    setDownvoted(newDownvoted);
    if (newDownvoted) setUpvoted(false);
  };

  useEffect(() => {
    if (!params.id && !params.url && !params.title) return;
    logReadingEvent({
      eventType: 'summary_open',
      itemId: params.id || params.url || params.title,
      title: params.title || '',
      url: params.url || '',
      itemType: params.type || 'blog',
    });
  }, [params.id, params.url, params.title, params.type]);

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
        <Pressable
          onPress={handleToggleBookmark}
          hitSlop={12}
          style={styles.topAction}>
          <Bookmark
            size={20}
            color={bookmarked ? Colors[colorScheme].foreground : Colors[colorScheme].muted}
            strokeWidth={bookmarked ? 2.5 : 1.5}
          />
        </Pressable>
        <Pressable
          onPress={() => {
            if (!params.url) return;
            logReadingEvent({
              eventType: 'external_open',
              itemId: params.id || params.url || params.title || '',
              title: params.title || '',
              url: params.url,
              itemType: params.type || 'blog',
            });
            WebBrowser.openBrowserAsync(params.url);
          }}
          hitSlop={12}
          style={styles.topAction}>
          <ExternalLink size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Article header */}
        <View style={styles.articleHeader}>
          <View style={styles.metaRow}>
            <View style={[styles.typeBadge, { backgroundColor: config.bgColor }]}>
              <Icon size={14} color={config.color} strokeWidth={2} />
              <ThemedText style={[styles.typeLabel, { color: config.color }]}>
                {config.label}
              </ThemedText>
            </View>
            {isHot && itemType !== 'news' && (
              <View style={styles.hotBadge}>
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

          <ThemedText style={styles.articleTitle}>{params.title}</ThemedText>

          {params.subtitle && (
            <ThemedText style={[styles.articleSubtitle, { color: Colors[colorScheme].secondary }]}>
              {params.subtitle}
            </ThemedText>
          )}

          {showHeroImage && (
            <Image
              source={{ uri: params.thumbnail }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          )}

        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />

        {hasAccess ? (
          <>
            {/* Full article body */}
            <View style={styles.articleBody}>
              {bodyParagraphs.map((paragraph, index) => renderParagraph(paragraph, index, colorScheme))}
            </View>

            {/* Actions row */}
            <View style={[styles.actionsRow, { borderTopColor: Colors[colorScheme].border }]}>
              <Pressable
                onPress={handleUpvote}
                style={[styles.bottomAction, upvoted && { backgroundColor: '#dcfce7' }]}>
                <ThumbsUp
                  size={18}
                  color={upvoted ? '#22c55e' : Colors[colorScheme].muted}
                  strokeWidth={upvoted ? 2.5 : 1.5}
                />
                <ThemedText
                  style={[
                    styles.bottomActionLabel,
                    { color: upvoted ? '#22c55e' : Colors[colorScheme].muted },
                  ]}>
                  Like
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={handleDownvote}
                style={[styles.bottomAction, downvoted && { backgroundColor: '#fee2e2' }]}>
                <ThumbsDown
                  size={18}
                  color={downvoted ? '#ef4444' : Colors[colorScheme].muted}
                  strokeWidth={downvoted ? 2.5 : 1.5}
                />
                <ThemedText
                  style={[
                    styles.bottomActionLabel,
                    { color: downvoted ? '#ef4444' : Colors[colorScheme].muted },
                  ]}>
                  Dislike
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={handleToggleBookmark}
                style={[
                  styles.bottomAction,
                  bookmarked && { backgroundColor: Colors[colorScheme].foreground + '12' },
                ]}>
                <Bookmark
                  size={18}
                  color={bookmarked ? Colors[colorScheme].foreground : Colors[colorScheme].muted}
                  strokeWidth={bookmarked ? 2.5 : 1.5}
                />
                <ThemedText
                  style={[
                    styles.bottomActionLabel,
                    { color: bookmarked ? Colors[colorScheme].foreground : Colors[colorScheme].muted },
                  ]}>
                  Save
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {/* Teaser: show first paragraph if available, else a placeholder */}
            <View style={styles.articleBody}>
              {bodyParagraphs.length > 0 ? (
                renderParagraph(bodyParagraphs[0], 0, colorScheme)
              ) : (
                <>
                  <ThemedText style={[styles.bodyText, { color: Colors[colorScheme].muted }]}>
                    The full breakdown is just a tap away for subscribers.
                  </ThemedText>
                </>
              )}
            </View>

            {/* Blurred / faded fake content (compact) */}
            <View style={styles.blurredSection}>
              <View style={{ opacity: 0.12 }}>
                <View style={[styles.fakeLine, { width: '100%', backgroundColor: Colors[colorScheme].foreground }]} />
                <View style={[styles.fakeLine, { width: '88%', backgroundColor: Colors[colorScheme].foreground }]} />
                <View style={[styles.fakeLine, { width: '55%', backgroundColor: Colors[colorScheme].foreground }]} />
              </View>

              <View style={{ opacity: 0.12 }}>
                <View style={[styles.fakeLine, { width: '100%', backgroundColor: Colors[colorScheme].foreground }]} />
                <View style={[styles.fakeLine, { width: '88%', backgroundColor: Colors[colorScheme].foreground }]} />
                <View style={[styles.fakeLine, { width: '55%', backgroundColor: Colors[colorScheme].foreground }]} />
              </View>

              {/* Gradient fade overlay (pure RN layers) */}
              <View style={styles.gradientOverlay}>
                <View style={[styles.gradientStep, { backgroundColor: Colors[colorScheme].background, opacity: 0.3 }]} />
                <View style={[styles.gradientStep, { backgroundColor: Colors[colorScheme].background, opacity: 0.7 }]} />
                <View style={[styles.gradientStep, { backgroundColor: Colors[colorScheme].background, opacity: 1 }]} />
              </View>
            </View>

            {/* Paywall CTA */}
            <View style={styles.paywallContainer}>
              <View style={[styles.paywallCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f8f9fa' }]}>
                <View style={[styles.paywallIconCircle, { backgroundColor: '#f0fdf4' }]}>
                  <Lock size={22} color="#22c55e" strokeWidth={2} />
                </View>
                <ThemedText style={styles.paywallTitle}>
                  Read the key takeaways in 2 minutes
                </ThemedText>
                <ThemedText style={[styles.paywallDesc, { color: Colors[colorScheme].muted }]}>
                  Every article, distilled to what matters most {'\u2014'} so you learn more, faster.
                </ThemedText>

                <Pressable
                  style={styles.subscribeButton}
                  onPress={() => presentPaywall()}>
                  <Crown size={16} color="#fff" strokeWidth={2} />
                  <Text style={styles.subscribeButtonText}>Unlock full access</Text>
                </Pressable>

                <Pressable
                  style={styles.openOriginalLink}
                  onPress={() => {
                    if (!params.url) return;
                    logReadingEvent({
                      eventType: 'external_open',
                      itemId: params.id || params.url || params.title || '',
                      title: params.title || '',
                      url: params.url,
                      itemType: params.type || 'blog',
                    });
                    WebBrowser.openBrowserAsync(params.url);
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
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  topAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 18,
  },
  articleHeader: {
    gap: 12,
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fff7ed',
  },
  hotText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ea580c',
  },
  readingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readingTimeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  articleTitle: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  articleSubtitle: {
    fontSize: 17,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  relevanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  relevanceText: {
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginBottom: 24,
  },
  articleBody: {
    gap: 16,
    marginBottom: 32,
  },
  bodyH2: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    marginTop: 8,
  },
  bodyH3: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 4,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 26,
  },
  listContainer: {
    gap: 6,
    paddingLeft: 4,
  },
  listItem: {
    flexDirection: 'row',
    gap: 8,
  },
  listBullet: {
    fontSize: 16,
    lineHeight: 26,
  },
  // ─── Paywall ───
  blurredSection: {
    position: 'relative',
    marginBottom: 0,
  },
  fakeLine: {
    height: 14,
    borderRadius: 7,
    marginBottom: 10,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    flexDirection: 'column',
  },
  gradientStep: {
    flex: 1,
  },
  paywallContainer: {
    marginTop: -20,
    marginBottom: 32,
  },
  paywallCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  paywallIconCircle: {
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
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22c55e',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 6,
    width: '100%',
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  openOriginalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  openOriginalLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    marginTop: 8,
  },
  bottomAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bottomActionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});

