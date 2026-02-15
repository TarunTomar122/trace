import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
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
  Goal,
  Sparkles,
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

const GOAL_OPTIONS = ['10 min/day', '20 min/day', '30+ min/day'];

const BOOK_PICKS = [
  { title: 'Atomic Habits', author: 'James Clear', cover: 'https://covers.openlibrary.org/b/id/12539702-L.jpg' },
  { title: 'Sapiens', author: 'Yuval Noah Harari', cover: 'https://covers.openlibrary.org/b/id/8634250-L.jpg' },
  { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', cover: 'https://covers.openlibrary.org/b/id/13290711-L.jpg' },
  { title: 'The Psychology of Money', author: 'Morgan Housel', cover: 'https://covers.openlibrary.org/b/id/10389354-L.jpg' },
  { title: 'Zero to One', author: 'Peter Thiel', cover: 'https://covers.openlibrary.org/b/id/9002334-L.jpg' },
  { title: 'Deep Work', author: 'Cal Newport', cover: 'https://covers.openlibrary.org/b/id/7988607-L.jpg' },
  { title: 'A Brief History of Time', author: 'Stephen Hawking', cover: 'https://covers.openlibrary.org/b/id/10432365-L.jpg' },
  { title: 'The Lean Startup', author: 'Eric Ries', cover: 'https://covers.openlibrary.org/b/id/7104760-L.jpg' },
];

const STEP_LABELS = [
  'Welcome',
  'About you',
  'Interests',
  'Books',
  'Personalization',
  'Rhythm',
];

const STEP_ICONS = [
  Sparkles,
  UserRound,
  CircleHelp,
  BookOpen,
  Brain,
  Goal,
];

/* ────────────────────────── Wide pill (gender / skill / goal) ── */
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
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [goal, setGoal] = useState(null);

  const totalSteps = 6;
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

  const toggleBook = (title) => {
    setSelectedBooks((prev) =>
      prev.includes(title)
        ? prev.filter((x) => x !== title)
        : [...prev, title],
    );
  };

  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(gender);
    if (step === 2) return interests.length > 0;
    if (step === 3) return selectedBooks.length > 0;
    if (step === 5) return Boolean(goal);
    return true;
  }, [step, gender, interests.length, selectedBooks.length, goal]);

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

      /* ── 2  Interests ── */
      case 2:
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

      /* ── 3  Book picks ── */
      case 3:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Any of these catch{'\n'}your eye?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Tap the ones you'd want to learn from.
            </Text>
            <View style={styles.bookGrid}>
              {BOOK_PICKS.map((book) => {
                const selected = selectedBooks.includes(book.title);
                return (
                  <TouchableOpacity
                    key={book.title}
                    onPress={() => toggleBook(book.title)}
                    activeOpacity={0.8}
                    style={[
                      styles.bookCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: selected
                          ? colors.accent
                          : colors.surfaceBorder,
                      },
                    ]}
                  >
                    <View style={styles.bookCoverWrap}>
                      <Image
                        source={{ uri: book.cover }}
                        style={styles.bookCover}
                        resizeMode="cover"
                      />
                      {selected && (
                        <View
                          style={[
                            styles.bookCheck,
                            { backgroundColor: colors.accent },
                          ]}
                        >
                          <Check
                            size={10}
                            color={colors.background}
                            strokeWidth={3}
                          />
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.bookTitle,
                        {
                          color: selected
                            ? colors.textPrimary
                            : colors.textSecondary,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {book.title}
                    </Text>
                    <Text
                      style={[
                        styles.bookAuthor,
                        { color: colors.textTertiary },
                      ]}
                      numberOfLines={1}
                    >
                      {book.author}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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

      /* ── 5  Daily target ── */
      case 5:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Almost done — your rhythm
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              How much time do you want to spend learning?
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
          // Only center the welcome hero — all form steps start from top
          step === 0 && styles.scrollContentCentered,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: BOTTOM_INSET + 10 }]}>
        {step > 0 && (
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
            {step === totalSteps - 1 ? 'Start exploring' : step === 0 ? 'Get started' : 'Continue'}
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

  /* ── Wide pills (gender, skill, goal) ── */
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

  /* ── Book picks grid ── */
  bookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bookCard: {
    width: (SCREEN_WIDTH - 48 - 12) / 2,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  bookCoverWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 0.65,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  bookCover: {
    width: '100%',
    height: '100%',
  },
  bookCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 2,
  },
  bookAuthor: {
    fontSize: 11,
    textAlign: 'center',
  },

  /* ── Info card (personalization) ── */
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

