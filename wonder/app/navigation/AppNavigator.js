import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { Compass, Bookmark, Flame } from 'lucide-react-native';
import { useTheme } from '../ThemeContext';

import BookFeed from '../screens/BookFeed';
import IdeaReel from '../screens/IdeaReel';
import ProfileScreen from '../screens/ProfileScreen';
import BookmarksScreen from '../screens/BookmarksScreen';
import StreaksScreen from '../screens/StreaksScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 84,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tab.Screen
        name="Explore"
        component={BookFeed}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Compass size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tab.Screen
        name="Saved"
        component={BookmarksScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Bookmark size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tab.Screen
        name="Activity"
        component={StreaksScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Flame size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen
        name="IdeaReel"
        component={IdeaReel}
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <RootStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
        }}
      />
      <RootStack.Screen
        name="Streaks"
        component={StreaksScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
        }}
      />
    </RootStack.Navigator>
  );
}
