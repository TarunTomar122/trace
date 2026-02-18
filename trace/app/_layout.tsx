import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RevenueCatProvider, useRevenueCat } from '@/contexts/RevenueCatContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

function AuthGate({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { isProUser, loading: revenueCatLoading } = useRevenueCat();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

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

    // User is logged in - wait for profile before deciding where to route.
    // Without this, a user with onboarded=true gets sent to /onboarding
    // prematurely because profile hasn't loaded yet.
    if (profile === null) return;
    if (profile.onboarded && revenueCatLoading) return;

    // User is logged in and still on an auth screen → redirect out
    if (inAuthGroup) {
      if (!profile.onboarded) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
      // Don't set ready yet - wait for segments to change after redirect
      return;
    }

    // User is logged in and on the correct screen
    setIsReady(true);
  }, [loading, user, profile, isProUser, revenueCatLoading, segments, router]);

  // Always render children so the Stack mounts and segments work.
  // Show an opaque overlay on top until routing is settled.
  return (
    <>
      {children}
      {(loading || !isReady || (user && profile?.onboarded && revenueCatLoading)) && (
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
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          freezeOnBlur: false,
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="article" options={{ presentation: 'card' }} />
        <Stack.Screen name="bookmarks" options={{ presentation: 'card' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <RevenueCatProvider>
            <AuthGate>
              <RootLayoutNav />
            </AuthGate>
          </RevenueCatProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
