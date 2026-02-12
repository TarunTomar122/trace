import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import {
  BookOpen,
  Brain,
  Check,
  ChevronLeft,
  ArrowRight,
  CircleHelp,
  FileText,
  Film,
  Gauge,
  Goal,
  Lightbulb,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react-native';
import { useTheme } from '../ThemeContext';

const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 24;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INTEREST_OPTIONS = [
  'Technology',
  'Business',
  'Money',
  'Psychology',
  'Health',
  'Career',
  'Design',
  'Science',
  'Relationships',
  'Culture',
  'Self-development',
  'Cooking',
];

const SKILL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];
const FORMAT_OPTIONS = ['Quick cards', 'Mixed format', 'Deep dives'];
const GOAL_OPTIONS = ['10 min/day', '20 min/day', '30+ min/day'];

const STEP_LABELS = [
  'Welcome',
  'About you',
  'What you get',
  'Interests',
  'Personalization',
  'Level',
  'Rhythm',
];

const STEP_ICONS = [
  Sparkles,
  UserRound,
  Target,
  CircleHelp,
  Brain,
  Gauge,
  Goal,
];

/* ────────────────────────── Wide pill (gender / skill / format / goal) ── */
function WidePill({ label, selected, onPress, colors, icon: Icon }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.widePill,
        {
          backgroundColor: selected ? colors.accent + '18' : colors.surface,
          borderColor: selected ? colors.accent : colors.surfaceBorder,
        },
      ]}
    >
      {Icon && (
        <Icon
          size={18}
          color={selected ? colors.accent : colors.textTertiary}
          strokeWidth={2}
        />
      )}
      <Text
        style={[
          styles.widePillText,
          { color: selected ? colors.textPrimary : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
      {selected && (
        <View style={[styles.checkDot, { backgroundColor: colors.accent }]}>
          <Check size={11} color={colors.background} strokeWidth={3} />
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ────────────────────────── Chip pill (interests grid) ── */
function ChipPill({ label, selected, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chipPill,
        {
          backgroundColor: selected ? colors.accent + '18' : colors.surface,
          borderColor: selected ? colors.accent : colors.surfaceBorder,
        },
      ]}
    >
      {selected && (
        <View style={[styles.checkDotSmall, { backgroundColor: colors.accent }]}>
          <Check size={9} color={colors.background} strokeWidth={3} />
        </View>
      )}
      <Text
        style={[
          styles.chipPillText,
          { color: selected ? colors.textPrimary : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ────────────────────────── Main component ── */
export default function OnboardingScreen({ onComplete }) {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState(null);
  const [interests, setInterests] = useState([]);
  const [skillLevel, setSkillLevel] = useState(null);
  const [format, setFormat] = useState(null);
  const [goal, setGoal] = useState(null);

  const totalSteps = 7;
  const progress = ((step + 1) / totalSteps) * 100;
  const StepIcon = STEP_ICONS[step] || Sparkles;

  const interestSummary = useMemo(() => {
    if (!interests.length) return 'a mix of timeless and trending topics';
    if (interests.length === 1) return interests[0];
    if (interests.length === 2) return `${interests[0]} and ${interests[1]}`;
    return `${interests[0]}, ${interests[1]}, and more`;
  }, [interests]);

  const toggleInterest = (value) => {
    setInterests((prev) =>
      prev.includes(value)
        ? prev.filter((x) => x !== value)
        : [...prev, value].slice(0, 6),
    );
  };

  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(gender);
    if (step === 3) return interests.length > 0;
    if (step === 5) return Boolean(skillLevel);
    if (step === 6) return Boolean(format) && Boolean(goal);
    return true;
  }, [step, gender, interests.length, skillLevel, format, goal]);

  /* ── Step renderers ── */
  const renderStep = () => {
    switch (step) {
      /* ── 0  Welcome ── */
      case 0:
        return (
          <View style={styles.centerWrap}>
            <Sparkles size={40} color={colors.accent} strokeWidth={1.6} />
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
              Welcome to{'\n'}wonder
            </Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
              Learn faster with ideas from books, articles, and videos — all in
              one place.
            </Text>
            <Text style={[styles.heroMuted, { color: colors.textTertiary }]}>
              Bite-sized insights. Real-world lessons. Zero fluff.
            </Text>
          </View>
        );

      /* ── 1  Gender ── */
      case 1:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Tell us about you
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Pick what fits best.
            </Text>
            <View style={styles.stack}>
              {['Male', 'Female'].map((v) => (
                <WidePill
                  key={v}
                  label={v}
                  icon={UserRound}
                  selected={gender === v}
                  onPress={() => setGender(v)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        );

      /* ── 2  Value prop ── */
      case 2:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              What you'll get
            </Text>
            <View style={styles.benefitWrap}>
              {[
                {
                  icon: BookOpen,
                  text: 'Actionable lessons from books, articles, and videos',
                },
                {
                  icon: Film,
                  text: 'Short reels for quick learning, deeper cards when you want',
                },
                {
                  icon: Lightbulb,
                  text: 'Personalized feed based on your interests',
                },
                {
                  icon: Target,
                  text: 'Daily momentum — no doomscrolling',
                },
              ].map((item) => (
                <View
                  key={item.text}
                  style={[
                    styles.benefitRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.surfaceBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.benefitIcon,
                      { backgroundColor: colors.accent + '18' },
                    ]}
                  >
                    <item.icon
                      size={16}
                      color={colors.accent}
                      strokeWidth={2.2}
                    />
                  </View>
                  <Text
                    style={[
                      styles.benefitText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );

      /* ── 3  Interests ── */
      case 3:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              What interests you?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Pick up to 6 topics.
            </Text>
            <View style={styles.chipGrid}>
              {INTEREST_OPTIONS.map((interest) => (
                <ChipPill
                  key={interest}
                  label={interest}
                  selected={interests.includes(interest)}
                  onPress={() => toggleInterest(interest)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        );

      /* ── 4  Personalization ── */
      case 4:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Great taste.{'\n'}Here's what happens next
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              We'll prioritize content around {interestSummary}.
            </Text>
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.surfaceBorder,
                },
              ]}
            >
              <Brain
                size={20}
                color={colors.accent}
                strokeWidth={2}
                style={{ marginBottom: 10 }}
              />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Your Explore feed will blend books, articles, and videos — then
                break them into swipeable idea cards so you learn quickly and go
                deep when you want.
              </Text>
            </View>
          </View>
        );

      /* ── 5  Skill level ── */
      case 5:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Your current level
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              We'll tune complexity for you.
            </Text>
            <View style={styles.stack}>
              {SKILL_OPTIONS.map((v) => (
                <WidePill
                  key={v}
                  label={v}
                  icon={Gauge}
                  selected={skillLevel === v}
                  onPress={() => setSkillLevel(v)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        );

      /* ── 6  Format + goal ── */
      case 6:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Almost done — your rhythm
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Choose how you like to learn.
            </Text>

            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              Preferred format
            </Text>
            <View style={styles.stack}>
              {FORMAT_OPTIONS.map((v) => (
                <WidePill
                  key={v}
                  label={v}
                  icon={
                    v === 'Quick cards'
                      ? FileText
                      : v === 'Mixed format'
                        ? BookOpen
                        : Film
                  }
                  selected={format === v}
                  onPress={() => setFormat(v)}
                  colors={colors}
                />
              ))}
            </View>

            <Text
              style={[
                styles.sectionLabel,
                { color: colors.textTertiary, marginTop: 20 },
              ]}
            >
              Daily target
            </Text>
            <View style={styles.stack}>
              {GOAL_OPTIONS.map((v) => (
                <WidePill
                  key={v}
                  label={v}
                  icon={Goal}
                  selected={goal === v}
                  onPress={() => setGoal(v)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  /* ── Layout ── */
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: STATUS_BAR_HEIGHT + 14 }]}>
        <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.stepChip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.surfaceBorder,
              },
            ]}
          >
            <StepIcon size={12} color={colors.accent} strokeWidth={2.2} />
            <Text style={[styles.stepChipText, { color: colors.textSecondary }]}>
              {STEP_LABELS[step]}
            </Text>
          </View>
          <Text style={[styles.stepCounter, { color: colors.textTertiary }]}>
            {step + 1} / {totalSteps}
          </Text>
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          // Center content for short steps (welcome, gender, skill, personalization)
          [0, 1, 4, 5].includes(step) && styles.scrollContentCentered,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: BOTTOM_INSET }]}>
        {step > 0 ? (
          <TouchableOpacity
            onPress={back}
            activeOpacity={0.8}
            style={[
              styles.backBtn,
              {
                backgroundColor: colors.accent + '12',
                borderColor: colors.accent + '30',
              },
            ]}
          >
            <ChevronLeft size={20} color={colors.accent} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 52 }} />
        )}

        <TouchableOpacity
          onPress={step === totalSteps - 1 ? onComplete : next}
          disabled={!canContinue}
          activeOpacity={0.8}
          style={[
            styles.continueBtn,
            {
              backgroundColor: colors.accent,
              opacity: canContinue ? 1 : 0.3,
            },
          ]}
        >
          <Text style={[styles.continueBtnText, { color: colors.background }]}>
            {step === totalSteps - 1 ? 'Start exploring' : 'Continue'}
          </Text>
          {step < totalSteps - 1 && (
            <ArrowRight size={18} color={colors.background} strokeWidth={2.4} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ────────────────────────── Styles ── */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  /* ── Header ── */
  header: {
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 99,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  stepChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* ── Scroll ── */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  /* ── Welcome hero (step 0) ── */
  centerWrap: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 46,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  heroSub: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 10,
  },
  heroMuted: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  /* ── Standard title / subtitle ── */
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },

  /* ── Wide pills (gender, skill, format, goal) ── */
  stack: {
    gap: 10,
  },
  widePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  widePillText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },

  /* ── Chip pills (interests) ── */
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 7,
  },
  chipPillText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* ── Shared check dot ── */
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDotSmall: {
    width: 16,
    height: 16,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Benefits (step 2) ── */
  benefitWrap: {
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },

  /* ── Info card (step 4) ── */
  infoCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 23,
  },

  /* ── Section label ── */
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 10,
  },

  /* ── Footer ── */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

