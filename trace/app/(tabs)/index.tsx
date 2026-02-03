import { useState, useEffect, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FeedCard } from '@/components/FeedCard';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { FeedItem, SAMPLE_FEED_ITEMS, getLatestUserFeed } from '@/lib/firestore';

export default function FeedScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedDate, setFeedDate] = useState<string>('');

  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const isOnboarded = profile?.onboarded ?? false;

  const loadFeed = useCallback(async () => {
    if (!user) return;
    
    try {
      if (isOnboarded) {
        // Load personalized feed from Firestore
        const userFeed = await getLatestUserFeed(user.uid);
        if (userFeed && userFeed.items?.length > 0) {
          setFeed(userFeed.items);
          setFeedDate(userFeed.date);
        } else {
          // No feed yet, show sample
          setFeed(SAMPLE_FEED_ITEMS);
          setFeedDate('');
        }
      } else {
        // Not onboarded, show sample feed
        setFeed(SAMPLE_FEED_ITEMS);
        setFeedDate('');
      }
    } catch (error) {
      console.error('Error loading feed:', error);
      setFeed(SAMPLE_FEED_ITEMS);
    }
  }, [user, isOnboarded]);

  useEffect(() => {
    const initFeed = async () => {
      setIsLoading(true);
      await loadFeed();
      setIsLoading(false);
    };
    initFeed();
  }, [loadFeed]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadFeed();
    setIsRefreshing(false);
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Colors[colorScheme].border }]}>
        <View style={styles.headerLeft}>
          <Image
            source={require('@/assets/images/trace-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <ThemedText style={styles.headerTitle}>TRACE</ThemedText>
        </View>
        {user?.photoURL && (
          <Image source={{ uri: user.photoURL }} style={styles.avatar} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors[colorScheme].foreground}
          />
        }>
        
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <ThemedText style={[styles.eyebrow, { color: Colors[colorScheme].muted }]}>
            {feedDate ? `Feed · ${feedDate}` : 'Today'}
          </ThemedText>
          <ThemedText type="title" style={styles.welcomeTitle}>
            Hey, {firstName}
          </ThemedText>
          <ThemedText style={[styles.welcomeSubtitle, { color: Colors[colorScheme].secondary }]}>
            {isOnboarded 
              ? 'Your personalized feed is ready.' 
              : 'Discover content from across the web.'}
          </ThemedText>
        </View>

        {/* Onboarding Callout - Only show if not onboarded */}
        {!isOnboarded && (
          <Pressable 
            onPress={() => router.push('/onboarding')}
            style={[styles.calloutCard, { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }]}>
            <View style={styles.calloutIcon}>
              <ThemedText style={{ fontSize: 24 }}>✨</ThemedText>
            </View>
            <View style={styles.calloutContent}>
              <ThemedText style={styles.calloutTitle}>
                Make the feed yours
              </ThemedText>
              <ThemedText style={[styles.calloutSubtitle, { color: '#7c3aed' }]}>
                Complete onboarding to personalize your feed based on your interests.
              </ThemedText>
            </View>
            <ThemedText style={[styles.calloutArrow, { color: '#7c3aed' }]}>→</ThemedText>
          </Pressable>
        )}

        {/* Feed Generation Notice - Show when onboarded but no feed yet */}
        {isOnboarded && feed === SAMPLE_FEED_ITEMS && (
          <View style={[styles.noticeCard, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}>
            <View style={styles.noticeIcon}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
            <View style={styles.noticeContent}>
              <ThemedText style={styles.noticeTitle}>
                Building your personalized feed...
              </ThemedText>
              <ThemedText style={[styles.noticeSubtitle, { color: '#3b82f6' }]}>
                This usually takes about a minute. Here's some popular content in the meantime!
              </ThemedText>
            </View>
          </View>
        )}

        {/* Loading State */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map((i) => (
              <View 
                key={i} 
                style={[styles.skeletonCard, { backgroundColor: Colors[colorScheme].card }]}>
                <View style={[styles.skeletonBadge, { backgroundColor: Colors[colorScheme].border }]} />
                <View style={[styles.skeletonTitle, { backgroundColor: Colors[colorScheme].border }]} />
                <View style={[styles.skeletonSubtitle, { backgroundColor: Colors[colorScheme].border }]} />
              </View>
            ))}
          </View>
        ) : (
          /* Feed Cards */
          <View style={styles.feedContainer}>
            {feed.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                colorScheme={colorScheme}
                disabled={!isOnboarded}
              />
            ))}
          </View>
        )}

        {/* End of Feed */}
        {!isLoading && feed.length > 0 && (
          <View style={styles.endOfFeed}>
            <ThemedText style={[styles.endOfFeedText, { color: Colors[colorScheme].muted }]}>
              You're all caught up
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },
  welcomeSection: {
    gap: 4,
    marginBottom: 8,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 15,
    marginTop: 2,
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  calloutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutContent: {
    flex: 1,
    gap: 4,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  calloutSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  calloutArrow: {
    fontSize: 18,
    fontWeight: '600',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeContent: {
    flex: 1,
    gap: 4,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  noticeSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  loadingContainer: {
    gap: 12,
  },
  skeletonCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  skeletonBadge: {
    width: 60,
    height: 20,
    borderRadius: 10,
  },
  skeletonTitle: {
    width: '90%',
    height: 20,
    borderRadius: 6,
  },
  skeletonSubtitle: {
    width: '60%',
    height: 14,
    borderRadius: 6,
  },
  feedContainer: {
    gap: 12,
  },
  endOfFeed: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  endOfFeedText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
