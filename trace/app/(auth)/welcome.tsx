import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Image,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Play,
  BookOpen,
  Smartphone,
  DollarSign,
  Zap,
  Heart,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

// Topic pills — scattered organically around hero text
const TOPIC_PILLS: { icon: LucideIcon; label: string; pos: ViewStyle; rotate: string }[] = [
  { icon: Play,       label: 'YouTube',           pos: { top: '16%',    left: '25%' },   rotate: '-8deg' },
  { icon: Heart,      label: 'Health & Wellness', pos: { bottom: '20%', right: '2%' }, rotate: '5deg' },
  { icon: BookOpen,   label: 'Medium',            pos: { top: '18%',   right: '16%' },  rotate: '4deg' },
  { icon: Smartphone, label: 'Tech',         pos: { top: '34%',   right: '4%' },  rotate: '-3deg' },
  { icon: DollarSign, label: 'Finances',          pos: { top: '30%',   left: '4%' },   rotate: '3deg' },
  { icon: Zap,        label: 'Productivity',      pos: { bottom: '22%', left: '8%' },  rotate: '-4deg' },
];

const TERMS_URL = 'https://www.yourtrace.online/terms';
const PRIVACY_URL = 'https://www.yourtrace.online/privacy-policy';

export default function WelcomeScreen() {
  const { signInWithGoogle } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        {/* Hero section with scattered topic pills */}
        <View style={styles.heroSection}>
          {/* Scattered topic pills */}
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
                <Icon size={16} color={Colors[colorScheme].muted} strokeWidth={2} />
                <ThemedText style={[styles.pillLabel, { color: Colors[colorScheme].text }]}>
                  {pill.label}
                </ThemedText>
              </View>
            );
          })}

          {/* Big bold hero text */}
          <View style={styles.heroTextContainer}>
            <ThemedText style={styles.heroText}>
              Build{'\n'}your own{'\n'}feed
            </ThemedText>
            <ThemedText style={[styles.heroSubtitle, { color: Colors[colorScheme].secondary }]}>
              Curated content and micro lessons,{'\n'}tailored to your interests and skill level.
            </ThemedText>
          </View>
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
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors[colorScheme].background} />
            ) : (
              <ThemedText style={[styles.primaryButtonText, { color: Colors[colorScheme].background }]}>
                Get started
              </ThemedText>
            )}
          </Pressable>

          {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

          <ThemedText style={[styles.footer, { color: Colors[colorScheme].muted }]}>
            By continuing you{"'"}re accepting our{' '}
            <ThemedText
              style={[styles.footerLink, { color: Colors[colorScheme].muted }]}
              onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
            >
              Terms of Use
            </ThemedText>
            {' '}and{' '}
            <ThemedText
              style={[styles.footerLink, { color: Colors[colorScheme].muted }]}
              onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
            >
              Privacy Policy
            </ThemedText>
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
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
