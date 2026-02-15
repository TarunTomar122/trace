import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ToastKind = 'info' | 'success' | 'error';

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<ToastKind>('info');
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 8,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMessage(null);
    });
  }, [opacity, translateY]);

  const showToast = useCallback(
    (nextMessage: string, nextKind: ToastKind = 'info', durationMs = 2000) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      setKind(nextKind);
      setMessage(nextMessage);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 170,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 170,
          useNativeDriver: true,
        }),
      ]).start();

      hideTimer.current = setTimeout(() => {
        hideToast();
      }, durationMs);
    },
    [hideToast, opacity, translateY]
  );

  const tone = useMemo(() => {
    if (kind === 'success') {
      return {
        bg: colorScheme === 'dark' ? '#0f2619' : '#ECFDF3',
        border: colorScheme === 'dark' ? '#1f5b3a' : '#BBF7D0',
        text: colorScheme === 'dark' ? '#bbf7d0' : '#166534',
      };
    }
    if (kind === 'error') {
      return {
        bg: colorScheme === 'dark' ? '#2a1316' : '#FEF2F2',
        border: colorScheme === 'dark' ? '#7f1d1d' : '#FECACA',
        text: colorScheme === 'dark' ? '#fecaca' : '#991B1B',
      };
    }
    return {
      bg: colorScheme === 'dark' ? '#14171c' : '#F5F7FA',
      border: colorScheme === 'dark' ? '#2f3742' : '#E5EAF0',
      text: Colors[colorScheme].text,
    };
  }, [colorScheme, kind]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <View pointerEvents="none" style={[styles.overlay, { bottom: Math.max(insets.bottom + 24, 28) }]}>
          <Animated.View
            style={[
              styles.toast,
              {
                backgroundColor: tone.bg,
                borderColor: tone.border,
                opacity,
                transform: [{ translateY }],
              },
            ]}>
            <ThemedText style={[styles.toastText, { color: tone.text }]}>{message}</ThemedText>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    paddingHorizontal: 16,
  },
  toast: {
    maxWidth: 360,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

