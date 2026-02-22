import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Newspaper, BookMarked, Flame } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const { isProUser, presentPaywall } = useRevenueCat();
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Platform.OS === 'ios' ? Math.max(insets.bottom, 10) : Math.max(insets.bottom, 28);
  const tabBarHeight = (Platform.OS === 'ios' ? 56 : 58) + tabBarBottomPadding;

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        freezeOnBlur: false,
        tabBarActiveTintColor: Colors[colorScheme].foreground,
        tabBarInactiveTintColor: Colors[colorScheme].muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#0a0a0a' : '#ffffff',
          borderTopWidth: 1,
          borderTopColor: colorScheme === 'dark' ? '#1c1c1c' : '#f0f0f0',
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: tabBarBottomPadding,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <Newspaper size={24} color={color} strokeWidth={focused ? 2.2 : 1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, focused }) => (
            <BookMarked size={24} color={color} strokeWidth={focused ? 2.2 : 1.5} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if (!isProUser) {
              e.preventDefault();
              presentPaywall();
            }
          },
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Streak',
          tabBarIcon: ({ color, focused }) => (
            <Flame size={24} color={color} strokeWidth={focused ? 2.2 : 1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
