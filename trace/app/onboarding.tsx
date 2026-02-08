import { useState, useEffect, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Slider from '@react-native-community/slider';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  INTERESTS,
  INTEREST_SUBTOPICS,
  SKILL_SUGGESTIONS,
  completeOnboarding,
} from '@/lib/firestore';

// ─── Design tokens ───
const ACCENT = '#22c55e';

const MAX_INTERESTS = 4;
const MIN_INTERESTS = 4;
const MAX_SUBTOPICS_PER_INTEREST = 2;
// Step 1: Interests | Steps 2-5: Subtopics (one per interest) | Step 6: Skills | Step 7: Sliders
const TOTAL_STEPS = 7;


// ─── Pill Component (dot-indicator style) ───
function Pill({
  label,
  selected,
  disabled,
  onPress,
  colorScheme,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  colorScheme: 'light' | 'dark';
}) {
  const selectedBg = colorScheme === 'dark' ? '#052e16' : '#f0fdf4';
  const unselectedBg = Colors[colorScheme].card;
  const selectedBorder = ACCENT;
  const unselectedBorder = colorScheme === 'dark' ? '#333' : '#e5e7eb';
  const dotInactive = colorScheme === 'dark' ? '#444' : '#d1d5db';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? selectedBg : unselectedBg,
          borderColor: selected ? selectedBorder : unselectedBorder,
          borderWidth: selected ? 1.5 : 1,
        },
        disabled && !selected && { opacity: 0.35 },
      ]}
    >
      <View
        style={[
          styles.pillDot,
          {
            backgroundColor: selected ? ACCENT : dotInactive,
          },
        ]}
      />
      <ThemedText
        style={[
          styles.pillText,
          { color: selected ? ACCENT : Colors[colorScheme].text },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

// ─── Option Row Component (for subtopic multiselect) ───
function OptionRow({
  label,
  selected,
  disabled,
  onPress,
  colorScheme,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  colorScheme: 'light' | 'dark';
}) {
  const selectedBg = colorScheme === 'dark' ? '#052e16' : '#f0fdf4';
  const unselectedBg = Colors[colorScheme].card;
  const selectedBorder = ACCENT;
  const unselectedBorder = colorScheme === 'dark' ? '#333' : '#e5e7eb';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.optionRow,
        {
          backgroundColor: selected ? selectedBg : unselectedBg,
          borderColor: selected ? selectedBorder : unselectedBorder,
          borderWidth: selected ? 1.5 : 1,
        },
        disabled && !selected && { opacity: 0.35 },
      ]}
    >
      <ThemedText
        style={[
          styles.optionRowText,
          { color: selected ? ACCENT : Colors[colorScheme].text },
        ]}
      >
        {label}
      </ThemedText>
      <View
        style={[
          styles.optionRowCheck,
          {
            backgroundColor: selected ? ACCENT : 'transparent',
            borderColor: selected
              ? ACCENT
              : colorScheme === 'dark'
                ? '#555'
                : '#d1d5db',
          },
        ]}
      >
        {selected && <Check size={14} color="#fff" strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

// ─── Main Onboarding Screen ───
export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const isEditMode = profile?.onboarded ?? false;

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Step 2: Subtopics / Focus
  const [selectedFocus, setSelectedFocus] = useState<Record<string, string[]>>({});

  // Step 3: Skills
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Step 4: Interest weights (0–10 per interest)
  const [interestWeights, setInterestWeights] = useState<Record<string, number>>({});

  // NOTE: No pre-fill. Onboarding always starts fresh.
  // The AuthGate ensures onboarded users go to (tabs), not here.
  // If we add an "Edit Preferences" flow later, it should pass
  // a route param and load existing data explicitly.

  // Initialise weights when interests change
  useEffect(() => {
    setInterestWeights((prev) => {
      const next: Record<string, number> = {};
      for (const id of selectedInterests) {
        next[id] = prev[id] ?? 5;
      }
      return next;
    });
  }, [selectedInterests]);

  // ─── Interest toggle ───
  const toggleInterest = useCallback(
    (id: string) => {
      if (selectedInterests.includes(id)) {
        setSelectedInterests(selectedInterests.filter((i) => i !== id));
        const nextFocus = { ...selectedFocus };
        delete nextFocus[id];
        setSelectedFocus(nextFocus);
      } else if (selectedInterests.length < MAX_INTERESTS) {
        setSelectedInterests([...selectedInterests, id]);
      }
    },
    [selectedInterests, selectedFocus],
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
      } else if (current.length < MAX_SUBTOPICS_PER_INTEREST) {
        setSelectedFocus({ ...selectedFocus, [interestId]: [...current, subtopicId] });
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

  // ─── Weight slider ───
  const setWeight = useCallback((id: string, value: number) => {
    setInterestWeights((prev) => ({ ...prev, [id]: Math.round(value) }));
  }, []);

  // ─── Step helpers ───
  const isSubtopicStep = step >= 2 && step <= 5;
  const subtopicIndex = step - 2; // 0–3 for steps 2–5
  const currentSubtopicInterestId = isSubtopicStep ? selectedInterests[subtopicIndex] : null;
  const currentSubtopicInterest = currentSubtopicInterestId
    ? INTERESTS.find((i) => i.id === currentSubtopicInterestId)
    : null;
  const currentSubtopics = currentSubtopicInterestId
    ? INTEREST_SUBTOPICS[currentSubtopicInterestId] || []
    : [];
  const currentSubtopicSelected = currentSubtopicInterestId
    ? selectedFocus[currentSubtopicInterestId] || []
    : [];

  // Conversational prompts (matching web frontend)
  const subtopicPrompts = currentSubtopicInterest
    ? [
        `You like ${currentSubtopicInterest.label.toLowerCase()}... what about it interests you the most?`,
        `${currentSubtopicInterest.label} is broad — any angle you're drawn to?`,
        `Anything specific about ${currentSubtopicInterest.label.toLowerCase()} you want to dive into?`,
        `Last one! What's your ${currentSubtopicInterest.label.toLowerCase()} sweet spot?`,
      ]
    : [];


  // ─── Navigation ───
  const progressWidth = `${(step / TOTAL_STEPS) * 100}%`;

  const canGoNext = () => {
    if (step === 1) return selectedInterests.length >= MIN_INTERESTS;
    return true; // All other steps are optional
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
        interests: selectedInterests,
        interestQueries: Object.keys(selectedFocus).length > 0 ? selectedFocus : undefined,
        interestWeights:
          Object.keys(interestWeights).length > 0 ? interestWeights : undefined,
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
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
    }
  };

  // ─── Render ───
  const showBackInHeader = step > 1 || isEditMode;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ═══════ Header: back chevron + green progress bar ═══════ */}
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

            <View style={[styles.progressBar, { backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#e5e7eb' }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: ACCENT, width: progressWidth as any },
                ]}
              />
            </View>
          </View>
        </View>

        {/* ═══════ Content ═══════ */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ═══════ STEP 1: Interests ═══════ */}
          {step === 1 && (
            <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}>
              {/* Logo + Question */}
              <View style={styles.questionRow}>
                <Image
                  source={require('@/assets/images/trace-logo.png')}
                  style={styles.questionLogo}
                  resizeMode="contain"
                />
                <ThemedText style={styles.pageTitle}>
                  What are you most{'\n'}interested in?
                </ThemedText>
              </View>

              <ThemedText style={[styles.pageSubtitle, { color: Colors[colorScheme].muted }]}>
                Pick {MIN_INTERESTS} topics • {selectedInterests.length}/{MAX_INTERESTS} selected
              </ThemedText>

              <View style={styles.pillsContainer}>
                {INTERESTS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.id);
                  const isMaxed = !isSelected && selectedInterests.length >= MAX_INTERESTS;
                  return (
                    <Pill
                      key={interest.id}
                      label={interest.label}
                      selected={isSelected}
                      disabled={isMaxed}
                      onPress={() => toggleInterest(interest.id)}
                      colorScheme={colorScheme}
                    />
                  );
                })}
              </View>

            </Animated.View>
          )}

          {/* ═══════ STEPS 2–5: Subtopics (one per interest) ═══════ */}
          {isSubtopicStep && currentSubtopicInterest && currentSubtopics.length > 0 && (
            <Animated.View
              key={`subtopic-${subtopicIndex}`}
              entering={FadeIn.duration(250)}
              exiting={FadeOut.duration(150)}
            >
              <View style={styles.questionRow}>
                <Image
                  source={require('@/assets/images/trace-logo.png')}
                  style={styles.questionLogo}
                  resizeMode="contain"
                />
                <ThemedText style={styles.pageTitle}>
                  {subtopicPrompts[subtopicIndex] || subtopicPrompts[0]}
                </ThemedText>
              </View>

              <ThemedText style={[styles.pageSubtitle, { color: Colors[colorScheme].muted }]}>
                Pick up to {MAX_SUBTOPICS_PER_INTEREST} • {currentSubtopicSelected.length}/{MAX_SUBTOPICS_PER_INTEREST} selected
              </ThemedText>

              <View style={styles.optionRowsContainer}>
                {currentSubtopics.map((sub) => {
                  const isSel = currentSubtopicSelected.includes(sub.id);
                  const isMaxed = !isSel && currentSubtopicSelected.length >= MAX_SUBTOPICS_PER_INTEREST;
                  return (
                    <OptionRow
                      key={sub.id}
                      label={sub.label}
                      selected={isSel}
                      disabled={isMaxed}
                      onPress={() => toggleSubtopic(currentSubtopicInterestId!, sub.id)}
                      colorScheme={colorScheme}
                    />
                  );
                })}
              </View>

            </Animated.View>
          )}

          {/* ═══════ STEP 6: Skills ═══════ */}
          {step === 6 && (
            <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}>
              <View style={styles.questionRow}>
                <Image
                  source={require('@/assets/images/trace-logo.png')}
                  style={styles.questionLogo}
                  resizeMode="contain"
                />
                <ThemedText style={styles.pageTitle}>
                  What are your skills?
                </ThemedText>
              </View>

              <ThemedText style={[styles.pageSubtitle, { color: Colors[colorScheme].muted }]}>
                Helps us tune the depth of content we surface • {selectedSkills.length} selected
              </ThemedText>

              <View style={styles.pillsContainer}>
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

          {/* ═══════ STEP 7: Interest Weight Sliders ═══════ */}
          {step === 7 && (
            <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}>
              <View style={styles.questionRow}>
                <Image
                  source={require('@/assets/images/trace-logo.png')}
                  style={styles.questionLogo}
                  resizeMode="contain"
                />
                <ThemedText style={styles.pageTitle}>
                  Tune your mix
                </ThemedText>
              </View>

              <ThemedText style={[styles.pageSubtitle, { color: Colors[colorScheme].muted }]}>
                Adjust how much of each topic shows up in your daily feed.
              </ThemedText>

              <View style={styles.slidersContainer}>
                {selectedInterests.map((interestId) => {
                  const interest = INTERESTS.find((i) => i.id === interestId);
                  if (!interest) return null;
                  const value = interestWeights[interestId] ?? 5;

                  return (
                    <View
                      key={interestId}
                      style={[
                        styles.sliderCard,
                        {
                          backgroundColor: Colors[colorScheme].card,
                          borderColor: Colors[colorScheme].border,
                        },
                      ]}
                    >
                      <View style={styles.sliderHeader}>
                        <ThemedText style={styles.sliderLabel}>{interest.label}</ThemedText>
                        <ThemedText style={[styles.sliderValue, { color: ACCENT }]}>
                          {value <= 3 ? 'Less' : value >= 7 ? 'More' : 'Balanced'}
                        </ThemedText>
                      </View>
                      <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={10}
                        step={1}
                        value={value}
                        onValueChange={(v) => setWeight(interestId, v)}
                        minimumTrackTintColor={ACCENT}
                        maximumTrackTintColor={colorScheme === 'dark' ? '#2c2c2c' : '#e5e7eb'}
                        thumbTintColor={ACCENT}
                      />
                      <View style={styles.sliderLabelsRow}>
                        <ThemedText style={[styles.sliderEndLabel, { color: Colors[colorScheme].muted }]}>
                          Less
                        </ThemedText>
                        <ThemedText style={[styles.sliderEndLabel, { color: Colors[colorScheme].muted }]}>
                          More
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* ═══════ Footer ═══════ */}
        <View style={styles.footer}>
          {/* Skip link on the left (only for optional steps) */}
          {isSubtopicStep || step === 6 ? (
            <Pressable onPress={handleNext} hitSlop={12} style={styles.skipButton}>
              <ThemedText style={[styles.skipText, { color: Colors[colorScheme].muted }]}>
                Skip
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.skipButton} />
          )}

          {/* Next / Build my feed button */}
          <Pressable
            onPress={handleNext}
            disabled={!canGoNext() || isSubmitting}
            style={[
              styles.nextButton,
              {
                backgroundColor:
                  canGoNext() && !isSubmitting
                    ? Colors[colorScheme].foreground
                    : colorScheme === 'dark'
                      ? '#1c1c1c'
                      : '#e5e7eb',
              },
            ]}
          >
            <ThemedText
              style={[
                styles.nextButtonText,
                {
                  color:
                    canGoNext() && !isSubmitting
                      ? Colors[colorScheme].background
                      : Colors[colorScheme].muted,
                },
              ]}
            >
              {isSubmitting
                ? 'Building your feed...'
                : step === TOTAL_STEPS
                  ? isEditMode
                    ? 'Save Changes'
                    : 'Build my feed'
                  : 'Next'}
            </ThemedText>
            {!isSubmitting && step < TOTAL_STEPS && canGoNext() && (
              <ChevronRight
                size={18}
                color={Colors[colorScheme].background}
                strokeWidth={2.5}
              />
            )}
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
  keyboardView: {
    flex: 1,
  },

  // ─── Header ───
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
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

  // ─── Content ───
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 40,
  },

  // ─── Question row (logo + title) ───
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  questionLogo: {
    width: 32,
    height: 32,
    marginTop: 3,
  },
  pageTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
    paddingLeft: 44,
  },

  // ─── Pills ───
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 8,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '500',
  },



  // ─── Option Rows (subtopics) ───
  optionRowsContainer: {
    gap: 10,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
  },
  optionRowText: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionRowCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Sliders (Step 4) ───
  slidersContainer: {
    gap: 16,
    marginBottom: 20,
  },
  sliderCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 36,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  sliderEndLabel: {
    fontSize: 11,
  },

  // ─── Footer ───
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  skipButton: {
    minWidth: 50,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 999,
    gap: 4,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

