import { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Alert, Switch, Text } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Shield,
  FileText,
  Check,
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
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

import {
  updateUserProfile,
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  CAREER_GOALS,
} from '@/lib/firestore';
import { getStreakData, StreakData } from '@/lib/streaks';

function lookupLabel(items: readonly { id: string; label: string }[], id: string): string {
  return items.find((i) => i.id === id)?.label || id.replace(/-/g, ' ');
}

const PRIVACY_URL = 'https://www.yourtrace.online/privacy-policy';
const TERMS_URL = 'https://www.yourtrace.online/terms';
const ACCENT = '#F59E0B';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, deleteAccount, refreshProfile } = useAuth();
  const { isProUser, presentPaywall, presentCustomerCenter } = useRevenueCat();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const isOnboarded = profile?.onboarded === true;
  const [newsletterOptIn, setNewsletterOptIn] = useState(profile?.newsletterOptIn !== false);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [summaryStyle, setSummaryStyle] = useState<string>(profile?.summaryStyle || 'balanced');
  const [savingSummaryStyle, setSavingSummaryStyle] = useState(false);

  useEffect(() => {
    setNewsletterOptIn(profile?.newsletterOptIn !== false);
  }, [profile?.newsletterOptIn]);

  useEffect(() => {
    setSummaryStyle(profile?.summaryStyle || 'balanced');
  }, [profile?.summaryStyle]);

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

  const handleSummaryStyleChange = async (value: string) => {
    if (!user || savingSummaryStyle || value === summaryStyle) return;
    const previous = summaryStyle;
    setSummaryStyle(value);
    setSavingSummaryStyle(true);
    try {
      await updateUserProfile(user.uid, { summaryStyle: value } as any);
      await refreshProfile();
    } catch (error) {
      console.error('Error updating summary style:', error);
      setSummaryStyle(previous);
    } finally {
      setSavingSummaryStyle(false);
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

        {/* ─── Onboarding nudge ─── */}
        {!isOnboarded && (
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

        {/* ─── Summary Style ─── */}
        {isOnboarded && (
          <View style={[s.card, { backgroundColor: cardBg }]}>
            <View style={s.summaryHeader}>
              <FileText size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
              <Text style={[s.summaryTitle, { color: Colors[colorScheme].text }]}>
                Summary style
              </Text>
            </View>
            <View style={s.summaryOptions}>
              {[
                { id: 'accessible', label: 'Accessible' },
                { id: 'technical', label: 'Technical' },
                { id: 'balanced', label: 'Balanced' },
              ].map((option) => {
                const selected = summaryStyle === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSummaryStyleChange(option.id)}
                    disabled={savingSummaryStyle}
                    style={[
                      s.summaryOption,
                      {
                        backgroundColor: selected ? ACCENT : (isDark ? '#2a2a2a' : '#ebebeb'),
                        borderColor: selected ? ACCENT : 'transparent',
                        borderWidth: selected ? 2 : 1,
                        opacity: savingSummaryStyle ? 0.75 : 1,
                      },
                    ]}
                  >
                    <View style={s.summaryOptionInner}>
                      {selected && <Check size={13} color="#fff" strokeWidth={3} />}
                      <Text style={[s.summaryOptionText, { color: selected ? '#fff' : Colors[colorScheme].text }]}>
                        {option.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[s.summaryCurrent, { color: Colors[colorScheme].text }]}>
              Current: {summaryStyle === 'accessible' ? 'Accessible' : summaryStyle === 'technical' ? 'Technical' : 'Balanced'}
            </Text>
            <Text style={[s.summaryHint, { color: Colors[colorScheme].muted }]}>
              Applies to tomorrow&apos;s feed.
            </Text>
          </View>
        )}

        {/* ─── Interests / Sources / Goals pills ─── */}
        {isOnboarded && profile?.interests && profile.interests.length > 0 && (
          <Pressable style={[s.card, { backgroundColor: cardBg }]} onPress={() => router.push('/preferences/interests')}>
            <View style={s.pillHeader}>
              <Text style={[s.pillLabel, { color: Colors[colorScheme].muted }]}>Interests</Text>
              <ChevronRight size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            </View>
            <View style={s.pillWrap}>
              {profile.interests.map((interest: string, i: number) => (
                <View key={i} style={[s.pill, { backgroundColor: isDark ? '#2a2a2a' : '#ebebeb' }]}>
                  <Text style={[s.pillText, { color: Colors[colorScheme].text }]}>
                    {lookupLabel(ONBOARDING_INTERESTS as unknown as { id: string; label: string }[], interest)}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        )}

        {isOnboarded && profile?.selectedLearningSources && profile.selectedLearningSources.length > 0 && (
          <Pressable style={[s.card, { backgroundColor: cardBg }]} onPress={() => router.push('/preferences/sources')}>
            <View style={s.pillHeader}>
              <Text style={[s.pillLabel, { color: Colors[colorScheme].muted }]}>Deep Dive Sources</Text>
              <ChevronRight size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            </View>
            <View style={s.pillWrap}>
              {profile.selectedLearningSources.map((source: string, i: number) => (
                <View key={i} style={[s.pill, { backgroundColor: isDark ? '#2a2a2a' : '#ebebeb' }]}>
                  <Text style={[s.pillText, { color: Colors[colorScheme].text }]}>
                    {source}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        )}

        {isOnboarded && profile?.careerGoals && profile.careerGoals.length > 0 && (
          <Pressable style={[s.card, { backgroundColor: cardBg }]} onPress={() => router.push('/preferences/goals')}>
            <View style={s.pillHeader}>
              <Text style={[s.pillLabel, { color: Colors[colorScheme].muted }]}>Career Goals</Text>
              <ChevronRight size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            </View>
            <View style={s.pillWrap}>
              {profile.careerGoals.map((goal: string, i: number) => (
                <View key={i} style={[s.pill, { backgroundColor: isDark ? '#2a2a2a' : '#ebebeb' }]}>
                  <Text style={[s.pillText, { color: Colors[colorScheme].text }]}>
                    {lookupLabel(CAREER_GOALS as unknown as { id: string; label: string }[], goal)}
                  </Text>
                </View>
              ))}
            </View>
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
    fontWeight: '700',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
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
    fontWeight: '600',
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
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
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
    fontWeight: '600',
    marginBottom: 2,
  },
  nudgeDesc: {
    fontSize: 13,
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
    fontWeight: '700',
  },
  subTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subDesc: {
    fontSize: 14,
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
    fontWeight: '700',
  },

  // Summary style
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  summaryOptionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCurrent: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  summaryHint: {
    fontSize: 12,
    marginTop: 4,
  },

  // Pills
  pillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
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
    fontWeight: '500',
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
    fontWeight: '600',
    marginBottom: 2,
  },
  newsletterDesc: {
    fontSize: 13,
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
    fontWeight: '500',
  },

  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
