import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  Easing,
} from 'react-native-reanimated';
import {
  Check, ChevronRight, ArrowLeft, ArrowRight,
  Palette, Code, ClipboardList, BarChart3, Rocket, Globe,
  Leaf, Zap, Award, Crown,
  Cpu, Target, Users, Settings, DollarSign, Heart, Link, Brain,
  TrendingUp, RefreshCw, Wrench,
  FileText, Microscope, MessageCircle,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  LEARNING_SOURCE_CATEGORIES,
  CAREER_GOALS,
  completeOnboarding,
} from '@/lib/firestore';

const ACCENT = '#F59E0B';
const ACCENT_BG_DARK = '#1a1408';
const ACCENT_BG_LIGHT = '#fffbeb';
const TOTAL_STEPS = 3;

const ICON_MAP: Record<string, LucideIcon> = {
  'palette': Palette, 'code': Code, 'clipboard-list': ClipboardList,
  'bar-chart-3': BarChart3, 'rocket': Rocket, 'globe': Globe,
  'leaf': Leaf, 'zap': Zap, 'award': Award, 'crown': Crown,
  'cpu': Cpu, 'target': Target, 'users': Users, 'settings': Settings,
  'dollar-sign': DollarSign, 'heart': Heart, 'link': Link, 'brain': Brain,
  'trending-up': TrendingUp, 'refresh-cw': RefreshCw, 'wrench': Wrench,
  'file-text': FileText, 'microscope': Microscope, 'message-circle': MessageCircle,
};

