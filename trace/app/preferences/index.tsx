import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Briefcase,
  GraduationCap,
  Sparkles,
  Target,
  Check,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  CAREER_GOALS,
  updateUserProfile,
  triggerFeedGeneration,
} from '@/lib/firestore';

const ACCENT = '#F59E0B';

type SectionKey = 'role' | 'experience' | 'interests' | 'goals';

function lookupLabel(items: readonly { id: string; label: string }[], id: string): string {
  return items.find((i) => i.id === id)?.label || id.replace(/-/g, ' ');
}

// ─── Accordion row wrapper ────────────────────────────────────────────────────
function AccordionRow({
  icon: Icon,
  label,
  value,
  isOpen,
  onToggle,
  colorScheme,
  children,
}: {
  icon: typeof Briefcase;
  label: string;
  value?: string;
  isOpen: boolean;
  onToggle: () => void;
  colorScheme: 'light' | 'dark';
  children: ReactNode;
}) {
  return (
    <View>
      <Pressable onPress={onToggle} style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: Colors[colorScheme].foreground + '08' }]}>
          <Icon size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
        </View>
        <View style={styles.rowText}>
          <ThemedText style={[styles.rowLabel, { color: Colors[colorScheme].text }]}>
            {label}
          </ThemedText>
          {value ? (
            <ThemedText
              style={[styles.rowValue, { color: Colors[colorScheme].muted }]}
              numberOfLines={1}>
              {value}
            </ThemedText>
          ) : null}
        </View>
        {isOpen
          ? <ChevronUp size={18} color={Colors[colorScheme].muted} strokeWidth={1.5} />
          : <ChevronDown size={18} color={Colors[colorScheme].border} strokeWidth={1.5} />}
      </Pressable>

      {isOpen && (
        <View style={styles.accordionBody}>
          {children}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function PreferencesHub() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

  // Role & Experience
  const [role, setRole] = useState(profile?.role || '');
  const [seniority, setSeniority] = useState(profile?.seniority || '');
  const [savingRole, setSavingRole] = useState(false);
  const roleHasChanges = role !== (profile?.role || '');
  const seniorityHasChanges = seniority !== (profile?.seniority || '');
  const roleCanSave = role !== '' || seniority !== '';

  // Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    Array.isArray(profile?.interests) ? [...profile.interests] : [],
  );
  const [savingInterests, setSavingInterests] = useState(false);
  const originalInterests = useRef(
    (Array.isArray(profile?.interests) ? [...profile.interests] : []).sort().join(','),
  );
  const interestsHasChanges =
    [...selectedInterests].sort().join(',') !== originalInterests.current;

  // Goals
  const [selectedGoals, setSelectedGoals] = useState<string[]>(
    Array.isArray(profile?.careerGoals) ? [...profile.careerGoals] : [],
  );
  const [savingGoals, setSavingGoals] = useState(false);
  const originalGoals = useRef(
    (Array.isArray(profile?.careerGoals) ? [...profile.careerGoals] : []).sort().join(','),
  );
  const goalsHasChanges = [...selectedGoals].sort().join(',') !== originalGoals.current;

  const hasAnyChanges = roleHasChanges || seniorityHasChanges || interestsHasChanges || goalsHasChanges;
  const isSavingAnything = savingRole || savingInterests || savingGoals;
  const insets = useSafeAreaInsets();

  const toggleSection = (key: SectionKey) =>
    setOpenSection((prev) => (prev === key ? null : key));

  const handleSaveRole = async () => {
    if (!user || !roleCanSave) return;
    setSavingRole(true);
    try {
      await updateUserProfile(user.uid, { role, seniority } as any);
      await refreshProfile();
      showToast('Role updated', 'success');
      setOpenSection(null);
    } catch {
      showToast('Could not save. Try again.', 'error');
    } finally {
      setSavingRole(false);
    }
  };

  const handleSaveInterests = async () => {
    if (!user || selectedInterests.length === 0) {
      showToast('Pick at least one interest.', 'error');
      return;
    }
    setSavingInterests(true);
    try {
      await updateUserProfile(user.uid, {
        interests: selectedInterests,
        feedBuildStatus: 'building',
        feedBuildRequestedAt: new Date().toISOString(),
      } as any);
      await triggerFeedGeneration(user.uid, { reason: 'preferences_edit', force: true });
      await refreshProfile();
      originalInterests.current = [...selectedInterests].sort().join(',');
      showToast('Interests saved — feed is rebuilding!', 'success');
      setOpenSection(null);
    } catch {
      showToast('Could not save. Try again.', 'error');
    } finally {
      setSavingInterests(false);
    }
  };

  const handleSaveGoals = async () => {
    if (!user || selectedGoals.length === 0) {
      showToast('Pick at least one goal.', 'error');
      return;
    }
    setSavingGoals(true);
    try {
      await updateUserProfile(user.uid, {
        careerGoals: selectedGoals,
        feedBuildStatus: 'building',
        feedBuildRequestedAt: new Date().toISOString(),
      } as any);
      await triggerFeedGeneration(user.uid, { reason: 'preferences_edit', force: true });
      await refreshProfile();
      originalGoals.current = [...selectedGoals].sort().join(',');
      showToast('Goals saved — feed is rebuilding!', 'success');
      setOpenSection(null);
    } catch {
      showToast('Could not save. Try again.', 'error');
    } finally {
      setSavingGoals(false);
    }
  };

  const roleValue = profile?.role ? lookupLabel(ROLES as any, profile.role) : '';
  const seniorityValue = profile?.seniority ? lookupLabel(SENIORITY_LEVELS as any, profile.seniority) : '';

  const interestValue = (profile?.interests || [])
    .map((id: string) => lookupLabel(ONBOARDING_INTERESTS as any, id))
    .join(', ');

  const goalsValue = (profile?.careerGoals || [])
    .map((id: string) => lookupLabel(CAREER_GOALS as any, id))
    .join(', ');

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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
          Feed preferences
        </ThemedText>

        {/* ── Role ── */}
        <AccordionRow
          icon={Briefcase}
          label="Role"
          value={roleValue}
          isOpen={openSection === 'role'}
          onToggle={() => toggleSection('role')}
          colorScheme={colorScheme}>

          {ROLES.map((r) => {
            const sel = role === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => setRole(r.id)}
                style={[styles.option, {
                  backgroundColor: sel ? ACCENT + '12' : Colors[colorScheme].card,
                  borderColor: sel ? ACCENT : Colors[colorScheme].border,
                }]}>
                <View style={styles.optionText}>
                  <ThemedText style={styles.optionLabel}>{r.label}</ThemedText>
                  <ThemedText style={[styles.optionSub, { color: Colors[colorScheme].muted }]}>
                    {r.subtitle}
                  </ThemedText>
                </View>
                {sel && (
                  <View style={[styles.checkCircle, { backgroundColor: ACCENT }]}>
                    <Check size={11} color={Colors[colorScheme].accentForeground} strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </AccordionRow>

        <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />

        {/* ── Experience Level ── */}
        <AccordionRow
          icon={GraduationCap}
          label="Experience Level"
          value={seniorityValue}
          isOpen={openSection === 'experience'}
          onToggle={() => toggleSection('experience')}
          colorScheme={colorScheme}>

          {SENIORITY_LEVELS.map((s) => {
            const sel = seniority === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSeniority(s.id)}
                style={[styles.option, {
                  backgroundColor: sel ? ACCENT + '12' : Colors[colorScheme].card,
                  borderColor: sel ? ACCENT : Colors[colorScheme].border,
                }]}>
                <View style={styles.optionText}>
                  <ThemedText style={styles.optionLabel}>{s.label}</ThemedText>
                  <ThemedText style={[styles.optionSub, { color: Colors[colorScheme].muted }]}>
                    {s.subtitle}
                  </ThemedText>
                </View>
                {sel && (
                  <View style={[styles.checkCircle, { backgroundColor: ACCENT }]}>
                    <Check size={11} color={Colors[colorScheme].accentForeground} strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </AccordionRow>

        <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />

        {/* ── Interests ── */}
        <AccordionRow
          icon={Sparkles}
          label="Interests"
          value={interestValue}
          isOpen={openSection === 'interests'}
          onToggle={() => toggleSection('interests')}
          colorScheme={colorScheme}>

          <View style={styles.chipGrid}>
            {ONBOARDING_INTERESTS.map((item) => {
              const sel = selectedInterests.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    setSelectedInterests((prev) =>
                      prev.includes(item.id)
                        ? prev.filter((x) => x !== item.id)
                        : [...prev, item.id],
                    )
                  }
                  style={[styles.chip, {
                    backgroundColor: sel ? ACCENT + '18' : Colors[colorScheme].card,
                    borderColor: sel ? ACCENT : Colors[colorScheme].border,
                  }]}>
                  {sel && (
                    <View style={[styles.checkDot, { backgroundColor: ACCENT }]}>
                      <Check size={9} color={Colors[colorScheme].accentForeground} strokeWidth={3} />
                    </View>
                  )}
                  <ThemedText style={[styles.chipText, { color: sel ? ACCENT : Colors[colorScheme].text }]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

        </AccordionRow>

        <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />

        {/* ── Career Goals ── */}
        <AccordionRow
          icon={Target}
          label="Career Goals"
          value={goalsValue}
          isOpen={openSection === 'goals'}
          onToggle={() => toggleSection('goals')}
          colorScheme={colorScheme}>

          {CAREER_GOALS.map((goal) => {
            const sel = selectedGoals.includes(goal.id);
            return (
              <Pressable
                key={goal.id}
                onPress={() =>
                  setSelectedGoals((prev) =>
                    prev.includes(goal.id)
                      ? prev.filter((x) => x !== goal.id)
                      : [...prev, goal.id],
                  )
                }
                style={[styles.option, {
                  backgroundColor: sel ? ACCENT + '12' : Colors[colorScheme].card,
                  borderColor: sel ? ACCENT : Colors[colorScheme].border,
                }]}>
                <View style={styles.optionText}>
                  <ThemedText style={styles.optionLabel}>{goal.label}</ThemedText>
                  <ThemedText style={[styles.optionSub, { color: Colors[colorScheme].muted }]}>
                    {goal.subtitle}
                  </ThemedText>
                </View>
                {sel && (
                  <View style={[styles.checkCircle, { backgroundColor: ACCENT }]}>
                    <Check size={11} color={Colors[colorScheme].accentForeground} strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}

        </AccordionRow>

        <View style={{ height: hasAnyChanges ? 100 : 40 }} />
      </ScrollView>

      {hasAnyChanges && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: Colors[colorScheme].background }]}>
          <Pressable
            onPress={async () => {
              if ((roleHasChanges || seniorityHasChanges) && roleCanSave) await handleSaveRole();
              if (interestsHasChanges && selectedInterests.length > 0) await handleSaveInterests();
              if (goalsHasChanges && selectedGoals.length > 0) await handleSaveGoals();
            }}
            disabled={isSavingAnything}
            style={[styles.fixedSaveBtn, { backgroundColor: Colors[colorScheme].foreground, opacity: isSavingAnything ? 0.6 : 1 }]}>
            {isSavingAnything ? (
              <ActivityIndicator size="small" color={Colors[colorScheme].background} />
            ) : (
              <ThemedText style={[styles.fixedSaveBtnText, { color: Colors[colorScheme].background }]}>Save</ThemedText>
            )}
          </Pressable>
        </View>
      )}
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
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: FontFamily.bold },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // Accordion row header
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontFamily: FontFamily.semiBold },
  rowValue: { fontSize: 13, fontFamily: FontFamily.regular },

  // Accordion body
  accordionBody: {
    paddingBottom: 8,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
  },

  // Sub-section label inside accordion
  subLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },

  // Option rows (role, goals)
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, fontFamily: FontFamily.semiBold },
  optionSub: { fontSize: 12, fontFamily: FontFamily.regular },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Interest chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  checkDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontFamily: FontFamily.semiBold },

  // Fixed bottom save bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  fixedSaveBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fixedSaveBtnText: { fontSize: 16, fontFamily: FontFamily.bold },
});
