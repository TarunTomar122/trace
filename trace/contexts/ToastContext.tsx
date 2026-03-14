import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, Info } from 'lucide-react-native';

type ToastKind = 'info' | 'success' | 'error';

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

const TOAST_CONFIG = {
  success: {
    bg: '#1a1a1a',
    icon: Check,
    iconBg: '#22c55e',
  },
  error: {
    bg: '#1a1a1a',
    icon: X,
    iconBg: '#ef4444',
  },
  info: {
    bg: '#1a1a1a',
    icon: Info,
    iconBg: '#3b82f6',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<ToastKind>('info');
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 20,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMessage(null);
    });
  }, [opacity, translateY, scale]);

  const showToast = useCallback(
    (nextMessage: string, nextKind: ToastKind = 'info', durationMs = 2500) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      setKind(nextKind);
      setMessage(nextMessage);

      // Reset values
      opacity.setValue(0);
      translateY.setValue(20);
      scale.setValue(0.9);

      Animated.parallel([
        Animated.spring(opacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
      ]).start();

      hideTimer.current = setTimeout(() => {
        hideToast();
      }, durationMs);
    },
    [hideToast, opacity, translateY, scale]
  );

  const config = TOAST_CONFIG[kind];
  const Icon = config.icon;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <View pointerEvents="none" style={[styles.overlay, { bottom: Math.max(insets.bottom + 16, 24) }]}>
          <Animated.View
            style={[
              styles.toast,
              {
                backgroundColor: config.bg,
                opacity,
                transform: [{ translateY }, { scale }],
              },
            ]}>
            <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
              <Icon size={14} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={styles.toastText} numberOfLines={2}>{message}</Text>
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
    paddingHorizontal: 20,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 100,
    paddingLeft: 6,
    paddingRight: 16,
    paddingVertical: 6,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    fontSize: 14,
    fontFamily: 'IBMPlexSans_500Medium',
    color: '#fff',
  },
});

