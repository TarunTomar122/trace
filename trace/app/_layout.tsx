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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // Wait for the navigation tree to mount so segments are populated
    if (segments.length === 0) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Not logged in → make sure we're on the welcome screen
    if (!user) {
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      } else {
        setIsReady(true);
      }
      return;
    }

    // User is logged in — wait for profile before deciding where to route.
    // Without this, a user with onboarded=true gets sent to /onboarding
    // prematurely because profile hasn't loaded yet.
    if (profile === null) return;

    // User is logged in and still on an auth screen → redirect out
    if (inAuthGroup) {
      if (profile.onboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
      // Don't set ready yet — wait for segments to change after redirect
      return;
    }

    // User is logged in and on the correct screen
    setIsReady(true);
  }, [loading, user, profile, segments, router]);

  // Always render children so the Stack mounts and segments work.
  // Show an opaque overlay on top until routing is settled.
  return (
    <>
      {children}
      {(loading || !isReady) && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.loadingContainer,
            { backgroundColor: Colors[colorScheme].background },
          ]}
        >
          <ActivityIndicator size="large" color={Colors[colorScheme].foreground} />
        </View>
      )}
    </>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="article" options={{ presentation: 'card' }} />
        <Stack.Screen name="bookmarks" options={{ presentation: 'card' }} />
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
