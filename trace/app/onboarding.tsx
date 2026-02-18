import { useState, useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  Easing,
} from 'react-native-reanimated';
import { Check, ChevronLeft } from 'lucide-react-native';

import CalendarIllus from '@/assets/images/calendar-svgrepo-com.svg';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  INTERESTS,
  INTEREST_SUBTOPICS,
  SKILL_SUGGESTIONS,
  completeOnboarding,
} from '@/lib/firestore';
import { ILLUS_PALETTE } from '@/app/(auth)/welcome';

// - Design tokens -
const ACCENT = '#22c55e';
const TOTAL_STEPS = 3;

// Personalised feature-forward copy per interest
const INTEREST_OUTCOMES: Record<string, string> = {
  technology: 'Get top tech links with AI summaries and key takeaways',
  science: 'See science updates with quick summaries and context',
  psychology: 'Read psychology ideas with practical takeaways you can apply',
  ideas: 'Turn long-form ideas into short, structured notes',
  business: 'Track business stories with clear summaries and action points',
  money: 'Follow finance and investing links with easy AI breakdowns',
  design: 'Save design references and review key insights faster',
  career: 'Surface career links with concrete tips and next steps',
  'self-development': 'Convert growth content into daily actionable notes',
  health: 'Read health updates with practical guidance upfront',
  cooking: 'Discover recipes and food ideas with quick context',
  culture: 'Keep up with culture stories using fast summaries',
  relationships: 'Get relationship insights with practical examples',
  society: 'Follow major topics with quick context and core points',
};

// ─── Pill types ───
type PillItem = {
  key: string;
  label: string;
  kind: 'interest' | 'subtopic';
  interestId: string;
  subtopicId?: string;
  selected: boolean;
  disabled: boolean;
};

// ─── Pill Component ───
// variant: 'primary' = main interest/skill pills (bolder, badge)
//          'sub'     = sub-interest pills (smaller, no badge)
function Pill({
  label,
  selected,
  disabled,
  onPress,
  colorScheme,
  variant = 'primary',
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  colorScheme: 'light' | 'dark';
  variant?: 'primary' | 'sub';
}) {
  const isSub = variant === 'sub';
  const selectedBg = colorScheme === 'dark' ? '#052e16' : '#f0fdf4';
  const unselectedBg = Colors[colorScheme].card;
  const selectedBorder = ACCENT;
  const unselectedBorder = Colors[colorScheme].border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        isSub ? styles.pillSub : styles.pill,
        {
          backgroundColor: selected ? selectedBg : unselectedBg,
          borderColor: selected ? selectedBorder : unselectedBorder,
          borderWidth: selected ? 2 : 1,
        },
        disabled && !selected && { opacity: 0.35 },
      ]}
    >
      <ThemedText
        style={[
          isSub ? styles.pillTextSub : styles.pillText,
          { color: selected ? ACCENT : Colors[colorScheme].text },
        ]}
      >
        {label}
      </ThemedText>

      {selected && !isSub && (
        <View style={styles.checkBadge}>
          <Check size={10} color="white" strokeWidth={3} />
        </View>
      )}
    </Pressable>
  );
}

