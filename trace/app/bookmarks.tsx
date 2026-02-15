import { useState, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronLeft, BookmarkX } from 'lucide-react-native';

import BrainIllus from '@/assets/images/brain-brainstorm-brainstorming-svgrepo-com.svg';

import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/components/FeedCard';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FeedItem } from '@/lib/firestore';
import { getBookmarks, removeBookmark, BookmarkedItem } from '@/lib/bookmarks';
import { ILLUS_PALETTE } from '@/app/(auth)/welcome';

export default function BookmarksScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
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

  const handleRemove = async (id: string) => {
    await removeBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const handlePress = (item: FeedItem) => {
    const hasSummary = !!item.summary?.short_article?.body;
    if (hasSummary) {
      router.push({
        pathname: '/article',
        params: {
          title: item.title,
          url: item.url,
          type: item.type || item.source || 'blog',
          subtitle: item.summary?.short_article?.subtitle || '',
          body: item.summary?.short_article?.body || '',
          reading_time: item.summary?.reading_time_minutes?.toString() || '',
          why_relevant: item.metadata?.why_relevant || '',
          is_hot: item.metadata?.is_hot ? 'true' : 'false',
        },
      });
    } else if (item.url) {
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
        {bookmarks.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIllusContainer,
                { backgroundColor: ILLUS_PALETTE.lavender[colorScheme] },
              ]}
            >
              <BrainIllus width={80} height={80} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
              No saved items yet
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: Colors[colorScheme].muted }]}>
              Save anything worth revisiting {"—"} it{"'"}ll be here when you need it.
            </ThemedText>
          </View>
        ) : (
          <View>
            <ThemedText style={[styles.countText, { color: Colors[colorScheme].muted }]}>
              {bookmarks.length} saved
            </ThemedText>
            {bookmarks.map((item, index) => (
              <View key={item.id}>
                {index > 0 && (
                  <View
                    style={[styles.separator, { backgroundColor: Colors[colorScheme].border }]}
                  />
                )}
                <View style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <FeedCard
                      item={item}
                      colorScheme={colorScheme}
                      onPress={() => handlePress(item)}
                    />
                  </View>
                  <Pressable
                    onPress={() => handleRemove(item.id)}
                    hitSlop={8}
                    style={styles.removeButton}>
                    <BookmarkX size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                  </Pressable>
                </View>
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
  countText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeButton: {
    padding: 8,
    marginLeft: 4,
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
});

