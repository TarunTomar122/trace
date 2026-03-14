import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gift, Rocket, ChevronRight, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, FontFamily } from '@/constants/theme';
import { getEarlyAdopterStatus, EarlyAdopterStatus } from '@/lib/firestore';

const DISMISSED_KEY = 'early_adopter_banner_dismissed';

interface Props {
  colorScheme: 'light' | 'dark';
  isEarlyAdopter: boolean;
  isSubscribed: boolean;
  onPress?: () => void;
}

export function EarlyAdopterBanner({ colorScheme, isEarlyAdopter, isSubscribed, onPress }: Props) {
  const [status, setStatus] = useState<EarlyAdopterStatus | null>(null);
  const [dismissed, setDismissed] = useState(true); // Start hidden until we check

  useEffect(() => {
    if (isEarlyAdopter) {
      // Check if early adopter banner was already dismissed
      AsyncStorage.getItem(DISMISSED_KEY).then((val) => {
        setDismissed(val === 'true');
      });
    } else if (!isSubscribed) {
      setDismissed(false);
      getEarlyAdopterStatus().then(setStatus).catch(() => {});
    }
  }, [isEarlyAdopter, isSubscribed]);

  const handleDismiss = async () => {
    setDismissed(true);
    await AsyncStorage.setItem(DISMISSED_KEY, 'true');
  };

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#1a1408' : '#fffbeb';
  const borderColor = isDark ? '#422006' : '#fef3c7';
  const textColor = Colors[colorScheme].text;
  const mutedColor = Colors[colorScheme].muted;
  const accentColor = '#F59E0B';

  // If user is an early adopter, show the success message (once)
  if (isEarlyAdopter) {
    if (dismissed) return null;
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[styles.banner, { backgroundColor: bgColor, borderColor }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: accentColor + '20' }]}>
          <Gift size={18} color={accentColor} strokeWidth={2} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>
            You're an early adopter!
          </Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>
            Full Pro access is yours free — forever
          </Text>
        </View>
        <Pressable onPress={handleDismiss} hitSlop={8}>
          <X size={18} color={mutedColor} strokeWidth={2} />
        </Pressable>
      </Animated.View>
    );
  }

  // Don't show to subscribed users or if program is closed
  if (isSubscribed) return null;
  if (status && !status.isOpen) return null;

  // For non-subscribed, non-early-adopters, show the launch offer banner
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
    >
      <Pressable
        onPress={onPress}
        style={[styles.banner, { backgroundColor: bgColor, borderColor }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: accentColor + '20' }]}>
          <Rocket size={18} color={accentColor} strokeWidth={2} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>
            Free for first {status?.limit ?? 200} users
          </Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>
            {status ? `${status.spotsRemaining} spots left` : 'Limited time offer'}
          </Text>
        </View>
        <ChevronRight size={18} color={mutedColor} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    marginTop: 8,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
});
