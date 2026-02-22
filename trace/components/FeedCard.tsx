import { useState, useEffect } from 'react';
import { Pressable, StyleSheet, View, Text, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  Clock,
  Bookmark,
  BookmarkCheck,
  Layers,
  Lightbulb,
  Info,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { FeedItem } from '@/lib/firestore';
import { toggleBookmark, isBookmarked } from '@/lib/bookmarks';

function useBookmark(item: FeedItem) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    isBookmarked(item.id).then(setSaved);
  }, [item.id]);
  const toggle = async () => {
    const nowSaved = await toggleBookmark(item);
    setSaved(nowSaved);
  };
  return { saved, toggle };
}

function isLikelyRealImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const v = url.trim().toLowerCase();
  if (!v.startsWith('http://') && !v.startsWith('https://')) return false;
  if (v.endsWith('.svg')) return false;
  if (v.includes('placeholder') || v.includes('ui-avatars.com')) return false;
  return true;
}

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

const TOPIC_MAP: Record<string, { label: string; color: string }> = {
  'technology': { label: 'AI', color: '#3b82f6' },
  'experience': { label: 'DESIGN', color: '#ec4899' },
  'business-market': { label: 'PRODUCT', color: '#f97316' },
  'startups': { label: 'STARTUPS', color: '#8b5cf6' },
  'leadership': { label: 'LEADERSHIP', color: '#ef4444' },
  'engineering': { label: 'TECH', color: '#06b6d4' },
  'marketing': { label: 'GROWTH', color: '#22c55e' },
  'fintech': { label: 'FINTECH', color: '#eab308' },
  'health': { label: 'HEALTH', color: '#14b8a6' },
  'web3': { label: 'WEB3', color: '#6366f1' },
  'climate': { label: 'CLIMATE', color: '#84cc16' },
  'productivity': { label: 'PRODUCTIVITY', color: '#a855f7' },
};

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

/* ─── Types ───────────────────────────────────────────────── */

type CardProps = {
  item: FeedItem;
  colorScheme: 'light' | 'dark';
  onPress?: () => void;
};

/* ═══════════════════════════════════════════════════════════
   1. TrendingCard — compact, source-first, explore feel
   ═══════════════════════════════════════════════════════════ */

export function TrendingCard({ item, colorScheme, onPress }: CardProps) {
  const sourceName = item.source_name || item.source || '';
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(item.published_date);
  const topic = TOPIC_MAP[item.interest_id || ''];
  const snippet = item.summary?.short_article?.subtitle || item.description || '';
  const [imgErr, setImgErr] = useState(false);
  const showImg = isLikelyRealImageUrl(item.thumbnail) && !imgErr;

  return (
    <Pressable onPress={onPress} style={tStyles.container}>
      {/* Content */}
      <View style={tStyles.content}>
        <View style={tStyles.sourceRow}>
          <View style={[tStyles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={tStyles.avatarText}>{initials}</Text>
          </View>
          <Text
            style={[tStyles.sourceName, { color: Colors[colorScheme].muted }]}
            numberOfLines={1}>
            {sourceName}
          </Text>
          {timeAgo !== '' && (
            <>
              <Text style={[tStyles.dot, { color: Colors[colorScheme].border }]}>·</Text>
              <Text style={[tStyles.time, { color: Colors[colorScheme].muted }]}>{timeAgo}</Text>
            </>
          )}
          {topic && (
            <View style={[tStyles.topicBadge, { backgroundColor: topic.color + '20' }]}>
              <Text style={[tStyles.topicText, { color: topic.color }]}>{topic.label}</Text>
            </View>
          )}
        </View>

        <Text
          style={[tStyles.title, { color: Colors[colorScheme].text }]}
          numberOfLines={2}>
          {item.title}
        </Text>

        {snippet !== '' && (
          <Text
            style={[tStyles.snippet, { color: Colors[colorScheme].muted }]}
            numberOfLines={2}>
            {snippet}
          </Text>
        )}
      </View>

      {/* Thumbnail */}
      {showImg && (
        <View style={[tStyles.thumbWrap, { backgroundColor: Colors[colorScheme].card }]}>
          <Image
            source={{ uri: item.thumbnail! }}
            style={tStyles.thumb}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        </View>
      )}
    </Pressable>
  );
}

const tStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 14,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  dot: { fontSize: 12 },
  time: { fontSize: 11 },
  topicBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 2,
  },
  topicText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  snippet: {
    fontSize: 13,
    lineHeight: 18,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
});

