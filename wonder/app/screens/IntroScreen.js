import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';

const { width: W } = Dimensions.get('window');

export default function IntroScreen({ onComplete }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Mascot — centered in the top half */}
      <View style={[styles.heroArea, { paddingTop: insets.top + 40 }]}>
        <Image
          source={require('../assets/images/scientist.png')}
          style={styles.mascot}
          resizeMode="contain"
        />
      </View>

      {/* Headline + CTA — bottom half */}
      <Animated.View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + 24,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={[styles.headline, { color: colors.textPrimary }]}>
          Key Ideas from Books,{'\n'}Videos, and more
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          5-minute insights from the world's best sources.{'\n'}The anti-brainrot app.
        </Text>

        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={onComplete}
        >
          <Text style={[styles.ctaText, { color: colors.textPrimary }]}>
            Get started
          </Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  heroArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    width: W * 0.6,
    height: W * 0.6,
  },

  bottom: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },

  ctaButton: {
    width: W - 56,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  skipButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
