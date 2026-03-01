import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  Flame,
  Crosshair,
  GraduationCap,
  Clock,
  ChevronRight,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { AppLogo } from '@/components/app-logo';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

export const ILLUS_PALETTE = {
  coral: { light: '#FEF2F2', dark: '#1a1212' },
  olive: { light: '#FEF9E7', dark: '#1a1708' },
  lavender: { light: '#F0F9FF', dark: '#0a1218' },
  gold: { light: '#FFFBEB', dark: '#1a1608' },
};

const TERMS_URL = 'https://www.yourtrace.online/terms';
const PRIVACY_URL = 'https://www.yourtrace.online/privacy-policy';

// Demo data for preview cards
const DEMO_TRENDING = {
  source: 'The Verge',
  title: 'OpenAI announces GPT-5 with breakthrough reasoning capabilities',
  time: '2h ago',
  image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&q=80',
};

const DEMO_FOR_YOU = {
  source: 'Lenny\'s Newsletter',
  title: 'The art of saying no: How top PMs protect their roadmap',
  subtitle: 'Why the best product managers are ruthless prioritizers',
  time: '5 min read',
  image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80',
};

const DEMO_DEEP_DIVE = {
  source: 'Stratechery',
  title: 'The end of the subscription era',
  subtitle: 'How AI is reshaping software business models',
  chapters: ['The subscription peak', 'AI changes everything', 'What comes next'],
  time: '12 min read',
  image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80',
};

// Intro pages with live demo cards
const INTRO_PAGES = [
  {
    icon: Flame,
    iconColor: '#F97316',
    badge: 'TRENDING',
    badgeColor: '#F97316',
    title: 'See what\'s buzzing',
    body: 'Every morning, catch up on the stories everyone\'s talking about.',
    demo: 'trending',
  },
  {
    icon: Crosshair,
    iconColor: '#F59E0B',
    badge: 'FOR YOU',
    badgeColor: '#F59E0B',
    title: 'Matched to your interests',
    body: 'AI finds articles you\'ll actually want to read based on your role and interests.',
    demo: 'for_you',
  },
  {
    icon: GraduationCap,
    iconColor: '#0EA5E9',
    badge: 'DEEP DIVES',
    badgeColor: '#0EA5E9',
    title: 'Go deeper with experts',
    body: 'Long-form reads from sources you trust, with chapter summaries.',
    demo: 'deep_dive',
  },
];

