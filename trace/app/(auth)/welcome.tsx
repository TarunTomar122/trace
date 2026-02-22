import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  Play,
  BookOpen,
  Smartphone,
  DollarSign,
  Zap,
  Heart,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import SunriseIllus from '@/components/illustrations/SunriseIllus';
import DigestIllus from '@/components/illustrations/DigestIllus';

import { ThemedText } from '@/components/themed-text';
import { AppLogo } from '@/components/app-logo';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

// - Subtle illustration tints -
// Very light washes - just enough warmth to feel intentional
export const ILLUS_PALETTE = {
  coral:    { light: '#F5F0EE', dark: '#F5F0EE' },
  olive:    { light: '#F0F4F0', dark: '#F0F4F0' },
  lavender: { light: '#F1F0F5', dark: '#F1F0F5' },
  gold:     { light: '#F5F3EE', dark: '#F5F3EE' },
};

type IllusProps = { width?: number; height?: number; color?: string; fill?: string };

// - Intro pages (feature-focused) -
const INTRO_PAGES: {
  Illustration: React.FC<IllusProps>;
  title: string;
  body: string;
  tint: { light: string; dark: string };
}[] = [
  {
    Illustration: SunriseIllus,
    title: 'Wake up smarter\nevery morning',
    body: 'Get a personalized feed of articles, videos, and news based on your selected interests.',
    tint: ILLUS_PALETTE.coral,
  },
  {
    Illustration: DigestIllus,
    title: '10 minutes that\nactually count',
    body: 'Open any item to get AI notes, key takeaways, and a quick read time in one tap.',
    tint: ILLUS_PALETTE.olive,
  },
];

// - Topic pills for landing page -
const TOPIC_PILLS: {
  icon: LucideIcon;
  label: string;
  pos: ViewStyle;
  rotate: string;
}[] = [
  {
    icon: Play,
    label: 'YouTube',
    pos: { top: '16%', left: '32%' },
    rotate: '8deg',
  },
  {
    icon: Heart,
    label: 'Health & Wellness',
    pos: { bottom: '20%', right: '2%' },
    rotate: '5deg',
  },
  {
    icon: BookOpen,
    label: 'Medium',
    pos: { top: '18%', right: '8%' },
    rotate: '4deg',
  },
  {
    icon: Smartphone,
    label: 'Tech',
    pos: { top: '24%', left: '4%' },
    rotate: '-3deg',
  },
  {
    icon: DollarSign,
    label: 'Finances',
    pos: { top: '84%', left: '34%' },
    rotate: '3deg',
  },
  {
    icon: Zap,
    label: 'Productivity',
    pos: { bottom: '22%', left: '8%' },
    rotate: '-4deg',
  },
];

const TERMS_URL = 'https://www.yourtrace.online/terms';
const PRIVACY_URL = 'https://www.yourtrace.online/privacy-policy';

// - Dots indicator -
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

