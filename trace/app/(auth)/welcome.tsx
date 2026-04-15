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
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { saveReferralSource } from '@/lib/firestore';
import { TRACE_PRIVACY_POLICY_URL, TRACE_TERMS_URL } from '@/constants/contact';

export const ILLUS_PALETTE = {
  coral: { light: '#FEF2F2', dark: '#1a1212' },
  olive: { light: '#FEF9E7', dark: '#1a1708' },
  lavender: { light: '#F0F9FF', dark: '#0a1218' },
  gold: { light: '#FFFBEB', dark: '#1a1608' },
};

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
    title: 'Relevant to your interests',
    subtitle: 'Daily tech and AI news.',
    body: 'Pick your interests. We fetch the latest news, group it into topics, and update it hourly.',
    image: require('@/assets/images/slide1.png'),
  },
  {
    title: '1 app, 100+ sources',
    subtitle: 'Keep up without checking all day.',
    body: 'Trace pulls from 100+ places and groups overlapping coverage into one clean story.',
    image: require('@/assets/images/slide2.png'),
  },
  {
    title: 'Your daily pulse',
    subtitle: 'The conversations worth knowing today.',
    body: 'Trace groups conversations and highlights from HN, Reddit, and the communities that matter to you.',
    image: require('@/assets/images/slide3.png'),
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
            <Text style={[styles.landingSubtitleBold, { color: Colors[colorScheme].text }]}>
              Your Interests. Your News.
            </Text>
            <Text style={[styles.landingSubtitle, { color: Colors[colorScheme].muted }]}>
              The fastest way to stay on top of tech and AI news.
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

  // Intro pages - image slides with text below
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
                <ThemedText style={styles.introTitle}>{introPage.title}</ThemedText>

                <Image
                  source={introPage.image}
                  style={styles.slideImage}
                  resizeMode="contain"
                />

                <Text style={[styles.introSubtitle, { color: Colors[colorScheme].text }]}>
                  {introPage.subtitle}
                </Text>
                <Text style={[styles.introBody, { color: Colors[colorScheme].muted }]}>
                  {introPage.body}
                </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideInner: {
    alignItems: 'center',
    width: '100%',
  },
  slideImage: {
    width: 260,
    height: 260,
    marginBottom: 28,
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

  // Intro page elements
  introTitle: {
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 16,
    fontFamily: FontFamilySerif.bold,
  },
  introSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 6,
    fontFamily: FontFamily.bold,
  },
  introBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 32,
    marginBottom: 8,
    fontFamily: FontFamily.regular,
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