function IconRenderer({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}

// ─── Selection Card ───
function SelectionCard({
  label,
  subtitle,
  icon,
  selected,
  onPress,
  colorScheme,
  compact = false,
}: {
  label: string;
  subtitle?: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
  colorScheme: 'light' | 'dark';
  compact?: boolean;
}) {
  const iconColor = selected ? ACCENT : Colors[colorScheme].muted;
  return (
    <Pressable
      onPress={onPress}
      style={[
        compact ? styles.cardCompact : styles.card,
        {
          backgroundColor: selected
            ? (colorScheme === 'dark' ? ACCENT_BG_DARK : ACCENT_BG_LIGHT)
            : Colors[colorScheme].card,
          borderColor: selected ? ACCENT : Colors[colorScheme].border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      {icon ? (
        <View style={compact ? styles.iconBoxCompact : styles.iconBox}>
          <IconRenderer name={icon} size={compact ? 20 : 24} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <ThemedText
          style={[
            compact ? styles.cardLabelCompact : styles.cardLabel,
            selected && { color: ACCENT },
          ]}
          numberOfLines={compact ? 2 : 1}
        >
          {label}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            style={[styles.cardSubtitle, { color: Colors[colorScheme].muted }]}
            numberOfLines={1}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {selected && (
        <View style={styles.checkBadgeOverlay}>
          <Check size={9} color="white" strokeWidth={3} />
        </View>
      )}
    </Pressable>
  );
}

// ─── Interest Chip ───
function InterestChip({
  label,
  icon,
  selected,
  onPress,
  colorScheme,
  disabled,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
  colorScheme: 'light' | 'dark';
  disabled?: boolean;
}) {
  const iconColor = selected ? ACCENT : Colors[colorScheme].muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? (colorScheme === 'dark' ? ACCENT_BG_DARK : ACCENT_BG_LIGHT)
            : Colors[colorScheme].card,
          borderColor: selected ? ACCENT : Colors[colorScheme].border,
          borderWidth: selected ? 2 : 1,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <View style={styles.chipIconBox}>
        <IconRenderer name={icon} size={18} color={iconColor} />
      </View>
      <ThemedText
        style={[
          styles.chipLabel,
          selected && { color: ACCENT },
        ]}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

// ─── Main Onboarding Screen ───
export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile, onboardingStatus, markOnboardingComplete } = useAuth();
  const { showToast } = useToast();
  const colorScheme = useColorScheme() ?? 'light';

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedSeniority, setSelectedSeniority] = useState<string>('');

  // Step 2
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Step 3
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  // Step 4
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  useEffect(() => {
    if (onboardingStatus === 'onboarded' || profile?.onboarded === true) {
      router.replace('/(tabs)');
    }
  }, [onboardingStatus, profile?.onboarded, router]);

  // ─── Toggles ───
  const toggleInterest = useCallback((id: string) => {
    setSelectedInterests(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= 5) return prev; // Max 5 interests
      return [...prev, id];
    });
  }, []);

  const toggleSource = useCallback((name: string) => {
    setSelectedSources(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  }, []);

  const toggleGoal = useCallback((id: string) => {
    setSelectedGoals(prev => {
      if (prev.includes(id)) return prev.filter(g => g !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  // ─── Source counts per category ───
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of LEARNING_SOURCE_CATEGORIES) {
      counts[cat.id] = cat.sources.filter(s => selectedSources.includes(s.name)).length;
    }
    return counts;
  }, [selectedSources]);

  if (onboardingStatus === 'onboarded' || profile?.onboarded === true) {
    return null;
  }

  // ─── Navigation ───
  const progressWidth = `${(step / TOTAL_STEPS) * 100}%`;

  const canGoNext = (): boolean => {
    if (step === 1) return !!selectedRole && !!selectedSeniority;
    if (step === 2) return selectedInterests.length >= 3;
    // Step 3 (Deep Dive Sources) commented out for now
    if (step === 3) return selectedGoals.length >= 1;
    return true;
  };

  const handleNext = () => {
    if (!canGoNext()) return;
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await completeOnboarding(user.uid, {
        name: user.displayName || '',
        role: selectedRole,
        seniority: selectedSeniority,
        interests: selectedInterests,
        selectedLearningSources: selectedSources,
        careerGoals: selectedGoals,
      });

      await markOnboardingComplete({
        name: user.displayName || '',
        role: selectedRole,
        seniority: selectedSeniority,
        interests: selectedInterests,
        selectedLearningSources: selectedSources,
        careerGoals: selectedGoals,
      });
      router.replace('/(tabs)'); // paywall disabled — skip straight to app
    } catch (error) {
      console.error('Error completing onboarding:', error);
      showToast('Could not verify your setup with the server. Please try again.', 'error');
      setIsSubmitting(false);
    }
  };

  const stepLabel = `${step} of ${TOTAL_STEPS}`;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ═══════ Header ═══════ */}
        <View style={styles.header}>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: Colors[colorScheme].muted + '30' },
            ]}
          >
            <Animated.View
              style={[styles.progressFill, { backgroundColor: ACCENT, width: progressWidth as any }]}
            />
          </View>
          <ThemedText style={[styles.stepLabel, { color: Colors[colorScheme].muted }]}>
            {stepLabel}
          </ThemedText>
        </View>

        {/* ═══════ Scrollable Content ═══════ */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ═══════ STEP 1: Role + Experience ═══════ */}
          {step === 1 && (
            <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)}>
              <ThemedText style={styles.title}>What&apos;s your role?</ThemedText>
              <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
                We&apos;ll tailor articles and learning cards to your perspective.
              </ThemedText>

              <View style={styles.gridTwo}>
                {ROLES.map(role => (
                  <SelectionCard
                    key={role.id}
                    label={role.label}
                    subtitle={role.subtitle}
                    icon={role.icon}
                    selected={selectedRole === role.id}
                    onPress={() => setSelectedRole(role.id)}
                    colorScheme={colorScheme}
                    compact
                  />
                ))}
              </View>

              <ThemedText style={[styles.title, { marginTop: 32 }]}>Experience level</ThemedText>
              <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
                Helps us calibrate depth, detail, and terminology.
              </ThemedText>

              <View style={styles.gridTwo}>
                {SENIORITY_LEVELS.map(level => (
                  <SelectionCard
                    key={level.id}
                    label={level.label}
                    subtitle={level.subtitle}
                    icon={level.icon}
                    selected={selectedSeniority === level.id}
                    onPress={() => setSelectedSeniority(level.id)}
                    colorScheme={colorScheme}
                    compact
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {/* ═══════ STEP 2: Interests ═══════ */}
          {step === 2 && (
            <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)}>
              <ThemedText style={styles.title}>What fires you up?</ThemedText>
              <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
                Pick 3+ beats you care about — we build grouped topic briefings around them, updated daily.
              </ThemedText>

              <View style={styles.gridTwo}>
                {ONBOARDING_INTERESTS.map((interest, index) => (
                  <Animated.View
                    key={interest.id}
                    entering={FadeInDown.duration(350).delay(index * 40).easing(Easing.out(Easing.ease))}
                  >
                    <InterestChip
                      label={interest.label}
                      icon={interest.icon}
                      selected={selectedInterests.includes(interest.id)}
                      onPress={() => toggleInterest(interest.id)}
                      colorScheme={colorScheme}
                      disabled={selectedInterests.length >= 5 && !selectedInterests.includes(interest.id)}
                    />
                  </Animated.View>
                ))}
              </View>

              {selectedInterests.length > 0 && (
                <ThemedText style={[styles.selectionCount, { color: Colors[colorScheme].muted }]}>
                  {selectedInterests.length}/5 selected{selectedInterests.length < 3 ? ` — pick ${3 - selectedInterests.length} more` : selectedInterests.length === 5 ? ' (max)' : ''}
                </ThemedText>
              )}
            </Animated.View>
          )}

          {/* ═══════ STEP 3: Deep Dive Sources (COMMENTED OUT FOR NOW) ═══════ */}
          {/* {step === 3 && (
            <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)}>
              <ThemedText style={styles.title}>Your Deep Dive sources</ThemedText>
              <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
                Pick the voices you trust. We'll turn their best content into chapters.
              </ThemedText>

              <View style={styles.sourceList}>
                {LEARNING_SOURCE_CATEGORIES.map(category => {
                  const isExpanded = expandedCategory === category.id;
                  const count = sourceCounts[category.id] || 0;

                  return (
                    <View key={category.id}>
                      <Pressable
                        onPress={() => setExpandedCategory(isExpanded ? null : category.id)}
                        style={[
                          styles.categoryRow,
                          {
                            backgroundColor: Colors[colorScheme].card,
                            borderColor: count > 0 ? ACCENT : Colors[colorScheme].border,
                            borderWidth: count > 0 ? 2 : 1,
                          },
                        ]}
                      >
                        <View style={styles.iconBox}>
                          <IconRenderer name={category.icon} size={22} color={count > 0 ? ACCENT : Colors[colorScheme].muted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.categoryLabel}>{category.label}</ThemedText>
                          <ThemedText style={[styles.categoryCount, { color: Colors[colorScheme].muted }]}>
                            {count > 0 ? `${count} selected` : `${category.sources.length} sources`}
                          </ThemedText>
                        </View>
                        <ChevronRight
                          size={18}
                          color={Colors[colorScheme].muted}
                          strokeWidth={1.5}
                          style={isExpanded ? { transform: [{ rotate: '90deg' }] } : undefined}
                        />
                      </Pressable>

                      {isExpanded && (
                        <Animated.View
                          entering={FadeInDown.duration(300).easing(Easing.out(Easing.ease))}
                          style={styles.sourceExpanded}
                        >
                          {category.sources.map(source => {
                            const isSelected = selectedSources.includes(source.name);
                            return (
                              <Pressable
                                key={source.name}
                                onPress={() => toggleSource(source.name)}
                                style={[
                                  styles.sourceRow,
                                  {
                                    backgroundColor: isSelected
                                      ? (colorScheme === 'dark' ? ACCENT_BG_DARK : ACCENT_BG_LIGHT)
                                      : 'transparent',
                                    borderColor: isSelected ? ACCENT : Colors[colorScheme].border,
                                  },
                                ]}
                              >
                                <View style={[
                                  styles.sourceAvatar,
                                  { backgroundColor: isSelected ? ACCENT + '30' : Colors[colorScheme].border + '50' },
                                ]}>
                                  <ThemedText style={[styles.sourceAvatarText, isSelected && { color: ACCENT }]}>
                                    {source.name.charAt(0)}
                                  </ThemedText>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <ThemedText style={[styles.sourceName, isSelected && { color: ACCENT }]}>
                                    {source.name}
                                  </ThemedText>
                                  <ThemedText
                                    style={[styles.sourceDesc, { color: Colors[colorScheme].muted }]}
                                    numberOfLines={1}
                                  >
                                    {source.description}
                                  </ThemedText>
                                </View>
                                {isSelected && (
                                  <View style={styles.checkSmall}>
                                    <Check size={12} color={ACCENT} strokeWidth={3} />
                                  </View>
                                )}
                              </Pressable>
                            );
                          })}
                        </Animated.View>
                      )}
                    </View>
                  );
                })}
              </View>

              {selectedSources.length > 0 && (
                <ThemedText style={[styles.selectionCount, { color: Colors[colorScheme].muted }]}>
                  {selectedSources.length} source{selectedSources.length !== 1 ? 's' : ''} selected
                </ThemedText>
              )}
            </Animated.View>
          )} */}

          {/* ═══════ STEP 3: Goals ═══════ */}
          {step === 3 && (
            <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)}>
              <ThemedText style={styles.title}>What&apos;s your next move?</ThemedText>
              <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
                Pick 1-2 goals. We&apos;ll surface articles and deep dives that help you get there.
              </ThemedText>

              <View style={styles.goalList}>
                {CAREER_GOALS.map((goal, index) => (
                  <Animated.View
                    key={goal.id}
                    entering={FadeInDown.duration(350).delay(index * 60).easing(Easing.out(Easing.ease))}
                  >
                    <SelectionCard
                      label={goal.label}
                      subtitle={goal.subtitle}
                      icon={goal.icon}
                      selected={selectedGoals.includes(goal.id)}
                      onPress={() => toggleGoal(goal.id)}
                      colorScheme={colorScheme}
                    />
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

        </ScrollView>

        {/* ═══════ Footer ═══════ */}
        <View style={[styles.footer]}>
          {step > 1 ? (
            <Pressable
              onPress={handleBack}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={16} color={Colors[colorScheme].muted} strokeWidth={2} />
              <ThemedText style={[styles.backBtnText, { color: Colors[colorScheme].muted }]}>
                Back
              </ThemedText>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable
            onPress={handleNext}
            disabled={!canGoNext() || isSubmitting}
            style={[
              styles.continueBtn,
              {
                backgroundColor: ACCENT,
                opacity: canGoNext() && !isSubmitting ? 1 : 0.35,
              },
            ]}
          >
            {isSubmitting && (
              <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} />
            )}
            <ThemedText style={styles.continueBtnText}>
              {isSubmitting
                ? 'Building your feed...'
                : step === TOTAL_STEPS
                  ? 'Build my feed'
                  : 'Continue'}
            </ThemedText>
            {!isSubmitting && (
              <ArrowRight size={16} color="#000" strokeWidth={2.5} style={{ marginLeft: 6 }} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───
const SCREEN_W = Dimensions.get('window').width;
const GRID_PAD = 24;
const GRID_GAP = 12;
const HALF_W = (SCREEN_W - GRID_PAD * 2 - GRID_GAP) / 2;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },

  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  progressBar: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  stepLabel: { fontSize: 12, fontFamily: FontFamily.semiBold, marginTop: 8, paddingLeft: 2 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 80 },

  title: { fontSize: 26, letterSpacing: -0.5, lineHeight: 34, marginBottom: 8, fontFamily: FontFamilySerif.bold },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 28, fontFamily: FontFamily.semiBold },

  // 2-column grid
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  // Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 2,
    overflow: 'visible',
  },
  cardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    width: HALF_W,
    overflow: 'visible',
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBoxCompact: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 16, fontFamily: FontFamily.semiBold },
  cardLabelCompact: { fontSize: 13, fontFamily: FontFamily.semiBold },
  cardSubtitle: { fontSize: 11, lineHeight: 14, marginTop: 2 },
  checkBadgeOverlay: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    width: HALF_W,
  },
  chipIconBox: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontSize: 14, fontFamily: FontFamily.semiBold, flex: 1 },

  selectionCount: { fontSize: 13, textAlign: 'center', marginTop: 16 },

  // Source categories
  sourceList: { gap: 10 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontSize: 15, fontFamily: FontFamily.semiBold },
  categoryCount: { fontSize: 12, marginTop: 2 },
  sourceExpanded: { paddingLeft: 8, paddingRight: 4, paddingTop: 4, paddingBottom: 8, gap: 4 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sourceAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceAvatarText: { fontSize: 15, fontFamily: FontFamily.bold },
  sourceName: { fontSize: 14, fontFamily: FontFamily.semiBold },
  sourceDesc: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  checkSmall: { marginLeft: 4 },

  // Goals
  goalList: { gap: 10 },

  // Summary style cards
  summaryCard: { borderRadius: 16, padding: 18, marginBottom: 2 },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  summaryIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  summaryLabel: { fontSize: 17, fontFamily: FontFamily.bold },
  summarySubtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  previewBox: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  previewText: { fontSize: 13, lineHeight: 20, fontStyle: 'italic' },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  backBtnText: { fontSize: 15, fontFamily: FontFamily.semiBold },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  continueBtnText: { fontSize: 16, fontFamily: FontFamily.bold, color: '#000' },
});
