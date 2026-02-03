import { useState, useRef, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { SAMPLE_FEED_ITEMS } from '@/lib/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Onboarding slides data
const SLIDES = [
  {
    id: '1',
    title: 'Your personalized feed',
    subtitle: 'AI-curated content from YouTube, GitHub, arXiv, HN and more — tailored to your interests.',
    type: 'feed',
  },
  {
    id: '2',
    title: 'Teach it your taste',
    subtitle: 'Upvote what you love, downvote what you don\'t. Trace learns and gets smarter every day.',
    type: 'voting',
  },
  {
    id: '3',
    title: 'Fresh every morning',
    subtitle: '15-20 hand-picked items daily. No doomscrolling, no algorithm games — just signal.',
    type: 'sources',
  },
];

// Source icons for the sources slide
const SOURCES = [
  { emoji: '📹', label: 'YouTube', color: '#ef4444' },
  { emoji: '💻', label: 'GitHub', color: '#8b5cf6' },
  { emoji: '📰', label: 'Blogs', color: '#10b981' },
  { emoji: '💬', label: 'HN', color: '#f59e0b' },
  { emoji: '📄', label: 'arXiv', color: '#3b82f6' },
  { emoji: '🐦', label: 'X/Twitter', color: '#0ea5e9' },
];

// Mini feed card for preview
function MiniFeedCard({ item, colorScheme }: { item: typeof SAMPLE_FEED_ITEMS[0]; colorScheme: 'light' | 'dark' }) {
  const typeColors: Record<string, string> = {
    video: '#ef4444',
    blog: '#10b981',
    discussion: '#f59e0b',
    repo: '#8b5cf6',
    paper: '#3b82f6',
  };
  
  const typeLabels: Record<string, string> = {
    video: 'VIDEO',
    blog: 'ARTICLE',
    discussion: 'DISCUSSION',
    repo: 'REPO',
    paper: 'PAPER',
  };
  
  const itemType = item.type || 'blog';
  const color = typeColors[itemType] || typeColors.blog;
  
  return (
    <View style={[styles.miniCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
      <View style={styles.miniCardHeader}>
        <ThemedText style={[styles.miniCardType, { color }]}>
          {typeLabels[itemType] || 'ARTICLE'}
        </ThemedText>
        {item.metadata?.is_hot && (
          <View style={styles.hotBadge}>
            <ThemedText style={styles.hotBadgeText}>🔥 Hot</ThemedText>
          </View>
        )}
      </View>
      <ThemedText style={styles.miniCardTitle} numberOfLines={2}>
        {item.title}
      </ThemedText>
      {item.metadata?.why_relevant && (
        <ThemedText style={[styles.miniCardMeta, { color: Colors[colorScheme].muted }]}>
          {item.metadata.why_relevant}
        </ThemedText>
      )}
    </View>
  );
}

// Interactive voting card demo
function VotingDemo({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  return (
    <View style={styles.votingDemo}>
      {/* Sample card with voting UI */}
      <View style={[styles.demoCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
        <View style={styles.demoCardHeader}>
          <View style={[styles.demoBadge, { backgroundColor: '#fef2f2' }]}>
            <ThemedText style={[styles.demoBadgeText, { color: '#ef4444' }]}>VIDEO</ThemedText>
          </View>
        </View>
        <ThemedText style={styles.demoTitle}>How I Built a $10K/month SaaS in 3 Months</ThemedText>
        <ThemedText style={[styles.demoMeta, { color: Colors[colorScheme].muted }]}>Trending in Indie Dev</ThemedText>
        
        {/* Voting buttons */}
        <View style={styles.votingRow}>
          <View style={[styles.voteButton, styles.upvoteActive]}>
            <MaterialIcons name="thumb-up" size={18} color="#22c55e" />
          </View>
          <View style={styles.voteButton}>
            <MaterialIcons name="thumb-down-off-alt" size={18} color={Colors[colorScheme].muted} />
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.voteButton}>
            <MaterialIcons name="bookmark-outline" size={20} color={Colors[colorScheme].muted} />
          </View>
        </View>
      </View>
      
      {/* Learning indicator */}
      <View style={[styles.learningPill, { backgroundColor: '#dcfce7' }]}>
        <MaterialIcons name="check-circle" size={14} color="#166534" style={{ marginRight: 6 }} />
        <ThemedText style={styles.learningText}>Trace learned: You like Indie Dev content</ThemedText>
      </View>
      
      {/* Second card showing downvote */}
      <View style={[styles.demoCard, styles.demoCardFaded, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
        <View style={styles.demoCardHeader}>
          <View style={[styles.demoBadge, { backgroundColor: '#eff6ff' }]}>
            <ThemedText style={[styles.demoBadgeText, { color: '#3b82f6' }]}>PAPER</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.demoTitle, { opacity: 0.6 }]}>Theoretical Foundations of Quantum ML...</ThemedText>
        <View style={styles.votingRow}>
          <View style={styles.voteButton}>
            <MaterialIcons name="thumb-up-off-alt" size={18} color={Colors[colorScheme].muted} />
          </View>
          <View style={[styles.voteButton, styles.downvoteActive]}>
            <MaterialIcons name="thumb-down" size={18} color="#ef4444" />
          </View>
        </View>
      </View>
    </View>
  );
}

// Sources grid
function SourcesGrid({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  return (
    <View style={styles.sourcesDemo}>
      <View style={styles.sourcesGrid}>
        {SOURCES.map((source, index) => (
          <View 
            key={index} 
            style={[styles.sourceItem, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <ThemedText style={styles.sourceEmoji}>{source.emoji}</ThemedText>
            <ThemedText style={[styles.sourceLabel, { color: source.color }]}>{source.label}</ThemedText>
          </View>
        ))}
      </View>
      
      {/* Daily feed preview */}
      <View style={[styles.dailyPreview, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
        <View style={styles.dailyHeader}>
          <ThemedText style={styles.dailyDate}>Today's Feed</ThemedText>
          <View style={[styles.countBadge, { backgroundColor: Colors[colorScheme].foreground }]}>
            <ThemedText style={[styles.countText, { color: Colors[colorScheme].background }]}>18 items</ThemedText>
          </View>
        </View>
        <View style={styles.dailyItems}>
          <View style={styles.dailyItem}>
            <View style={[styles.dailyDot, { backgroundColor: '#ef4444' }]} />
            <ThemedText style={styles.dailyItemText}>5 videos</ThemedText>
          </View>
          <View style={styles.dailyItem}>
            <View style={[styles.dailyDot, { backgroundColor: '#10b981' }]} />
            <ThemedText style={styles.dailyItemText}>8 articles</ThemedText>
          </View>
          <View style={styles.dailyItem}>
            <View style={[styles.dailyDot, { backgroundColor: '#f59e0b' }]} />
            <ThemedText style={styles.dailyItemText}>3 discussions</ThemedText>
          </View>
          <View style={styles.dailyItem}>
            <View style={[styles.dailyDot, { backgroundColor: '#8b5cf6' }]} />
            <ThemedText style={styles.dailyItemText}>2 repos</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const { signInWithGoogle } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      {item.type === 'feed' && (
        <View style={styles.feedPreview}>
          {SAMPLE_FEED_ITEMS.slice(0, 3).map((feedItem) => (
            <MiniFeedCard key={feedItem.id} item={feedItem} colorScheme={colorScheme} />
          ))}
        </View>
      )}
      {item.type === 'voting' && (
        <VotingDemo colorScheme={colorScheme} />
      )}
      {item.type === 'sources' && (
        <SourcesGrid colorScheme={colorScheme} />
      )}
      <View style={styles.slideContent}>
        <ThemedText style={styles.slideTitle}>{item.title}</ThemedText>
        <ThemedText style={[styles.slideSubtitle, { color: Colors[colorScheme].secondary }]}>
          {item.subtitle}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}>
      <ThemedView style={styles.container}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoRow}>
            <Image
              source={require('@/assets/images/trace-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText style={styles.logoText}>TRACE</ThemedText>
          </View>
        </View>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          keyExtractor={(item) => item.id}
          style={styles.slideList}
        />

        {/* Pagination dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentIndex 
                    ? Colors[colorScheme].foreground 
                    : Colors[colorScheme].border,
                },
              ]}
            />
          ))}
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: Colors[colorScheme].foreground },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={Colors[colorScheme].background} />
            ) : (
              <ThemedText style={[styles.primaryButtonText, { color: Colors[colorScheme].background }]}>
                Get Started with Google
              </ThemedText>
            )}
          </Pressable>

          {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

          <ThemedText style={[styles.footer, { color: Colors[colorScheme].muted }]}>
            By continuing, you agree to our terms and privacy policy.
          </ThemedText>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 28,
    height: 28,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  slideList: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedPreview: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  miniCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  miniCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniCardType: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  hotBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  hotBadgeText: {
    fontSize: 9,
    fontWeight: '500',
  },
  miniCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  miniCardMeta: {
    fontSize: 11,
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  slideSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ctaSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 16,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: Fonts.mono,
    letterSpacing: 0.5,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
  },
  // Voting Demo styles
  votingDemo: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  demoCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  demoCardFaded: {
    opacity: 0.7,
  },
  demoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  demoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  demoBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  demoMeta: {
    fontSize: 11,
  },
  votingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  voteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upvoteActive: {
    backgroundColor: '#dcfce7',
  },
  downvoteActive: {
    backgroundColor: '#fee2e2',
  },
  learningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  learningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  // Sources Grid styles
  sourcesDemo: {
    width: '100%',
    gap: 14,
    marginBottom: 24,
  },
  sourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  sourceItem: {
    width: 100,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  sourceEmoji: {
    fontSize: 24,
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  dailyPreview: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  dailyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dailyDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dailyItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dailyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dailyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dailyItemText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

