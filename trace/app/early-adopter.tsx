import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Gift, Check, Zap, BookOpen, Bookmark } from 'lucide-react-native';

import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { getEarlyAdopterStatus, claimEarlyAdopterStatus, EarlyAdopterStatus } from '@/lib/firestore';

export default function EarlyAdopterOfferScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user, profile, refreshProfile } = useAuth();
  const { offerings } = useRevenueCat();

  const [status, setStatus] = useState<EarlyAdopterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (profile?.isEarlyAdopter === true) {
      router.replace(profile.onboarded ? '/(tabs)' : '/onboarding');
    }
  }, [router, profile?.isEarlyAdopter, profile?.onboarded]);

  // Get price from RevenueCat
  const monthlyPackage = offerings?.current?.monthly;
  const monthlyPrice = monthlyPackage?.product?.priceString ?? '$2.99/month';

  useEffect(() => {
    getEarlyAdopterStatus()
      .then((s) => {
        setStatus(s);
        // If no spots left, continue to the appropriate next screen
        if (!s.isOpen) {
          router.replace(profile?.onboarded ? '/(tabs)' : '/onboarding');
        }
      })
      .finally(() => setLoading(false));
  }, [router, profile?.onboarded]);

  const handleClaim = async () => {
    if (!user || claiming) return;

    setClaiming(true);
    const success = await claimEarlyAdopterStatus(user.uid);

    if (success) {
      await refreshProfile();
      router.replace(profile?.onboarded ? '/(tabs)' : '/onboarding');
    } else {
      router.replace(profile?.onboarded ? '/(tabs)' : '/onboarding');
    }
  };


  const isDark = colorScheme === 'dark';
  const userNumber = status ? status.currentCount + 1 : '?';

  // Show loading while redirecting already-claimed users or if no spots remain.
  if (profile?.isEarlyAdopter === true || loading || (status && !status.isOpen)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].foreground} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
        {/* Gift icon */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={[styles.giftCircle, { backgroundColor: '#F59E0B15' }]}
        >
          <Gift size={48} color="#F59E0B" strokeWidth={1.5} />
        </Animated.View>

        {/* User number badge */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          style={[styles.userBadge, { backgroundColor: isDark ? '#1a1a2e' : '#f0f0f5' }]}
        >
          <Text style={[styles.userBadgeText, { color: Colors[colorScheme].muted }]}>
            You&apos;re user #{userNumber}
          </Text>
        </Animated.View>

        {/* Main headline */}
        <Animated.Text
          entering={FadeInDown.delay(300).duration(500)}
          style={[styles.headline, { color: Colors[colorScheme].text }]}
        >
          You made it!
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(400).duration(500)}
          style={[styles.subheadline, { color: Colors[colorScheme].muted }]}
        >
          Trace is FREE for the first {status?.limit ?? 300} users.
        </Animated.Text>

        {/* What you get */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(500)}
          style={[styles.perksCard, { backgroundColor: isDark ? '#161616' : '#fafafa', borderColor: Colors[colorScheme].border }]}
        >
          <Text style={[styles.perksTitle, { color: Colors[colorScheme].text }]}>
            What you unlock:
          </Text>

          <View style={styles.perkRow}>
            <View style={[styles.perkIcon, { backgroundColor: '#F9731615' }]}>
              <Zap size={16} color="#F97316" strokeWidth={2} />
            </View>
            <Text style={[styles.perkText, { color: Colors[colorScheme].text }]}>
              Trending topics and Personalized learning content
            </Text>
          </View>

          <View style={styles.perkRow}>
            <View style={[styles.perkIcon, { backgroundColor: '#0EA5E915' }]}>
              <BookOpen size={16} color="#0EA5E9" strokeWidth={2} />
            </View>
            <Text style={[styles.perkText, { color: Colors[colorScheme].text }]}>
              AI overviews of high quality sources
            </Text>
          </View>

          <View style={styles.perkRow}>
            <View style={[styles.perkIcon, { backgroundColor: '#8B5CF615' }]}>
              <Bookmark size={16} color="#8B5CF6" strokeWidth={2} />
            </View>
            <Text style={[styles.perkText, { color: Colors[colorScheme].text }]}>
              Save articles and AI summaries
            </Text>
          </View>
        </Animated.View>

        {/* Spots remaining */}
        {status && (
          <Animated.Text
            entering={FadeInDown.delay(600).duration(500)}
            style={[styles.spotsText, { color: Colors[colorScheme].muted }]}
          >
            Only {status.spotsRemaining} spots remaining
          </Animated.Text>
        )}
      </Animated.View>

      {/* CTA */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleClaim}
          disabled={claiming}
          style={[styles.claimButton, claiming && { opacity: 0.7 }]}
        >
          {claiming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Gift size={20} color="#fff" strokeWidth={2} />
              <Text style={styles.claimButtonText}>Claim free Pro</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  giftCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  userBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  userBadgeText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  headline: {
    fontSize: 32,
    fontFamily: FontFamilySerif.bold,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subheadline: {
    fontSize: 17,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 28,
  },
  perksCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  perksTitle: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    marginBottom: 4,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    flex: 1,
  },
  spotsText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    marginTop: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
    alignItems: 'center',
  },
  claimButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F59E0B',
    paddingVertical: 18,
    borderRadius: 999,
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: FontFamily.bold,
  },
});
