import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from './ThemeContext';
import { AuthProvider, useAuth } from './lib/AuthContext';
import SplashScreen from './screens/SplashScreen';
import IntroScreen from './screens/IntroScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AppNavigator from './navigation/AppNavigator';

function Main() {
  const { colors } = useTheme();
  const { session, loading } = useAuth();
  const [introDone, setIntroDone] = React.useState(false);
  const [onboardingDone, setOnboardingDone] = React.useState(false);

  if (loading) {
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

  if (!session) {
    if (!introDone) {
      return <IntroScreen onComplete={() => setIntroDone(true)} />;
    }

    // Run onboarding only for logged-out users.
    if (!onboardingDone) {
      return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
    }

    return <WelcomeScreen />;
  }

  return <AppNavigator />;
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
          <AppWithTheme />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
