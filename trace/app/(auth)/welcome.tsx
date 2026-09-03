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
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  ChevronRight,
  Users,
  Youtube,
  Twitter,
  Instagram,
  Sparkles,
  Zap,
  Cpu,
  Newspaper,
  Layers,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { saveReferralSource } from '@/lib/firestore';
import { TRACE_PRIVACY_POLICY_URL, TRACE_TERMS_URL } from '@/constants/contact';

/* ═══════════════════════════════════════════════════════════════
   Mock card components for the intro screens (no images)
   ═══════════════════════════════════════════════════════════════ */

function MockStoryCard({
  title,
  source,
  tag,
  colorScheme,
}: {
  title: string;
  source?: string;
  tag?: string;
  colorScheme: 'light' | 'dark';
}) {
  const bg = colorScheme === 'dark' ? '#1a1a1a' : '#fff';
  const border = colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8';
  const textCol = Colors[colorScheme].text;
  const mutedCol = Colors[colorScheme].muted;
  return (
    <View style={[mStyles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={mStyles.cardTop}>
        {source && (
          <View style={mStyles.badge}>
            <Text style={mStyles.badgeText}>{source}</Text>
          </View>
        )}
        {tag && (
          <View style={[mStyles.tag, { backgroundColor: colorScheme === 'dark' ? '#1a1200' : '#FFF7ED' }]}>
            <Text style={[mStyles.tagText, { color: '#F59E0B' }]}>{tag}</Text>
          </View>
        )}
      </View>
      <Text style={[mStyles.cardTitle, { color: textCol }]} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

function BlankCard({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const bg = colorScheme === 'dark' ? '#1a1a1a' : '#fff';
  const border = colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8';
  return (
    <View style={[mStyles.blankCard, { backgroundColor: bg, borderColor: border }]}>
      <View style={[mStyles.blankLine, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8' }]} />
      <View style={[mStyles.blankLineShort, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8' }]} />
    </View>
  );
}

function MockSourceChip({ label, colorScheme }: { label: string; colorScheme: 'light' | 'dark' }) {
  const bg = colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5';
  const border = colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8';
  return (
    <View style={[mStyles.chip, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[mStyles.chipText, { color: Colors[colorScheme].text }]}>{label}</Text>
    </View>
  );
}

/* ─── Floating card stack for each intro slide ─── */

function SlideMockCards({
  index,
  colorScheme,
}: {
  index: number;
  colorScheme: 'light' | 'dark';
}) {
  if (index === 0) {
    // Slide 1: "30 seconds" — a story card with a time tag
    return (
      <View style={mStyles.stackContainer}>
        <View style={[mStyles.backCard, { transform: [{ rotate: '-8deg' }] }]}>
          <BlankCard colorScheme={colorScheme} />
        </View>
        <View style={[mStyles.backCard2, { transform: [{ rotate: '6deg' }] }]}>
          <BlankCard colorScheme={colorScheme} />
        </View>
        <View style={mStyles.frontCard}>
          <MockStoryCard
            title="Google DeepMind's latest breakthrough in reasoning"
            source="Ars Technica"
            tag="30 sec"
            colorScheme={colorScheme}
          />
        </View>
      </View>
    );
  }

  if (index === 1) {
    // Slide 2: "Tech & AI" — cards with category emphasis
    return (
      <View style={mStyles.stackContainer}>
        <View style={[mStyles.backCard, { transform: [{ rotate: '-6deg' }] }]}>
          <BlankCard colorScheme={colorScheme} />
        </View>
        <View style={[mStyles.backCard2, { transform: [{ rotate: '5deg' }] }]}>
          <BlankCard colorScheme={colorScheme} />
        </View>
        <View style={mStyles.frontCard}>
          <View style={[mStyles.categoryCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#fff', borderColor: colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8' }]}>
            <View style={mStyles.catRow}>
              <View style={[mStyles.catIcon, { backgroundColor: colorScheme === 'dark' ? '#0a1a0a' : '#F0FDF4' }]}>
                <Cpu size={16} color="#22c55e" />
              </View>
              <Text style={[mStyles.catLabel, { color: Colors[colorScheme].text }]}>Artificial Intelligence</Text>
            </View>
            <View style={mStyles.catRow}>
              <View style={[mStyles.catIcon, { backgroundColor: colorScheme === 'dark' ? '#0a0a1a' : '#EFF6FF' }]}>
                <Zap size={16} color="#3b82f6" />
              </View>
              <Text style={[mStyles.catLabel, { color: Colors[colorScheme].text }]}>Developer Tools</Text>
            </View>
            <View style={mStyles.catRow}>
              <View style={[mStyles.catIcon, { backgroundColor: colorScheme === 'dark' ? '#1a0a0a' : '#FEF2F2' }]}>
                <Newspaper size={16} color="#ef4444" />
              </View>
              <Text style={[mStyles.catLabel, { color: Colors[colorScheme].text }]}>Big Tech</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Slide 3: "100+ sources" — grid of source chips
  return (
    <View style={mStyles.stackContainer}>
      <View style={[mStyles.backCard, { transform: [{ rotate: '-5deg' }] }]}>
        <BlankCard colorScheme={colorScheme} />
      </View>
      <View style={mStyles.frontCard}>
        <View style={[mStyles.sourcesCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#fff', borderColor: colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8' }]}>
          <View style={mStyles.sourcesHeader}>
            <Layers size={14} color={Colors[colorScheme].muted} />
            <Text style={[mStyles.sourcesHeaderText, { color: Colors[colorScheme].muted }]}>Sources today</Text>
          </View>
          <View style={mStyles.chipGrid}>
            {['TechCrunch', 'The Verge', 'HN', 'Reddit', 'Wired', 'Ars', 'Reuters', 'Bloomberg', '9to5', 'TC', 'X', 'Discord'].map((s) => (
              <MockSourceChip key={s} label={s} colorScheme={colorScheme} />
            ))}
            <View style={[mStyles.moreChip, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f0f0f0' }]}>
              <Text style={[mStyles.moreChipText, { color: Colors[colorScheme].muted }]}>+90 more</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const mStyles = StyleSheet.create({
  stackContainer: {
    width: 300,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCard: {
    position: 'absolute',
    width: 250,
    opacity: 0.45,
    top: 12,
  },
  backCard2: {
    position: 'absolute',
    width: 250,
    opacity: 0.3,
    top: 36,
  },
  frontCard: {
    width: 280,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  blankCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 12,
    height: 120,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  blankLine: {
    height: 10,
    borderRadius: 4,
    width: '80%',
  },
  blankLineShort: {
    height: 10,
    borderRadius: 4,
    width: '50%',
  },
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#6f6f6f',
    letterSpacing: 0.3,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  categoryCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    letterSpacing: -0.2,
  },
  sourcesCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sourcesHeaderText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    letterSpacing: -0.2,
  },
  moreChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  moreChipText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: -0.2,
  },
});

/* ═══════════════════════════════════════════════════════════════
   Main Welcome Screen
   ═══════════════════════════════════════════════════════════════ */

type ReferralSource = 'friend' | 'youtube' | 'twitter' | 'instagram' | 'other';

const REFERRAL_OPTIONS: { id: ReferralSource; label: string; icon: typeof Users }[] = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'friend', label: 'From a Friend', icon: Users },
  { id: 'twitter', label: 'Twitter', icon: Twitter },
  { id: 'other', label: 'Just Discovered', icon: Sparkles },
];

const INTRO_PAGES = [
  {
    headline: 'News in 30 seconds',
  },
  {
    headline: 'Built for people in tech and AI',
  },
  {
    headline: 'One app, 100+ sources',
  },
];

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
  const { signInWithGoogle, signInWithApple, user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const { width: screenWidth } = useWindowDimensions();

  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReferral, setSelectedReferral] = useState<ReferralSource | null>(null);
  const carouselRef = useRef<ScrollView>(null);
  const pendingReferralRef = useRef<ReferralSource | null>(null);

  // Page flow: intro screens -> referral source -> landing
  const isReferralPage = page === INTRO_PAGES.length;
  const isLanding = page > INTRO_PAGES.length;

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
      pendingReferralRef.current = selectedReferral;
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      pendingReferralRef.current = selectedReferral;
      await signInWithApple();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in with Apple.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const saveReferralAfterSignIn = async (uid: string, source: ReferralSource) => {
    try {
      await saveReferralSource(uid, source);
    } catch (err) {
      console.warn('Failed to save referral source:', err);
    }
  };

  const hasAttemptedSaveRef = useRef(false);
  if (user && pendingReferralRef.current && !hasAttemptedSaveRef.current) {
    hasAttemptedSaveRef.current = true;
    saveReferralAfterSignIn(user.uid, pendingReferralRef.current);
  }

  // Show referral source selection page
  if (isReferralPage) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}
      >
        <View style={styles.referralContainer}>
          <View style={styles.referralContent}>
            <ThemedText style={styles.referralTitle}>
              How did you find us?
            </ThemedText>
            <Text style={[styles.referralSubtitle, { color: Colors[colorScheme].muted }]}>
              We&apos;d love to know! This helps us grow.
            </Text>

            <View style={styles.referralOptions}>
              {REFERRAL_OPTIONS.map((option) => {
                const isSelected = selectedReferral === option.id;
                const IconComponent = option.icon;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setSelectedReferral(option.id)}
                    style={[
                      styles.referralOption,
                      {
                        backgroundColor: isSelected
                          ? (colorScheme === 'dark' ? '#1a1608' : '#FFF7ED')
                          : colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5',
                        borderColor: isSelected
                          ? '#F59E0B'
                          : colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5',
                      },
                    ]}
                  >
                    <IconComponent
                      size={20}
                      color={isSelected ? '#F59E0B' : Colors[colorScheme].muted}
                      strokeWidth={1.8}
                    />
                    <Text
                      style={[
                        styles.referralOptionText,
                        { color: Colors[colorScheme].text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fixedFooter}>
            <Pressable
              onPress={() => setPage(INTRO_PAGES.length + 1)}
              style={[
                styles.nextBtn,
                {
                  backgroundColor: Colors[colorScheme].foreground,
                },
              ]}
            >
              <Text
                style={[
                  styles.nextBtnText,
                  {
                    color: Colors[colorScheme].background,
                  },
                ]}
              >
                Continue
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Show landing page separately (not in carousel)
  if (isLanding) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}
      >
        <View style={styles.landingPageContent}>
          <View style={styles.landingContent}>
            <Image
              source={require('@/assets/images/signin.png')}
              style={styles.splashLogo}
              resizeMode="contain"
            />
            <ThemedText style={styles.landingTitle}>
              Welcome to Trace
            </ThemedText>
            <Text style={[styles.landingSubtitle, { color: Colors[colorScheme].muted }]}>
              Get your daily brief in 30 seconds. That&apos;s it.
            </Text>
          </View>

          <View style={styles.landingFooter}>
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
                  Continue with Google
                </Text>
              )}
            </Pressable>

            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={colorScheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={999}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />

            {error && <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>}

            <View style={styles.legalRow}>
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync(TRACE_PRIVACY_POLICY_URL)}
                hitSlop={8}>
                <Text style={[styles.legalLink, { color: Colors[colorScheme].muted }]}>Privacy Policy</Text>
              </Pressable>
              <Text style={[styles.legalSeparator, { color: Colors[colorScheme].muted }]}> · </Text>
              <Pressable onPress={() => WebBrowser.openBrowserAsync(TRACE_TERMS_URL)} hitSlop={8}>
                <Text style={[styles.legalLink, { color: Colors[colorScheme].muted }]}>Terms of Service</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Intro pages - floating mock cards + minimal headline
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}
    >
      {/* Skip button */}
      <View style={styles.skipContainer} pointerEvents="box-none">
        <Pressable onPress={() => scrollToPage(INTRO_PAGES.length)} hitSlop={12}>
          <Text style={[styles.skipText, { color: Colors[colorScheme].muted }]}>Skip</Text>
        </Pressable>
      </View>

      {/* Swipeable content area */}
      <View style={styles.carousel}>
        <ScrollView
          ref={carouselRef}
          horizontal
          pagingEnabled
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          bounces={false}
        >
          {INTRO_PAGES.map((introPage, i) => (
            <View key={i} style={[styles.slideContainer, { width: screenWidth }]}>
              <View style={styles.slideInner}>
                {/* Floating mock cards — centered */}
                <View style={styles.cardsArea}>
                  <SlideMockCards index={i} colorScheme={colorScheme} />
                </View>

                {/* Minimal headline — bottom */}
                <ThemedText style={styles.introHeadline}>{introPage.headline}</ThemedText>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Fixed footer */}
      <View style={styles.fixedFooter}>
        <PageDots total={INTRO_PAGES.length} current={page} colorScheme={colorScheme} />
        {page < INTRO_PAGES.length - 1 ? (
          <Pressable
            onPress={() => scrollToPage(page + 1)}
            style={[styles.nextBtn, { backgroundColor: Colors[colorScheme].foreground }]}
          >
            <Text style={[styles.nextBtnText, { color: Colors[colorScheme].background }]}>Next</Text>
            <ChevronRight size={18} color={Colors[colorScheme].background} strokeWidth={2.5} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setPage(INTRO_PAGES.length)}
            style={[styles.nextBtn, { backgroundColor: Colors[colorScheme].foreground }]}
          >
            <Text style={[styles.nextBtnText, { color: Colors[colorScheme].background }]}>Get Started</Text>
          </Pressable>
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
    fontFamily: FontFamily.regular,
  },

  // Carousel
  carousel: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
    alignItems: 'center',
  },
  slideInner: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
    flex: 1,
    paddingBottom: 24,
  },
  cardsArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  introHeadline: {
    fontSize: 30,
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 38,
    fontFamily: FontFamilySerif.bold,
    paddingHorizontal: 32,
  },
  fixedFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 14,
    alignItems: 'center',
  },
  landingPageContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Dots & buttons
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
    fontFamily: FontFamily.bold,
  },

  // Landing page
  landingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  splashLogo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    marginBottom: 28,
  },
  landingTitle: {
    fontSize: 28,
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 14,
    fontFamily: FontFamilySerif.bold,
  },
  landingSubtitleBold: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
    fontFamily: FontFamily.semiBold,
  },
  landingSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },
  landingFooter: {
    width: '100%',
    paddingBottom: 20,
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
  appleButton: {
    width: '100%',
    height: 56,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  legalLink: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },

  // Referral page
  referralContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  referralContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  referralTitle: {
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 8,
    fontFamily: FontFamilySerif.bold,
  },
  referralSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
    fontFamily: FontFamily.regular,
  },
  referralOptions: {
    gap: 10,
  },
  referralOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  referralOptionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.medium,
  },
});
