import { useState, useEffect } from 'react';
import { Pressable, StyleSheet, View, Text, Image, Share, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  Clock,
  Bookmark,
  BookmarkCheck,
  Share2,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { FeedItem } from '@/lib/firestore';
import { toggleBookmark, isBookmarked } from '@/lib/bookmarks';
import { getArticleImage } from '@/lib/fallback-images';

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

async function shareArticle(item: FeedItem) {
  try {
    const message = Platform.OS === 'ios'
      ? item.title
      : `${item.title}\n\n${item.url}`;

    await Share.share({
      message,
      url: item.url, // iOS only
      title: item.title,
    });
  } catch (error) {
    // User cancelled or error
  }
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
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^\s*#+\s*/gm, '')
    .trim();
}

function firstParagraph(text?: string): string {
  if (!text) return '';
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  const para = normalized.split(/\n\s*\n/)[0] || '';
  return stripMd(para);
}

/* ─── Types ───────────────────────────────────────────────── */

type CardProps = {
  item: FeedItem;
  colorScheme: 'light' | 'dark';
  onPress?: () => void;
  accentColor?: string;
};

/* ═══════════════════════════════════════════════════════════
   1. TrendingCard — compact, source-first, explore feel
   ═══════════════════════════════════════════════════════════ */

export function TrendingCard({ item, colorScheme, onPress, accentColor = '#F97316' }: CardProps) {
  const sourceName = item.source_name || item.source || '';
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(item.published_date);
  const subtitle = stripMd(item.summary?.short_article?.subtitle || '');
  const brief = firstParagraph(item.summary?.short_article?.body);
  const snippet = brief || subtitle || item.description || '';
  const imageUrl = getArticleImage(item.thumbnail, item.title);

  return (
    <Pressable onPress={onPress} style={tStyles.container}>
      {/* Hero image at top */}
      <View style={tStyles.heroWrap}>
        <Image
          source={{ uri: imageUrl }}
          style={tStyles.heroImg}
          resizeMode="cover"
        />
      </View>

      {/* Source row with share on right */}
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
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={12} onPress={() => shareArticle(item)} style={tStyles.actionBtn}>
          <Share2 size={18} color={Colors[colorScheme].muted} strokeWidth={1.6} />
        </Pressable>
      </View>

      {/* Title */}
      <Text
        style={[tStyles.title, { color: Colors[colorScheme].text }]}
        numberOfLines={3}>
        {item.title}
      </Text>

      {/* Snippet */}
      {snippet !== '' && (
        <Text
          style={[tStyles.snippet, { color: Colors[colorScheme].muted }]}
          numberOfLines={2}>
          {snippet}
        </Text>
      )}
    </Pressable>
  );
}

const tStyles = StyleSheet.create({
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
    marginBottom: 10,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  dot: { fontSize: 12 },
  time: { fontSize: 12 },
  actionBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  snippet: {
    fontSize: 14,
    lineHeight: 20,
  },
});

/* ═══════════════════════════════════════════════════════════
   2. ForYouCard — accent left bar, match badges, actions
   ═══════════════════════════════════════════════════════════ */

export function ForYouCard({ item, colorScheme, onPress, accentColor = ACCENT }: CardProps) {
  const sourceName = item.source_name || item.source || '';
  const initials = getSourceInitials(sourceName);
  const avatarBg = hashColor(sourceName);
  const timeAgo = getTimeAgo(item.published_date);
  const snippet = item.summary?.short_article?.subtitle || item.description || '';
  const readTime = item.summary?.reading_time_minutes;
  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const { saved, toggle: onToggleBookmark } = useBookmark(item);
  const accent = accentColor;

  return (
    <Pressable onPress={onPress} style={fyStyles.container}>
      {/* Hero image at top */}
      <View style={fyStyles.heroWrap}>
        <Image
          source={{ uri: imageUrl }}
          style={fyStyles.heroImg}
          resizeMode="cover"
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

      {/* Footer: read time + actions */}
      <View style={fyStyles.footerRow}>
        {readTime != null && (
          <View style={fyStyles.readTimePill}>
            <Clock size={12} color={Colors[colorScheme].muted} strokeWidth={1.8} />
            <Text style={[fyStyles.readTimeText, { color: Colors[colorScheme].muted }]}>
              {readTime} min read
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={12} onPress={() => shareArticle(item)} style={fyStyles.actionBtn}>
          <Share2 size={20} color={Colors[colorScheme].muted} strokeWidth={1.6} />
        </Pressable>
        <Pressable hitSlop={12} onPress={onToggleBookmark} style={fyStyles.actionBtn}>
          {saved ? (
            <BookmarkCheck size={20} color={accent} strokeWidth={2} />
          ) : (
            <Bookmark size={20} color={Colors[colorScheme].muted} strokeWidth={1.6} />
          )}
        </Pressable>
      </View>
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
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  dot: { fontSize: 12 },
  time: { fontSize: 12 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  snippet: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
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
    fontSize: 12,
    fontWeight: '500',
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
  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const { saved, toggle: onToggleBookmark } = useBookmark(item);
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

      {/* Footer actions */}
      <View style={ddStyles.footerRow}>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={12} onPress={() => shareArticle(item)} style={ddStyles.actionBtn}>
          <Share2 size={20} color={Colors[colorScheme].muted} strokeWidth={1.6} />
        </Pressable>
        <Pressable hitSlop={12} onPress={onToggleBookmark} style={ddStyles.actionBtn}>
          {saved ? (
            <BookmarkCheck size={20} color={accent} strokeWidth={2} />
          ) : (
            <Bookmark size={20} color={Colors[colorScheme].muted} strokeWidth={1.6} />
          )}
        </Pressable>
      </View>
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
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '700',
  },
  date: {
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
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  snippet: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  sectionsPreview: {
    fontSize: 12,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  actionBtn: {
    padding: 6,
    marginLeft: 10,
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
