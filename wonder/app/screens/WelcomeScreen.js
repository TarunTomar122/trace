import React, { useState } from 'react';
import {
  View,
  Text,
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
import { supabase } from '../lib/supabase';
import { useTheme } from '../ThemeContext';

GoogleSignin.configure({
  iosClientId:
    '77441044401-g6r9gn0degkcp4cfcshc6ji179tdlbue.apps.googleusercontent.com',
});

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 0;

export default function WelcomeScreen() {
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top section — brand */}
      <View style={styles.brandSection}>
        <View style={styles.wordmark}>
          <Text style={[styles.logoLight, { color: colors.textPrimary }]}>brain</Text>
          <Text style={[styles.logoBold, { color: colors.textPrimary }]}>wave</Text>
        </View>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          big ideas from books, articles, and videos,{'\n'}one card at a time
        </Text>
      </View>

      {/* Bottom section — CTA */}
      <View style={[styles.ctaSection, { marginBottom: BOTTOM_INSET + 32 }]}>
        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text
                style={[styles.googleButtonText, { color: colors.background }]}
              >
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },

  brandSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  logoLight: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: -2,
  },
  logoBold: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
  },
  tagline: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  ctaSection: {
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH - 64,
    height: 56,
    borderRadius: 16,
    gap: 12,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#050505',
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  disclaimer: {
    fontSize: 11,
    marginTop: 20,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
