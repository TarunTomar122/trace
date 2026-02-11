import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useTheme } from '../ThemeContext';

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 0;

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  // Listen for OAuth redirect
  useEffect(() => {
    const handleUrl = async (event) => {
      const url = event.url;
      if (url?.includes('auth/callback')) {
        try {
          const parsedUrl = new URL(url);
          const fragment = parsedUrl.hash?.substring(1);
          const params = new URLSearchParams(fragment);

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        } catch (e) {
          console.error('Error handling redirect:', e);
        }
        setLoading(false);
      }
    };

    // Listen for URL events
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription?.remove();
    };
  }, []);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      console.log('Redirect URL:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('OAuth error:', error.message);
        setLoading(false);
        return;
      }

      if (data?.url) {
        // Open Supabase's auth URL in a browser
        await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      }
    } catch (e) {
      console.error('Sign-in failed:', e);
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top section — brand */}
      <View style={styles.brandSection}>
        <Text style={[styles.logo, { color: colors.accent }]}>wonder</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          big ideas from great books,{'\n'}one card at a time
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

  // Brand
  brandSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // CTA
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
