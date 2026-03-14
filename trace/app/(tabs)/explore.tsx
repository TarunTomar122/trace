import { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Alert, Switch, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Shield,
  FileText,
  ChevronRight,
  ExternalLink,
  LogOut,
  ArrowRight,
  Trash2,
  Crown,
  Mail,
  Flame,
  Calendar,
  Trophy,
  BookMarked,
  HelpCircle,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

import {
  updateUserProfile,
  ROLES,
  SENIORITY_LEVELS,
} from '@/lib/firestore';
import { getStreakData, StreakData } from '@/lib/streaks';

function lookupLabel(items: readonly { id: string; label: string }[], id: string): string {
  return items.find((i) => i.id === id)?.label || id.replace(/-/g, ' ');
}

const PRIVACY_URL = 'https://www.yourtrace.online/privacy-policy';
const TERMS_URL = 'https://www.yourtrace.online/terms';
const CONTACT_URL = 'https://www.yourtrace.online/contact';
const ACCENT = '#F59E0B';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, deleteAccount, refreshProfile, profileLoadError, retryProfileLoad } = useAuth();
  const { isProUser, presentPaywall, presentCustomerCenter } = useRevenueCat();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const isOnboarded = profile?.onboarded === true;
  const showNetworkError = profileLoadError && !profile;
  const [newsletterOptIn, setNewsletterOptIn] = useState(profile?.newsletterOptIn !== false);
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    setNewsletterOptIn(profile?.newsletterOptIn !== false);
  }, [profile?.newsletterOptIn]);

  useEffect(() => {
    getStreakData().then(setStreak);
  }, []);

  const handleNewsletterToggle = async (value: boolean) => {
    setNewsletterOptIn(value);
    if (user) {
      try {
        await updateUserProfile(user.uid, { newsletterOptIn: value } as any);
        await refreshProfile();
      } catch (error) {
        console.error('Error updating newsletter preference:', error);
        setNewsletterOptIn(!value);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
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

  const cardBg = isDark ? '#1a1a1a' : '#f7f7f5';

  return (
    <SafeAreaView
      style={[s.root, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ─── Profile header ─── */}
        <View style={s.header}>
          {user?.photoURL ? (
            <Image
              source={{ uri: user.photoURL }}
              style={s.avatar}
              cachePolicy="memory-disk"
              priority="high"
            />
          ) : (
            <View style={[s.avatarFallback, { backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5' }]}>
              <Text style={[s.avatarInitial, { color: Colors[colorScheme].text }]}>
                {user?.displayName?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          <Text style={[s.name, { color: Colors[colorScheme].text }]}>
            {profile?.name || user?.displayName || 'User'}
          </Text>
          <Text style={[s.email, { color: Colors[colorScheme].muted }]}>
            {user?.email || 'No email'}
          </Text>
          {(profile?.role || profile?.seniority) && (
            <View style={s.badgeRow}>
              {profile?.role && (
                <View style={[s.badge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                  <Text style={[s.badgeText, { color: Colors[colorScheme].text }]}>
                    {lookupLabel(ROLES as unknown as { id: string; label: string }[], profile.role)}
                  </Text>
                </View>
              )}
              {profile?.seniority && (
                <View style={[s.badge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                  <Text style={[s.badgeText, { color: Colors[colorScheme].text }]}>
                    {lookupLabel(SENIORITY_LEVELS as unknown as { id: string; label: string }[], profile.seniority)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ─── Activity / Streak ─── */}
        {isOnboarded && streak !== null && (
          <View style={[s.card, { backgroundColor: cardBg }]}>
            <View style={s.statsRow}>
              <View style={s.stat}>
                <Flame size={18} color={ACCENT} strokeWidth={2} />
                <Text style={[s.statValue, { color: Colors[colorScheme].text }]}>
                  {streak.currentStreak}
                </Text>
                <Text style={[s.statLabel, { color: Colors[colorScheme].muted }]}>
                  Current
                </Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: isDark ? '#333' : '#e5e5e5' }]} />
              <View style={s.stat}>
                <Trophy size={18} color={ACCENT} strokeWidth={2} />
                <Text style={[s.statValue, { color: Colors[colorScheme].text }]}>
                  {streak.longestStreak}
                </Text>
                <Text style={[s.statLabel, { color: Colors[colorScheme].muted }]}>
                  Best
                </Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: isDark ? '#333' : '#e5e5e5' }]} />
              <View style={s.stat}>
                <Calendar size={18} color={ACCENT} strokeWidth={2} />
                <Text style={[s.statValue, { color: Colors[colorScheme].text }]}>
                  {streak.streakHistory.length}
                </Text>
                <Text style={[s.statLabel, { color: Colors[colorScheme].muted }]}>
                  Days
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── Network error nudge ─── */}
        {showNetworkError && (
          <Pressable
            onPress={retryProfileLoad}
            style={[s.card, s.nudge, { backgroundColor: cardBg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.nudgeTitle, { color: Colors[colorScheme].text }]}>
                📡 Connection Issue
              </Text>
              <Text style={[s.nudgeDesc, { color: Colors[colorScheme].muted }]}>
                Could not load your profile. Tap to retry.
              </Text>
            </View>
            <ArrowRight size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </Pressable>
        )}

        {/* ─── Onboarding nudge ─── */}
        {!isOnboarded && !showNetworkError && (
          <Pressable
            onPress={() => router.push('/onboarding')}
            style={[s.card, s.nudge, { backgroundColor: cardBg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.nudgeTitle, { color: Colors[colorScheme].text }]}>
                Make every morning count
              </Text>
              <Text style={[s.nudgeDesc, { color: Colors[colorScheme].muted }]}>
                2 minutes to set up, smarter mornings forever.
              </Text>
            </View>
            <ArrowRight size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </Pressable>
        )}

        {/* ─── Subscription ─── */}
        {isProUser ? (
          <Pressable
            onPress={() => presentCustomerCenter()}
            style={[s.card, { backgroundColor: cardBg }]}>
            <View style={s.subRow}>
              <View style={s.subBadge}>
                <Crown size={16} color={ACCENT} strokeWidth={2} />
                <Text style={[s.subLabel, { color: Colors[colorScheme].text }]}>Pro</Text>
              </View>
              <ChevronRight size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            </View>
            <Text style={[s.subDesc, { color: Colors[colorScheme].muted }]}>
              Full access · Manage subscription
            </Text>
          </Pressable>
        ) : (
          <View style={[s.card, { backgroundColor: cardBg }]}>
            <Text style={[s.subTitle, { color: Colors[colorScheme].text }]}>
              Unlock the full experience
            </Text>
            <Text style={[s.subDesc, { color: Colors[colorScheme].muted, marginTop: 4 }]}>
              Unlimited articles, deep dives, and personalized summaries. Start with a free trial.
            </Text>
            <Pressable
              onPress={() => presentPaywall()}
              style={s.upgradeBtn}>
              <Text style={s.upgradeBtnText}>Start Free Trial</Text>
              <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
            </Pressable>
          </View>
        )}

        {/* ─── Edit Preferences ─── */}
        {isOnboarded && (
          <Pressable
            style={[s.card, { backgroundColor: cardBg }]}
            onPress={() => router.push('/preferences')}>
            <View style={s.menuRow}>
              <FileText size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
              <Text style={[s.menuText, { color: Colors[colorScheme].text }]}>Edit Preferences</Text>
              <ChevronRight size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            </View>
            <Text style={[s.prefDesc, { color: Colors[colorScheme].muted }]}>
              Update your interests, goals, and content preferences
            </Text>
          </Pressable>
        )}

        {/* ─── Menu ─── */}
        <View style={[s.card, { backgroundColor: cardBg, paddingVertical: 4 }]}>
          {isOnboarded && (
            <Pressable style={s.menuRow} onPress={() => router.push('/(tabs)/bookmarks')}>
              <BookMarked size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
              <Text style={[s.menuText, { color: Colors[colorScheme].text }]}>Saved Articles</Text>
              <ChevronRight size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            </Pressable>
          )}
          {isOnboarded && (
            <View style={[s.menuDivider, { backgroundColor: isDark ? '#333' : '#e5e5e5' }]} />
          )}
          <Pressable
            style={s.menuRow}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
            <Shield size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            <Text style={[s.menuText, { color: Colors[colorScheme].text }]}>Privacy Policy</Text>
            <ExternalLink size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </Pressable>
          <View style={[s.menuDivider, { backgroundColor: isDark ? '#333' : '#e5e5e5' }]} />
          <Pressable
            style={s.menuRow}
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
            <FileText size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            <Text style={[s.menuText, { color: Colors[colorScheme].text }]}>Terms of Service</Text>
            <ExternalLink size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </Pressable>
          <View style={[s.menuDivider, { backgroundColor: isDark ? '#333' : '#e5e5e5' }]} />
          <Pressable
            style={s.menuRow}
            onPress={() => WebBrowser.openBrowserAsync(CONTACT_URL)}>
            <HelpCircle size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            <Text style={[s.menuText, { color: Colors[colorScheme].text }]}>Help & Feedback</Text>
            <ExternalLink size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </Pressable>
        </View>

        {/* ─── Newsletter ─── */}
        {isOnboarded && (
          <View style={[s.card, { backgroundColor: cardBg }]}>
            <View style={s.newsletterRow}>
              <Mail size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
              <View style={{ flex: 1 }}>
                <Text style={[s.newsletterTitle, { color: Colors[colorScheme].text }]}>
                  Daily Newsletter
                </Text>
                <Text style={[s.newsletterDesc, { color: Colors[colorScheme].muted }]}>
                  {isProUser
                    ? 'Your personalized summary at 10:00 AM IST.'
                    : 'Curated digest, every morning.'}
                </Text>
              </View>
              <Switch
                value={newsletterOptIn}
                onValueChange={handleNewsletterToggle}
                trackColor={{ false: isDark ? '#333' : '#d4d4d4', true: ACCENT }}
                thumbColor="#fff"
                ios_backgroundColor={isDark ? '#333' : '#d4d4d4'}
              />
            </View>
          </View>
        )}

        {/* ─── Sign out / Delete ─── */}
        <View style={s.bottomActions}>
          <Pressable style={s.bottomRow} onPress={handleSignOut}>
            <LogOut size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            <Text style={[s.bottomRowText, { color: Colors[colorScheme].text }]}>Sign out</Text>
          </Pressable>
          <Pressable style={s.bottomRow} onPress={handleDeleteAccount}>
            <Trash2 size={18} color="#b91c1c" strokeWidth={1.5} />
            <Text style={[s.bottomRowText, { color: '#b91c1c' }]}>Delete account</Text>
          </Pressable>
        </View>

        <Text style={[s.footer, { color: Colors[colorScheme].muted }]}>
          Trace v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },

  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 14,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInitial: {
    fontSize: 30,
    fontFamily: FontFamilySerif.bold,
  },
  name: {
    fontSize: 22,
    fontFamily: FontFamilySerif.bold,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },

  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontFamily: FontFamilySerif.bold,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 44,
  },

  // Nudge
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  nudgeTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    marginBottom: 2,
  },
  nudgeDesc: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },

  // Subscription
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subLabel: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
  },
  subTitle: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.3,
  },
  subDesc: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 16,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: FontFamily.bold,
  },

  
  // Preferences
  prefDesc: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginLeft: 34,
    marginTop: -8,
  },

  // Menu
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 34,
  },

  // Newsletter
  newsletterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  newsletterTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    marginBottom: 2,
  },
  newsletterDesc: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },

  // Bottom actions
  bottomActions: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  bottomRowText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },

  footer: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    marginTop: 24,
  },
});
