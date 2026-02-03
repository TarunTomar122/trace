import { useState } from 'react';
import { Pressable, StyleSheet, View, Linking } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { FeedItem } from '@/lib/firestore';

// Source type configurations
const SOURCE_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  video: { color: '#ef4444', bgColor: '#fef2f2', label: 'VIDEO' },
  repo: { color: '#8b5cf6', bgColor: '#f5f3ff', label: 'REPO' },
  paper: { color: '#3b82f6', bgColor: '#eff6ff', label: 'PAPER' },
  blog: { color: '#10b981', bgColor: '#ecfdf5', label: 'ARTICLE' },
  discussion: { color: '#f59e0b', bgColor: '#fffbeb', label: 'DISCUSSION' },
  tweet: { color: '#0ea5e9', bgColor: '#f0f9ff', label: 'THREAD' },
  launch: { color: '#d946ef', bgColor: '#fdf4ff', label: 'LAUNCH' },
  model: { color: '#6366f1', bgColor: '#eef2ff', label: 'MODEL' },
  news: { color: '#f97316', bgColor: '#fff7ed', label: 'NEWS' },
};

type FeedCardProps = {
  item: FeedItem;
  colorScheme: 'light' | 'dark';
  disabled?: boolean;
  onUpvote?: () => void;
  onDownvote?: () => void;
  onBookmark?: () => void;
};

export function FeedCard({ 
  item, 
  colorScheme, 
  disabled = false,
  onUpvote,
  onDownvote,
  onBookmark,
}: FeedCardProps) {
  const [upvoted, setUpvoted] = useState(false);
  const [downvoted, setDownvoted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  
  const itemType = item.type || item.source || 'blog';
  const config = SOURCE_CONFIG[itemType] || SOURCE_CONFIG.blog;
  const relevance = item.metadata?.why_relevant;
  const isHot = item.metadata?.is_hot;

  const handlePress = () => {
    if (item.url) {
      Linking.openURL(item.url);
    }
  };

  const handleUpvote = () => {
    if (disabled) return;
    const newUpvoted = !upvoted;
    setUpvoted(newUpvoted);
    if (newUpvoted) {
      setDownvoted(false);
      onUpvote?.();
    }
  };

  const handleDownvote = () => {
    if (disabled) return;
    const newDownvoted = !downvoted;
    setDownvoted(newDownvoted);
    if (newDownvoted) {
      setUpvoted(false);
      onDownvote?.();
    }
  };

  const handleBookmark = () => {
    if (disabled) return;
    setBookmarked(!bookmarked);
    onBookmark?.();
  };

  return (
    <Pressable 
      style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
      onPress={handlePress}>
      {/* Header: Type badge + Hot badge */}
      <View style={styles.header}>
        <View style={[styles.typeBadge, { backgroundColor: config.bgColor }]}>
          <ThemedText style={[styles.typeText, { color: config.color }]}>
            {config.label}
          </ThemedText>
        </View>
        {isHot && itemType !== 'news' && (
          <View style={styles.hotBadge}>
            <MaterialIcons name="local-fire-department" size={12} color="#ea580c" />
            <ThemedText style={styles.hotText}>Hot</ThemedText>
          </View>
        )}
      </View>

      {/* Title */}
      <ThemedText style={styles.title} numberOfLines={2}>
        {item.title}
      </ThemedText>

      {/* Relevance */}
      {relevance && (
        <ThemedText style={[styles.relevance, { color: Colors[colorScheme].muted }]}>
          {relevance}
        </ThemedText>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable 
          onPress={handleUpvote}
          style={[
            styles.actionButton,
            upvoted && { backgroundColor: '#dcfce7' },
          ]}>
          <MaterialIcons 
            name={upvoted ? 'thumb-up' : 'thumb-up-off-alt'} 
            size={18} 
            color={upvoted ? '#22c55e' : Colors[colorScheme].muted} 
          />
        </Pressable>

        <Pressable 
          onPress={handleDownvote}
          style={[
            styles.actionButton,
            downvoted && { backgroundColor: '#fee2e2' },
          ]}>
          <MaterialIcons 
            name={downvoted ? 'thumb-down' : 'thumb-down-off-alt'} 
            size={18} 
            color={downvoted ? '#ef4444' : Colors[colorScheme].muted} 
          />
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable 
          onPress={handleBookmark}
          style={[
            styles.actionButton,
            bookmarked && { backgroundColor: Colors[colorScheme].foreground + '15' },
          ]}>
          <MaterialIcons 
            name={bookmarked ? 'bookmark' : 'bookmark-outline'} 
            size={20} 
            color={bookmarked ? Colors[colorScheme].foreground : Colors[colorScheme].muted} 
          />
        </Pressable>

        <Pressable style={styles.actionButton} onPress={handlePress}>
          <MaterialIcons 
            name="open-in-new" 
            size={18} 
            color={Colors[colorScheme].muted} 
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#fff7ed',
  },
  hotText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ea580c',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  relevance: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 10,
  },
});
