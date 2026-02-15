import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  PanResponder,
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
  Goal,
  Heart,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react-native';
import { useTheme } from '../ThemeContext';

const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 24;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH - 90;

/* ────────────────────────── Data ── */

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

const SWIPE_PICKS = [
  {
    type: 'book',
    title: 'Atomic Habits',
    by: 'James Clear',
    cover: 'https://covers.openlibrary.org/b/id/12539702-L.jpg',
  },
  {
    type: 'video',
    title: 'How Great Leaders Inspire Action',
    by: 'Simon Sinek',
    source: 'TED',
    cover:
      'https://pi.tedcdn.com/r/pe.tedcdn.com/images/ted/04916ee6e81065c8333e6546184af512eee37bbe_2880x1620.jpg',
  },
  {
    type: 'book',
    title: 'Sapiens',
    by: 'Yuval Noah Harari',
    cover: 'https://covers.openlibrary.org/b/id/8634250-L.jpg',
  },
  {
    type: 'article',
    title: 'The Myth of the Pivot',
    by: 'Sarah Chen',
    source: 'Harvard Business Review',
    cover:
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80',
  },
  {
    type: 'book',
    title: 'The Psychology of Money',
    by: 'Morgan Housel',
    cover: 'https://covers.openlibrary.org/b/id/10389354-L.jpg',
  },
  {
    type: 'video',
    title: 'A Guide to Self-Love for Skeptics',
    by: 'Dan Harris',
    source: 'TED',
    cover:
      'https://talkstar-assets.s3.amazonaws.com/production/talks/talk_147528/638645c8-7137-40c5-9284-249071157dc3/DanHarris_2025V-embed.jpg',
  },
  {
    type: 'book',
    title: 'Deep Work',
    by: 'Cal Newport',
    cover: 'https://covers.openlibrary.org/b/id/7988607-L.jpg',
  },
  {
    type: 'article',
    title: 'Index Funds Won Because Competitors Helped Them',
    by: 'Jason Park',
    source: 'Bloomberg Markets',
    cover:
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80',
  },
];

const TYPE_ICON_MAP = { book: BookOpen, video: Film, article: FileText };
const TYPE_LABEL = { book: 'Book', video: 'Video', article: 'Article' };

const STEP_LABELS = [
  'Welcome',
  'About you',
  'Interests',
  'Picks',
  'Personalization',
  'Rhythm',
];

const STEP_ICONS = [Sparkles, UserRound, CircleHelp, Heart, Brain, Goal];

/* ────────────────────────── Wide pill ── */
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

