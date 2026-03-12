import { Pressable, ScrollView, StyleSheet, View, Text, Switch, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
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
  HelpCircle,
  CreditCard,
  Trash2,
  Trophy,
  Calendar,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { updateUserProfile } from '@/lib/firestore';
import { getStreakData, StreakData } from '@/lib/streaks';
import { useEffect, useState } from 'react';

const ACCENT_ORANGE = '#ff8d28';
const CONTACT_URL = 'https://www.yourtrace.online/contact';

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
};

function MenuRow({ icon: Icon, label, subtitle, colorScheme, onPress, showChevron = true, danger }: MenuRowProps) {
  const iconColor = danger ? '#EF4444' : Colors[colorScheme].muted;
  const labelColor = danger ? '#EF4444' : Colors[colorScheme].text;

  return (
    <Pressable onPress={onPress} style={styles.menuRow}>
      <View style={[styles.menuIcon, { backgroundColor: danger ? '#EF444410' : `${Colors[colorScheme].muted}15` }]}>
        <Icon size={18} color={iconColor} strokeWidth={1.8} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: labelColor }]}>{label}</Text>
        {subtitle && (
          <Text style={[styles.menuSubtitle, { color: Colors[colorScheme].muted }]}>{subtitle}</Text>
        )}
      </View>
      {showChevron && <ChevronRight size={18} color={Colors[colorScheme].border} strokeWidth={1.5} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user, profile, signOut, refreshProfile, deleteAccount } = useAuth();
  const { isProUser, isEarlyAdopter, presentCustomerCenter, presentPaywall } = useRevenueCat();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [newsletterEnabled, setNewsletterEnabled] = useState(profile?.newsletterOptIn !== false);

  useEffect(() => {
    getStreakData().then(setStreak);
  }, []);

  useEffect(() => {
    setNewsletterEnabled(profile?.newsletterOptIn !== false);
  }, [profile?.newsletterOptIn]);

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

  const handleManageSubscription = async () => {
    await presentCustomerCenter();
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
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

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors[colorScheme].text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Profile</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <View style={[styles.avatar, { backgroundColor: Colors[colorScheme].muted }]}>
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          </View>
          <Text style={[styles.profileName, { color: Colors[colorScheme].text }]}>{displayName}</Text>
          {email && (
            <Text style={[styles.profileEmail, { color: Colors[colorScheme].muted }]}>{email}</Text>
          )}
          <View style={styles.badges}>
            {isProUser && (
              <View style={[styles.badge, { backgroundColor: `${ACCENT_ORANGE}15` }]}>
                <Crown size={12} color={ACCENT_ORANGE} />
                <Text style={[styles.badgeText, { color: ACCENT_ORANGE }]}>Pro</Text>
              </View>
            )}
            {isEarlyAdopter && (
              <View style={[styles.badge, { backgroundColor: '#8B5CF615' }]}>
                <Text style={[styles.badgeText, { color: '#8B5CF6' }]}>Early Adopter</Text>
              </View>
            )}
          </View>
        </View>

        {/* Streak Card */}
        {streak && streak.currentStreak > 0 && (
          <View style={[styles.streakCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Flame size={20} color={ACCENT_ORANGE} fill={ACCENT_ORANGE} />
                <Text style={[styles.statValue, { color: Colors[colorScheme].text }]}>{streak.currentStreak}</Text>
                <Text style={[styles.statLabel, { color: Colors[colorScheme].muted }]}>Current</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: Colors[colorScheme].border }]} />
              <View style={styles.stat}>
                <Trophy size={20} color={ACCENT_ORANGE} />
                <Text style={[styles.statValue, { color: Colors[colorScheme].text }]}>{streak.longestStreak}</Text>
                <Text style={[styles.statLabel, { color: Colors[colorScheme].muted }]}>Best</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: Colors[colorScheme].border }]} />
              <View style={styles.stat}>
                <Calendar size={20} color={ACCENT_ORANGE} />
                <Text style={[styles.statValue, { color: Colors[colorScheme].text }]}>{streak.streakHistory.length}</Text>
                <Text style={[styles.statLabel, { color: Colors[colorScheme].muted }]}>Days</Text>
              </View>
            </View>
          </View>
        )}

        {/* Subscription Card */}
        {!isProUser && (
          <View style={[styles.upgradeCard, { backgroundColor: isDark ? '#2a1a10' : '#fff8f0', borderColor: `${ACCENT_ORANGE}30` }]}>
            <View style={styles.upgradeHeader}>
              <Crown size={20} color={ACCENT_ORANGE} />
              <Text style={[styles.upgradeTitle, { color: Colors[colorScheme].text }]}>Unlock Pro</Text>
            </View>
            <Text style={[styles.upgradeDesc, { color: Colors[colorScheme].muted }]}>
              Unlimited articles, deep dives, and personalized summaries.
            </Text>
            <Pressable onPress={() => presentPaywall()} style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>Start Free Trial</Text>
            </Pressable>
          </View>
        )}

        {/* Settings Section */}
        <Text style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>Settings</Text>
        <View style={[styles.menuCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <MenuRow
            icon={Settings}
            label="Feed Preferences"
            subtitle="Interests, sources, goals"
            colorScheme={colorScheme}
            onPress={() => router.push('/preferences')}
          />
          <View style={[styles.menuDivider, { backgroundColor: Colors[colorScheme].border }]} />
          <View style={styles.menuRow}>
            <View style={[styles.menuIcon, { backgroundColor: `${Colors[colorScheme].muted}15` }]}>
              <Mail size={18} color={Colors[colorScheme].muted} strokeWidth={1.8} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: Colors[colorScheme].text }]}>Newsletter</Text>
              <Text style={[styles.menuSubtitle, { color: Colors[colorScheme].muted }]}>Weekly digest emails</Text>
            </View>
            <Switch
              value={newsletterEnabled}
              onValueChange={handleNewsletterToggle}
              trackColor={{ false: Colors[colorScheme].border, true: `${ACCENT_ORANGE}80` }}
              thumbColor={newsletterEnabled ? ACCENT_ORANGE : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Subscription Management (Pro users) */}
        {isProUser && (
          <>
            <Text style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>Subscription</Text>
            <View style={[styles.menuCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
              <MenuRow
                icon={CreditCard}
                label="Manage Subscription"
                subtitle="Billing, cancel, or change plan"
                colorScheme={colorScheme}
                onPress={handleManageSubscription}
              />
            </View>
          </>
        )}

        {/* Support Section */}
        <Text style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>Support</Text>
        <View style={[styles.menuCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <MenuRow
            icon={HelpCircle}
            label="Help & Feedback"
            subtitle="Get help or share feedback"
            colorScheme={colorScheme}
            onPress={() => WebBrowser.openBrowserAsync(CONTACT_URL)}
          />
        </View>

        {/* Account Actions */}
        <View style={[styles.menuCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border, marginTop: 24 }]}>
          <MenuRow
            icon={LogOut}
            label="Sign Out"
            colorScheme={colorScheme}
            onPress={handleSignOut}
            showChevron={false}
            danger
          />
          <View style={[styles.menuDivider, { backgroundColor: Colors[colorScheme].border }]} />
          <MenuRow
            icon={Trash2}
            label="Delete Account"
            colorScheme={colorScheme}
            onPress={handleDeleteAccount}
            showChevron={false}
            danger
          />
        </View>

        <Text style={[styles.footer, { color: Colors[colorScheme].muted }]}>
          Trace v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Streak Card
  streakCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: Fonts.serif,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 40,
  },

  // Upgrade Card
  upgradeCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  upgradeDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  upgradeBtn: {
    backgroundColor: ACCENT_ORANGE,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Section Label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },

  // Menu Card
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 13,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },

  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
