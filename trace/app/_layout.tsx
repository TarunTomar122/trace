import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

function AuthGate({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [isNavigating, setIsNavigating] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    // Not logged in -> go to welcome
    if (!user) {
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
      setIsNavigating(false);
      return;
    }

    // User is logged in
    if (inAuthGroup) {
      // Coming from auth screens, redirect based on onboarded status
      if (profile?.onboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
      // Keep navigating state true until navigation completes
      setTimeout(() => setIsNavigating(false), 100);
      return;
    }

    // Allow onboarded users to access onboarding for editing preferences
    // (Don't redirect them away from onboarding)

    // All good, show content
    setIsNavigating(false);
  }, [loading, user, profile, segments, router]);

  // Show loading while auth is loading or during navigation
  if (loading || isNavigating) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors[colorScheme].background }]}>
        <ActivityIndicator size="large" color={Colors[colorScheme].foreground} />
      </View>
    );
  }

  return children;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <RootLayoutNav />
      </AuthGate>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