/* ═══════════════════════════════════════════════════════════
   2. ForYouCard — accent left bar, match badges, actions
   ═══════════════════════════════════════════════════════════ */

export function ForYouCard({ item, colorScheme, onPress }: CardProps) {
  const sourceName = item.source_name || item.source || '';
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(item.published_date);
  const topic = TOPIC_MAP[item.interest_id || ''];
  const snippet = item.summary?.short_article?.subtitle || item.description || '';
  const readTime = item.summary?.reading_time_minutes;
  const itemType = item.type || item.source || 'blog';
  const typeLabel = itemType === 'video' ? 'Video' : 'Article';
  const [imgErr, setImgErr] = useState(false);
  const showImg = isLikelyRealImageUrl(item.thumbnail) && !imgErr;
  const { saved, toggle: onToggleBookmark } = useBookmark(item);

  return (
    <Pressable onPress={onPress} style={fyStyles.container}>
      <View style={[fyStyles.accentBar, { backgroundColor: ACCENT + '50' }]} />

      <View style={fyStyles.content}>
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
          <View style={{ flex: 1 }} />
          {readTime != null && (
            <View style={fyStyles.readTimePill}>
              <Clock size={10} color={Colors[colorScheme].muted} strokeWidth={1.8} />
              <Text style={[fyStyles.readTimeText, { color: Colors[colorScheme].muted }]}>
                {typeLabel} · {readTime} min
              </Text>
            </View>
          )}
        </View>

        {/* Body: text column + thumbnail */}
        <View style={fyStyles.bodyRow}>
          <View style={fyStyles.textCol}>
            <Text
              style={[fyStyles.title, { color: Colors[colorScheme].text }]}
              numberOfLines={showImg ? 2 : 3}>
              {item.title}
            </Text>
            {snippet !== '' && (
              <Text
                style={[fyStyles.snippet, { color: Colors[colorScheme].muted }]}
                numberOfLines={showImg ? 2 : 3}>
                {snippet}
              </Text>
            )}
          </View>
          {showImg && (
            <View style={[fyStyles.thumbWrap, { backgroundColor: Colors[colorScheme].card }]}>
              <Image
                source={{ uri: item.thumbnail! }}
                style={fyStyles.thumb}
                resizeMode="cover"
                onError={() => setImgErr(true)}
              />
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={fyStyles.footer}>
          {topic && (
            <View style={[fyStyles.topicPill, { backgroundColor: topic.color + '20' }]}>
              <Text style={[fyStyles.topicPillText, { color: topic.color }]}>{topic.label}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={8} onPress={onToggleBookmark}>
            {saved ? (
              <BookmarkCheck size={18} color={ACCENT} strokeWidth={2} />
            ) : (
              <Bookmark size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const fyStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  accentBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 14,
  },
  content: {
    flex: 1,
    gap: 10,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  dot: { fontSize: 12 },
  time: { fontSize: 11 },
  readTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readTimeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  textCol: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  thumbWrap: {
    width: 88,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  snippet: {
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  topicPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  topicPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

/* ═══════════════════════════════════════════════════════════
   3. DeepDiveCard — elevated card, key sections, longer reads
   ═══════════════════════════════════════════════════════════ */

export function DeepDiveCard({ item, colorScheme, onPress }: CardProps) {
  const sourceName = item.source_name || item.source || '';
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(item.published_date);
  const topic = TOPIC_MAP[item.interest_id || ''];
  const snippet = item.summary?.short_article?.subtitle || item.description || '';
  const readTime = item.summary?.reading_time_minutes;
  const sections = item.summary?.short_article?.outline;
  const takeaways = item.summary?.short_article?.key_takeaways;
  const whyMatters = item.summary?.short_article?.why_it_matters;
  const [imgErr, setImgErr] = useState(false);
  const showImg = isLikelyRealImageUrl(item.thumbnail) && !imgErr;
  const { saved, toggle: onToggleBookmark } = useBookmark(item);

  const cardBg = colorScheme === 'dark' ? '#161616' : '#f5f5f0';
  const sectionBg = colorScheme === 'dark' ? '#1f1f1f' : '#eaeae5';

  return (
    <Pressable onPress={onPress} style={[ddStyles.card, { backgroundColor: cardBg }]}>
      {/* Hero image */}
      {showImg && (
        <View style={ddStyles.heroWrap}>
          <Image
            source={{ uri: item.thumbnail! }}
            style={ddStyles.heroImg}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        </View>
      )}

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
            <View style={[ddStyles.readTimeBadge, { borderColor: ACCENT }]}>
              <Clock size={12} color={ACCENT} strokeWidth={2} />
              <Text style={[ddStyles.readTimeText, { color: ACCENT }]}>{readTime} min</Text>
            </View>
          )}
          <Pressable hitSlop={8} onPress={onToggleBookmark}>
            {saved ? (
              <BookmarkCheck size={18} color={ACCENT} strokeWidth={2} />
            ) : (
              <Bookmark size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            )}
          </Pressable>
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

      {/* Key Sections */}
      {sections && sections.length > 0 && (
        <View style={[ddStyles.sectionsBox, { backgroundColor: sectionBg }]}>
          <View style={ddStyles.sectionsHeader}>
            <Layers size={12} color={Colors[colorScheme].muted} strokeWidth={2} />
            <Text style={[ddStyles.sectionsLabel, { color: Colors[colorScheme].muted }]}>
              KEY SECTIONS
            </Text>
          </View>
          <Text
            style={[ddStyles.sectionsText, { color: Colors[colorScheme].text }]}
            numberOfLines={2}>
            {sections.join(' · ')}
          </Text>
        </View>
      )}

      {/* Key Takeaways */}
      {takeaways && takeaways.length > 0 && (
        <View style={ddStyles.takeawaysBox}>
          <View style={ddStyles.sectionsHeader}>
            <Lightbulb size={12} color={ACCENT} strokeWidth={2} />
            <Text style={[ddStyles.sectionsLabel, { color: ACCENT }]}>
              KEY TAKEAWAYS
            </Text>
          </View>
          {takeaways.map((t, idx) => (
            <View key={idx} style={ddStyles.takeawayRow}>
              <Text style={[ddStyles.takeawayBullet, { color: ACCENT }]}>•</Text>
              <Text style={[ddStyles.takeawayText, { color: Colors[colorScheme].text }]}>
                {t}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Why It Matters */}
      {whyMatters ? (
        <View style={ddStyles.whyBox}>
          <Info size={12} color={Colors[colorScheme].muted} strokeWidth={2} />
          <Text style={[ddStyles.whyText, { color: Colors[colorScheme].muted }]}>
            {whyMatters}
          </Text>
        </View>
      ) : null}

      {/* Footer */}
      {topic && (
        <View style={ddStyles.footer}>
          <View style={[ddStyles.topicPill, { backgroundColor: topic.color + '20' }]}>
            <Text style={[ddStyles.topicPillText, { color: topic.color }]}>{topic.label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const ddStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    gap: 12,
    marginVertical: 6,
    overflow: 'hidden',
  },
  heroWrap: {
    height: 140,
    marginHorizontal: -18,
    marginTop: -18,
    marginBottom: 0,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '700',
  },
  date: {
    fontSize: 11,
    marginTop: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  readTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  readTimeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  snippet: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionsBox: {
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  sectionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionsLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionsText: {
    fontSize: 13,
    lineHeight: 18,
  },
  takeawaysBox: {
    gap: 6,
  },
  takeawayRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
  },
  takeawayBullet: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  takeawayText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  whyBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  whyText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  topicPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  topicPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
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
          {item.title}
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
    fontSize: 12,
    fontWeight: '500',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  snippet: {
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
    fontSize: 11,
    fontWeight: '500',
  },
});
