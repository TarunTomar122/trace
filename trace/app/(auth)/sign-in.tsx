import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

export default function SignInScreen() {
  const { signInWithGoogle } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in.';
      setError(message);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}>
      <ThemedView style={styles.container}>
        <ThemedView
          style={[
            styles.card,
            {
              borderColor: Colors[colorScheme].border,
              backgroundColor: Colors[colorScheme].card,
            },
          ]}>
          <ThemedText type="title" style={styles.title}>
            Trace
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].secondary }]}>
            Your personalized feed of what matters in tech.
          </ThemedText>

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: Colors[colorScheme].foreground },
            ]}
            onPress={handleGoogleSignIn}>
            <ThemedText
              style={[
                styles.primaryButtonText,
                { color: Colors[colorScheme].background },
              ]}>
              Continue with Google
            </ThemedText>
          </Pressable>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          <ThemedText style={[styles.helperText, { color: Colors[colorScheme].muted }]}>
            By continuing you agree to the Trace terms and privacy policy.
          </ThemedText>
        </ThemedView>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  title: {
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {},
  primaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.mono,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  errorText: {
    color: '#b91c1c',
  },
  helperText: {
    fontSize: 12,
  },
});

