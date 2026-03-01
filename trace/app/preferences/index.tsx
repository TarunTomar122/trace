import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Sparkles,
  BookOpen,
  Target,
  RefreshCw,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useToast } from '@/contexts/ToastContext';
import {
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  CAREER_GOALS,
  triggerFeedGeneration,
  updateUserProfile,
} from '@/lib/firestore';

const ACCENT = '#F59E0B';

function lookupLabel(items: readonly { id: string; label: string }[], id: string): string {
  return items.find((i) => i.id === id)?.label || id.replace(/-/g, ' ');
}

type PrefRowProps = {
  icon: typeof Briefcase;
  label: string;
  value: string;
  colorScheme: 'light' | 'dark';
  onPress: () => void;
};

function PrefRow({ icon: Icon, label, value, colorScheme, onPress }: PrefRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: Colors[colorScheme].foreground + '08' }]}>
        <Icon size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        {value !== '' && (
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
  const { user, profile } = useAuth();
  const { isProUser } = useRevenueCat();
  const { showToast } = useToast();

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

  const lastRebuildTs = (() => {
    const raw = profile?.feedBuildRequestedAt;
    if (!raw) return 0;
    if (typeof raw === 'string') return new Date(raw).getTime();
    if (raw?.toDate) return raw.toDate().getTime();
    if (raw?.seconds) return raw.seconds * 1000;
    return 0;
  })();
  const canRebuild = Date.now() - lastRebuildTs > 24 * 60 * 60 * 1000;

  const handleRebuild = async () => {
    if (!user) return;
    if (!canRebuild) {
      showToast('You can rebuild once per day. Try again tomorrow.', 'info');
      return;
    }
    try {
      await updateUserProfile(user.uid, { feedBuildStatus: 'building', feedBuildRequestedAt: new Date().toISOString() } as any);
      await triggerFeedGeneration(user.uid, { reason: 'preferences_edit', force: true });
      showToast('Feed rebuild started!', 'success');
    } catch {
      showToast('Could not trigger rebuild. Try again.', 'error');
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors[colorScheme].text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Preferences</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
          Your profile
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
          Feed
        </ThemedText>

        {isProUser && (
          <>
            <Pressable
              onPress={handleRebuild}
              disabled={!canRebuild}
              style={[styles.rebuildBtn, { borderColor: ACCENT, opacity: canRebuild ? 1 : 0.4 }]}>
              <RefreshCw size={16} color={ACCENT} strokeWidth={2} />
              <ThemedText style={[styles.rebuildText, { color: ACCENT }]}>
                Rebuild my feed now
              </ThemedText>
            </Pressable>

            <ThemedText style={[styles.hint, { color: Colors[colorScheme].muted }]}>
              {canRebuild
                ? 'Your feed refreshes daily. Tap above to apply changes immediately.'
                : 'Already rebuilt today — your feed refreshes again tomorrow.'}
            </ThemedText>
          </>
        )}
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
  rebuildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  rebuildText: {
    fontSize: 15,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
});
