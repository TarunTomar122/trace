import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../lib/AuthContext';

const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 0;

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { session, signOut } = useAuth();

  const user = session?.user;
  const name = user?.user_metadata?.full_name || user?.email || 'Reader';
  const email = user?.email || '';
  const initial = name.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: STATUS_BAR_HEIGHT + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Profile
        </Text>
      </View>

      <View style={styles.content}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: colors.accent + '20' }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>
            {initial}
          </Text>
        </View>

        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {name}
        </Text>
        {email ? (
          <Text style={[styles.email, { color: colors.textTertiary }]}>
            {email}
          </Text>
        ) : null}

        {/* Sign out */}
        <TouchableOpacity
          style={[styles.signOutButton, { borderColor: colors.surfaceBorder }]}
          activeOpacity={0.7}
          onPress={signOut}
        >
          <Text style={[styles.signOutText, { color: colors.textSecondary }]}>
            Sign out
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 40,
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

