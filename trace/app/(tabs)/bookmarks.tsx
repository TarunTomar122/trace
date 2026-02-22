import { useState, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronLeft, Lock } from 'lucide-react-native';

import BookmarkIllus from '@/components/illustrations/BookmarkIllus';

import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/components/FeedCard';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { FeedItem } from '@/lib/firestore';
import { logReadingEvent } from '@/lib/reading-analytics';
import { getBookmarks, BookmarkedItem } from '@/lib/bookmarks';
import { ILLUS_PALETTE } from '@/app/(auth)/welcome';

export default function BookmarksScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { isProUser, presentPaywall } = useRevenueCat();
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);

  // Reload bookmarks every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const items = await getBookmarks();
        setBookmarks(items);
      };
      load();
    }, [])
  );

  const handlePress = (item: FeedItem) => {
    const hasSummary = !!item.summary?.short_article?.body;
    logReadingEvent({
      eventType: 'feed_open',
      itemId: item.id,
      title: item.title,
      url: item.url,
      tags: item.tags,
      itemType: item.type || item.source,
      feedCategory: item.metadata?.feed_category,
    });
    if (hasSummary) {
      router.push({
        pathname: '/article',
        params: {
          id: item.id,
          title: item.title,
          url: item.url,
          thumbnail: item.thumbnail || '',
          type: item.type || item.source || 'blog',
          subtitle: item.summary?.short_article?.subtitle || '',
          body: item.summary?.short_article?.body || '',
          reading_time: item.summary?.reading_time_minutes?.toString() || '',
          why_relevant: item.metadata?.why_relevant || '',
          is_hot: item.metadata?.is_hot ? 'true' : 'false',
          feed_category: item.metadata?.feed_category || '',
        },
      });
    } else if (item.url) {
      logReadingEvent({
        eventType: 'external_open',
        itemId: item.id,
        title: item.title,
        url: item.url,
        tags: item.tags,
        itemType: item.type || item.source,
        feedCategory: item.metadata?.feed_category,
      });
      WebBrowser.openBrowserAsync(item.url);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors[colorScheme].foreground} strokeWidth={2} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Saved</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {!isProUser ? (
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
              Upgrade to save articles and build your personal knowledge base.
            </ThemedText>
            <Pressable
              onPress={() => presentPaywall()}
              style={[styles.upgradeButton, { backgroundColor: '#22c55e' }]}
            >
              <ThemedText style={[styles.upgradeButtonText, { color: '#fff' }]}>
                Upgrade to Pro
              </ThemedText>
            </Pressable>
          </View>
        ) : bookmarks.length === 0 ? (
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
              No saved items yet
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: Colors[colorScheme].muted }]}>
              Save anything worth revisiting - it{"'"}ll be here when you need it.
            </ThemedText>
          </View>
        ) : (
          <View>
            {bookmarks.map((item, index) => (
              <View key={item.id}>
                {index > 0 && (
                  <View
                    style={[styles.separator, { backgroundColor: Colors[colorScheme].border }]}
                  />
                )}
                <FeedCard
                  item={item}
                  colorScheme={colorScheme}
                  onPress={() => handlePress(item)}
                />
              </View>
            ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
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
    fontWeight: '600',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
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
    fontWeight: '600',
    marginTop: 8,
  },
  lockedSub: {
    fontSize: 14,
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
    fontWeight: '600',
  },
});