// Demo Card Components
function DemoTrendingCard({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  return (
    <View style={[demoStyles.card, { backgroundColor: Colors[colorScheme].card }]}>
      <Image source={{ uri: DEMO_TRENDING.image }} style={demoStyles.trendingImage} />
      <View style={demoStyles.trendingContent}>
        <View style={demoStyles.sourceRow}>
          <View style={[demoStyles.sourceAvatar, { backgroundColor: '#F97316' }]}>
            <Text style={demoStyles.sourceInitials}>TV</Text>
          </View>
          <Text style={[demoStyles.sourceName, { color: Colors[colorScheme].muted }]}>
            {DEMO_TRENDING.source}
          </Text>
          <Text style={[demoStyles.dot, { color: Colors[colorScheme].muted }]}>·</Text>
          <Text style={[demoStyles.time, { color: Colors[colorScheme].muted }]}>
            {DEMO_TRENDING.time}
          </Text>
        </View>
        <Text style={[demoStyles.title, { color: Colors[colorScheme].text }]} numberOfLines={2}>
          {DEMO_TRENDING.title}
        </Text>
        <View style={[demoStyles.hotBadge, { backgroundColor: '#F9731615' }]}>
          <Flame size={12} color="#F97316" fill="#F97316" />
          <Text style={demoStyles.hotText}>Trending</Text>
        </View>
      </View>
    </View>
  );
}

function DemoForYouCard({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  return (
    <View style={[demoStyles.card, { backgroundColor: Colors[colorScheme].card }]}>
      <Image source={{ uri: DEMO_FOR_YOU.image }} style={demoStyles.forYouImage} />
      <View style={demoStyles.forYouContent}>
        <View style={demoStyles.sourceRow}>
          <View style={[demoStyles.sourceAvatar, { backgroundColor: '#8B5CF6' }]}>
            <Text style={demoStyles.sourceInitials}>LN</Text>
          </View>
          <Text style={[demoStyles.sourceName, { color: Colors[colorScheme].muted }]}>
            {DEMO_FOR_YOU.source}
          </Text>
        </View>
        <Text style={[demoStyles.title, { color: Colors[colorScheme].text }]} numberOfLines={2}>
          {DEMO_FOR_YOU.title}
        </Text>
        <Text style={[demoStyles.subtitle, { color: Colors[colorScheme].muted }]} numberOfLines={1}>
          {DEMO_FOR_YOU.subtitle}
        </Text>
        <View style={demoStyles.readTimeRow}>
          <Clock size={12} color={Colors[colorScheme].muted} />
          <Text style={[demoStyles.readTime, { color: Colors[colorScheme].muted }]}>
            {DEMO_FOR_YOU.time}
          </Text>
        </View>
      </View>
    </View>
  );
}

function DemoDeepDiveCard({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const cardBg = colorScheme === 'dark' ? '#161616' : '#f5f5f0';
  return (
    <View style={[demoStyles.deepDiveCard, { backgroundColor: cardBg }]}>
      <Image source={{ uri: DEMO_DEEP_DIVE.image }} style={demoStyles.deepDiveImage} />
      <View style={demoStyles.deepDiveContent}>
        <View style={demoStyles.sourceRow}>
          <View style={[demoStyles.sourceAvatar, { backgroundColor: '#0EA5E9' }]}>
            <Text style={demoStyles.sourceInitials}>ST</Text>
          </View>
          <Text style={[demoStyles.sourceName, { color: Colors[colorScheme].muted }]}>
            {DEMO_DEEP_DIVE.source}
          </Text>
        </View>
        <Text style={[demoStyles.deepDiveTitle, { color: Colors[colorScheme].text }]} numberOfLines={2}>
          {DEMO_DEEP_DIVE.title}
        </Text>
        <Text style={[demoStyles.subtitle, { color: Colors[colorScheme].muted }]} numberOfLines={1}>
          {DEMO_DEEP_DIVE.subtitle}
        </Text>
        <Text style={[demoStyles.chapters, { color: Colors[colorScheme].muted }]} numberOfLines={1}>
          {DEMO_DEEP_DIVE.chapters.join(' · ')}
        </Text>
        <View style={demoStyles.readTimeRow}>
          <Clock size={12} color="#0EA5E9" />
          <Text style={[demoStyles.readTime, { color: '#0EA5E9' }]}>
            {DEMO_DEEP_DIVE.time}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PageDots({
  total,
  current,
  colorScheme,
}: {
  total: number;
  current: number;
  colorScheme: 'light' | 'dark';
}) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor:
                i === current
                  ? Colors[colorScheme].foreground
                  : Colors[colorScheme].border,
              width: i === current ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function WelcomeScreen() {
  const { signInWithGoogle } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = INTRO_PAGES.length + 1;
  const isLanding = page >= INTRO_PAGES.length;

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

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}
    >
      {/* Intro screens with demo cards */}
      {!isLanding && (
        <Animated.View
          key={`intro-${page}`}
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(200)}
          style={styles.introPage}
        >
          <View style={styles.introHeader}>
            <Pressable onPress={() => setPage(INTRO_PAGES.length)} hitSlop={12}>
              <ThemedText style={[styles.skipText, { color: Colors[colorScheme].muted }]}>
                Skip
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.introCenter}>
            {/* Badge */}
            <View style={[styles.introBadge, { backgroundColor: INTRO_PAGES[page].badgeColor + '15' }]}>
              {(() => {
                const Icon = INTRO_PAGES[page].icon;
                return <Icon size={14} color={INTRO_PAGES[page].iconColor} strokeWidth={2.5} />;
              })()}
              <Text style={[styles.introBadgeText, { color: INTRO_PAGES[page].badgeColor }]}>
                {INTRO_PAGES[page].badge}
              </Text>
            </View>

            {/* Title & Body */}
            <ThemedText style={styles.introTitle}>
              {INTRO_PAGES[page].title}
            </ThemedText>
            <ThemedText style={[styles.introBody, { color: Colors[colorScheme].muted }]}>
              {INTRO_PAGES[page].body}
            </ThemedText>

            {/* Demo Card */}
            <View style={styles.demoContainer}>
              {INTRO_PAGES[page].demo === 'trending' && <DemoTrendingCard colorScheme={colorScheme} />}
              {INTRO_PAGES[page].demo === 'for_you' && <DemoForYouCard colorScheme={colorScheme} />}
              {INTRO_PAGES[page].demo === 'deep_dive' && <DemoDeepDiveCard colorScheme={colorScheme} />}
            </View>
          </View>

          <View style={styles.introFooter}>
            <PageDots total={totalPages} current={page} colorScheme={colorScheme} />
            <Pressable
              onPress={() => setPage(page + 1)}
              style={[styles.nextBtn, { backgroundColor: Colors[colorScheme].foreground }]}
            >
              <ThemedText style={[styles.nextBtnText, { color: Colors[colorScheme].background }]}>
                Next
              </ThemedText>
              <ChevronRight size={18} color={Colors[colorScheme].background} strokeWidth={2.5} />
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Landing page */}
      {isLanding && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.landingContainer}>
          <View style={styles.landingContent}>
            <AppLogo style={styles.landingLogo} />

            <ThemedText style={styles.landingTitle}>
              Your Personalized Daily Digest
            </ThemedText>

            <ThemedText style={[styles.landingSubtitle, { color: Colors[colorScheme].muted }]}>
              10 minutes a day. Three curated feeds.{'\n'}
              Everything worth reading, nothing else.
            </ThemedText>

            {/* Feature pills */}
            <View style={styles.featurePills}>
              <View style={[styles.featurePill, { backgroundColor: '#F9731610' }]}>
                <Flame size={14} color="#F97316" strokeWidth={2} />
                <Text style={[styles.featurePillText, { color: Colors[colorScheme].text }]}>Trending</Text>
              </View>
              <View style={[styles.featurePill, { backgroundColor: '#F59E0B10' }]}>
                <Crosshair size={14} color="#F59E0B" strokeWidth={2} />
                <Text style={[styles.featurePillText, { color: Colors[colorScheme].text }]}>For You</Text>
              </View>
              <View style={[styles.featurePill, { backgroundColor: '#0EA5E910' }]}>
                <GraduationCap size={14} color="#0EA5E9" strokeWidth={2} />
                <Text style={[styles.featurePillText, { color: Colors[colorScheme].text }]}>Deep Dives</Text>
              </View>
            </View>
          </View>

          <View style={styles.ctaSection}>
            <PageDots total={totalPages} current={totalPages - 1} colorScheme={colorScheme} />

            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: Colors[colorScheme].foreground },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors[colorScheme].background} />
              ) : (
                <ThemedText style={[styles.primaryButtonText, { color: Colors[colorScheme].background }]}>
                  Get started free
                </ThemedText>
              )}
            </Pressable>

            {error && (
              <ThemedText style={[styles.errorText, { color: '#EF4444' }]}>{error}</ThemedText>
            )}

            <ThemedText style={[styles.legalFooter, { color: Colors[colorScheme].muted }]}>
              By continuing you accept our{' '}
              <ThemedText
                style={styles.legalLink}
                onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
              >
                Terms
              </ThemedText>
              {' & '}
              <ThemedText
                style={styles.legalLink}
                onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
              >
                Privacy Policy
              </ThemedText>
            </ThemedText>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // Intro screens
  introPage: {
    flex: 1,
  },
  introHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  introCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  introBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  introBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  introTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 36,
    marginBottom: 12,
  },
  introBody: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  demoContainer: {
    width: '100%',
    paddingHorizontal: 8,
  },
  introFooter: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 20,
    alignItems: 'center',
  },
  nextBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 999,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // Landing
  landingContainer: {
    flex: 1,
  },
  landingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  landingLogo: {
    width: 64,
    height: 64,
    marginBottom: 24,
  },
  landingTitle: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -1,
    marginBottom: 16,
  },
  landingSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  featurePills: {
    flexDirection: 'row',
    gap: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featurePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ctaSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 999,
    minHeight: 56,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  legalFooter: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
});

// Demo card styles
const demoStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  trendingImage: {
    width: '100%',
    height: 140,
  },
  trendingContent: {
    padding: 14,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sourceAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sourceInitials: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  sourceName: {
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    marginHorizontal: 6,
  },
  time: {
    fontSize: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F97316',
  },
  forYouImage: {
    width: '100%',
    height: 120,
  },
  forYouContent: {
    padding: 14,
  },
  readTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  readTime: {
    fontSize: 12,
  },
  deepDiveCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  deepDiveImage: {
    width: '100%',
    height: 130,
  },
  deepDiveContent: {
    padding: 14,
  },
  deepDiveTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 6,
  },
  chapters: {
    fontSize: 11,
    marginTop: 6,
  },
});
