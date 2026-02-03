import { useState, useMemo, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Image,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { 
  INTERESTS, 
  HOBBY_SUGGESTIONS, 
  SKILL_SUGGESTIONS, 
  ROLES,
  SAMPLE_FEED_ITEMS,
  completeOnboarding 
} from '@/lib/firestore';

// Sample feed items per interest (for preview)
const INTEREST_FEED_SAMPLES: Record<string, { title: string; category: string }[]> = {
  'ai-tools': [
    { title: 'I Spent $28K Testing Every AI Tool for PMs', category: 'AI Tools' },
    { title: 'The Best AI Coding Assistants Compared', category: 'AI Tools' },
  ],
  'frontend-performance': [
    { title: 'Core Web Vitals: Ultimate 2026 Guide', category: 'Frontend' },
    { title: 'Why Your React App is Slow', category: 'Frontend' },
  ],
  'startups': [
    { title: 'Five Growth Strategies for Early-Stage', category: 'Startups' },
    { title: 'How We Got First 1000 Users', category: 'Startups' },
  ],
  'indie-dev': [
    { title: 'Side Project to $20K MRR Journey', category: 'Indie Dev' },
    { title: 'Tech Stack I Use to Ship Fast', category: 'Indie Dev' },
  ],
};

type PillProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  colorScheme: 'light' | 'dark';
};

