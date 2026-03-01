import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Text,
  Linking,
  Pressable,
  Platform,
} from 'react-native';
import 'react-native-reanimated';
import * as Application from 'expo-application';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RevenueCatProvider, useRevenueCat } from '@/contexts/RevenueCatContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';
import { checkMinAppVersion } from '@/lib/firestore';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(auth)',
};

const LIGHT_LOGO = require('@/assets/images/trace.png');
const DARK_LOGO = require('@/assets/images/dark-icon.png');

const STORE_URL = Platform.select({
  android: 'https://play.google.com/store/apps/details?id=online.yourtrace.app',
  ios: 'https://apps.apple.com/app/id123456789',
  default: 'https://www.yourtrace.online',
});

function ForceUpdateGate({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const [needsUpdate, setNeedsUpdate] = useState(false);

  useEffect(() => {
    const appVersion = Application.nativeApplicationVersion || '1.0.0';
    checkMinAppVersion(appVersion).then((ok) => {
      if (!ok) setNeedsUpdate(true);
    });
  }, []);

  if (needsUpdate) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: Colors[colorScheme].background }]}>
        <Image
          source={colorScheme === 'dark' ? DARK_LOGO : LIGHT_LOGO}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={[styles.updateTitle, { color: Colors[colorScheme].foreground }]}>
          Update Available
        </Text>
        <Text style={[styles.updateBody, { color: Colors[colorScheme].muted }]}>
          A new version of Trace is available with important improvements.
          Please update to continue.
        </Text>
        <Pressable
          style={[styles.updateButton, { backgroundColor: Colors[colorScheme].foreground }]}
          onPress={() => Linking.openURL(STORE_URL)}
        >
          <Text style={[styles.updateButtonText, { color: Colors[colorScheme].background }]}>
            Update Now
          </Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { isProUser, loading: revenueCatLoading } = useRevenueCat();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [appReady, setAppReady] = useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (user && profile === null) return;
    if (user && profile?.onboarded && revenueCatLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!user) {
      if (!inAuthGroup) {
        hasNavigated.current = true;
        router.replace('/(auth)/welcome');
      } else {
        setAppReady(true);
      }
      return;
    }

    if (!profile?.onboarded) {
      const inEarlyAdopter = segments[0] === 'early-adopter';

      // If already on early-adopter or onboarding, let those screens handle navigation
      if (inEarlyAdopter || inOnboarding) {
        setAppReady(true);
        return;
      }

      // If not an early adopter yet, show the offer screen first
      if (!profile?.isEarlyAdopter) {
        hasNavigated.current = true;
        router.replace('/early-adopter');
        return;
      }

      // Already claimed early adopter, go to onboarding
      hasNavigated.current = true;
      router.replace('/onboarding');
      return;
    }

    // User is onboarded + RC done
    if (inAuthGroup || inOnboarding) {
      hasNavigated.current = true;
      router.replace('/(tabs)');
      return;
    }

    // On correct screen — wait an extra frame so the screen is painted
    if (hasNavigated.current) {
      const timer = setTimeout(() => setAppReady(true), 50);
      return () => clearTimeout(timer);
    }
    setAppReady(true);
  }, [loading, user, profile, isProUser, revenueCatLoading, segments, router]);

  // Hide native splash + branded overlay together
  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  return (
    <>
      {children}
      {!appReady && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.splashContainer,
            { backgroundColor: Colors[colorScheme].background, zIndex: 999 },
          ]}
        >
          <Image
            source={colorScheme === 'dark' ? DARK_LOGO : LIGHT_LOGO}
            style={styles.splashLogo}
            resizeMode="contain"
          />
          <Text style={[styles.splashTitle, { color: Colors[colorScheme].foreground }]}>
            TRACE
          </Text>
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
          animation: 'none',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="early-adopter" options={{ presentation: 'fullScreenModal', animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', animation: 'none' }} />
        <Stack.Screen name="preferences" options={{ presentation: 'card', animation: 'default' }} />
        <Stack.Screen name="article" options={{ presentation: 'card', animation: 'default' }} />
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
            <ForceUpdateGate>
              <AuthGate>
                <RootLayoutNav />
              </AuthGate>
            </ForceUpdateGate>
          </RevenueCatProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 64,
    height: 64,
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 4,
  },
  updateTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  updateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 28,
  },
  updateButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 999,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
