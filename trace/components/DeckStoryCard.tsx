import { useState, useCallback, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  Share,
  Platform,
  type GestureResponderEvent,
} from 'react-native';
import { trackEvent } from '@/lib/posthog';
import { LinearGradient } from 'expo-linear-gradient';
import { Share2 } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import RNShare from 'react-native-share';

import { FontFamily } from '@/constants/theme';
import { FeedItem, TrendingTopic } from '@/lib/firestore';
import { getArticleImage } from '@/lib/fallback-images';
import { decodeHtmlEntities } from '@/lib/text-decode';
import { formatShareMessage } from '@/lib/article-share';

const LOCK_IMAGE = require('@/assets/images/lock.png');
const TAP_END_SLOP_PX = 18;
const TAP_MOVE_CANCEL_DY = 12;
const TAP_MAX_MS = 600;


const CARD_RADIUS = 12;
const INS = {
  canvas: '#FFFFFF',
  textHead: '#1B1B1B',
  textBody: '#797979',
  sub: '#B8B8B8',
};
const INS_DARK = {
  canvas: '#101010',
  textHead: '#F2F2F2',
  textBody: '#A3A3A3',
  sub: '#8C8C8C',
};


function truncateWords(text: string, limit: number): { text: string; truncated: boolean } {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return { text, truncated: false };
  return { text: words.slice(0, limit).join(' ') + '...', truncated: true };
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
  shareTitle: string;
  shareOverview: string;
  shareUrl?: string;
  onPress: () => void;
  pressEnabled?: boolean;
  swipeHint?: string;
  nextTitle?: string;
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
  shareTitle,
  shareOverview,
  shareUrl,
  onPress,
  pressEnabled = true,
  swipeHint,
  nextTitle,
  locked,
}: DeckStoryCardProps) {
  const isTrending = variant === 'trending';
  const display = isTrending && topic ? getTopicDisplay(topic) : null;
  const title = isTrending ? (display?.title || '') : (item?.title || '');
  const overview = overviewText;
  const thumbnail = isTrending ? display?.thumbnail : item?.thumbnail;
  const published = isTrending ? topic?.last_updated_at || topic?.first_seen_at : item?.published_date;
  const sourceName = isTrending
    ? (() => { const a = topic?.articles?.[0]; return a?.source_name || a?.source || 'Sources'; })()
    : item?.source_name || item?.source || '';
  const timeAgo = (() => {
    if (!published) return '';
    const ts = new Date(published).getTime();
    if (Number.isNaN(ts)) return '';
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  })();

  const ins = colorScheme === 'dark' ? INS_DARK : INS;

  const fallbackUrl = getArticleImage(null, title);
  const [imageUrl, setImageUrl] = useState(
    isRealImage(thumbnail) ? (thumbnail as string) : getArticleImage(thumbnail, title),
  );

  const imageHeight = Math.min(280, Math.max(170, Math.round(height * 0.38)));


  const [shareBusy, setShareBusy] = useState(false);
  const [shareViewMounted, setShareViewMounted] = useState(false);
  const shareViewRef = useRef<View>(null);
  const touchStartRef = useRef<{ x: number; y: number; at: number } | null>(null);

  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    touchStartRef.current = { x: pageX, y: pageY, at: Date.now() };
  }, []);

  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const { pageX, pageY } = event.nativeEvent;
    const dx = Math.abs(pageX - start.x);
    const dy = Math.abs(pageY - start.y);
    if (dy > TAP_MOVE_CANCEL_DY || dx > TAP_END_SLOP_PX) {
      touchStartRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback((event: GestureResponderEvent) => {
    if (!pressEnabled) {
      touchStartRef.current = null;
      return;
    }

    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const { pageX, pageY } = event.nativeEvent;
    const dx = Math.abs(pageX - start.x);
    const dy = Math.abs(pageY - start.y);
    const elapsed = Date.now() - start.at;

    if (dx <= TAP_END_SLOP_PX && dy <= TAP_END_SLOP_PX && elapsed <= TAP_MAX_MS) {
      onPress();
    }
  }, [onPress, pressEnabled]);

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  const onShare = useCallback(async () => {
    if (shareBusy) return;
    const t = decodeHtmlEntities(shareTitle).trim();
    const message = formatShareMessage(shareOverview || '', shareUrl);
    setShareBusy(true);
    trackEvent('share_initiated', {
      title: shareTitle,
      url: shareUrl,
      variant,
      has_thumbnail: !!thumbnail,
    });
    try {
      if (!thumbnail) {
        await Share.share(Platform.OS === 'ios' ? { message } : { message, title: t.slice(0, 80) });
        trackEvent('share_completed', { title: shareTitle, url: shareUrl, variant, method: 'text_only' });
        return;
      }
      // Mount the share view, wait a frame for it to render, then capture
      setShareViewMounted(true);
      await new Promise((r) => setTimeout(r, 80));
      const uri = await captureRef(shareViewRef, { format: 'png', quality: 1 });
      if (Platform.OS === 'ios') {
        await Share.share({ url: uri, message });
      } else {
        await RNShare.open({ message, url: `file://${uri}`, type: 'image/png' });
      }
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('[Share] error:', error);
        trackEvent('share_failed', { title: shareTitle, url: shareUrl, variant, error: error?.message });
      } else {
        trackEvent('share_cancelled', { title: shareTitle, url: shareUrl, variant });
      }
    } finally {
      setShareBusy(false);
      setShareViewMounted(false);
    }
  }, [shareBusy, shareTitle, shareOverview, shareUrl, thumbnail]);

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

  const titleDecoded = decodeHtmlEntities(title);

  return (
    <View style={[styles.shell, { height, width: cardWidth, backgroundColor: ins.canvas }]}>
      <View style={styles.cardPressable}>
        <View style={[styles.cardInner, { backgroundColor: ins.canvas }]}>
          <View style={[styles.imageShell, { height: imageHeight }]}>
            <View
              style={styles.imageTouchLayer}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}>
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
              <View style={styles.imageMeta}>
                <Text style={styles.sourceName} numberOfLines={1}>{sourceName}</Text>
                {timeAgo !== '' && (
                  <>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.time}>{timeAgo}</Text>
                  </>
                )}
              </View>
            </View>
            <Pressable
              onPress={onShare}
              style={styles.shareBtn}
              hitSlop={8}
              disabled={shareBusy}
              accessibilityRole="button"
              accessibilityLabel="Share story">
              <Share2 size={16} color="#1B1B1B" strokeWidth={2} />
            </Pressable>
          </View>

          <View
            style={styles.newsColumn}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}>
            <Text style={[styles.metaLine, { color: ins.sub }]} numberOfLines={1}>
              {metaLine}
            </Text>
            <Text style={[styles.newsHeading, { color: ins.textHead }]} numberOfLines={3}>{titleDecoded}</Text>
            {overview ? (
              <ScrollView
                style={styles.bodyWrap}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                scrollEventThrottle={16}>
                <Text style={[styles.newsBody, { color: ins.textBody }]}>
                  {truncateWords(overview, 62).text}
                </Text>
              </ScrollView>
            ) : null}
            <Text style={[styles.swipeHint, { color: ins.sub }]}>{swipeHint ?? 'Swipe up for next story'}</Text>
          </View>

          {locked && (
            <View
              style={[styles.lockOverlay, { bottom: 0, left: 0, right: 0, top: 0 }]}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}>
              <Image source={LOCK_IMAGE} style={styles.lockIcon} resizeMode="contain" />
            </View>
          )}
        </View>
      </View>

      {/* Hidden off-screen view — only mounted when sharing to avoid per-card render cost */}
      {shareViewMounted && (
      <View style={styles.shareViewContainer} pointerEvents="none">
        <View ref={shareViewRef} style={styles.shareView} collapsable={false}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.shareImage} resizeMode="cover" />
          ) : (
            <View style={[styles.shareImage, { backgroundColor: '#1a1a1a' }]} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={styles.shareGradient} />
          <View style={styles.shareTitleContainer}>
            <Text style={styles.shareTitleText} numberOfLines={3}>{titleDecoded}</Text>
            <Text style={styles.shareBranding}>trace</Text>
          </View>
        </View>
      </View>
      )}

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
    backgroundColor: '#1C1C1E',
  },
  imageTouchLayer: {
    ...StyleSheet.absoluteFillObject,
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
  imageMeta: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontSize: 19,
    lineHeight: 25,
  },
  bodyWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  newsBody: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 23,
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
  shareBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareViewContainer: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },
  shareView: {
    width: 400,
    height: 500,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  shareImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  shareGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
  },
  shareTitleContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    gap: 10,
  },
  shareTitleText: {
    fontFamily: FontFamily.regular,
    fontSize: 22,
    lineHeight: 29,
    color: '#fff',
  },
  shareBranding: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.5,
    textTransform: 'lowercase',
  },
});
