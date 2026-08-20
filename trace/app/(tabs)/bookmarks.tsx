import { useState, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock, Quote } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

import BookmarkIllus from '@/components/illustrations/BookmarkIllus';

import { ThemedText } from '@/components/themed-text';
import { TrendingCard, ForYouCard, DeepDiveCard } from '@/components/FeedCard';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { FeedItem } from '@/lib/firestore';
import { logReadingEvent } from '@/lib/reading-analytics';
import { getBookmarks, BookmarkedItem, getSnippets, Snippet } from '@/lib/bookmarks';
import { setCurrentArticle } from '@/lib/article-store';
import { ILLUS_PALETTE } from '@/app/(auth)/welcome';

type FilterType = 'all' | 'articles' | 'snippets';
type ArticleFeedType = 'trending' | 'for_you' | 'deep_dives';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'articles', label: 'Articles' },
  { key: 'snippets', label: 'Snippets' },
];

function getArticleFeedType(item: BookmarkedItem): ArticleFeedType {
  const feedType = item.feed_type || item.metadata?.feed_type || item.metadata?.feed_category;
  if (feedType === 'trending' || feedType === 'trending_news') return 'trending';
  if (feedType === 'deep_dives') return 'deep_dives';
  if (item.summary?.deep_dive) return 'deep_dives';
  return 'for_you';
}

function getAccentColor(feedType: ArticleFeedType): string {
  if (feedType === 'trending') return '#F97316';
  if (feedType === 'deep_dives') return '#0EA5E9';
  return '#F59E0B';
}

export default function BookmarksScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { isProUser, presentPaywall } = useRevenueCat();
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [items, savedSnippets] = await Promise.all([getBookmarks(), getSnippets()]);
        setBookmarks(items);
        setSnippets(savedSnippets);
      };
      load();
    }, [])
  );


  const handlePress = (item: FeedItem) => {
    logReadingEvent({
      eventType: 'feed_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      tags: item.tags,
      itemType: item.type || item.source,
      feedCategory: item.metadata?.feed_category,
    });
    setCurrentArticle(item);
    router.push('/article');
  };

  // Filter based on active filter
  const showArticles = activeFilter === 'all' || activeFilter === 'articles';
  const showSnippets = activeFilter === 'all' || activeFilter === 'snippets';

  // Only show filters if there's both articles and snippets
  const hasMultipleTypes = bookmarks.length > 0 && snippets.length > 0;

  const renderCard = (item: BookmarkedItem, index: number) => {
    const feedType = getArticleFeedType(item);
    const accentColor = getAccentColor(feedType);
    const showDivider = index < bookmarks.length - 1;

    const CardComponent = feedType === 'trending' ? TrendingCard
      : feedType === 'deep_dives' ? DeepDiveCard
      : ForYouCard;

    return (
      <View key={`${item.id}-${index}`}>
        <CardComponent
          item={item}
          colorScheme={colorScheme}
          onPress={() => handlePress(item)}
          accentColor={accentColor}
        />
        {showDivider && (
          <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />
        )}
      </View>
    );
  };

  if (!isProUser) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}>
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Saved</ThemedText>
        </View>
        <View style={styles.lockedState}>
          <View
            style={[
              styles.lockedIllusContainer,
              { backgroundColor: ILLUS_PALETTE.lavender[colorScheme] },
            ]}
          >
            <Lock size={48} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </View>
          <ThemedText style={[styles.lockedTitle, { color: Colors[colorScheme].text }]}>
            Bookmarks are for Pro users
          </ThemedText>
          <ThemedText style={[styles.lockedSub, { color: Colors[colorScheme].muted }]}>
            Upgrade to save articles and build your personal reading list.
          </ThemedText>
          <Pressable
            onPress={() => presentPaywall()}
            style={[styles.upgradeButton, { backgroundColor: Colors[colorScheme].accent }]}
          >
            <ThemedText style={[styles.upgradeButtonText, { color: Colors[colorScheme].accentForeground }]}>
              Upgrade to Pro
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}>

      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Saved</ThemedText>
        {(bookmarks.length > 0 || snippets.length > 0) && (
          <Text style={[styles.countText, { color: Colors[colorScheme].muted }]}>
            {bookmarks.length > 0 && `${bookmarks.length} ${bookmarks.length === 1 ? 'article' : 'articles'}`}
            {bookmarks.length > 0 && snippets.length > 0 && ' · '}
            {snippets.length > 0 && `${snippets.length} ${snippets.length === 1 ? 'snippet' : 'snippets'}`}
          </Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter chips - only if both articles and snippets exist */}
        {hasMultipleTypes && (
          <View style={styles.filterRow}>
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <Pressable
                  key={filter.key}
                  onPress={() => setActiveFilter(filter.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive
                        ? Colors[colorScheme].foreground
                        : Colors[colorScheme].card,
                      borderColor: Colors[colorScheme].border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      {
                        color: isActive
                          ? Colors[colorScheme].background
                          : Colors[colorScheme].muted,
                      },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Snippets section */}
        {showSnippets && snippets.length > 0 && (
          <View style={styles.snippetsSection}>
            <View style={styles.snippetsHeader}>
              <Quote size={16} color={Colors[colorScheme].muted} strokeWidth={2} />
              <Text style={[styles.snippetsTitle, { color: Colors[colorScheme].muted }]}>
                Snippets
              </Text>
            </View>
            {snippets.map((snippet) => (
              <Pressable
                key={snippet.id}
                onPress={() => router.push(`/snippet?id=${snippet.id}`)}
                style={[styles.snippetCard, { backgroundColor: Colors[colorScheme].card }]}
              >
                <Text style={[styles.snippetLabel, { color: Colors[colorScheme].muted }]} numberOfLines={1}>
                  {snippet.label}
                </Text>
                <Text
                  style={[styles.snippetContent, { color: Colors[colorScheme].text }]}
                  numberOfLines={3}
                >
                  {snippet.content.replace(/\*\*/g, '')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Articles section */}
        {showArticles && bookmarks.length > 0 && (
          <View style={styles.feedList}>
            {bookmarks.map((item, index) => renderCard(item, index))}
          </View>
        )}

        {/* Empty state */}
        {bookmarks.length === 0 && snippets.length === 0 && (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIllusContainer,
                { backgroundColor: ILLUS_PALETTE.lavender[colorScheme] },
              ]}
            >
              <BookmarkIllus width={80} height={80} color={Colors[colorScheme].text} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
              Nothing saved yet
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: Colors[colorScheme].muted }]}>
              Tap the bookmark icon on articles or save snippets from deep dives.
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FontFamilySerif.bold,
    letterSpacing: -0.5,
  },
  countText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    marginTop: 4,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },

  // Feed
  feedList: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    marginVertical: 16,
    opacity: 0.4,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyIllusContainer: {
    width: 140,
    height: 120,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FontFamily.semiBold,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },

  // Locked state
  lockedState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  lockedIllusContainer: {
    width: 140,
    height: 120,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lockedTitle: {
    fontSize: 18,
    fontFamily: FontFamily.semiBold,
    marginTop: 8,
  },
  lockedSub: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
    marginBottom: 12,
  },
  upgradeButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },

  // Snippets
  snippetsSection: {
    marginBottom: 24,
  },
  snippetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  snippetsTitle: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  snippetCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  snippetLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    marginBottom: 6,
  },
  snippetContent: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
});
