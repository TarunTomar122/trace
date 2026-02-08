import { Pressable, StyleSheet, View } from 'react-native';
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
  FileText,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { FeedItem } from '@/lib/firestore';

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

type FeedCardProps = {
  item: FeedItem;
  colorScheme: 'light' | 'dark';
  onPress?: () => void;
};

export function FeedCard({ item, colorScheme, onPress }: FeedCardProps) {
  const itemType = item.type || item.source || 'blog';
  const config = SOURCE_LABEL[itemType] || SOURCE_LABEL.blog;
  const Icon = config.icon;
  const relevance = item.metadata?.why_relevant;
  const isHot = item.metadata?.is_hot;
  const hasSummary = !!item.summary?.short_article?.body;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (item.url) {
      WebBrowser.openBrowserAsync(item.url);
    }
  };

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      {/* Source + meta line */}
      <View style={styles.metaRow}>
        <Icon size={14} color={config.color} strokeWidth={1.8} />
        <ThemedText style={[styles.sourceLabel, { color: Colors[colorScheme].muted }]}>
          {config.label}
        </ThemedText>
        {isHot && itemType !== 'news' && (
          <>
            <ThemedText style={[styles.dot, { color: Colors[colorScheme].border }]}>·</ThemedText>
            <Flame size={12} color="#ea580c" strokeWidth={2} />
            <ThemedText style={styles.hotLabel}>Trending</ThemedText>
          </>
        )}
      </View>

      {/* Title */}
      <ThemedText style={styles.title} numberOfLines={3}>
        {item.title}
      </ThemedText>

      {/* Bottom row: relevance + summary/external indicator */}
      <View style={styles.bottomRow}>
        {relevance ? (
          <ThemedText style={[styles.relevance, { color: Colors[colorScheme].muted }]} numberOfLines={1}>
            {relevance}
          </ThemedText>
        ) : <View />}
        {hasSummary ? (
          <View style={styles.summaryBadge}>
            <FileText size={11} color="#22c55e" strokeWidth={2} />
            <ThemedText style={styles.summaryBadgeText}>Summary</ThemedText>
          </View>
        ) : (
          <View style={styles.externalBadge}>
            <ExternalLink size={11} color={Colors[colorScheme].muted} strokeWidth={2} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 4,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sourceLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  dot: {
    fontSize: 13,
  },
  hotLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ea580c',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  relevance: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    marginRight: 8,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22c55e12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22c55e',
  },
  externalBadge: {
    padding: 3,
  },
});
