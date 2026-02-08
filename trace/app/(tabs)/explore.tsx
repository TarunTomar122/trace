import { StyleSheet, View, Pressable, Image, ScrollView, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Settings,
  Shield,
  FileText,
  ChevronRight,
  ExternalLink,
  LogOut,
  Sparkles,
  ArrowRight,
  Trash2,
  CreditCard,
  Crown,
  Zap,
  AlertTriangle,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

const PRIVACY_URL = 'https://www.yourtrace.online/privacy-policy';
const TERMS_URL = 'https://www.yourtrace.online/terms';
const MANAGE_SUBSCRIPTION_URL = 'https://www.yourtrace.online/profile';

const SUBSCRIPTION_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Crown; description: string }> = {
  none: { label: 'Free', color: '#6b7280', bgColor: '#f3f4f6', icon: Zap, description: 'Upgrade to unlock your personalized daily feed.' },
  trial: { label: 'Trial', color: '#8b5cf6', bgColor: '#f5f3ff', icon: Sparkles, description: 'You\'re on a free trial. Enjoy full access!' },
  active: { label: 'Pro', color: '#22c55e', bgColor: '#f0fdf4', icon: Crown, description: 'You have full access to your personalized feed.' },
  on_hold: { label: 'On Hold', color: '#f59e0b', bgColor: '#fffbeb', icon: AlertTriangle, description: 'Payment issue. Update your billing to continue.' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bgColor: '#fef2f2', icon: AlertTriangle, description: 'Your subscription has been cancelled.' },
  expired: { label: 'Expired', color: '#6b7280', bgColor: '#f3f4f6', icon: AlertTriangle, description: 'Your subscription has expired. Resubscribe to continue.' },
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, deleteAccount } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const isOnboarded = profile?.onboarded ?? false;

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
            } catch (e) {
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ─── Profile header ─── */}
        <View style={styles.profileHeader}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: Colors[colorScheme].border },
              ]}>
              <ThemedText style={styles.avatarInitial}>
                {user?.displayName?.charAt(0) || '?'}
              </ThemedText>
            </View>
          )}
          <ThemedText style={styles.profileName}>
            {profile?.name || user?.displayName || 'User'}
          </ThemedText>
          <ThemedText style={[styles.profileEmail, { color: Colors[colorScheme].muted }]}>
            {user?.email || 'No email'}
          </ThemedText>
          {profile?.role && (
            <View style={[styles.roleBadge, { backgroundColor: Colors[colorScheme].foreground + '0D' }]}>
              <ThemedText style={[styles.roleText, { color: Colors[colorScheme].foreground }]}>
                {profile.role}
              </ThemedText>
            </View>
          )}
        </View>

        {/* ─── Onboarding nudge ─── */}
        {!isOnboarded && (
          <Pressable
            onPress={() => router.push('/onboarding')}
            style={[styles.nudge, { borderColor: Colors[colorScheme].border }]}>
            <Sparkles size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.nudgeTitle}>Personalize your feed</ThemedText>
              <ThemedText style={[styles.nudgeSub, { color: Colors[colorScheme].muted }]}>
                Tell us your interests to get started.
              </ThemedText>
            </View>
            <ArrowRight size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          </Pressable>
        )}

        {/* ─── Interests ─── */}
        {isOnboarded && profile?.interests && profile.interests.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
              Interests
            </ThemedText>
            <View style={styles.pillsWrap}>
              {profile.interests.map((interest, index) => (
                <View
                  key={index}
                  style={[styles.pill, { backgroundColor: Colors[colorScheme].foreground + '0A' }]}>
                  <ThemedText style={[styles.pillText, { color: Colors[colorScheme].text }]}>
                    {interest.replace(/-/g, ' ')}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Skills ─── */}
        {isOnboarded && profile?.skills && profile.skills.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
              Skills
            </ThemedText>
            <View style={styles.pillsWrap}>
              {profile.skills.map((skill, index) => (
                <View
                  key={index}
                  style={[styles.pill, { backgroundColor: Colors[colorScheme].foreground + '0A' }]}>
                  <ThemedText style={[styles.pillText, { color: Colors[colorScheme].text }]}>
                    {skill.replace(/-/g, ' ')}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Subscription ─── */}
        {(() => {
          const status = profile?.subscriptionStatus || 'none';
          const config = SUBSCRIPTION_CONFIG[status] || SUBSCRIPTION_CONFIG.none;
          const StatusIcon = config.icon;
          return (
            <Pressable
              onPress={() => WebBrowser.openBrowserAsync(MANAGE_SUBSCRIPTION_URL)}
              style={[styles.subscriptionCard, { backgroundColor: config.bgColor }]}>
              <View style={styles.subscriptionTop}>
                <View style={styles.subscriptionBadge}>
                  <StatusIcon size={16} color={config.color} strokeWidth={2} />
                  <ThemedText style={[styles.subscriptionLabel, { color: config.color }]}>
                    {config.label}
                  </ThemedText>
                </View>
                <ChevronRight size={18} color={config.color} strokeWidth={1.5} />
              </View>
              <ThemedText style={[styles.subscriptionDesc, { color: Colors[colorScheme].secondary }]}>
                {config.description}
              </ThemedText>
              {(status === 'none' || status === 'cancelled' || status === 'expired') && (
                <View style={[styles.upgradeButton, { backgroundColor: '#22c55e18', borderColor: '#22c55e30' }]}>
                  <ThemedText style={[styles.upgradeButtonText, { color: '#22c55e' }]}>
                    {status === 'none' ? 'Upgrade to Pro' : 'Resubscribe'}
                  </ThemedText>
                </View>
              )}
              {(status === 'active' || status === 'trial' || status === 'on_hold') && (
                <ThemedText style={[styles.manageText, { color: config.color }]}>
                  Manage subscription →
                </ThemedText>
              )}
            </Pressable>
          );
        })()}

        {/* ─── Divider ─── */}
        <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />

        {/* ─── Menu rows ─── */}
        <View style={styles.menuSection}>
          {isOnboarded && (
            <Pressable
              style={styles.menuRow}
              onPress={() => router.push('/onboarding')}>
              <Settings size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
              <ThemedText style={[styles.menuText, { color: Colors[colorScheme].text }]}>
                Edit preferences
              </ThemedText>
              <ChevronRight size={18} color={Colors[colorScheme].border} strokeWidth={1.5} />
            </Pressable>
          )}
          <Pressable
            style={styles.menuRow}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
            <Shield size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            <ThemedText style={[styles.menuText, { color: Colors[colorScheme].text }]}>
              Privacy policy
            </ThemedText>
            <ExternalLink size={16} color={Colors[colorScheme].border} strokeWidth={1.5} />
          </Pressable>
          <Pressable
            style={styles.menuRow}
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
            <FileText size={20} color={Colors[colorScheme].muted} strokeWidth={1.5} />
            <ThemedText style={[styles.menuText, { color: Colors[colorScheme].text }]}>
              Terms of service
            </ThemedText>
            <ExternalLink size={16} color={Colors[colorScheme].border} strokeWidth={1.5} />
          </Pressable>
        </View>

        {/* ─── Sign out ─── */}
        <Pressable style={styles.actionRow} onPress={handleSignOut}>
          <LogOut size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          <ThemedText style={[styles.actionRowText, { color: Colors[colorScheme].text }]}>
            Sign out
          </ThemedText>
        </Pressable>

        {/* ─── Delete account ─── */}
        <Pressable style={styles.actionRow} onPress={handleDeleteAccount}>
          <Trash2 size={18} color="#b91c1c" strokeWidth={1.5} />
          <ThemedText style={[styles.actionRowText, { color: '#b91c1c' }]}>
            Delete account
          </ThemedText>
        </Pressable>

        {/* ─── Footer ─── */}
        <ThemedText style={[styles.footer, { color: Colors[colorScheme].muted }]}>
          Trace v1.0.0
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },

  // ─── Profile header ───
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '600',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ─── Onboarding nudge ───
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 28,
  },
  nudgeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  nudgeSub: {
    fontSize: 13,
    lineHeight: 18,
  },

  // ─── Sections ───
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  // ─── Subscription ───
  subscriptionCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    gap: 10,
  },
  subscriptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subscriptionDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  upgradeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 4,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  manageText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },

  // ─── Divider ───
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },

  // ─── Menu ───
  menuSection: {
    gap: 0,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
  },

  // ─── Action rows ───
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  actionRowText: {
    fontSize: 16,
  },

  // ─── Footer ───
  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
  },
});
