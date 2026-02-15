import { useState } from 'react';
import { Pressable, StyleSheet, View, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  Youtube,
  Github,
  BookOpen,
  MessageCircle,
  Sparkles,
  Newspaper,
  Flame,
  ExternalLink,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { FeedItem } from '@/lib/firestore';

// ─── Source config (matching web frontend) ───
const SOURCE_LABEL: Record<string, { icon: typeof Youtube; label: string; color: string }> = {
  video: { icon: Youtube, label: 'Video', color: '#ef4444' },
  repo: { icon: Github, label: 'Repo', color: '#8b5cf6' },
  paper: { icon: BookOpen, label: 'Paper', color: '#3b82f6' },
  blog: { icon: BookOpen, label: 'Article', color: '#10b981' },
  discussion: { icon: MessageCircle, label: 'Discussion', color: '#f59e0b' },
  tweet: { icon: MessageCircle, label: 'Thread', color: '#0ea5e9' },
  launch: { icon: Sparkles, label: 'Launch', color: '#d946ef' },
  model: { icon: Sparkles, label: 'Model', color: '#6366f1' },
  news: { icon: Newspaper, label: 'News', color: '#f97316' },
};

function isLikelyRealImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const value = url.trim().toLowerCase();
  if (!value.startsWith('http://') && !value.startsWith('https://')) return false;
  if (value.endsWith('.svg')) return false;
  if (value.includes('placeholder') || value.includes('ui-avatars.com')) return false;
  return true;
}

// ─── Category badge config (matching web frontend) ───
function getCategoryBadge(item: FeedItem): { label: string; color: string; bg: string } | null {
  const feedCategory = item.metadata?.feed_category;
  const isHot = item.metadata?.is_hot;

  if (feedCategory === 'trending_news' || isHot) {
    return { label: 'Trending', color: '#ea580c', bg: '#FFF7ED' };
  }
  if (feedCategory === 'suggested') {
    return { label: 'Suggested', color: '#9333ea', bg: '#FAF5FF' };
  }
  if (feedCategory === 'topics') {
    return { label: 'For You', color: '#2563eb', bg: '#EFF6FF' };
  }
  if (feedCategory === 'sample_summary') {
    return { label: 'Free summary', color: '#16a34a', bg: '#F0FDF4' };
  }
  return null;
}

// ─── Props ───
type FeedCardProps = {
  item: FeedItem;
  colorScheme: 'light' | 'dark';
  onPress?: () => void;
};

export function FeedCard({ item, colorScheme, onPress }: FeedCardProps) {
  const itemType = item.type || item.source || 'blog';
  const config = SOURCE_LABEL[itemType] || SOURCE_LABEL.blog;
  const Icon = config.icon;
  const hasSummary = !!item.summary?.short_article?.body;
  const snippet = item.summary?.short_article?.subtitle || item.description || '';
  const categoryBadge = getCategoryBadge(item);

  const thumbnail = item.thumbnail;
  const [imgError, setImgError] = useState(false);
  const showRealImage = isLikelyRealImageUrl(thumbnail) && !imgError;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (item.url) {
      WebBrowser.openBrowserAsync(item.url);
    }
  };

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.row}>
        {/* Left: text content */}
        <View style={styles.textContent}>
          {/* Source label */}
          <View style={styles.metaRow}>
            <Icon size={13} color={config.color} strokeWidth={1.8} />
            <ThemedText style={[styles.sourceLabel, { color: Colors[colorScheme].muted }]}>
              {config.label}
            </ThemedText>
            {categoryBadge && (
              <>
                <ThemedText style={[styles.dot, { color: Colors[colorScheme].border }]}>·</ThemedText>
                {categoryBadge.label === 'Trending' && (
                  <Flame size={11} color={categoryBadge.color} strokeWidth={2} />
                )}
                {categoryBadge.label === 'Free summary' && (
                  <Sparkles size={11} color={categoryBadge.color} strokeWidth={2} />
                )}
                <ThemedText style={[styles.categoryLabel, { color: categoryBadge.color }]}>
                  {categoryBadge.label}
                </ThemedText>
              </>
            )}
            {!hasSummary && (
              <>
                <ThemedText style={[styles.dot, { color: Colors[colorScheme].border }]}>·</ThemedText>
                <ExternalLink size={11} color={Colors[colorScheme].muted} strokeWidth={1.8} />
              </>
            )}
          </View>

          {/* Title */}
          <ThemedText style={styles.title} numberOfLines={3}>
            {item.title}
          </ThemedText>

          {/* Snippet */}
          {snippet ? (
            <ThemedText
              style={[styles.snippet, { color: Colors[colorScheme].muted }]}
              numberOfLines={2}
            >
              {snippet}
            </ThemedText>
          ) : null}

        </View>

        {/* Right: show only real source image */}
        {showRealImage && (
          <View style={[styles.thumbnailWrap, { backgroundColor: Colors[colorScheme].card }]}>
            <Image
              source={{ uri: thumbnail }}
              style={styles.thumbnail}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  textContent: {
    flex: 1,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sourceLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  dot: {
    fontSize: 12,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
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
  // ─── Thumbnail ───
  thumbnailWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
});
