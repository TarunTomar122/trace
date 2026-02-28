import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

GoogleSignin.configure({
  iosClientId:
    '77441044401-g6r9gn0degkcp4cfcshc6ji179tdlbue.apps.googleusercontent.com',
});

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen({ onSkip }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    if (loading) return;
    setLoading(true);

    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token returned from Google');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        console.error('Supabase signInWithIdToken error:', error.message);
        Alert.alert('Sign-in failed', error.message);
      }
    } catch (e) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled — do nothing
      } else if (e.code === statusCodes.IN_PROGRESS) {
        // already in progress
      } else {
        console.error('Google sign-in error:', e);
        Alert.alert('Sign-in error', e.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Mascot section */}
      <View style={[styles.heroSection, { paddingTop: insets.top + 60 }]}>
        <Image
          source={require('../assets/images/scientist.png')}
          style={styles.mascot}
          resizeMode="contain"
        />
      </View>

      {/* Bottom section — CTA */}
      <View style={[styles.ctaSection, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Save your progress and sync across devices</Text>

        <TouchableOpacity
          style={styles.googleButton}
          activeOpacity={0.85}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          activeOpacity={0.7}
          onPress={onSkip}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
  },

  ctaSection: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#777777',
    marginBottom: 28,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH - 48,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#8BC34A',
    gap: 12,
    shadowColor: '#5D8C2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  skipButton: {
    marginTop: 20,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8BC34A',
  },
});
