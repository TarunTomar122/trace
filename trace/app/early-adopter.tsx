import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

export default function EarlyAdopterOfferScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { profile } = useAuth();

  useEffect(() => {
    router.replace(profile?.onboarded ? '/(tabs)' : '/onboarding');
  }, [router, profile?.onboarded]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme].foreground} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
