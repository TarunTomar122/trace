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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Flame,
  GraduationCap,
  ChevronRight,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { AppLogo } from '@/components/app-logo';
import { Colors, Fonts } from '@/constants/theme';
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
const SPLASH_BG = '#FEF7F4'; // Matches splash.png background - warm off-white

const INTRO_PAGES = [
  {
    title: 'Trending, simplified',
    body: 'Pick your interests. We fetch the latest news, group it into topics, and update it hourly.',
    demo: 'trending',
  },
  {
    title: 'Learn on the go',
    body: 'Tell us your role and level. We find the best articles, videos, and blogs — then compress them into quick reads. Updated daily.',
    demo: 'for_you',
  },
];

// ─── Demo card: Trending Topics ─────────────────────────────────────────────
function DemoTrendingCard({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? '#151515' : '#ffffff';
  const dividerColor = isDark ? '#2c2c2c' : '#f0f0f0';
  const bulletColor = '#F97316';
  const timelineAccent = '#F59E0B';

  return (
    <View style={[demoStyles.card, { backgroundColor: cardBg }]}>
      <View style={demoStyles.heroWrap}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=500&q=80' }}
          style={demoStyles.heroImage}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'transparent']}
          style={demoStyles.heroGradientTop}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.35)', cardBg]}
          locations={[0, 0.58, 1]}
          style={demoStyles.heroGradientBottom}
        />
        <View style={demoStyles.heroOverlay}>
          <View style={demoStyles.ageRow}>
            <Flame size={11} color="#F97316" fill="#F97316" strokeWidth={2} />
            <Text style={demoStyles.ageText}>19 MIN AGO</Text>
          </View>
          <Text style={demoStyles.heroTitle} numberOfLines={2}>
            The AI Race Has a New Frontrunner
          </Text>
        </View>
      </View>

      <View style={demoStyles.summaryBlock}>
        <Text style={[demoStyles.summaryText, { color: Colors[colorScheme].muted }]}>
          A new model lead is shifting investor bets, partner strategy, and the pace of the AI race.
        </Text>
        <Text style={[demoStyles.metaText, { color: Colors[colorScheme].muted }]}>
          12 sources · 19 updates
        </Text>
      </View>


      <View style={[demoStyles.section, { borderTopColor: dividerColor }]}>
        <Text style={[demoStyles.sectionLabel, { color: Colors[colorScheme].muted }]}>TIMELINE</Text>
        <View style={demoStyles.timelineBlock}>
          <View style={[demoStyles.timelineAccent, { backgroundColor: timelineAccent }]} />
          <View style={demoStyles.timelineList}>
            <View style={demoStyles.timelineItem}>
              <View style={demoStyles.timelineSourceRow}>
                <View style={[demoStyles.timelineAvatar, { backgroundColor: isDark ? '#333' : '#1a1a1a' }]}>
                  <Text style={demoStyles.timelineAvatarText}>OA</Text>
                </View>
                <Text style={[demoStyles.timelineSource, { color: Colors[colorScheme].muted }]}>
                  OpenAI <Text style={demoStyles.timelineSourceDot}>•</Text> 2h ago
                </Text>
              </View>
              <Text style={[demoStyles.timelineTitle, { color: Colors[colorScheme].text }]} numberOfLines={2}>
                OpenAI confirms the next launch window
              </Text>
              <Text style={[demoStyles.timelineSummary, { color: Colors[colorScheme].muted }]} numberOfLines={2}>
                New benchmarks put it ahead on reasoning and coding tests.
              </Text>
            </View>

            <View style={demoStyles.timelineItem}>
              <View style={demoStyles.timelineSourceRow}>
                <View style={[demoStyles.timelineAvatar, { backgroundColor: isDark ? '#2b3445' : '#dbeafe' }]}>
                  <Text style={[demoStyles.timelineAvatarText, { color: isDark ? '#bfdbfe' : '#1d4ed8' }]}>TC</Text>
                </View>
                <Text style={[demoStyles.timelineSource, { color: Colors[colorScheme].muted }]}>
                  TechCrunch <Text style={demoStyles.timelineSourceDot}>•</Text> 6h ago
                </Text>
              </View>
              <Text style={[demoStyles.timelineTitle, { color: Colors[colorScheme].text }]} numberOfLines={2}>
                New benchmarks leak and rivals respond
              </Text>
              <Text style={[demoStyles.timelineSummary, { color: Colors[colorScheme].muted }]} numberOfLines={2}>
                Competitors are adjusting launch plans as pressure builds.
              </Text>
            </View>
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
  const accent = '#F59E0B';
  const labelColor = isDark ? '#888' : '#4b5563';

  return (
    <View style={[demoStyles.card, { backgroundColor: cardBg }]}>
      <View style={demoStyles.heroWrap}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=500&q=80' }}
          style={demoStyles.heroImage}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.28)', 'transparent']}
          style={demoStyles.heroGradientTop}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.2)', cardBg]}
          locations={[0, 0.62, 1]}
          style={demoStyles.heroGradientBottom}
        />
        <View style={[demoStyles.sourceBadge, { backgroundColor: isDark ? '#2a2a2a' : '#1a1a1a' }]}>
          <Text style={demoStyles.sourceBadgeText}>TechCrunch</Text>
        </View>
      </View>

      <View style={demoStyles.titleSection}>
        <Text style={[demoStyles.cardTitleLarge, { color: Colors[colorScheme].text }]} numberOfLines={2}>
          The real reason AI teams are rebuilding around evals
        </Text>
      </View>

      <View style={demoStyles.tabRow}>
        <View style={[demoStyles.tabPill, { backgroundColor: isDark ? '#2a2a2a' : '#f4f4f5' }]}>
          <Text style={[demoStyles.tabPillText, { color: Colors[colorScheme].text }]}>Highlights</Text>
        </View>
        <View style={[demoStyles.tabPill, { backgroundColor: accent, marginLeft: 8 }]}>
          <Text style={demoStyles.tabPillTextActive}>Key Insight</Text>
        </View>
      </View>

      <View style={demoStyles.cardPager}>
        <View
          style={[
            demoStyles.learningCardLarge,
            { backgroundColor: isDark ? '#1d1d1d' : '#ffffff' },
          ]}>
          <Text style={[demoStyles.learningCardLabelSimple, { color: labelColor }]}>Key Insight</Text>
          <Text style={[demoStyles.learningCardTextLarge, { color: Colors[colorScheme].text }]}>
            AI spending is moving from demos to reliability, evals, and clear ROI.
          </Text>
          <Text style={[demoStyles.learningCardMeta, { color: Colors[colorScheme].muted }]}>
            Matched for: Product strategy · AI tools
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
  const dividerColor = isDark ? '#2c2c2c' : '#ececec';
  const tldrBg = isDark ? '#111827' : '#f7f7f5';

  const chapters = ['The subscription peak', 'AI disrupts the model', 'What comes next'];

  return (
    <View style={[demoStyles.card, { backgroundColor: cardBg }]}>
      <View style={demoStyles.heroWrap}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&q=80' }}
          style={demoStyles.deepDiveImage}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'transparent']}
          style={demoStyles.heroGradientTop}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.35)', cardBg]}
          locations={[0, 0.56, 1]}
          style={demoStyles.heroGradientBottom}
        />
        <View style={demoStyles.heroOverlay}>
          <View style={demoStyles.deepDiveHeroBadge}>
            <GraduationCap size={11} color="#fff" strokeWidth={2.3} />
            <Text style={demoStyles.deepDiveHeroBadgeText}>Deep Dive</Text>
          </View>
          <Text style={demoStyles.heroTitle} numberOfLines={2}>
            The end of the subscription era
          </Text>
          <Text style={demoStyles.deepDiveHeroMeta}>12 min read · 3 chapters</Text>
        </View>
      </View>

      <View style={demoStyles.sectionTight}>
        <Text style={[demoStyles.sectionLabel, { color: Colors[colorScheme].muted }]}>TL;DR</Text>
        <View style={[demoStyles.tldrBox, { backgroundColor: tldrBg }]}>
          <Text style={[demoStyles.tldrText, { color: Colors[colorScheme].text }]} numberOfLines={2}>
            AI is breaking the old subscription model and changing how software companies make money.
          </Text>
        </View>
      </View>

      <View style={[demoStyles.sectionTight, { borderTopColor: dividerColor, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <Text style={[demoStyles.sectionLabel, { color: Colors[colorScheme].muted }]}>CHAPTERS</Text>
        {chapters.map((ch, i) => (
          <View key={i} style={[demoStyles.chapterRowCard, { backgroundColor: isDark ? '#1f1f1f' : '#f7f7f5' }]}>
            <View style={[demoStyles.chapterNumberBadge, { backgroundColor: isDark ? '#2a2a2a' : '#e8e8e6' }]}>
              <Text style={[demoStyles.chapterNumberText, { color: Colors[colorScheme].text }]}>{i + 1}</Text>
            </View>
            <Text style={[demoStyles.chapterName, { color: Colors[colorScheme].text }]} numberOfLines={1}>{ch}</Text>
            <ChevronRight size={16} color={Colors[colorScheme].muted} strokeWidth={1.8} />
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
      style={[styles.safeArea, { backgroundColor: isLanding ? SPLASH_BG : Colors[colorScheme].background }]}
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
            <ThemedText style={styles.introTitle}>{introPage.title}</ThemedText>

            <Text style={[styles.introBody, { color: Colors[colorScheme].muted }]}>
              {introPage.body}
            </Text>

            <View style={styles.demoContainer}>
              {introPage.demo === 'trending' && <DemoTrendingCard colorScheme={colorScheme} />}
              {introPage.demo === 'for_you' && <DemoForYouCard colorScheme={colorScheme} />}
              {introPage.demo === 'deep_dive' && <DemoDeepDiveCard colorScheme={colorScheme} />}
            </View>

            <View style={styles.pageFooter}>
              <PageDots total={totalPages} current={page} colorScheme={colorScheme} />
              <Pressable
                onPress={() => scrollToPage(page + 1)}
                style={[styles.nextBtn, { backgroundColor: Colors[colorScheme].foreground }]}
              >
                <Text style={[styles.nextBtnText, { color: Colors[colorScheme].background }]}>Next</Text>
                <ChevronRight size={18} color={Colors[colorScheme].background} strokeWidth={2.5} />
              </Pressable>
            </View>
          </ScrollView>
        ))}

        {/* Landing page */}
        <ScrollView
          style={{ width: screenWidth }}
          contentContainerStyle={styles.landingPageContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.landingContent}>
            <Image
              source={require('@/assets/images/splash.png')}
              style={styles.splashLogo}
              resizeMode="contain"
            />
            <ThemedText style={styles.landingTitle}>
              Trace
            </ThemedText>
              <Text style={[styles.landingSubtitle, { color: Colors[colorScheme].muted }]}>
                Your interests. Your level.{'\n'}One feed that keeps you sharp.
              </Text>
              <View style={styles.statsRow}>
                <View style={[styles.statPill, { backgroundColor: '#F9731612' }]}>
                  <Flame size={13} color="#F97316" strokeWidth={2} />
                  <Text style={[styles.statText, { color: Colors[colorScheme].text }]}>Trending · hourly</Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: '#0EA5E912' }]}>
                  <GraduationCap size={13} color="#0EA5E9" strokeWidth={2} />
                  <Text style={[styles.statText, { color: Colors[colorScheme].text }]}>Articles · daily</Text>
                </View>
              </View>
            </View>
            <View style={styles.pageFooter}>
              <PageDots total={totalPages} current={page} colorScheme={colorScheme} />
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
            </View>
        </ScrollView>
      </ScrollView>
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
    paddingBottom: 28,
    alignItems: 'center',
  },
  landingPageContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 28,
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
    fontFamily: Fonts.serif,
  },
  introBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
    marginBottom: 24,
    fontFamily: Fonts.serif,
  },
  demoContainer: {
    width: '100%',
  },

  // Scroll footer
  pageFooter: {
    width: '100%',
    paddingTop: 22,
    gap: 14,
    alignItems: 'center',
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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  splashLogo: {
    width: 260,
    height: 260,
    marginBottom: 20,
  },
  landingTitle: {
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 46,
    letterSpacing: -1.2,
    marginBottom: 18,
    fontFamily: Fonts.serif,
  },
  landingSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 28,
    paddingHorizontal: 4,
    fontFamily: Fonts.serif,
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
    fontFamily: Fonts.serif,
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
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  heroWrap: {
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 190,
  },
  deepDiveImage: {
    width: '100%',
    height: 210,
  },
  heroGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  heroGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    paddingHorizontal: 16,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  ageText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FDBA74',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  summaryBlock: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  sourceBadge: {
    position: 'absolute',
    left: 16,
    bottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  cardTitleLarge: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
    letterSpacing: -0.4,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tabPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabPillTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  cardPager: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  learningCardLarge: {
    borderRadius: 18,
    padding: 18,
    minHeight: 132,
  },
  learningCardLabelSimple: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  learningCardTextLarge: {
    fontSize: 18,
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  learningCardMeta: {
    fontSize: 12,
    marginTop: 12,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 18,
  },
  paginationDot: {
    height: 7,
    width: 7,
    borderRadius: 4,
  },

  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },

  section: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  sectionTight: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },

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

  timelineBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineAccent: {
    width: 2,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  timelineList: {
    flex: 1,
    gap: 14,
  },
  timelineItem: {
    flex: 1,
  },
  timelineSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  timelineAvatar: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineAvatarText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
  },
  timelineSource: {
    fontSize: 11,
    fontWeight: '500',
  },
  timelineSourceDot: {
    color: '#9ca3af',
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 3,
  },
  timelineSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  deepDiveHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 10,
  },
  deepDiveHeroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  deepDiveHeroMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 8,
  },
  tldrBox: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tldrText: {
    fontSize: 13,
    lineHeight: 19,
  },
  chapterRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  chapterNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chapterName: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});
