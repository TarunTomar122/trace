import { useState, useEffect, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  Share,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Share2 } from 'lucide-react-native';
import he from 'he';

import { FontFamily } from '@/constants/theme';
import { FeedItem, TrendingTopic } from '@/lib/firestore';
import { getArticleImage } from '@/lib/fallback-images';
import { isBookmarked, toggleBookmark } from '@/lib/bookmarks';

const LOCK_IMAGE = require('@/assets/images/lock.png');

/** Inshorts-style card; bottom bar neutral gray */
const BOTTOM_BAR_H = 70;
const CARD_RADIUS = 10;
const INS = {
  canvas: '#FFFFFF',
  textHead: '#1B1B1B',
  textBody: '#797979',
  sub: '#B8B8B8',
  barBg: '#5E5E5E',
  barFg: '#FAFAFA',
};
const INS_DARK = {
  canvas: '#101010',
  textHead: '#F2F2F2',
  textBody: '#A3A3A3',
  sub: '#8C8C8C',
  barBg: '#454545',
  barFg: '#F5F5F5',
};

function getSourceInitials(name: string): string {
  const value = String(name || '').trim();
  if (!value) return '??';
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words[0] && words[1]) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase() || '??';
  }
  return value.slice(0, 2).toUpperCase() || '??';
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

function isRealImage(url?: string | null): boolean {
  if (!url) return false;
  if (url.includes('placeholder') || url.includes('dicebear') || url.includes('via.placeholder')) return false;
  return true;
}

function getTopicDisplay(topic: TrendingTopic) {
  const isSingleton = (topic.source_count ?? 0) <= 1 || (topic.article_count ?? 0) <= 1;
  const article = isSingleton ? (topic.articles?.[0] ?? null) : null;
  return {
    title: article?.title || topic.title,
    summary: article?.summary?.short_article?.subtitle || article?.summary?.short_article?.body || topic.summary || '',
    thumbnail: article?.thumbnail || topic.thumbnail,
  };
}

export type DeckStoryCardProps = {
  variant: 'trending' | 'foryou';
  topic?: TrendingTopic;
  item?: FeedItem;
  overviewText: string;
  colorScheme: 'light' | 'dark';
  height: number;
  cardWidth: number;
  bookmarkItem?: FeedItem | null;
  shareTitle: string;
  shareOverview: string;
  shareUrl?: string;
  onPress: () => void;
  locked?: boolean;
};