function Pill({ label, selected, onPress, colorScheme }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        selected
          ? { backgroundColor: Colors[colorScheme].foreground }
          : { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border, borderWidth: 1 },
      ]}>
      <ThemedText
        style={[
          styles.pillText,
          { color: selected ? Colors[colorScheme].background : Colors[colorScheme].text },
        ]}>
        {label}
      </ThemedText>
      {selected && (
        <ThemedText style={[styles.pillCheck, { color: Colors[colorScheme].background }]}>✓</ThemedText>
      )}
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  
  const isEditMode = profile?.onboarded ?? false;
  
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 0: Interests & Profession
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  
  // Step 1: Skills & Goals
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [goalsShortTerm, setGoalsShortTerm] = useState('');
  
  // Step 2: Name & Hobbies
  const [name, setName] = useState(user?.displayName || '');
  const [role, setRole] = useState('');
  
  // Pre-fill form with existing profile data when editing
  useEffect(() => {
    if (profile) {
      if (profile.interests?.length) setSelectedInterests(profile.interests);
      if (profile.hobbies?.length) setSelectedHobbies(profile.hobbies);
      if (profile.skills?.length) setSelectedSkills(profile.skills);
      if (profile.goalsShortTerm) setGoalsShortTerm(profile.goalsShortTerm);
      if (profile.name) setName(profile.name);
      if (profile.role) setRole(profile.role);
    }
  }, [profile]);

  // Compute preview feed items
  const previewItems = useMemo(() => {
    if (selectedInterests.length === 0) {
      return [
        { title: 'How AI is Transforming Every Industry', category: 'AI' },
        { title: 'Building Products People Want to Use', category: 'Product' },
      ];
    }
    
    const items: { title: string; category: string }[] = [];
    for (const interest of selectedInterests) {
      const samples = INTEREST_FEED_SAMPLES[interest];
      if (samples && items.length < 3) {
        items.push(samples[0]);
      }
    }
    return items.length > 0 ? items : [{ title: 'Personalized content loading...', category: 'Feed' }];
  }, [selectedInterests]);

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter(i => i !== id));
    } else if (selectedInterests.length < 8) {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const toggleHobby = (id: string) => {
    if (selectedHobbies.includes(id)) {
      setSelectedHobbies(selectedHobbies.filter(h => h !== id));
    } else if (selectedHobbies.length < 3) {
      setSelectedHobbies([...selectedHobbies, id]);
    }
  };

  const toggleSkill = (id: string) => {
    if (selectedSkills.includes(id)) {
      setSelectedSkills(selectedSkills.filter(s => s !== id));
    } else {
      setSelectedSkills([...selectedSkills, id]);
    }
  };

  const canProceed = () => {
    // Step 0: Interests & Profession
    if (step === 0) return selectedInterests.length >= 4 && role;
    // Step 1: Skills & Goals
    if (step === 1) return selectedSkills.length >= 1;
    // Step 2: Name & Hobbies
    if (step === 2) return name.trim().length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await completeOnboarding(user.uid, {
        name: name.trim(),
        role,
        interests: selectedInterests,
        hobbies: selectedHobbies,
        skills: selectedSkills,
        goalsShortTerm: goalsShortTerm.trim() || undefined,
        sourcePreferences: {
          youtube: 5,
          articles: 7,
          papers: 2,
          repos: 3,
          tweets: 3,
          discussions: 4,
        },
        contentDepth: null,
      });
      
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (!canProceed()) return;
    if (step < 2) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <SafeAreaView 
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {isEditMode ? (
              <Pressable 
                onPress={() => router.replace('/(tabs)/explore')} 
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <ThemedText style={[styles.closeButtonText, { color: Colors[colorScheme].muted }]}>
                  Cancel
                </ThemedText>
              </Pressable>
            ) : (
              <View style={styles.closeButton} />
            )}
            <View style={styles.logoRow}>
              <Image
                source={require('@/assets/images/trace-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <ThemedText style={styles.logoText}>
                {isEditMode ? 'Edit Preferences' : 'TRACE'}
              </ThemedText>
            </View>
            <View style={styles.closeButton} />
          </View>
          
          {/* Progress bar */}
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme].border }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: Colors[colorScheme].foreground,
                  width: `${((step + 1) / 3) * 100}%` 
                }
              ]} 
            />
          </View>
          
          <View style={styles.stepIndicator}>
            <ThemedText style={[styles.stepText, { color: Colors[colorScheme].muted }]}>
              Step {step + 1} of 3
            </ThemedText>
          </View>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          
          {/* Step 0: Interests & Profession */}
          {step === 0 && (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <ThemedText style={styles.pageTitle}>Let's get started</ThemedText>
              <ThemedText style={[styles.pageSubtitle, { color: Colors[colorScheme].muted }]}>
                Pick what you care about and what you do
              </ThemedText>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  What are you interested in?
                </ThemedText>
                <ThemedText style={[styles.sectionSubtitle, { color: Colors[colorScheme].muted }]}>
                  Pick at least 4 topics • {selectedInterests.length}/8 selected
                </ThemedText>

                <View style={styles.pillsContainer}>
                  {INTERESTS.map((interest) => (
                    <Pill
                      key={interest.id}
                      label={interest.label}
                      selected={selectedInterests.includes(interest.id)}
                      onPress={() => toggleInterest(interest.id)}
                      colorScheme={colorScheme}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  What do you do?
                </ThemedText>
                
                <View style={styles.pillsContainer}>
                  {ROLES.map((r) => (
                    <Pill
                      key={r}
                      label={r}
                      selected={role === r}
                      onPress={() => setRole(r)}
                      colorScheme={colorScheme}
                    />
                  ))}
                </View>
              </View>

              {/* Feed Preview */}
              <View style={[styles.previewCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
                <ThemedText style={[styles.previewLabel, { color: Colors[colorScheme].muted }]}>
                  Your feed preview
                </ThemedText>
                {previewItems.map((item, index) => (
                  <View key={index} style={[styles.previewItem, index > 0 && { borderTopWidth: 1, borderTopColor: Colors[colorScheme].border }]}>
                    <ThemedText style={styles.previewTitle}>{item.title}</ThemedText>
                    <ThemedText style={[styles.previewMeta, { color: Colors[colorScheme].muted }]}>
                      Trending in {item.category}
                    </ThemedText>
                  </View>
                ))}
              </View>

              <View style={[styles.tipCard, { backgroundColor: '#eff6ff' }]}>
                <ThemedText style={styles.tipText}>
                  👋 We'll use this to personalize your experience
                </ThemedText>
              </View>
            </Animated.View>
          )}

          {/* Step 1: Skills & Goals */}
          {step === 1 && (
            <Animated.View entering={SlideInRight} exiting={SlideOutLeft}>
              <ThemedText style={styles.pageTitle}>Skills & Goals</ThemedText>
              <ThemedText style={[styles.pageSubtitle, { color: Colors[colorScheme].muted }]}>
                Help us match content to your level
              </ThemedText>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  Your skills
                </ThemedText>
                <ThemedText style={[styles.sectionSubtitle, { color: Colors[colorScheme].muted }]}>
                  Pick at least 1 • {selectedSkills.length} selected
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
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  Short-term goals
                </ThemedText>
                <ThemedText style={[styles.sectionSubtitle, { color: Colors[colorScheme].muted }]}>
                  Optional — what are you working towards?
                </ThemedText>
                
                <TextInput
                  value={goalsShortTerm}
                  onChangeText={setGoalsShortTerm}
                  placeholder="e.g. Scale a startup, Get promoted"
                  placeholderTextColor={Colors[colorScheme].muted}
                  style={[
                    styles.textInput,
                    { 
                      backgroundColor: Colors[colorScheme].card, 
                      borderColor: Colors[colorScheme].border,
                      color: Colors[colorScheme].text,
                    }
                  ]}
                />
              </View>

              <View style={[styles.tipCard, { backgroundColor: '#eff6ff' }]}>
                <ThemedText style={styles.tipText}>
                  ℹ️ {isEditMode ? 'Your feed will update with your new preferences.' : 'You can always edit your preferences from the Profile tab later.'}
                </ThemedText>
              </View>
            </Animated.View>
          )}

          {/* Step 2: Name & Hobbies */}
          {step === 2 && (
            <Animated.View entering={SlideInRight} exiting={SlideOutLeft}>
              <ThemedText style={styles.pageTitle}>About You</ThemedText>
              <ThemedText style={[styles.pageSubtitle, { color: Colors[colorScheme].muted }]}>
                Personalize your name and hobbies
              </ThemedText>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  What should we call you?
                </ThemedText>
                
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={Colors[colorScheme].muted}
                  style={[
                    styles.textInput,
                    { 
                      backgroundColor: Colors[colorScheme].card, 
                      borderColor: Colors[colorScheme].border,
                      color: Colors[colorScheme].text,
                    }
                  ]}
                />
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  Hobbies
                </ThemedText>
                <ThemedText style={[styles.sectionSubtitle, { color: Colors[colorScheme].muted }]}>
                  Optional • {selectedHobbies.length}/3 selected
                </ThemedText>
                
                <View style={styles.pillsContainer}>
                  {HOBBY_SUGGESTIONS.map((hobby) => (
                    <Pill
                      key={hobby.id}
                      label={hobby.label}
                      selected={selectedHobbies.includes(hobby.id)}
                      onPress={() => toggleHobby(hobby.id)}
                      colorScheme={colorScheme}
                    />
                  ))}
                </View>
              </View>

              <View style={[styles.tipCard, { backgroundColor: '#f0fdf4' }]}>
                <ThemedText style={styles.tipText}>
                  💡 <ThemedText style={styles.tipBold}>82% of early users</ThemedText> say their feed feels noticeably better after picking 4+ interests.
                </ThemedText>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: Colors[colorScheme].border }]}>
          {step > 0 ? (
            <Pressable onPress={prevStep} style={styles.backButton}>
              <ThemedText style={[styles.backButtonText, { color: Colors[colorScheme].muted }]}>
                ← Back
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}

          <Pressable
            onPress={nextStep}
            disabled={!canProceed() || isSubmitting}
            style={[
              styles.nextButton,
              { backgroundColor: canProceed() && !isSubmitting ? Colors[colorScheme].foreground : Colors[colorScheme].border },
            ]}>
            <ThemedText
              style={[
                styles.nextButtonText,
                { color: canProceed() && !isSubmitting ? Colors[colorScheme].background : Colors[colorScheme].muted },
              ]}>
              {isSubmitting ? 'Saving...' : step === 2 ? (isEditMode ? 'Save Changes' : 'Finish') : 'Continue →'}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  closeButton: {
    minWidth: 70,
    paddingVertical: 4,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  logoRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logo: {
    width: 24,
    height: 24,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepIndicator: {
    alignItems: 'center',
  },
  stepText: {
    fontSize: 13,
    fontFamily: Fonts.mono,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    paddingTop: 4,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 14,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pillCheck: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewItem: {
    paddingVertical: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewMeta: {
    fontSize: 12,
  },
  tipCard: {
    padding: 16,
    borderRadius: 12,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
  },
  tipBold: {
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  backButton: {
    padding: 12,
    minWidth: 80,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  nextButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
