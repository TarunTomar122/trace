import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Sparkles,
  BookOpen,
  Target,
  LogOut,
  Trash2,
  Crown,
  Gift,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import {
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  CAREER_GOALS,
} from '@/lib/firestore';

const ACCENT = '#F59E0B';

function lookupLabel(items: readonly { id: string; label: string }[], id: string): string {
  return items.find((i) => i.id === id)?.label || id.replace(/-/g, ' ');
}

type PrefRowProps = {
  icon: typeof Briefcase;
  label: string;
  value?: string;
  colorScheme: 'light' | 'dark';
  onPress: () => void;
  danger?: boolean;
};

function PrefRow({ icon: Icon, label, value, colorScheme, onPress, danger }: PrefRowProps) {
  const iconColor = danger ? '#EF4444' : Colors[colorScheme].muted;
  const labelColor = danger ? '#EF4444' : Colors[colorScheme].text;

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? '#EF444410' : Colors[colorScheme].foreground + '08' }]}>
        <Icon size={18} color={iconColor} strokeWidth={1.5} />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={[styles.rowLabel, { color: labelColor }]}>{label}</ThemedText>
        {value && value !== '' && (
          <ThemedText
            style={[styles.rowValue, { color: Colors[colorScheme].muted }]}
            numberOfLines={1}>
            {value}
          </ThemedText>
        )}
      </View>
      <ChevronRight size={18} color={Colors[colorScheme].border} strokeWidth={1.5} />
    </Pressable>
  );
}

export default function PreferencesHub() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user, profile, signOut, deleteAccount } = useAuth();
  const { isProUser, isEarlyAdopter, presentPaywall } = useRevenueCat();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const roleValue = [
    profile?.role ? lookupLabel(ROLES as any, profile.role) : '',
    profile?.seniority ? lookupLabel(SENIORITY_LEVELS as any, profile.seniority) : '',
  ].filter(Boolean).join(' · ');

  const interestValue = (profile?.interests || [])
    .map((id: string) => lookupLabel(ONBOARDING_INTERESTS as any, id))
    .join(', ');

  const sourcesValue = (profile?.selectedLearningSources || []).join(', ');

  const goalsValue = (profile?.careerGoals || [])
    .map((id: string) => lookupLabel(CAREER_GOALS as any, id))
    .join(', ');

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
              router.replace('/(auth)/welcome');
            } catch (error) {
              console.error('Logout error:', error);
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteAccount();
              router.replace('/(auth)/welcome');
            } catch (error) {
              console.error('Delete account error:', error);
              Alert.alert('Error', 'Could not delete account. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const displayName = profile?.name || user?.displayName || 'User';
  const email = user?.email || '';
  const photoURL = user?.photoURL;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors[colorScheme].text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: ACCENT + '20' }]}>
              <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <ThemedText style={styles.profileName}>{displayName}</ThemedText>
            <ThemedText style={[styles.profileEmail, { color: Colors[colorScheme].muted }]}>{email}</ThemedText>
          </View>
          {/* Subscription badge */}
          {isProUser && (
            <View style={[styles.proBadge, { backgroundColor: isEarlyAdopter ? '#10B98120' : ACCENT + '20' }]}>
              {isEarlyAdopter ? (
                <Gift size={14} color="#10B981" strokeWidth={2} />
              ) : (
                <Crown size={14} color={ACCENT} strokeWidth={2} />
              )}
              <Text style={[styles.proBadgeText, { color: isEarlyAdopter ? '#10B981' : ACCENT }]}>
                {isEarlyAdopter ? 'Early Adopter' : 'Pro'}
              </Text>
            </View>
          )}
        </View>

        {/* Upgrade banner for free users */}
        {!isProUser && (
          <Pressable
            onPress={() => presentPaywall()}
            style={[styles.upgradeBanner, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '30' }]}
          >
            <Crown size={20} color={ACCENT} strokeWidth={2} />
            <View style={styles.upgradeText}>
              <Text style={[styles.upgradeTitle, { color: Colors[colorScheme].text }]}>Upgrade to Pro</Text>
              <Text style={[styles.upgradeSubtitle, { color: Colors[colorScheme].muted }]}>Unlock all features</Text>
            </View>
            <ChevronRight size={18} color={ACCENT} strokeWidth={2} />
          </Pressable>
        )}

        <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
          Feed preferences
        </ThemedText>

        <View style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <PrefRow
            icon={Briefcase}
            label="Role & Experience"
            value={roleValue}
            colorScheme={colorScheme}
            onPress={() => router.push('/preferences/role')}
          />
          <View style={[styles.rowDivider, { backgroundColor: Colors[colorScheme].border }]} />
          <PrefRow
            icon={Sparkles}
            label="Interests"
            value={interestValue}
            colorScheme={colorScheme}
            onPress={() => router.push('/preferences/interests')}
          />
          <View style={[styles.rowDivider, { backgroundColor: Colors[colorScheme].border }]} />
          <PrefRow
            icon={BookOpen}
            label="Deep Dive Sources"
            value={sourcesValue}
            colorScheme={colorScheme}
            onPress={() => router.push('/preferences/sources')}
          />
          <View style={[styles.rowDivider, { backgroundColor: Colors[colorScheme].border }]} />
          <PrefRow
            icon={Target}
            label="Career Goals"
            value={goalsValue}
            colorScheme={colorScheme}
            onPress={() => router.push('/preferences/goals')}
          />
        </View>

        <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme].muted, marginTop: 28 }]}>
          Account
        </ThemedText>

        <View style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <PrefRow
            icon={LogOut}
            label={isLoggingOut ? 'Signing out...' : 'Sign Out'}
            colorScheme={colorScheme}
            onPress={handleLogout}
          />
          <View style={[styles.rowDivider, { backgroundColor: Colors[colorScheme].border }]} />
          <PrefRow
            icon={Trash2}
            label={isDeleting ? 'Deleting...' : 'Delete Account'}
            colorScheme={colorScheme}
            onPress={handleDeleteAccount}
            danger
          />
        </View>

        <ThemedText style={[styles.versionText, { color: Colors[colorScheme].muted }]}>
          Trace v1.0.0
        </ThemedText>
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F59E0B',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 14,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Upgrade banner
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  upgradeText: {
    flex: 1,
    gap: 2,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  upgradeSubtitle: {
    fontSize: 13,
  },

  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 13,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
  },
});
