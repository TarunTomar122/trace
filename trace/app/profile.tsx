import { Linking, Pressable, ScrollView, StyleSheet, View, Text, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Flame,
  Crown,
  LogOut,
  Mail,
  Star,
  CreditCard,
  Trash2,
  Trophy,
  Calendar,
  Bell,
  HelpCircle,
} from 'lucide-react-native';

import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { updateUserProfile } from '@/lib/firestore';
import { getStreakData, StreakData } from '@/lib/streaks';
import { enablePushNotifications, disablePushNotifications } from '@/lib/notifications';
import * as StoreReview from 'expo-store-review';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

const STAT_ORANGE = '#FF6B35';
const ACCENT_ORANGE = '#ff8d28';

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type MenuRowProps = {
  icon: typeof Settings;
  label: string;
  subtitle?: string;
  colorScheme: 'light' | 'dark';
  onPress: () => void;
  showChevron?: boolean;
  danger?: boolean;
  rightElement?: React.ReactNode;
  isLast?: boolean;
};

function MenuRow({ icon: Icon, label, subtitle, colorScheme, onPress, showChevron = true, danger, rightElement, isLast }: MenuRowProps) {
  const isDark = colorScheme === 'dark';
  const iconBg = danger ? '#EF444415' : isDark ? '#2a2a2a' : '#ECECF0';
  const iconColor = danger ? '#EF4444' : '#717182';
  const labelColor = danger ? '#EF4444' : isDark ? '#fff' : '#000000';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : '#E8E8E8';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, !isLast && { borderBottomWidth: 1, borderBottomColor: dividerColor }]}>
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <Icon size={20} color={iconColor} strokeWidth={1.7} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: labelColor }]}>{label}</Text>
        {subtitle && (
          <Text style={[styles.menuSubtitle, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.6)' }]}>{subtitle}</Text>
        )}
      </View>
      {rightElement ?? (showChevron && <ChevronRight size={20} color={isDark ? 'rgba(255,255,255,0.3)' : '#CBCED4'} strokeWidth={1.5} />)}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user, profile, signOut, refreshProfile, deleteAccount } = useAuth();
  const {
    isProUser,
    isEarlyAdopter,
    loading: rcLoading,
    refreshCustomerInfo,
    presentCustomerCenter,
    presentPaywall,
  } = useRevenueCat();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [newsletterEnabled, setNewsletterEnabled] = useState(profile?.newsletterOptIn !== false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile?.pushNotificationsEnabled !== false);
  const [isAccessResolving, setIsAccessResolving] = useState(true);
  const refreshProfileRef = useRef(refreshProfile);
  const refreshCustomerInfoRef = useRef(refreshCustomerInfo);

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  useEffect(() => {
    refreshCustomerInfoRef.current = refreshCustomerInfo;
  }, [refreshCustomerInfo]);

  useEffect(() => {
    getStreakData().then(setStreak);
  }, []);

  useEffect(() => {
    setNewsletterEnabled(profile?.newsletterOptIn !== false);
  }, [profile?.newsletterOptIn]);

  useEffect(() => {
    setNotificationsEnabled(profile?.pushNotificationsEnabled !== false);
  }, [profile?.pushNotificationsEnabled]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user?.uid) {
        setIsAccessResolving(false);
        return () => {
          active = false;
        };
      }

      setIsAccessResolving(true);
      void Promise.allSettled([
        refreshProfileRef.current(),
        refreshCustomerInfoRef.current(),
      ]).finally(() => {
        if (active) {
          setIsAccessResolving(false);
        }
      });

      return () => {
        active = false;
      };
    }, [user?.uid])
  );

  const displayName = profile?.displayName || profile?.name || user?.displayName || 'User';
  const email = profile?.email || user?.email || '';

  const handleNewsletterToggle = async (value: boolean) => {
    setNewsletterEnabled(value);
    if (user?.uid) {
      try {
        await updateUserProfile(user.uid, { newsletterOptIn: value } as any);
        await refreshProfile();
      } catch (error) {
        console.error('Failed to update newsletter preference:', error);
        setNewsletterEnabled(!value);
      }
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (user?.uid) {
      try {
        if (value) {
          const success = await enablePushNotifications(user.uid);
          if (!success) {
            Alert.alert(
              'Notifications Unavailable',
              'Push notifications require a physical device and permission. Please check your device settings.'
            );
            setNotificationsEnabled(false);
            return;
          }
        } else {
          await disablePushNotifications(user.uid);
        }
        await refreshProfile();
      } catch (error) {
        console.error('Failed to update notification preference:', error);
        setNotificationsEnabled(!value);
      }
    }
  };

  const handleManageSubscription = async () => {
    await presentCustomerCenter();
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const handleHelpFeedback = () => {
    Linking.openURL('mailto:yourtrace.online@gmail.com?subject=Trace App Feedback');
  };

  const handleRateApp = async () => {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      } else {
        Alert.alert('Not Available', 'App rating is not available on this device.');
      }
    } catch (error) {
      console.warn('[Profile] Error requesting review:', error);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch {
              Alert.alert('Error', 'Could not delete your account. Please try again or contact support.');
            }
          },
        },
      ]
    );
  };

  const switchTrackColor = { false: isDark ? '#3a3a3a' : '#CBCED4', true: `${ACCENT_ORANGE}90` };
  const switchThumbColor = (on: boolean) => on ? ACCENT_ORANGE : '#fff';

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={isDark ? '#fff' : '#0A0A0A'} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#312D2D' }]}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Profile — centered, flat on page */}
        <View style={styles.profileSection}>
          <View style={[styles.avatar, { backgroundColor: isDark ? '#2a3d1f' : '#E8FFC9' }]}>
            <Text style={[styles.avatarText, { color: isDark ? '#d4f0a0' : '#312D2D' }]}>
              {getInitials(displayName)}
            </Text>
          </View>

          {/* Badges — between avatar and name, rotated per design */}
          {(isProUser || isEarlyAdopter) && (
            <View style={styles.badges}>
              {isProUser && (
                <View style={[styles.badge, { backgroundColor: `${ACCENT_ORANGE}18`, transform: [{ rotate: '-6deg' }] }]}>
                  <Crown size={11} color={ACCENT_ORANGE} />
                  <Text style={[styles.badgeText, { color: ACCENT_ORANGE }]}>Pro</Text>
                </View>
              )}
              {isEarlyAdopter && (
                <View style={[styles.badge, { backgroundColor: '#F5F0FF', transform: [{ rotate: '-6deg' }] }]}>
                  <Text style={[styles.badgeText, { color: '#8051DE' }]}>Early Access</Text>
                </View>
              )}
            </View>
          )}

          <Text style={[styles.profileName, { color: isDark ? '#fff' : '#000000' }]}>{displayName}</Text>
          {email !== '' && (
            <Text style={[styles.profileEmail, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)' }]}>{email}</Text>
          )}
        </View>

        {/* Stats Card — white bg, no border, border-radius 20 */}
        <View style={[styles.statsCard, { backgroundColor: isDark ? '#1c1c1c' : '#FFFFFF' }]}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Flame size={24} color={STAT_ORANGE} fill={STAT_ORANGE} />
              <Text style={[styles.statValue, { color: isDark ? '#fff' : '#000000' }]}>{streak?.currentStreak ?? 0}</Text>
              <Text style={[styles.statLabel, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.65)' }]}>Current</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
            <View style={styles.stat}>
              <Trophy size={24} color={STAT_ORANGE} />
              <Text style={[styles.statValue, { color: isDark ? '#fff' : '#000000' }]}>{streak?.longestStreak ?? 0}</Text>
              <Text style={[styles.statLabel, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.65)' }]}>Best</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
            <View style={styles.stat}>
              <Calendar size={24} color={STAT_ORANGE} />
              <Text style={[styles.statValue, { color: isDark ? '#fff' : '#000000' }]}>{streak?.streakHistory.length ?? 0}</Text>
              <Text style={[styles.statLabel, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.65)' }]}>Total Days</Text>
            </View>
          </View>
        </View>

        {/* Upgrade card (non-Pro only) */}
        {!isProUser && !rcLoading && !isAccessResolving && (
          <View style={[styles.upgradeCard, { backgroundColor: isDark ? '#2a1a10' : '#fff8f0', borderColor: `${ACCENT_ORANGE}30` }]}>
            <View style={styles.upgradeHeader}>
              <Crown size={18} color={ACCENT_ORANGE} />
              <Text style={[styles.upgradeTitle, { color: isDark ? '#fff' : '#000' }]}>Unlock Pro</Text>
            </View>
            <Text style={[styles.upgradeDesc, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.6)' }]}>
              Unlimited articles, deep dives, and personalized summaries.
            </Text>
            <Pressable onPress={() => presentPaywall()} style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>Start Free Trial</Text>
            </Pressable>
          </View>
        )}

        {/* Preferences — flat rows, no card */}
        <Text style={[styles.sectionLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)' }]}>Preferences</Text>
        <MenuRow
          icon={Settings}
          label="Feed Preferences"
          subtitle="Interests, sources, goals"
          colorScheme={colorScheme}
          onPress={() => router.push('/preferences')}
        />
        <MenuRow
          icon={Mail}
          label="Newsletter"
          subtitle="Weekly digest emails"
          colorScheme={colorScheme}
          onPress={() => {}}
          showChevron={false}
          rightElement={
            <Switch
              value={newsletterEnabled}
              onValueChange={handleNewsletterToggle}
              trackColor={switchTrackColor}
              thumbColor={switchThumbColor(newsletterEnabled)}
            />
          }
        />
        <MenuRow
          icon={Bell}
          label="Push Notifications"
          subtitle="Daily briefings & alerts"
          colorScheme={colorScheme}
          onPress={() => {}}
          showChevron={false}
          isLast
          rightElement={
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={switchTrackColor}
              thumbColor={switchThumbColor(notificationsEnabled)}
            />
          }
        />

        {/* Subscription */}
        <Text style={[styles.sectionLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)' }]}>Subscription</Text>
        <MenuRow
          icon={CreditCard}
          label="Manage Subscription"
          subtitle={(rcLoading || isAccessResolving) ? "Checking your plan..." : "Billing, cancel, or change plan"}
          colorScheme={colorScheme}
          onPress={handleManageSubscription}
          isLast
        />

        {/* Support */}
        <Text style={[styles.sectionLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)' }]}>Support</Text>
        <MenuRow
          icon={HelpCircle}
          label="Help & Feedback"
          subtitle="Get help or share feedback"
          colorScheme={colorScheme}
          onPress={handleHelpFeedback}
        />
        <MenuRow
          icon={Star}
          label="Rate App"
          subtitle="Love Trace? Leave a review!"
          colorScheme={colorScheme}
          onPress={handleRateApp}
          isLast
        />

        {/* Account Actions */}
        <Text style={[styles.sectionLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)' }]}>Account</Text>
        <MenuRow
          icon={LogOut}
          label="Sign Out"
          colorScheme={colorScheme}
          onPress={handleSignOut}
          showChevron={false}
          danger
        />
        <MenuRow
          icon={Trash2}
          label="Delete Account"
          colorScheme={colorScheme}
          onPress={handleDeleteAccount}
          showChevron={false}
          danger
          isLast
        />

        <Text style={[styles.footer, { color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)' }]}>
          Trace v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  // Header — left-aligned arrow + title
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 19,
    lineHeight: 25,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 20,
  },

  // Profile section — centered on page, no card
  profileSection: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 60,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontFamily: FontFamilySerif.bold,
    fontSize: 25,
    lineHeight: 32,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 17,
  },
  profileName: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 19,
    lineHeight: 25,
    marginBottom: 4,
  },
  profileEmail: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
  },

  // Stats Card — white bg, NO border, border-radius 20
  statsCard: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontFamily: FontFamilySerif.bold,
    fontSize: 23,
    lineHeight: 30,
  },
  statLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  statDivider: {
    width: 1,
    height: 64,
  },

  // Upgrade Card
  upgradeCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  upgradeTitle: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 17,
  },
  upgradeDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  upgradeBtn: {
    backgroundColor: ACCENT_ORANGE,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeBtnText: {
    fontFamily: FontFamily.bold,
    color: '#fff',
    fontSize: 15,
  },

  // Section label
  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: -12,
  },

  // Menu row — flat, border-bottom separator only
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    gap: 4,
  },
  menuLabel: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  menuSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 17,
  },

  footer: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: -4,
  },
});
