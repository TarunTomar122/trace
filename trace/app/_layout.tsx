import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import LottieView from 'lottie-react-native';
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
import { useFonts } from '@expo-google-fonts/ibm-plex-sans/useFonts';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';
import { IBMPlexSerif_400Regular } from '@expo-google-fonts/ibm-plex-serif/400Regular';
import { IBMPlexSerif_500Medium } from '@expo-google-fonts/ibm-plex-serif/500Medium';
import { IBMPlexSerif_600SemiBold } from '@expo-google-fonts/ibm-plex-serif/600SemiBold';
import { IBMPlexSerif_700Bold } from '@expo-google-fonts/ibm-plex-serif/700Bold';
import {
  initializeNotifications,
  addNotificationResponseListener,
} from '@/lib/notifications';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RevenueCatProvider } from '@/contexts/RevenueCatContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Colors, FontFamily, Typography } from '@/constants/theme';
import { getAppVersionConfig, getArticleById, getTopicById } from '@/lib/firestore';
import { setCurrentArticle } from '@/lib/article-store';
import { setCurrentTopic } from '@/lib/topic-store';

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
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const appVersion = Application.nativeApplicationVersion || '1.0.0';
    getAppVersionConfig().then((config) => {
      if (!config) return;
      if (config.min_version && !checkVersion(appVersion, config.min_version)) {
        setNeedsUpdate(true);
        return;
      }
      if (config.latest_version && !checkVersion(appVersion, config.latest_version)) {
        setLatestVersion(config.latest_version);
      }
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

  return (
    <>
      {children}
    </>
  );
}

function checkVersion(current: string, target: string): boolean {
  const c = current.split('.').map(Number);
  const t = target.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, t.length); i++) {
    const cv = c[i] || 0;
    const tv = t[i] || 0;
    if (cv < tv) return false;
    if (cv > tv) return true;
  }
  return true;
}

