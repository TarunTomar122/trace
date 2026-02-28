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
import { Clock } from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

export default function PreOnboardingScreen({ onComplete }) {
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        <Animated.View
          style={[
            styles.iconContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Clock size={64} color="#8BC34A" strokeWidth={2.5} />
        </Animated.View>

        <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
          Just 2 minutes
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, { opacity: fadeAnim }]}>
          to personalize your learning
        </Animated.Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 32 }]}>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={onComplete}
        >
          <Text style={styles.ctaText}>LET'S GO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F7E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 18,
    color: '#777777',
    letterSpacing: -0.2,
  },

  bottom: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  ctaButton: {
    width: W - 48,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#8BC34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5D8C2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },

  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
