import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, Sparkles, BookMarked, Mail, FileText } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function WelcomeProScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const features = [
    {
      icon: FileText,
      title: 'Curated Content',
      description: 'Articles and videos on your interested topics from around the internet',
    },
    {
      icon: Sparkles,
      title: 'AI Summaries',
      description: "Learning notes and summaries so you don't have to read everything",
    },
    {
      icon: BookMarked,
      title: 'Bookmarks',
      description: 'Save articles for later and build your personal knowledge base',
    },
    {
      icon: Mail,
      title: 'Daily Newsletter',
      description: 'Get the most trending articles delivered to your inbox every day',
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
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: '#22c55e' }]}>
            <Check size={40} color="#fff" strokeWidth={3} />
          </View>
          <ThemedText style={styles.title}>Welcome to Pro!</ThemedText>
          <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
            You now have full access to all premium features
          </ThemedText>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <View key={index} style={styles.featureRow}>
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: Colors[colorScheme].foreground + '0D' },
                  ]}>
                  <Icon size={20} color={Colors[colorScheme].foreground} strokeWidth={2} />
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

        {/* CTA */}
        <Pressable
          onPress={handleContinue}
          style={[styles.continueButton, { backgroundColor: '#22c55e' }]}>
          <ThemedText style={styles.continueButtonText}>Start exploring</ThemedText>
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
    marginBottom: 48,
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
    paddingHorizontal: 20,
  },
  featuresContainer: {
    gap: 24,
    marginBottom: 48,
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
