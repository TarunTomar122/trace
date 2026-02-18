import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';

const { width: W } = Dimensions.get('window');

const SOURCES = [
  { emoji: '📚', label: 'Books' },
  { emoji: '▶', label: 'YouTube' },
  { emoji: '📰', label: 'Articles' },
];

export default function IntroScreen({ onComplete }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Wordmark */}
      <View style={[styles.wordmark, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.wordLight, { color: colors.textPrimary }]}>brain</Text>
        <Text style={[styles.wordBold, { color: colors.textPrimary }]}>wave</Text>
      </View>

      {/* Hero mascot */}
      <View style={styles.mascotContainer}>
        <Image
          source={require('../assets/images/scientist.png')}
          style={styles.mascot}
          resizeMode="contain"
        />
      </View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={[styles.eyebrow, { color: colors.accent }]}>
          THE ANTI-BRAINROT APP
        </Text>

        <Text style={[styles.headline, { color: colors.textPrimary }]}>
          Big ideas.{'\n'}Zero brainrot.
        </Text>

        {/* Source pills */}
        <View style={styles.sourcesRow}>
          {SOURCES.map((s, i) => (
            <View
              key={s.label}
              style={[
                styles.pill,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.surfaceBorder,
                },
              ]}
            >
              <Text style={styles.pillEmoji}>{s.emoji}</Text>
              <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We pull the best insights from the world's top sources, distilled into
          bite-sized cards.
        </Text>
      </Animated.View>

      {/* CTAs */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={onComplete}
        >
          <Text style={[styles.ctaText, { color: colors.textPrimary }]}>
            Get started  →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          activeOpacity={0.6}
          onPress={onComplete}
        >
          <Text style={[styles.skipText, { color: colors.textTertiary }]}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  wordmark: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 24,
  },
  wordLight: {
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: -0.3,
  },
  wordBold: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  mascotContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    width: W * 0.62,
    height: W * 0.62,
  },

  content: {
    paddingHorizontal: 28,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  headline: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 20,
  },

  sourcesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillEmoji: {
    fontSize: 13,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  body: {
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
  },

  footer: {
    paddingHorizontal: 24,
    gap: 4,
  },
  ctaButton: {
    height: 56,
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
