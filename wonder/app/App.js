import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';

import { ThemeProvider, useTheme } from './ThemeContext';
import { AuthProvider, useAuth } from './lib/AuthContext';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AppNavigator from './navigation/AppNavigator';
import colors from './theme';

function Main() {
  const { colors } = useTheme();
  const { session, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = React.useState(false);

  // For now, always run onboarding at app start.
  if (!onboardingDone) {
    return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
  }

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
    return <WelcomeScreen />;
  }

  return <AppNavigator />;
}

const navTheme = {
  dark: true,
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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Main />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
