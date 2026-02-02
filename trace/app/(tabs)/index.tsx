import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const { profile, signOut } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>Today</ThemedText>
          <ThemedText type="title">Your Trace Feed</ThemedText>
          <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].secondary }]}>
            {profile?.displayName ? `Welcome back, ${profile.displayName}.` : 'Welcome back.'}
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border },
          ]}>
          <ThemedText type="defaultSemiBold">Feed coming soon</ThemedText>
          <ThemedText style={[styles.cardText, { color: Colors[colorScheme].muted }]}>
            We&apos;re wiring the personalized feed to match the web experience.
          </ThemedText>
        </ThemedView>

        <Pressable
          style={[
            styles.secondaryButton,
            { borderColor: Colors[colorScheme].border },
          ]}
          onPress={signOut}>
          <ThemedText style={styles.secondaryButtonText}>Sign out</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardText: {
    fontSize: 13,
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