export function DeckStoryCard({
  variant,
  topic,
  item,
  overviewText,
  colorScheme,
  height,
  cardWidth,
  bookmarkItem,
  shareTitle,
  shareOverview,
  shareUrl,
  onPress,
  locked,
}: DeckStoryCardProps) {
  const isTrending = variant === 'trending';
  const display = isTrending && topic ? getTopicDisplay(topic) : null;
  const title = isTrending ? (display?.title || '') : (item?.title || '');
  const overview = overviewText;
  const published = isTrending ? topic?.last_updated_at || topic?.first_seen_at : item?.published_date;
  const thumbnail = isTrending ? display?.thumbnail : item?.thumbnail;
  const sourceName = isTrending
    ? (() => {
        const a = topic?.articles?.[0];
        return a?.source_name || a?.source || 'Sources';
      })()
    : item?.source_name || item?.source || '';

  const ins = colorScheme === 'dark' ? INS_DARK : INS;

  const fallbackUrl = getArticleImage(null, title);
  const [imageUrl, setImageUrl] = useState(
    isRealImage(thumbnail) ? (thumbnail as string) : getArticleImage(thumbnail, title),
  );

  const innerH = Math.max(1, height - BOTTOM_BAR_H);
  const imageHeight = Math.min(248, Math.max(156, Math.round(innerH * 0.32)));

  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(published);

  const [saved, setSaved] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!bookmarkItem?.id) {
      setSaved(false);
      return;
    }
    void isBookmarked(bookmarkItem.id).then((v) => {
      if (!cancelled) setSaved(v);
    });
    return () => {
      cancelled = true;
    };
  }, [bookmarkItem?.id]);

  const onToggleSave = useCallback(async () => {
    if (!bookmarkItem) return;
    const next = await toggleBookmark(bookmarkItem);
    setSaved(next);
  }, [bookmarkItem]);

  const onShare = useCallback(async () => {
    if (shareBusy) return;
    const t = he.decode(shareTitle).trim();
    const body = (shareOverview || '').trim().slice(0, 2000);
    const url = (shareUrl || '').trim();
    const message = url
      ? `${t}\n\n${body}\n\n${url}\n\n— via Trace (yourtrace.online)`
      : `${t}\n\n${body}\n\nRead more at yourtrace.online`;
    setShareBusy(true);
    try {
      await Share.share(
        Platform.OS === 'ios' ? { message } : { message, title: t.slice(0, 80) },
      );
    } catch {
      /* dismissed */
    } finally {
      setShareBusy(false);
    }
  }, [shareBusy, shareTitle, shareOverview, shareUrl]);

  const metaLine = isTrending && topic
    ? `${topic.source_count ?? 1} source${(topic.source_count ?? 1) === 1 ? '' : 's'} · ${topic.article_count ?? 1} update${(topic.article_count ?? 1) === 1 ? '' : 's'}`
    : (() => {
        const sourceCount = item?.metadata?.source_count || item?.sources?.length || 1;
        const isCurated = item?.metadata?.curated === true || item?.feed_type === 'curated';
        const statusLabel = isCurated
          ? `Curated${item?.metadata?.curated_platform ? ` · ${String(item.metadata.curated_platform).toUpperCase()}` : ''}`
          : 'New';
        return `${sourceCount} source${sourceCount === 1 ? '' : 's'} · ${statusLabel}`;
      })();

  const titleDecoded = he.decode(title);

  return (
    <View style={[styles.shell, { height, width: cardWidth, backgroundColor: ins.canvas }]}>
      <Pressable onPress={onPress} style={styles.cardPressable}>
        <View style={[styles.cardInner, { backgroundColor: ins.canvas }]}>
          <View style={[styles.imageShell, { height: imageHeight }]}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageUrl(fallbackUrl)}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.78)']}
              style={styles.imageGradient}
            />
            <View style={styles.tracePill}>
              <Text style={[styles.tracePillText, { color: ins.sub }]}>TRACE</Text>
            </View>
            <View style={styles.imageMeta}>
              <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.sourceName} numberOfLines={1}>
                {sourceName}
              </Text>
              {timeAgo !== '' && (
                <>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.time}>{timeAgo}</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.newsColumn}>
            <Text style={[styles.metaLine, { color: ins.sub }]} numberOfLines={1}>
              {metaLine}
            </Text>
            <Text style={[styles.newsHeading, { color: ins.textHead }]}>{titleDecoded}</Text>
            <ScrollView
              style={styles.overviewScroll}
              contentContainerStyle={styles.overviewContent}
              showsVerticalScrollIndicator={false}>
              {overview ? (
                <Text style={[styles.newsBody, { color: ins.textBody }]}>{overview}</Text>
              ) : null}
            </ScrollView>
            <Text style={[styles.swipeHint, { color: ins.sub }]}>Swipe up for next story</Text>
          </View>

          {locked && (
            <View style={[styles.lockOverlay, { bottom: BOTTOM_BAR_H, left: 0, right: 0, top: 0 }]}>
              <Image source={LOCK_IMAGE} style={styles.lockIcon} resizeMode="contain" />
            </View>
          )}
        </View>
      </Pressable>

      <View style={[styles.bottomChrome, { height: BOTTOM_BAR_H, backgroundColor: ins.barBg }]}>
        <View style={styles.bottomRow}>
          <View style={styles.bottomTextCol}>
            <Text style={[styles.bottomHeadline, { color: ins.barFg }]} numberOfLines={1}>
              {titleDecoded}
            </Text>
          </View>
          <View style={styles.bottomActions}>
            {bookmarkItem ? (
              <Pressable
                onPress={onToggleSave}
                style={styles.iconHit}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remove from saved' : 'Save story'}>
                <Heart
                  size={20}
                  color={ins.barFg}
                  fill={saved ? 'rgba(255,255,255,0.28)' : 'transparent'}
                  strokeWidth={2}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onShare}
              style={styles.iconHit}
              hitSlop={8}
              disabled={shareBusy}
              accessibilityRole="button"
              accessibilityLabel="Share story">
              <Share2 size={20} color={ins.barFg} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'column',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  cardPressable: {
    flex: 1,
    minHeight: 0,
  },
  cardInner: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  imageShell: {
    width: '100%',
    position: 'relative',
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
  },
  tracePill: {
    position: 'absolute',
    left: 14,
    bottom: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  tracePillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  imageMeta: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
  },
  dot: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  time: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: FontFamily.regular },
  newsColumn: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6,
  },
  metaLine: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.15,
  },
  newsHeading: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 21,
  },
  overviewScroll: {
    flex: 1,
    minHeight: 0,
  },
  overviewContent: {
    paddingBottom: 4,
    flexGrow: 1,
  },
  /** Roboto Flex 16 light / 153% — closest: 400 @ 16 / 24.5 */
  newsBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.06,
  },
  swipeHint: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.25,
  },
  lockOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    width: 56,
    height: 56,
  },
  bottomChrome: {
    width: '100%',
    overflow: 'hidden',
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
  },
  bottomRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    gap: 8,
  },
  bottomTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  bottomHeadline: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconHit: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