/* ────────────────────────── Chip pill ── */
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
  const [likedItems, setLikedItems] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [goal, setGoal] = useState(null);

  /* ── Prefetch all swipe card images on mount ── */
  useEffect(() => {
    SWIPE_PICKS.forEach((pick) => {
      if (pick.cover) {
        Image.prefetch(pick.cover).catch(() => {});
      }
    });
  }, []);

  const totalSteps = 6;
  const progress = ((step + 1) / totalSteps) * 100;
  const StepIcon = STEP_ICONS[step] || Sparkles;

  /* ── Swipe animation ── */
  const pan = useRef(new Animated.ValueXY()).current;
  const cardIndexRef = useRef(0);

  const swipeCard = useCallback(
    (direction) => {
      const idx = cardIndexRef.current;
      if (idx >= SWIPE_PICKS.length) return;

      if (direction === 'right') {
        setLikedItems((prev) => [...prev, SWIPE_PICKS[idx].title]);
      }

      const toX =
        direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
      Animated.timing(pan, {
        toValue: { x: toX, y: -40 },
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        pan.setValue({ x: 0, y: 0 });
        cardIndexRef.current += 1;
        setCardIndex(cardIndexRef.current);
      });
    },
    [pan],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, { dx }) => {
        if (dx > SWIPE_THRESHOLD) {
          swipeCard('right');
        } else if (dx < -SWIPE_THRESHOLD) {
          swipeCard('left');
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 7,
            tension: 40,
          }).start();
        }
      },
    }),
  ).current;

  /* ── Swipe interpolations ── */
  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-12deg', '0deg', '12deg'],
  });
  const likeOpacity = pan.x.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.15],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const nopeOpacity = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.15, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const nextScale = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [1, 0.92, 1],
    extrapolate: 'clamp',
  });

  /* ── Helpers ── */
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
    if (step === 2) return interests.length > 0;
    if (step === 3) return cardIndex >= SWIPE_PICKS.length;
    if (step === 5) return Boolean(goal);
    return true;
  }, [step, gender, interests.length, cardIndex, goal]);

  /* ── Render swipe step (step 3) ── */
  const renderSwipeStep = () => {
    const allDone = cardIndex >= SWIPE_PICKS.length;

    if (allDone) {
      return (
        <View style={styles.swipeDone}>
          <Sparkles size={36} color={colors.accent} strokeWidth={1.6} />
          <Text
            style={[
              styles.heroTitle,
              { color: colors.textPrimary, fontSize: 28, marginTop: 16 },
            ]}
          >
            Great taste!
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            You liked {likedItems.length} out of {SWIPE_PICKS.length}.{'\n'}
            We'll use this to shape your feed.
          </Text>
        </View>
      );
    }

    const currentPick = SWIPE_PICKS[cardIndex];
    const nextPick = SWIPE_PICKS[cardIndex + 1];
    const CurrentTypeIcon = TYPE_ICON_MAP[currentPick.type];
    const NextTypeIcon = nextPick ? TYPE_ICON_MAP[nextPick.type] : null;

    return (
      <View style={{ flex: 1 }}>
        {/* Card stack area */}
        <View style={styles.cardStack}>
          {/* Next card (behind, scales up as top card is dragged) */}
          {nextPick && (
            <Animated.View
              style={[
                styles.swipeCard,
                {
                  backgroundColor: nextPick.cover
                    ? colors.surface
                    : nextPick.color,
                  transform: [{ scale: nextScale }],
                },
              ]}
            >
              {nextPick.cover ? (
                <Image
                  source={{ uri: nextPick.cover }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderBg}>
                  {NextTypeIcon && (
                    <NextTypeIcon
                      size={80}
                      color="rgba(255,255,255,0.1)"
                      strokeWidth={1.2}
                    />
                  )}
                </View>
              )}
            </Animated.View>
          )}

          {/* Top card (draggable) */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.swipeCard,
              {
                backgroundColor: currentPick.cover
                  ? colors.surface
                  : currentPick.color,
                transform: [{ translateX: pan.x }, { rotate }],
                zIndex: 2,
              },
            ]}
          >
            {/* Background image or colored placeholder */}
            {currentPick.cover ? (
              <Image
                source={{ uri: currentPick.cover }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholderBg}>
                <CurrentTypeIcon
                  size={80}
                  color="rgba(255,255,255,0.1)"
                  strokeWidth={1.2}
                />
              </View>
            )}

            {/* LIKE stamp */}
            <Animated.View
              style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}
            >
              <View style={[styles.stampBorder, { borderColor: '#4ADE80' }]}>
                <Text style={[styles.stampText, { color: '#4ADE80' }]}>
                  LIKE
                </Text>
              </View>
            </Animated.View>

            {/* NOPE stamp */}
            <Animated.View
              style={[
                styles.stamp,
                styles.nopeStamp,
                { opacity: nopeOpacity },
              ]}
            >
              <View style={[styles.stampBorder, { borderColor: '#F87171' }]}>
                <Text style={[styles.stampText, { color: '#F87171' }]}>
                  NOPE
                </Text>
              </View>
            </Animated.View>

            {/* Bottom info overlay */}
            <View style={styles.cardOverlay}>
              <View style={styles.typeBadge}>
                <CurrentTypeIcon size={11} color="#fff" strokeWidth={2.2} />
                <Text style={styles.typeBadgeText}>
                  {TYPE_LABEL[currentPick.type]}
                  {currentPick.source ? ` · ${currentPick.source}` : ''}
                </Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {currentPick.title}
              </Text>
              <Text style={styles.cardAuthor}>{currentPick.by}</Text>
            </View>
          </Animated.View>
        </View>

        {/* Action buttons */}
        <View style={styles.swipeActions}>
          <TouchableOpacity
            onPress={() => swipeCard('left')}
            activeOpacity={0.7}
            style={[styles.actionBtn, { borderColor: '#F87171' + '40' }]}
          >
            <X size={26} color="#F87171" strokeWidth={2.5} />
          </TouchableOpacity>

          <Text style={[styles.swipeCounter, { color: colors.textTertiary }]}>
            {cardIndex + 1} / {SWIPE_PICKS.length}
          </Text>

          <TouchableOpacity
            onPress={() => swipeCard('right')}
            activeOpacity={0.7}
            style={[styles.actionBtn, { borderColor: colors.accent + '40' }]}
          >
            <Heart size={26} color={colors.accent} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ── Step renderers (non-swipe steps) ── */
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

      /* step 3 is handled by renderSwipeStep */

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
        <View
          style={[styles.progressTrack, { backgroundColor: colors.surface }]}
        >
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
            <Text
              style={[styles.stepChipText, { color: colors.textSecondary }]}
            >
              {STEP_LABELS[step]}
            </Text>
          </View>
          <Text style={[styles.stepCounter, { color: colors.textTertiary }]}>
            {step + 1} / {totalSteps}
          </Text>
        </View>
      </View>

      {/* ── Content ── */}
      {step === 3 ? (
        <View style={styles.swipeWrapper}>{renderSwipeStep()}</View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            step === 0 && styles.scrollContentCentered,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>
      )}

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
          <Text
            style={[styles.continueBtnText, { color: colors.background }]}
          >
            {step === totalSteps - 1
              ? 'Start exploring'
              : step === 0
                ? 'Get started'
                : 'Continue'}
          </Text>
          {step < totalSteps - 1 && (
            <ArrowRight
              size={18}
              color={colors.background}
              strokeWidth={2.4}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ────────────────────────── Styles ── */
const styles = StyleSheet.create({
  screen: { flex: 1 },

  /* ── Header ── */
  header: { paddingHorizontal: 24, paddingBottom: 4 },
  progressTrack: { height: 4, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
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
  stepChipText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  stepCounter: { fontSize: 12, fontWeight: '500' },

  /* ── Scroll (non-swipe steps) ── */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  scrollContentCentered: { flexGrow: 1, justifyContent: 'center' },

  /* ── Welcome hero ── */
  centerWrap: { alignItems: 'center' },
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
  heroMuted: { fontSize: 13, lineHeight: 20, textAlign: 'center' },

  /* ── Standard title / subtitle ── */
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
    marginBottom: 10,
  },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 20 },

  /* ── Wide pills ── */
  stack: { gap: 10 },
  widePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  widePillText: { flex: 1, fontSize: 16, fontWeight: '600' },

  /* ── Chip pills ── */
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 7,
  },
  chipPillText: { fontSize: 14, fontWeight: '600' },

  /* ── Check dots ── */
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

  /* ── Swipe step ── */
  swipeWrapper: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  cardStack: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  swipeCard: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  placeholderBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Stamps */
  stamp: { position: 'absolute', top: 30, zIndex: 10 },
  likeStamp: { left: 16, transform: [{ rotate: '-15deg' }] },
  nopeStamp: { right: 16, transform: [{ rotate: '15deg' }] },
  stampBorder: {
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stampText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
  },

  /* Card bottom overlay */
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 64,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  cardAuthor: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },

  /* Action buttons */
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 16,
  },
  actionBtn: {
    width: 58,
    height: 58,
    borderRadius: 99,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeCounter: { fontSize: 14, fontWeight: '600', minWidth: 40, textAlign: 'center' },

  /* Swipe done */
  swipeDone: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* ── Info card ── */
  infoCard: { borderWidth: 1, borderRadius: 18, padding: 20 },
  infoText: { fontSize: 14, lineHeight: 23 },

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
  continueBtnText: { fontSize: 16, fontWeight: '700' },
});
