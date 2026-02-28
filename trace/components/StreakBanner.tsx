import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  FadeIn,
} from 'react-native-reanimated';
import { Flame, Shield, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/theme';
import {
  getStreakStatus,
  getNextMilestone,
  getStreakMessage,
} from '@/lib/streaks';

interface Props {
  colorScheme: 'light' | 'dark';
  onStreakUpdate?: () => void;
}

export function StreakBanner({ colorScheme, onStreakUpdate }: Props) {
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [hasReadToday, setHasReadToday] = useState(false);
  const [shields, setShields] = useState(0);
  const [isAtRisk, setIsAtRisk] = useState(false);

  const scale = useSharedValue(1);

  useEffect(() => {
    loadStreak();
  }, []);

  const loadStreak = async () => {
    const status = await getStreakStatus();
    setStreak(status.currentStreak);
    setHasReadToday(status.hasReadToday);
    setShields(status.shieldsRemaining);
    setIsAtRisk(status.isAtRisk);

    // Bounce animation when streak loads
    if (status.currentStreak > 0) {
      scale.value = withSequence(
        withSpring(1.1, { damping: 8 }),
        withSpring(1, { damping: 10 })
      );
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const nextMilestone = getNextMilestone(streak);
  const progress = nextMilestone ? (streak / nextMilestone) * 100 : 100;
  const message = getStreakMessage(streak, hasReadToday);

  const flameColor = hasReadToday ? '#F97316' : (isAtRisk ? '#EAB308' : Colors[colorScheme].muted);
  const bgColor = colorScheme === 'dark' ? '#1a1408' : '#fffbeb';
  const borderColor = hasReadToday ? '#F9731630' : (isAtRisk ? '#EAB30830' : Colors[colorScheme].border);

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <Pressable
        onPress={() => router.push('/(tabs)/analytics')}
        style={[styles.container, { backgroundColor: bgColor, borderColor }]}
      >
        <View style={styles.mainRow}>
          {/* Flame + Streak Count */}
          <Animated.View style={[styles.flameWrap, animatedStyle]}>
            <Flame
              size={32}
              color={flameColor}
              fill={hasReadToday ? '#F97316' : 'transparent'}
              strokeWidth={2}
            />
            <Text style={[styles.streakCount, { color: flameColor }]}>
              {streak}
            </Text>
          </Animated.View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
              {streak === 0 ? 'Start Your Streak' : `${streak} Day Streak`}
            </Text>
            <Text style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
              {message}
            </Text>

            {/* Progress bar to next milestone */}
            {nextMilestone && streak > 0 && (
              <View style={styles.progressWrap}>
                <View style={[styles.progressBg, { backgroundColor: Colors[colorScheme].border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(progress, 100)}%`, backgroundColor: '#F97316' },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: Colors[colorScheme].muted }]}>
                  {nextMilestone - streak} to {nextMilestone}
                </Text>
              </View>
            )}
          </View>

          {/* Shield indicator */}
          <View style={styles.rightSection}>
            {shields > 0 && (
              <View style={styles.shieldBadge}>
                <Shield size={16} color="#3B82F6" fill="#3B82F620" strokeWidth={2} />
                <Text style={styles.shieldCount}>{shields}</Text>
              </View>
            )}
            <ChevronRight size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </View>
        </View>

        {/* At risk warning */}
        {isAtRisk && !hasReadToday && (
          <View style={styles.warningRow}>
            <Text style={styles.warningText}>
              Read today to keep your streak alive!
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flameWrap: {
    alignItems: 'center',
    marginRight: 14,
  },
  streakCount: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: -4,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  progressBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3B82F615',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  shieldCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
  },
  warningRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAB30830',
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EAB308',
    textAlign: 'center',
  },
});
