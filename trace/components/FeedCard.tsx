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
  FileText,
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

// ─── Pastel fallback colors (matching web frontend) ───
const PASTEL_COLORS: { bg: string; darkBg: string; text: string }[] = [
  { bg: '#FFE4E6', darkBg: '#3B1A1E', text: '#FB7185' },
  { bg: '#E0F2FE', darkBg: '#0C2A3E', text: '#38BDF8' },
  { bg: '#FEF3C7', darkBg: '#2E2410', text: '#FBBF24' },
  { bg: '#D1FAE5', darkBg: '#0A2E1A', text: '#34D399' },
  { bg: '#EDE9FE', darkBg: '#1E1530', text: '#A78BFA' },
  { bg: '#CCFBF1', darkBg: '#0A2925', text: '#2DD4BF' },
  { bg: '#FFEDD5', darkBg: '#2E1A08', text: '#FB923C' },
  { bg: '#E0E7FF', darkBg: '#151A30', text: '#818CF8' },
  { bg: '#FCE7F3', darkBg: '#30152A', text: '#F472B6' },
  { bg: '#CFFAFE', darkBg: '#0A2530', text: '#22D3EE' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getDomainLetter(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return hostname.charAt(0).toUpperCase();
  } catch {
    return '?';
  }
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
  const showRealImage = !!thumbnail && !imgError;

  // Pastel fallback
  const pastelIndex = hashString(item.url || item.id) % PASTEL_COLORS.length;
  const pastel = PASTEL_COLORS[pastelIndex];
  const letter = getDomainLetter(item.url);

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

          {/* Bottom: summary badge */}
          {hasSummary && (
            <View style={styles.summaryBadge}>
              <FileText size={11} color="#22c55e" strokeWidth={2} />
              <ThemedText style={styles.summaryBadgeText}>Summary</ThemedText>
            </View>
          )}
        </View>

        {/* Right: thumbnail or pastel fallback */}
        <View
          style={[
            styles.thumbnailWrap,
            {
              backgroundColor: showRealImage
                ? Colors[colorScheme].card
                : colorScheme === 'dark'
                  ? pastel.darkBg
                  : pastel.bg,
            },
          ]}
        >
          {showRealImage ? (
            <Image
              source={{ uri: thumbnail }}
              style={styles.thumbnail}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <ThemedText style={[styles.pastelLetter, { color: pastel.text }]}>
              {letter}
            </ThemedText>
          )}
        </View>
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
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#22c55e12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 2,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22c55e',
  },

  // ─── Thumbnail / fallback ───
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
  pastelLetter: {
    fontSize: 24,
    fontWeight: '600',
  },
});
