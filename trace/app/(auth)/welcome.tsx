import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Image,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const INTRO_PAGES = [
  {
    icon: Flame,
    iconColor: '#F97316',
    badge: 'TRENDING TOPICS',
    badgeColor: '#F97316',
    title: 'Understand a story\nin seconds.',
    body: 'Overview, key points, and a live timeline. One topic page with the context that matters.',
    demo: 'trending',
  },
  {
    icon: Crosshair,
    iconColor: '#F59E0B',
    badge: 'FOR YOU',
    badgeColor: '#F59E0B',
    title: 'Your feed.\nActually personal.',
    body: 'Matched to your role, seniority, and goals, so the right stories find you first.',
    demo: 'for_you',
  },
  {
    icon: GraduationCap,
    iconColor: '#0EA5E9',
    badge: 'DEEP DIVES',
    badgeColor: '#0EA5E9',
    title: 'Deep context.\nNo time sink.',
    body: 'Start with a TL;DR, then go chapter by chapter only when you want the full breakdown.',
    demo: 'deep_dive',
  },
];

// ─── Demo card: Trending Topics ─────────────────────────────────────────────
function DemoTrendingCard({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? '#151515' : '#ffffff';
  const dividerColor = isDark ? '#2c2c2c' : '#f0f0f0';
  const bulletColor = '#F97316';
  const timelineDotBorder = isDark ? '#3a3a3a' : '#e8e8e8';

  return (
    <View style={[demoStyles.card, { backgroundColor: cardBg }]}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=500&q=80' }}
        style={demoStyles.heroImage}
      />
      <View style={demoStyles.trendingHeader}>
        <View style={demoStyles.trendingMetaRow}>
          <View style={[demoStyles.hotBadge, { backgroundColor: '#F9731618' }]}>
            <Flame size={10} color="#F97316" fill="#F97316" />
            <Text style={demoStyles.hotText}>Trending</Text>
          </View>
          <Text style={[demoStyles.metaText, { color: Colors[colorScheme].muted }]}>
            4 sources · 12 updates
          </Text>
        </View>
        <Text style={[demoStyles.cardTitle, { color: Colors[colorScheme].text }]}>
          The AI Race Has a{'\n'}New Frontrunner
        </Text>
      </View>

      <View style={[demoStyles.section, { borderTopColor: dividerColor }]}>
        <Text style={[demoStyles.sectionLabel, { color: Colors[colorScheme].muted }]}>KEY POINTS</Text>
        <View style={demoStyles.bulletRow}>
          <View style={[demoStyles.bulletDot, { backgroundColor: bulletColor }]} />
          <Text style={[demoStyles.bulletText, { color: Colors[colorScheme].text }]} numberOfLines={2}>
            {"OpenAI's latest model outperforms every rival in reasoning tests"}
          </Text>
        </View>
        <View style={demoStyles.bulletRow}>
          <View style={[demoStyles.bulletDot, { backgroundColor: bulletColor }]} />
          <Text style={[demoStyles.bulletText, { color: Colors[colorScheme].text }]} numberOfLines={2}>
            Microsoft deepens its $13B bet as competitors scramble to respond
          </Text>
        </View>
      </View>

      <View style={[demoStyles.section, { borderTopColor: dividerColor }]}>
        <Text style={[demoStyles.sectionLabel, { color: Colors[colorScheme].muted }]}>TIMELINE</Text>
        <View style={demoStyles.timelineRow}>
          <View style={[demoStyles.timelineDot, { borderColor: bulletColor, backgroundColor: isDark ? '#1e1e1e' : '#fff' }]} />
          <View style={demoStyles.timelineContent}>
            <Text style={[demoStyles.timelineTime, { color: Colors[colorScheme].muted }]}>2h ago</Text>
            <Text style={[demoStyles.timelineText, { color: Colors[colorScheme].text }]} numberOfLines={1}>
              Sam Altman confirms GPT-5 launch timeline
            </Text>
          </View>
        </View>
        <View style={demoStyles.timelineRow}>
          <View style={[demoStyles.timelineDot, { borderColor: timelineDotBorder, backgroundColor: isDark ? '#1e1e1e' : '#fff' }]} />
          <View style={demoStyles.timelineContent}>
            <Text style={[demoStyles.timelineTime, { color: Colors[colorScheme].muted }]}>6h ago</Text>
            <Text style={[demoStyles.timelineText, { color: Colors[colorScheme].text }]} numberOfLines={1}>
              Leaked benchmarks surface, rivals react
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Demo card: For You ──────────────────────────────────────────────────────
function DemoForYouCard({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? '#151515' : '#ffffff';
  const dividerColor = isDark ? '#2c2c2c' : '#f0f0f0';
  const accent = '#F59E0B';
  const insightBg = isDark ? '#1c1a12' : '#FFFBEB';
  const whyBg = isDark ? '#12141a' : '#F0F9FF';

  return (
    <View style={[demoStyles.card, { backgroundColor: cardBg }]}>
      {/* Interest category header */}
      <View style={[demoStyles.categoryHeader, { backgroundColor: accent + '12', borderBottomColor: dividerColor }]}>
        <Crosshair size={11} color={accent} strokeWidth={2.5} />
        <Text style={[demoStyles.categoryText, { color: accent }]}>AI & Machine Learning</Text>
        <View style={demoStyles.categoryDivider} />
        <Text style={[demoStyles.matchedText, { color: Colors[colorScheme].muted }]}>Matched to you</Text>
      </View>

      {/* Article row */}
      <View style={demoStyles.articleRow}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=200&q=80' }}
          style={demoStyles.thumbnail}
        />
        <View style={demoStyles.articleInfo}>
          <View style={demoStyles.sourceRow}>
            <View style={[demoStyles.sourceAvatar, { backgroundColor: '#1DA1F2' }]}>
              <Text style={demoStyles.sourceInitials}>TC</Text>
            </View>
            <Text style={[demoStyles.sourceName, { color: Colors[colorScheme].muted }]}>TechCrunch</Text>
            <Text style={[demoStyles.sourceDot, { color: Colors[colorScheme].muted }]}>·</Text>
            <Clock size={10} color={Colors[colorScheme].muted} />
            <Text style={[demoStyles.sourceName, { color: Colors[colorScheme].muted }]}> 5 min</Text>
          </View>
          <Text style={[demoStyles.articleTitle, { color: Colors[colorScheme].text }]} numberOfLines={3}>
            The real reason OpenAI built its own chip division
          
          </Text>
        </View>
      </View>

      {/* Learning cards preview */}
      <View style={[demoStyles.learningDivider, { borderTopColor: dividerColor }]}>
        <View style={[demoStyles.learningCard, { backgroundColor: insightBg }]}>
          <Text style={[demoStyles.learningCardLabel, { color: accent }]}>💡  THE INSIGHT</Text>
          <Text style={[demoStyles.learningCardText, { color: Colors[colorScheme].text }]} numberOfLines={2}>
            Vertical integration is becoming the new moat in AI infrastructure.
          </Text>
        </View>
        <View style={[demoStyles.learningCard, { backgroundColor: whyBg, marginTop: 6 }]}>
          <Text style={[demoStyles.learningCardLabel, { color: '#0EA5E9' }]}>🎯  WHY IT MATTERS</Text>
          <Text style={[demoStyles.learningCardText, { color: Colors[colorScheme].text }]} numberOfLines={2}>
            Every major player is racing to control their stack from silicon to software.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Demo card: Deep Dives ──────────────────────────────────────────────────
function DemoDeepDiveCard({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? '#151515' : '#ffffff';
  const dividerColor = isDark ? '#2c2c2c' : '#f0f0f0';
  const accent = '#0EA5E9';
  const tldrBg = isDark ? '#0a1520' : '#F0F9FF';

  const chapters = ['The subscription peak', 'AI disrupts the model', 'What comes next'];

  return (
    <View style={[demoStyles.card, { backgroundColor: cardBg }]}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&q=80' }}
        style={demoStyles.deepDiveImage}
      />

      <View style={demoStyles.deepDiveHeader}>
        <View style={demoStyles.sourceRow}>
          <View style={[demoStyles.sourceAvatar, { backgroundColor: accent }]}>
            <Text style={demoStyles.sourceInitials}>ST</Text>
          </View>
          <Text style={[demoStyles.sourceName, { color: Colors[colorScheme].muted }]}>Stratechery</Text>
          <Text style={[demoStyles.sourceDot, { color: Colors[colorScheme].muted }]}>·</Text>
          <Clock size={10} color={accent} />
          <Text style={[demoStyles.sourceName, { color: accent }]}> 12 min deep dive</Text>
        </View>
        <Text style={[demoStyles.cardTitle, { color: Colors[colorScheme].text }]} numberOfLines={2}>
          The end of the subscription era
        </Text>
        <View style={demoStyles.deepDiveMetaRow}>
          <View style={[demoStyles.deepDiveMetaPill, { backgroundColor: accent + '14' }]}>
            <Text style={[demoStyles.deepDiveMetaText, { color: accent }]}>TL;DR</Text>
          </View>
          <View style={[demoStyles.deepDiveMetaPill, { backgroundColor: '#22C55E14' }]}>
            <Text style={[demoStyles.deepDiveMetaText, { color: '#22C55E' }]}>Key takeaways</Text>
          </View>
          <View style={[demoStyles.deepDiveMetaPill, { backgroundColor: '#A78BFA14' }]}>
            <Text style={[demoStyles.deepDiveMetaText, { color: '#A78BFA' }]}>3 chapters</Text>
          </View>
        </View>
      </View>

      {/* TL;DR */}
      <View style={[demoStyles.compactSection, { borderTopColor: dividerColor }]}>
        <Text style={[demoStyles.sectionLabel, { color: Colors[colorScheme].muted }]}>TL;DR</Text>
        <View style={[demoStyles.tldrBox, { backgroundColor: tldrBg }]}>
          <Text style={[demoStyles.tldrText, { color: Colors[colorScheme].text }]} numberOfLines={1}>
            The $50B subscription market is fracturing. AI agents fundamentally change the economics of every app.
          </Text>
        </View>
      </View>

      {/* Chapters */}
      <View style={[demoStyles.compactSection, { borderTopColor: dividerColor }]}>
        <Text style={[demoStyles.sectionLabel, { color: Colors[colorScheme].muted }]}>3 CHAPTERS</Text>
        {chapters.map((ch, i) => (
          <View key={i} style={demoStyles.chapterRow}>
            <Text style={[demoStyles.chapterNum, { color: accent }]}>{i + 1}</Text>
            <Text style={[demoStyles.chapterName, { color: Colors[colorScheme].text }]} numberOfLines={1}>{ch}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Page dots ──────────────────────────────────────────────────────────────
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
                i === current ? Colors[colorScheme].foreground : Colors[colorScheme].border,
              width: i === current ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const { signInWithGoogle } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const { width: screenWidth } = useWindowDimensions();

  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const carouselRef = useRef<ScrollView>(null);

  const totalPages = INTRO_PAGES.length + 1;
  const isLanding = page >= INTRO_PAGES.length;

  const scrollToPage = (targetPage: number) => {
    carouselRef.current?.scrollTo({ x: targetPage * screenWidth, animated: true });
    setPage(targetPage);
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newPage = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setPage(newPage);
  };

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
      {/* Skip button — floats over the carousel */}
      {!isLanding && (
        <View style={styles.skipContainer} pointerEvents="box-none">
          <Pressable onPress={() => scrollToPage(INTRO_PAGES.length)} hitSlop={12}>
            <Text style={[styles.skipText, { color: Colors[colorScheme].muted }]}>Skip</Text>
          </Pressable>
        </View>
      )}

      {/* Horizontal carousel */}
      <ScrollView
        ref={carouselRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.carousel}
        bounces={false}
      >
        {/* Intro pages */}
        {INTRO_PAGES.map((introPage, i) => (
          <ScrollView
            key={i}
            style={{ width: screenWidth }}
            contentContainerStyle={[styles.pageContent, { paddingTop: 52 }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.introBadge, { backgroundColor: introPage.badgeColor + '15' }]}>
              {(() => {
                const Icon = introPage.icon;
                return <Icon size={13} color={introPage.iconColor} strokeWidth={2.5} />;
              })()}
              <Text style={[styles.introBadgeText, { color: introPage.badgeColor }]}>
                {introPage.badge}
              </Text>
            </View>

            <ThemedText style={styles.introTitle}>{introPage.title}</ThemedText>

            <Text style={[styles.introBody, { color: Colors[colorScheme].muted }]}>
              {introPage.body}
            </Text>

            <View style={styles.demoContainer}>
              {introPage.demo === 'trending' && <DemoTrendingCard colorScheme={colorScheme} />}
              {introPage.demo === 'for_you' && <DemoForYouCard colorScheme={colorScheme} />}
              {introPage.demo === 'deep_dive' && <DemoDeepDiveCard colorScheme={colorScheme} />}
            </View>
          </ScrollView>
        ))}

        {/* Landing page */}
        <View style={{ width: screenWidth, flex: 1 }}>
          <View style={styles.landingContent}>
            <AppLogo style={styles.landingLogo} />
            <ThemedText style={styles.landingTitle}>
              Fu*k the algorithms.
            </ThemedText>
            <Text style={[styles.landingSubtitle, { color: Colors[colorScheme].muted }]}>
              Build your own feed with the topics that matter to you.
            </Text>
            <View style={styles.statsRow}>
              <View style={[styles.statPill, { backgroundColor: '#F9731612' }]}>
                <Flame size={13} color="#F97316" strokeWidth={2} />
                <Text style={[styles.statText, { color: Colors[colorScheme].text }]}>Overview + timeline</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: '#0EA5E912' }]}>
                <GraduationCap size={13} color="#0EA5E9" strokeWidth={2} />
                <Text style={[styles.statText, { color: Colors[colorScheme].text }]}>TL;DR + chapters</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={[styles.statPill, { backgroundColor: '#F59E0B12' }]}>
                <Crosshair size={13} color="#F59E0B" strokeWidth={2} />
                <Text style={[styles.statText, { color: Colors[colorScheme].text }]}>Personalized by role</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed footer */}
      <View style={[styles.footer, { borderTopColor: Colors[colorScheme].border + '40' }]}>
        <PageDots total={totalPages} current={page} colorScheme={colorScheme} />

        {!isLanding ? (
          <Pressable
            onPress={() => scrollToPage(page + 1)}
            style={[styles.nextBtn, { backgroundColor: Colors[colorScheme].foreground }]}
          >
            <Text style={[styles.nextBtnText, { color: Colors[colorScheme].background }]}>Next</Text>
            <ChevronRight size={18} color={Colors[colorScheme].background} strokeWidth={2.5} />
          </Pressable>
        ) : (
          <View style={styles.ctaStack}>
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
                <Text style={[styles.primaryButtonText, { color: Colors[colorScheme].background }]}>
                  Get started free
                </Text>
              )}
            </Pressable>

            {error && <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>}

            <Text style={[styles.legalFooter, { color: Colors[colorScheme].muted }]}>
              By continuing you accept our{' '}
              <Text
                style={[styles.legalLink, { color: Colors[colorScheme].muted }]}
                onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
              >
                Terms
              </Text>
              {' & '}
              <Text
                style={[styles.legalLink, { color: Colors[colorScheme].muted }]}
                onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // Skip overlay
  skipContainer: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Carousel
  carousel: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },

  // Intro page elements
  introBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 18,
  },
  introBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  introTitle: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 10,
  },
  introBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  demoContainer: {
    width: '100%',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
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

  // Landing page
  landingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  landingLogo: {
    width: 60,
    height: 60,
    marginBottom: 28,
  },
  landingTitle: {
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 46,
    letterSpacing: -1.2,
    marginBottom: 18,
  },
  landingSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // CTA (landing page footer)
  ctaStack: {
    width: '100%',
    gap: 10,
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

// ─── Demo card styles ────────────────────────────────────────────────────────
const demoStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 120,
  },
  deepDiveImage: {
    width: '100%',
    height: 92,
  },

  // Trending
  trendingHeader: {
    padding: 14,
    paddingBottom: 10,
  },
  trendingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  hotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F97316',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },

  // Sections (shared)
  section: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },

  // Bullets
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },

  // Timeline
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    marginTop: 4,
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTime: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 1,
  },
  timelineText: {
    fontSize: 12,
    lineHeight: 17,
  },

  // For You
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryDivider: {
    flex: 1,
  },
  matchedText: {
    fontSize: 10,
    fontWeight: '500',
  },
  articleRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 10,
    flexShrink: 0,
  },
  articleInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  articleTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sourceAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceInitials: {
    fontSize: 7,
    fontWeight: '800',
    color: '#fff',
  },
  sourceName: {
    fontSize: 11,
    fontWeight: '500',
  },
  sourceDot: {
    fontSize: 11,
  },
  learningDivider: {
    padding: 12,
    paddingTop: 0,
    gap: 0,
  },
  learningCard: {
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  learningCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  learningCardText: {
    fontSize: 12,
    lineHeight: 17,
  },

  // Deep Dive
  deepDiveHeader: {
    padding: 12,
    paddingBottom: 8,
    gap: 6,
  },
  deepDiveMetaRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  deepDiveMetaPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deepDiveMetaText: {
    fontSize: 10,
    fontWeight: '700',
  },
  compactSection: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  tldrBox: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tldrText: {
    fontSize: 11,
    lineHeight: 16,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chapterNum: {
    fontSize: 12,
    fontWeight: '800',
    width: 14,
    textAlign: 'center',
  },
  chapterName: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});
