import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from './ThemeContext';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { MascotProvider } from './lib/MascotContext';
import { SubscriptionProvider } from './lib/SubscriptionContext';
import { BookmarksProvider } from './lib/BookmarksContext';
import { DEV_SKIP_ONBOARDING } from './lib/devConfig';
import { refreshPersonalization } from './data';
import { hasCompletedOnboarding } from './lib/userPreferences';
import SplashScreen from './screens/SplashScreen';
import IntroScreen from './screens/IntroScreen';
import PreOnboardingScreen from './screens/PreOnboardingScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AppNavigator from './navigation/AppNavigator';

function Main() {
  const { colors } = useTheme();
  const { session, loading } = useAuth();

  const [checkingOnboarding, setCheckingOnboarding] = React.useState(true);
  const [introDone, setIntroDone] = React.useState(DEV_SKIP_ONBOARDING);
  const [preOnboardingDone, setPreOnboardingDone] = React.useState(DEV_SKIP_ONBOARDING);
  const [onboardingDone, setOnboardingDone] = React.useState(DEV_SKIP_ONBOARDING);
  const [skippedSignIn, setSkippedSignIn] = React.useState(DEV_SKIP_ONBOARDING);

  // Check if user already completed onboarding
  React.useEffect(() => {
    async function checkOnboarding() {
      const completed = await hasCompletedOnboarding();
      if (completed) {
        setIntroDone(true);
        setPreOnboardingDone(true);
        setOnboardingDone(true);
        setSkippedSignIn(true);
      }
      setCheckingOnboarding(false);
      refreshPersonalization();
    }
    checkOnboarding();
  }, []);

  if (loading || checkingOnboarding) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  // User is signed in or skipped sign-in
  if (session || skippedSignIn) {
    return <AppNavigator />;
  }

  // Onboarding flow
  if (!introDone) {
    return <IntroScreen onComplete={() => setIntroDone(true)} />;
  }

  if (!preOnboardingDone) {
    return <PreOnboardingScreen onComplete={() => setPreOnboardingDone(true)} />;
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onComplete={() => {
          refreshPersonalization(); // Refresh feed with new preferences
          setOnboardingDone(true);
        }}
      />
    );
  }

  return <WelcomeScreen onSkip={() => setSkippedSignIn(true)} />;
}

/**
 * Separate component so NavigationContainer and StatusBar can
 * read the active theme from context. When dark mode is wired up,
 * navTheme and statusBarStyle will automatically follow.
 */
function AppWithTheme() {
  const { colors, isDark } = useTheme();
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(t);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  const navTheme = {
    dark: isDark,
    colors: {
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.surfaceBorder,
      notification: colors.accent,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '800' },
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={colors.statusBarStyle} />
      <Main />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <BookmarksProvider>
              <MascotProvider>
                <AppWithTheme />
              </MascotProvider>
            </BookmarksProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
