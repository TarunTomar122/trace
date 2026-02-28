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

const { width: W } = Dimensions.get('window');

export default function IntroScreen({ onComplete }) {
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
    <View style={styles.container}>
      {/* Mascot — centered */}
      <View style={[styles.heroArea, { paddingTop: insets.top + 60 }]}>
        <Image
          source={require('../assets/images/scientist.png')}
          style={styles.mascot}
          resizeMode="contain"
        />
      </View>

      {/* Title + CTA — bottom */}
      <Animated.View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + 32,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.title}>brainwave</Text>
        <Text style={styles.subtitle}>Learn something new</Text>

        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={onComplete}
        >
          <Text style={styles.ctaText}>GET STARTED</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  heroArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    width: W * 0.7,
    height: W * 0.7,
  },

  bottom: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#E8A4A0',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: '#777777',
    marginBottom: 40,
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
