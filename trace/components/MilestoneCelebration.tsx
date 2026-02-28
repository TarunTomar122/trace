import { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  Easing,
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import { Flame, Trophy, Star, Zap, Crown } from 'lucide-react-native';

interface Props {
  visible: boolean;
  milestone: number;
  onClose: () => void;
}

function getMilestoneConfig(milestone: number) {
  switch (milestone) {
    case 7:
      return {
        title: 'One Week!',
        subtitle: 'You read for 7 days straight',
        emoji: '🔥',
        color: '#F97316',
        Icon: Flame,
        message: 'The habit is forming. Keep it up!',
      };
    case 14:
      return {
        title: 'Two Weeks!',
        subtitle: '14 days of reading',
        emoji: '⚡',
        color: '#EAB308',
        Icon: Zap,
        message: 'You\'re building something great.',
      };
    case 30:
      return {
        title: 'One Month!',
        subtitle: '30 days of consistency',
        emoji: '🏆',
        color: '#F59E0B',
        Icon: Trophy,
        message: 'A whole month! You\'re incredible.',
      };
    case 60:
      return {
        title: 'Two Months!',
        subtitle: '60 days strong',
        emoji: '⭐',
        color: '#8B5CF6',
        Icon: Star,
        message: 'This is who you are now.',
      };
    case 100:
      return {
        title: 'Century!',
        subtitle: '100 days of reading',
        emoji: '👑',
        color: '#EC4899',
        Icon: Crown,
        message: 'You\'re in the top 1% of readers.',
      };
    case 200:
      return {
        title: 'Legendary!',
        subtitle: '200 days achieved',
        emoji: '💎',
        color: '#06B6D4',
        Icon: Crown,
        message: 'Absolutely legendary commitment.',
      };
    case 365:
      return {
        title: 'One Year!',
        subtitle: '365 days of reading',
        emoji: '🎉',
        color: '#10B981',
        Icon: Crown,
        message: 'A whole year! You\'re unstoppable.',
      };
    default:
      return {
        title: `${milestone} Days!`,
        subtitle: `${milestone} day streak`,
        emoji: '🔥',
        color: '#F97316',
        Icon: Flame,
        message: 'Keep the momentum going!',
      };
  }
}

export function MilestoneCelebration({ visible, milestone, onClose }: Props) {
  const scale = useSharedValue(0.5);
  const rotation = useSharedValue(0);

  const config = getMilestoneConfig(milestone);
  const IconComponent = config.Icon;

  useEffect(() => {
    if (visible) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 8 }),
        withSpring(1, { damping: 10 })
      );
      rotation.value = withSequence(
        withTiming(-10, { duration: 100 }),
        withTiming(10, { duration: 100 }),
        withTiming(-5, { duration: 100 }),
        withTiming(5, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
    }
  }, [visible]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          entering={ZoomIn.springify().damping(12)}
          style={styles.card}
        >
          {/* Big emoji/icon */}
          <Animated.View style={[styles.iconWrap, iconAnimatedStyle]}>
            <View style={[styles.iconBg, { backgroundColor: config.color + '20' }]}>
              <IconComponent
                size={48}
                color={config.color}
                fill={config.color + '40'}
                strokeWidth={2}
              />
            </View>
          </Animated.View>

          {/* Emoji burst */}
          <Text style={styles.emoji}>{config.emoji}</Text>

          {/* Content */}
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>
          <Text style={styles.message}>{config.message}</Text>

          {/* Streak number */}
          <View style={[styles.streakBadge, { backgroundColor: config.color + '15' }]}>
            <Flame size={20} color={config.color} fill={config.color} strokeWidth={2} />
            <Text style={[styles.streakNumber, { color: config.color }]}>{milestone}</Text>
          </View>

          {/* Close button */}
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Keep Reading</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  iconWrap: {
    marginBottom: 16,
  },
  iconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0a0a0a',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 20,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 20,
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: '#F97316',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