function AuthGate({ children }: { children: ReactNode }) {
  const {
    user,
    profile,
    bootUid,
    bootProfile,
    loading,
    profileResolved,
    profileLoadError,
    profileServerVerified,
    retryProfileLoad,
    signOut,
  } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [appReady, setAppReady] = useState(false);
  const [recoveringProfile, setRecoveringProfile] = useState(false);
  const needsProfileRecovery = !!user && profileResolved && !profileServerVerified;

  useEffect(() => {
    const effectiveUid = user?.uid || bootUid;
    const effectiveProfile = user ? profile : (profile || bootProfile);

    if (loading) return;
    if (user && !profileResolved) return;
    if (needsProfileRecovery) {
      setAppReady(true);
      return;
    }
    // Don't block on RevenueCat - let feed load while RC initializes in background

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inEarlyAdopter = segments[0] === 'early-adopter';

    if (!effectiveUid) {
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      } else {
        setAppReady(true);
      }
      return;
    }

    if (effectiveProfile?.onboarded === false) {
      // If already on early-adopter or onboarding, let those screens handle navigation
      if (inEarlyAdopter || inOnboarding) {
        setAppReady(true);
        return;
      }

      // Profile is null means it failed to load (network error / cache miss).
      // Don't route anywhere — keep the splash up. The AuthContext retry will
      // re-resolve profileResolved and re-trigger this effect once it succeeds.
      if (!effectiveProfile) return;

      // Only route once the early-adopter state is explicit. Missing/stale values
      // should keep the splash up until the real profile resolves.
      if (effectiveProfile.isEarlyAdopter === false) {
        router.replace('/early-adopter');
        return;
      }

      if (effectiveProfile.isEarlyAdopter !== true) {
        return;
      }

      // Already claimed early adopter, go to onboarding
      router.replace('/onboarding');
      return;
    }

    if (!effectiveProfile) {
      return;
    }

    // User is onboarded - redirect away from auth/onboarding screens.
    // Keep early-adopter accessible so eligible users can still claim the launch offer.
    if (inAuthGroup || inOnboarding) {
      router.replace('/(tabs)');
      return;
    }

    // On a valid screen; release the splash.
    setAppReady(true);
  }, [loading, user, profile, bootUid, bootProfile, profileResolved, needsProfileRecovery, segments, router]);

  const [lottieFinished, setLottieFinished] = useState(false);
  const splashVisible = !appReady || !lottieFinished;

  // Hide native splash as soon as our Lottie overlay is mounted
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const onAnimationFinish = useCallback(() => {
    setLottieFinished(true);
  }, []);

  const handleRetryProfile = useCallback(async () => {
    setRecoveringProfile(true);
    try {
      await retryProfileLoad();
    } finally {
      setRecoveringProfile(false);
    }
  }, [retryProfileLoad]);

  return (
    <>
      {needsProfileRecovery ? (
        <View
          style={[
            styles.splashContainer,
            { backgroundColor: Colors[colorScheme].background, paddingHorizontal: 28 },
          ]}
        >
          <Text style={[styles.updateTitle, { color: Colors[colorScheme].foreground, textAlign: 'center' }]}>
            Account Needs Sync
          </Text>
          <Text style={[styles.updateBody, { color: Colors[colorScheme].muted }]}>
            We found local account data, but could not verify your onboarding state with the server yet.
            Please retry once you have a stable connection.
          </Text>
          <Pressable
            style={[
              styles.updateButton,
              { backgroundColor: Colors[colorScheme].foreground, opacity: recoveringProfile ? 0.7 : 1 },
            ]}
            disabled={recoveringProfile}
            onPress={() => void handleRetryProfile()}
          >
            <Text style={[styles.updateButtonText, { color: Colors[colorScheme].background }]}>
              {recoveringProfile ? 'Retrying...' : 'Retry Sync'}
            </Text>
          </Pressable>
          <Pressable
            style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 24 }}
            onPress={() => void signOut()}
          >
            <Text style={[styles.updateButtonText, { color: Colors[colorScheme].muted }]}>
              Sign Out
            </Text>
          </Pressable>
          {profileLoadError ? (
            <Text style={[styles.updateBody, { color: Colors[colorScheme].muted, marginTop: 8, marginBottom: 0 }]}>
              The last profile fetch failed. If this keeps happening, try switching networks.
            </Text>
          ) : null}
        </View>
      ) : (
        children
      )}
      {splashVisible && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.splashContainer,
            { backgroundColor: '#f59e0b', zIndex: 999 },
          ]}>
          <LottieView
            source={require('@/assets/images/splash.json')}
            autoPlay
            loop={!appReady}
            onAnimationFinish={onAnimationFinish}
            resizeMode="cover"
            style={{ position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%' }}
          />
        </View>
      )}
    </>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // Initialize notifications and set up response listener
  useEffect(() => {
    initializeNotifications();

    // Handle notification taps - prefer topic deep links, then fall back to article
    const subscription = addNotificationResponseListener(async (response) => {
      const data = response.notification.request.content.data;

      if (data?.topicId) {
        const topic = await getTopicById(String(data.topicId));
        if (topic) {
          setCurrentTopic(topic);
          router.push('/topic');
          return;
        }
      }

      if (data?.articleId) {
        const article = await getArticleById(String(data.articleId));
        if (article) {
          setCurrentArticle(article);
          router.push('/article');
        }
      }
    });

    return () => subscription.remove();
  }, [router]);

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
        <Stack.Screen name="topic" options={{ presentation: 'card', animation: 'default' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexSerif_400Regular,
    IBMPlexSerif_500Medium,
    IBMPlexSerif_600SemiBold,
    IBMPlexSerif_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      console.log('[Fonts] Loaded successfully:', Object.keys({
        IBMPlexSans_400Regular,
        IBMPlexSans_500Medium,
        IBMPlexSans_600SemiBold,
        IBMPlexSans_700Bold,
        IBMPlexSerif_400Regular,
        IBMPlexSerif_500Medium,
        IBMPlexSerif_600SemiBold,
        IBMPlexSerif_700Bold,
      }));
    }
    if (fontError) {
      console.error('[Fonts] Error loading fonts:', fontError);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
  lottie: {
    width: '150%',
    height: '150%',
  },
  splashLogo: {
    width: 128,
    height: 128,
    marginBottom: 16,
  },
  splashTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    letterSpacing: 4,
  },
  updateTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  updateBody: {
    fontFamily: FontFamily.regular,
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
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },
});