// ─── Main Onboarding Screen ───
export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const colorScheme = useColorScheme() ?? 'light';

  const isEditMode = profile?.onboarded ?? false;

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedFocus, setSelectedFocus] = useState<Record<string, string[]>>({});
  // Track which interests have had their sub-topics revealed (never shrinks)
  const [revealedSubs, setRevealedSubs] = useState<Set<string>>(new Set());

  // Step 3
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // ─── Build the flat pill list (interests + inline sub-interests) ───
  const pillItems: PillItem[] = useMemo(() => {
    const items: PillItem[] = [];
    for (const interest of INTERESTS) {
      const isSelected = selectedInterests.includes(interest.id);

      items.push({
        key: interest.id,
        label: interest.label,
        kind: 'interest',
        interestId: interest.id,
        selected: isSelected,
        disabled: false,
      });

      // Show sub-topics if this interest was ever selected (stays revealed)
      if (revealedSubs.has(interest.id)) {
        const subtopics = INTEREST_SUBTOPICS[interest.id] || [];
        const selectedSubList = selectedFocus[interest.id] || [];
        for (const sub of subtopics) {
          items.push({
            key: `${interest.id}--${sub.id}`,
            label: sub.label,
            kind: 'subtopic',
            interestId: interest.id,
            subtopicId: sub.id,
            selected: selectedSubList.includes(sub.id),
            disabled: false,
          });
        }
      }
    }
    return items;
  }, [selectedInterests, selectedFocus, revealedSubs]);

  // ─── Interest toggle ───
  const toggleInterest = useCallback(
    (id: string) => {
      if (selectedInterests.includes(id)) {
        // Deselect interest - keep sub-topics visible and selections intact
        setSelectedInterests(selectedInterests.filter((i) => i !== id));
      } else {
        setSelectedInterests([...selectedInterests, id]);
        // Reveal sub-topics (permanently for this session)
        setRevealedSubs((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
    },
    [selectedInterests],
  );

  // ─── Subtopic toggle ───
  const toggleSubtopic = useCallback(
    (interestId: string, subtopicId: string) => {
      const current = selectedFocus[interestId] || [];
      if (current.includes(subtopicId)) {
        const nextList = current.filter((s) => s !== subtopicId);
        if (nextList.length === 0) {
          const next = { ...selectedFocus };
          delete next[interestId];
          setSelectedFocus(next);
        } else {
          setSelectedFocus({ ...selectedFocus, [interestId]: nextList });
        }
      } else {
        setSelectedFocus({
          ...selectedFocus,
          [interestId]: [...current, subtopicId],
        });
      }
    },
    [selectedFocus],
  );

  // ─── Skill toggle ───
  const toggleSkill = useCallback(
    (id: string) => {
      if (selectedSkills.includes(id)) {
        setSelectedSkills(selectedSkills.filter((s) => s !== id));
      } else {
        setSelectedSkills([...selectedSkills, id]);
      }
    },
    [selectedSkills],
  );

  // ─── Navigation ───
  const progressWidth = `${(step / TOTAL_STEPS) * 100}%`;

  const canGoNext = () => {
    if (step === 1) {
      // Need at least one interest or sub-interest selected
      const hasSubs = Object.values(selectedFocus).some((subs) => subs.length > 0);
      return selectedInterests.length > 0 || hasSubs;
    }
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
      // Merge: if sub-interests are selected for an interest the user untapped,
      // still include that interest (they clearly care about those sub-topics)
      const finalInterests = [...new Set([
        ...selectedInterests,
        ...Object.keys(selectedFocus).filter((id) => (selectedFocus[id] || []).length > 0),
      ])];

      await completeOnboarding(user.uid, {
        name: user.displayName || '',
        interests: finalInterests,
        interestQueries:
          Object.keys(selectedFocus).length > 0 ? selectedFocus : undefined,
        hobbies: profile?.hobbies || [],
        skills: selectedSkills,
        sourcePreferences: {
          youtube: 5,
          articles: 7,
          papers: 2,
          repos: 3,
          tweets: 3,
          discussions: 4,
        },
        contentDepth: 'surprise',
      });

      await refreshProfile();
      
      // Take user to paywall after onboarding
      router.replace('/paywall?fromOnboarding=true');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      showToast('Could not finish setup. Please try again.', 'error');
      setIsSubmitting(false);
    }
  };

  // ─── Personalised outcome lines for Step 2 ───
  const allChosenInterests = useMemo(() => {
    return [...new Set([
      ...selectedInterests,
      ...Object.keys(selectedFocus).filter((id) => (selectedFocus[id] || []).length > 0),
    ])];
  }, [selectedInterests, selectedFocus]);

  const outcomeLines = useMemo(() => {
    return allChosenInterests
      .slice(0, 3)
      .map((id) => INTEREST_OUTCOMES[id])
      .filter(Boolean);
  }, [allChosenInterests]);

  const interestLabels = useMemo(() => {
    const labels = allChosenInterests
      .map((id) => INTERESTS.find((i) => i.id === id)?.label)
      .filter(Boolean) as string[];
    if (labels.length <= 2) return labels.join(' & ');
    return labels.slice(0, -1).join(', ') + ' & ' + labels[labels.length - 1];
  }, [allChosenInterests]);

  // ─── Render ───
  const showBackInHeader = step > 1 || isEditMode;

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
          <View style={styles.headerRow}>
            {showBackInHeader && (
              <Pressable
                onPress={step > 1 ? handleBack : () => router.replace('/(tabs)/explore')}
                style={styles.backChevron}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ChevronLeft size={26} color={Colors[colorScheme].text} strokeWidth={2} />
              </Pressable>
            )}
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
          </View>
        </View>

        {/* ═══════ Scrollable Content ═══════ */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ═══════ STEP 1: Interests + Inline Sub-interests ═══════ */}
          {step === 1 && (
            <Animated.View entering={FadeIn.duration(450)} exiting={FadeOut.duration(200)}>
              <View style={styles.titleRow}>
                <Image
                  source={require('@/assets/images/trace-logo.png')}
                  style={styles.titleLogo}
                  resizeMode="contain"
                />
                <ThemedText style={styles.title}>
                  Choose areas you would{'\n'}like to explore
                </ThemedText>
              </View>

              <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
                Tap what catches your eye
              </ThemedText>

              {/* Single unified pill grid - interests + sub-interests interleaved */}
              <View style={styles.pillsGrid}>
                {pillItems.map((item, index) => {
                  const pillEl = (
                    <Pill
                      label={item.label}
                      selected={item.selected}
                      disabled={item.disabled}
                      variant={item.kind === 'subtopic' ? 'sub' : 'primary'}
                      onPress={() => {
                        if (item.kind === 'interest') {
                          toggleInterest(item.interestId);
                        } else {
                          toggleSubtopic(item.interestId, item.subtopicId!);
                        }
                      }}
                      colorScheme={colorScheme}
                    />
                  );

                  // Sub-interest pills get a smooth fade + slide entrance with staggered delay
                  if (item.kind === 'subtopic') {
                    // Count how many subtopics came before this one to calculate stagger delay
                    const subtopicIndex = pillItems
                      .slice(0, index)
                      .filter((p) => p.kind === 'subtopic' && p.interestId === item.interestId)
                      .length;
                    
                    return (
                      <Animated.View
                        key={item.key}
                        entering={FadeInDown.duration(400)
                          .easing(Easing.out(Easing.ease))
                          .delay(subtopicIndex * 60)}
                        exiting={FadeOut.duration(200)}
                      >
                        {pillEl}
                      </Animated.View>
                    );
                  }

                  return <View key={item.key}>{pillEl}</View>;
                })}
              </View>
            </Animated.View>
          )}

          {/* ═══════ STEP 2: Outcomes Screen ═══════ */}
          {step === 2 && (
            <Animated.View
              entering={FadeIn.duration(500)}
              exiting={FadeOut.duration(200)}
              style={styles.valueScreen}
            >
              {/* Illustration container - gold tint */}
              <View
                style={[
                  styles.valueIllusContainer,
                  { backgroundColor: ILLUS_PALETTE.gold[colorScheme] },
                ]}
              >
                <CalendarIllus width={120} height={120} color={Colors[colorScheme].text} fill={Colors[colorScheme].text} />
              </View>

              <ThemedText style={styles.valueTitle}>
                Here is what Trace{'\n'}will do for you
              </ThemedText>

              <ThemedText style={[styles.valueBody, { color: Colors[colorScheme].muted }]}>
                Every day you get a feed for{' '}
                <ThemedText style={[styles.valueBodyBold, { color: Colors[colorScheme].text }]}>
                  {interestLabels}
                </ThemedText>
                {' '}plus AI notes, key takeaways, and quick read time.
              </ThemedText>

              <View style={styles.outcomeList}>
                {outcomeLines.map((line, i) => (
                  <Animated.View
                    key={i}
                    entering={FadeInDown.duration(500)
                      .easing(Easing.out(Easing.cubic))
                      .delay(300 + i * 180)}
                    style={[
                      styles.outcomeRow,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#0d1f12' : '#f0fdf4',
                        borderColor: Colors[colorScheme].border,
                      },
                    ]}
                  >
                    <ThemedText style={styles.outcomeText}>{line}</ThemedText>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* ═══════ STEP 3: Skills ═══════ */}
          {step === 3 && (
            <Animated.View entering={FadeIn.duration(450)} exiting={FadeOut.duration(200)}>
              <View style={styles.titleRow}>
                <Image
                  source={require('@/assets/images/trace-logo.png')}
                  style={styles.titleLogo}
                  resizeMode="contain"
                />
                <ThemedText style={styles.title}>
                  What are your skills?
                </ThemedText>
              </View>

              <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
                Helps us tune the depth of content we surface · {selectedSkills.length} selected
              </ThemedText>

              <View style={styles.pillsGrid}>
                {SKILL_SUGGESTIONS.map((skill) => (
                  <Pill
                    key={skill.id}
                    label={skill.label}
                    selected={selectedSkills.includes(skill.id)}
                    onPress={() => toggleSkill(skill.id)}
                    colorScheme={colorScheme}
                  />
                ))}
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* ═══════ Footer ═══════ */}
        <View
          style={[
            styles.footer,
            { borderTopColor: Colors[colorScheme].border },
          ]}
        >
          <Pressable
            onPress={handleNext}
            disabled={!canGoNext() || isSubmitting}
            style={[
              styles.continueBtn,
              {
                backgroundColor:
                  canGoNext() && !isSubmitting
                    ? ACCENT
                    : Colors[colorScheme].card,
              },
            ]}
          >
            {isSubmitting && (
              <ActivityIndicator
                size="small"
                color="white"
                style={{ marginRight: 8 }}
              />
            )}
            <ThemedText
              style={[
                styles.continueBtnText,
                {
                  color:
                    canGoNext() && !isSubmitting ? 'white' : Colors[colorScheme].muted,
                },
              ]}
            >
              {isSubmitting
                ? 'Building your feed...'
                : step === TOTAL_STEPS
                  ? isEditMode
                    ? 'Save Changes'
                    : 'Build my feed'
                  : 'Continue'}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // ─── Header ───
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backChevron: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ─── Scroll content ───
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 80,
  },

  // ─── Title row ───
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  titleLogo: {
    width: 32,
    height: 32,
    marginTop: 4,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 32,
    paddingLeft: 44,
  },

  // - Pill grid (interests, sub-interests, skills - all same style) -
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  pill: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },
  pillSub: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pillTextSub: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Step 2: Outcomes / Value screen ───
  valueScreen: {
    alignItems: 'center',
    paddingTop: 40,
  },
  valueIllusContainer: {
    width: 200,
    height: 160,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    overflow: 'hidden',
  },
  valueTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 16,
  },
  valueBody: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 4,
  },
  valueBodyBold: {
    fontWeight: '600',
  },
  outcomeList: {
    width: '100%',
    gap: 12,
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  outcomeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  outcomeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },

  // ─── Footer ───
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
