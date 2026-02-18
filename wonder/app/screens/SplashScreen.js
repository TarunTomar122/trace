import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../ThemeContext';

export default function SplashScreen() {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.Image
        source={require('../assets/images/base.png')}
        style={[styles.mascot, { opacity }]}
        resizeMode="contain"
      />

      <Animated.View style={[styles.nameRow, { opacity }]}>
        <Text style={[styles.nameLight, { color: colors.textPrimary }]}>brain</Text>
        <Text style={[styles.nameBold, { color: colors.textPrimary }]}>wave</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    width: 256,
    height: 256,
  },
  nameRow: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  nameLight: {
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  nameBold: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
