import { Pressable, ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Crown, Sparkles, Infinity as InfinityIcon, Wand2, Loader } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ACCENT = '#F59E0B';

export default function WelcomeProScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const features = [
    {
      icon: InfinityIcon,
      title: 'Unlimited content',
      description: 'Full access to personalized articles, learning cards, and deep dives',
    },
    {
      icon: Wand2,
      title: 'Tailored to you',
      description: 'Articles and deep dive chapters shaped by your role, interests, and goals',
    },
    {
      icon: Sparkles,
      title: 'Smarter every day',
      description: 'Your feed improves as you read — better topics, better matches',
    },
  ];

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: ACCENT }]}>
            <Crown size={40} color="#fff" strokeWidth={2.5} />
          </View>
          <ThemedText style={styles.title}>You're Pro now!</ThemedText>
          <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
            Your personalized feed is being built. Trending topics, For You articles, and deep dives — all tailored to you.
          </ThemedText>
        </View>

        <View style={styles.featuresContainer}>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <View key={index} style={styles.featureRow}>
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: ACCENT + '18' },
                  ]}>
                  <Icon size={20} color={ACCENT} strokeWidth={2} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={styles.featureTitle}>{feature.title}</ThemedText>
                  <ThemedText style={[styles.featureDescription, { color: Colors[colorScheme].muted }]}>
                    {feature.description}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.buildingBanner, { backgroundColor: ACCENT + '12' }]}>
          <ActivityIndicator size="small" color={ACCENT} />
          <ThemedText style={[styles.buildingText, { color: Colors[colorScheme].muted }]}>
            Building your upgraded feed...
          </ThemedText>
        </View>

        <Pressable
          onPress={handleContinue}
          style={[styles.continueButton, { backgroundColor: ACCENT }]}>
          <ThemedText style={styles.continueButtonText}>Go to my feed</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  featuresContainer: {
    gap: 24,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  buildingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  buildingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