// - Main Welcome Screen -
export default function WelcomeScreen() {
  const { signInWithGoogle } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = INTRO_PAGES.length + 1; // intro screens + landing
  const isLanding = page >= INTRO_PAGES.length;

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not sign in.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: Colors[colorScheme].background },
      ]}
      edges={['top', 'bottom']}
    >
      {/* Intro screens */}
      {!isLanding && (
        <Animated.View
          key={`intro-${page}`}
          entering={FadeIn.duration(450)}
          exiting={FadeOut.duration(200)}
          style={styles.introPage}
        >
          {/* Skip button */}
          <View style={styles.introHeader}>
            <Pressable
              onPress={() => setPage(INTRO_PAGES.length)}
              hitSlop={12}
            >
              <ThemedText
                style={[styles.skipText, { color: Colors[colorScheme].muted }]}
              >
                Skip
              </ThemedText>
            </Pressable>
          </View>

          {/* Centered content */}
          <View style={styles.introCenter}>
            {/* Illustration container - colored rounded rect */}
            <View
              style={[
                styles.illusContainer,
                {
                  backgroundColor:
                    INTRO_PAGES[page].tint[colorScheme],
                },
              ]}
            >
              {(() => {
                const Illus = INTRO_PAGES[page].Illustration;
                return <Illus width={140} height={140} color={Colors[colorScheme].text} fill={Colors[colorScheme].text} />;
              })()}
            </View>

            <ThemedText style={styles.introTitle}>
              {INTRO_PAGES[page].title}
            </ThemedText>

            <ThemedText
              style={[
                styles.introBody,
                { color: Colors[colorScheme].muted },
              ]}
            >
              {INTRO_PAGES[page].body}
            </ThemedText>
          </View>

          {/* Footer: dots + next */}
          <View style={styles.introFooter}>
            <PageDots
              total={totalPages}
              current={page}
              colorScheme={colorScheme}
            />
            <Pressable
              onPress={() => setPage(page + 1)}
              style={[
                styles.introNextBtn,
                { backgroundColor: Colors[colorScheme].foreground },
              ]}
            >
              <ThemedText
                style={[
                  styles.introNextText,
                  { color: Colors[colorScheme].background },
                ]}
              >
                Next
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Landing page (Get Started) */}
      {isLanding && (
        <Animated.View
          entering={FadeIn.duration(450)}
          style={styles.landingContainer}
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoRow}>
              <AppLogo style={styles.logo} />
              <ThemedText style={styles.logoText}>TRACE</ThemedText>
            </View>
          </View>

          {/* Hero section with scattered topic pills */}
          <View style={styles.heroSection}>
            {TOPIC_PILLS.map((pill, index) => {
              const Icon = pill.icon;
              return (
                <View
                  key={index}
                  style={[
                    styles.topicPill,
                    {
                      backgroundColor: Colors[colorScheme].card,
                      borderColor: Colors[colorScheme].border,
                      transform: [{ rotate: pill.rotate }],
                    },
                    pill.pos,
                  ]}
                >
                  <Icon
                    size={16}
                    color={Colors[colorScheme].muted}
                    strokeWidth={2}
                  />
                  <ThemedText
                    style={[
                      styles.pillLabel,
                      { color: Colors[colorScheme].text },
                    ]}
                  >
                    {pill.label}
                  </ThemedText>
                </View>
              );
            })}

            {/* Hero text */}
            <View style={styles.heroTextContainer}>
              <ThemedText style={styles.heroText}>
                Your daily{'\n'}edge
              </ThemedText>
              <ThemedText
                style={[
                  styles.heroSubtitle,
                  { color: Colors[colorScheme].secondary },
                ]}
              >
                Every morning, the best articles, videos,{'\n'}and ideas
                {' '}with AI summaries and takeaways tailored to what you care about.
              </ThemedText>
            </View>
          </View>

          {/* CTA Section */}
          <View style={styles.ctaSection}>
            <PageDots
              total={totalPages}
              current={totalPages - 1}
              colorScheme={colorScheme}
            />

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
                <ThemedText
                  style={[
                    styles.primaryButtonText,
                    { color: Colors[colorScheme].background },
                  ]}
                >
                  Get started
                </ThemedText>
              )}
            </Pressable>

            {error && (
              <ThemedText style={[styles.errorText, { color: colorScheme === 'dark' ? '#ef4444' : '#b91c1c' }]}>{error}</ThemedText>
            )}

            <ThemedText
              style={[styles.legalFooter, { color: Colors[colorScheme].muted }]}
            >
              By continuing you{"'"}re accepting our{' '}
              <ThemedText
                style={[
                  styles.legalLink,
                  { color: Colors[colorScheme].muted },
                ]}
                onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
              >
                Terms of Use
              </ThemedText>
              {' '}and{' '}
              <ThemedText
                style={[
                  styles.legalLink,
                  { color: Colors[colorScheme].muted },
                ]}
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

// - Styles -
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // - Intro screens -
  introPage: {
    flex: 1,
  },
  introHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  introCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  illusContainer: {
    width: 220,
    height: 180,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    overflow: 'hidden',
  },
  introEmoji: {
    fontSize: 56,
  },
  introTitle: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  introBody: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 8,
  },
  introFooter: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 24,
    alignItems: 'center',
  },
  introNextBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 999,
  },
  introNextText: {
    fontSize: 17,
    fontWeight: '700',
  },

  // - Dots -
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

  // - Landing page -
  landingContainer: {
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
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  topicPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 1,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroTextContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 2,
  },
  heroText: {
    fontSize: 52,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 58,
    letterSpacing: -1.5,
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 16,
  },
  ctaSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  primaryButton: {
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
