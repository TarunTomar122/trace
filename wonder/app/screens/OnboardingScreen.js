import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Line as SvgLine } from 'react-native-svg';
import Constants from 'expo-constants';
import {
  Bell,
  BookOpen,
  Check,
  ChevronLeft,
  ArrowRight,
  CircleHelp,
  FileText,
  Film,
  Goal,
  Heart,
  Sparkles,
  Star,
  UserRound,
  X,
} from 'lucide-react-native';
import { useTheme } from '../ThemeContext';
import businessVideos from '../../data/videos/business.json';
import moneyVideos from '../../data/videos/money.json';
import businessArticle from '../../data/articles/business.json';
import moneyArticle from '../../data/articles/money.json';

const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 24;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH - 90;

/* ────────────────────────── Data ── */

const ALL_TOPICS = [
  'Technology', 'Science', 'Psychology', 'Ideas', 'Business', 'Money',
  'Design', 'Career', 'Self-development', 'Health', 'Cooking', 'Culture',
  'Relationships', 'Society',
];

const TOPIC_EMOJIS = {
  Technology:        '🚀',
  Science:           '🔬',
  Psychology:        '🧠',
  Ideas:             '💡',
  Business:          '💼',
  Money:             '💰',
  Design:            '🎨',
  Career:            '🎓',
  'Self-development':'🌱',
  Health:            '🏃',
  Cooking:           '🍳',
  Culture:           '🎭',
  Relationships:     '❤️',
  Society:           '🌍',
};

const TOPIC_SECTIONS = [
  { label: 'MIND & GROWTH',    topics: ['Psychology', 'Self-development', 'Ideas'] },
  { label: 'BUSINESS & CAREER',topics: ['Business', 'Career', 'Money'] },
  { label: 'SCIENCE & TECH',   topics: ['Technology', 'Science', 'Design'] },
  { label: 'LIFESTYLE',        topics: ['Health', 'Relationships', 'Culture', 'Cooking', 'Society'] },
];

const INTEREST_KEY_TO_TOPIC = {
  technology: 'Technology', science: 'Science', psychology: 'Psychology',
  ideas: 'Ideas', business: 'Business', money: 'Money', design: 'Design',
  career: 'Career', 'self-development': 'Self-development', health: 'Health',
  cooking: 'Cooking', culture: 'Culture', relationships: 'Relationships',
};

function getRecommendedTopicNames(focus, goals) {
  const seen = new Set();
  const result = [];
  const tryAdd = (key) => {
    const name = INTEREST_KEY_TO_TOPIC[key];
    if (name && !seen.has(name)) { seen.add(name); result.push(name); }
  };
  if (focus && FOCUS_INTERESTS[focus]) FOCUS_INTERESTS[focus].forEach(tryAdd);
  (goals || []).forEach((g) => (GOAL_INTERESTS[g] || []).forEach(tryAdd));
  return result.slice(0, 6);
}

const FOCUS_OPTIONS = [
  { id: 'social',  emoji: '📵', label: 'Replace social media' },
  { id: 'reading', emoji: '📖', label: 'Develop a reading habit' },
  { id: 'ideas',   emoji: '💡', label: 'Discover new ideas' },
  { id: 'growth',  emoji: '🌱', label: 'Work on personal growth' },
];

const GOAL_OPTIONS = ['10 min/day', '20 min/day', '30+ min/day'];

function normalizeImageUrl(url) {
  if (!url) return null;
  if (url.includes('images.unsplash.com') && !url.includes('auto=format')) {
    return `${url}&auto=format`;
  }
  return url;
}

function getFallbackImageUrl(url) {
  if (!url) return null;
  if (url.includes('maxresdefault.jpg')) {
    return url.replace('maxresdefault.jpg', 'hqdefault.jpg');
  }
  return null;
}

const SWIPE_PICKS = [
  {
    type: 'book',
    title: 'Atomic Habits',
    by: 'James Clear',
    color: '#F5E6CC',
    cover: 'https://covers.openlibrary.org/b/id/12539702-L.jpg',
  },
  {
    type: 'video',
    title: businessVideos.videos?.[1]?.title || 'How Amazon Makes Money',
    by: businessVideos.videos?.[1]?.creator || 'Polymatter',
    source: businessVideos.videos?.[1]?.platform || 'YouTube',
    color: '#1A1A2E',
    cover: normalizeImageUrl(
      businessVideos.videos?.[1]?.thumbnail_url ||
        businessVideos.videos?.[0]?.thumbnail_url,
    ),
  },
  {
    type: 'book',
    title: 'Sapiens',
    by: 'Yuval Noah Harari',
    color: '#E8DDD0',
    cover: 'https://covers.openlibrary.org/b/id/8634250-L.jpg',
  },
  {
    type: 'article',
    title: businessArticle.article?.title || 'The Myth of the Pivot',
    by: businessArticle.article?.author || 'Sarah Chen',
    source: businessArticle.article?.publication || 'Harvard Business Review',
    color: '#2C3E50',
    cover: normalizeImageUrl(businessArticle.article?.image_url),
  },
  {
    type: 'book',
    title: 'The Psychology of Money',
    by: 'Morgan Housel',
    color: '#FFF3E0',
    cover: 'https://covers.openlibrary.org/b/id/10389354-L.jpg',
  },
  {
    type: 'video',
    title: moneyVideos.videos?.[1]?.title || 'The Psychology of Money',
    by: moneyVideos.videos?.[1]?.creator || 'The Plain Bagel',
    source: moneyVideos.videos?.[1]?.platform || 'YouTube',
    color: '#1B2838',
    cover: normalizeImageUrl(
      moneyVideos.videos?.[1]?.thumbnail_url || moneyVideos.videos?.[0]?.thumbnail_url,
    ),
  },
  {
    type: 'book',
    title: 'Deep Work',
    by: 'Cal Newport',
    color: '#1C1C1C',
    cover: 'https://covers.openlibrary.org/b/id/7988607-L.jpg',
  },
  {
    type: 'article',
    title:
      moneyArticle.article?.title ||
      'Index Funds Won Because Competitors Helped Them',
    by: moneyArticle.article?.author || 'Jason Park',
    source: moneyArticle.article?.publication || 'Bloomberg Markets',
    color: '#1A3C5E',
    cover: normalizeImageUrl(moneyArticle.article?.image_url),
  },
];

const TYPE_ICON_MAP = { book: BookOpen, video: Film, article: FileText };

/* ────────────────────────── Personalized picks ── */
const FOCUS_INTERESTS = {
  social:  ['relationships', 'culture', 'psychology'],
  reading: ['self-development', 'psychology'],
  ideas:   ['ideas', 'technology', 'science'],
  growth:  ['self-development', 'psychology', 'health'],
};
const GOAL_INTERESTS = {
  productivity: ['self-development', 'technology'],
  career:       ['career', 'business'],
  habits:       ['self-development', 'health'],
  money:        ['money', 'business'],
  smarter:      ['science', 'psychology', 'ideas'],
  social:       ['relationships', 'culture'],
};

const TYPE_LABEL = { book: 'Book', video: 'Video', article: 'Article' };

const LIFE_GOALS = [
  { id: 'productivity', label: 'Increase Productivity', emoji: '🔥' },
  { id: 'career',       label: 'Develop Your Career',   emoji: '🥇' },
  { id: 'habits',       label: 'Build Better Habits',   emoji: '🚀' },
  { id: 'money',        label: 'Earn More Money',        emoji: '💰' },
  { id: 'smarter',      label: 'Become Smarter',         emoji: '🧠' },
  { id: 'social',       label: 'Improve Social Life',    emoji: '🎉' },
];

const STEP_LABELS = [
  'Focus',
  'Why it works',
  'Goals',
  'Interests',
  'Picks',
  'Rhythm',
  'Loading',
  'Get started',
  'Source',
  'Plans',
];

const STEP_ICONS = [Sparkles, BookOpen, Goal, CircleHelp, Heart, Goal, Sparkles, Star, CircleHelp, Sparkles];

const HEAR_ABOUT_OPTIONS = [
  'Google Search',
  'From a friend',
  'App Store',
  'YouTube',
  'TikTok',
  'Instagram',
  'Facebook',
  'Twitter / X',
  'Other',
];

/* ────────────────────────── Goal pill (emoji right) ── */
function GoalPill({ label, emoji, selected, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.goalPill,
        {
          backgroundColor: selected ? colors.accent + '18' : colors.surface,
          borderColor: selected ? colors.accent : colors.surfaceBorder,
        },
      ]}
    >
      <Text
        style={[
          styles.goalPillText,
          { color: selected ? colors.textPrimary : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
      <Text style={styles.goalPillEmoji}>{emoji}</Text>
    </TouchableOpacity>
  );
}

/* ────────────────────────── Topic chip (emoji + label) ── */
function TopicChip({ label, selected, onPress, colors }) {
  const emoji = TOPIC_EMOJIS[label] || '📌';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.topicChip,
        {
          backgroundColor: selected ? colors.accent + '18' : colors.surface,
          borderColor: selected ? colors.accent : colors.surfaceBorder,
        },
      ]}
    >
      <Text style={styles.topicChipEmoji}>{emoji}</Text>
      <Text
        style={[
          styles.topicChipLabel,
          { color: selected ? colors.textPrimary : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ────────────────────────── Trend line chart (SVG) ── */
function TrendLine({ color }) {
  return (
    <Svg width="100%" height="52" viewBox="0 0 240 52" preserveAspectRatio="none">
      <SvgLine x1="0" y1="18" x2="240" y2="18" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
      <SvgLine x1="0" y1="34" x2="240" y2="34" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
      <Path
        d="M 0 48 C 50 48 70 38 100 30 S 165 12 240 4"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
  const [focus, setFocus] = useState(null);
  const [lifeGoals, setLifeGoals] = useState([]);
  const [interests, setInterests] = useState([]);
  const [likedItems, setLikedItems] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [goal, setGoal] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [hearAboutUs, setHearAboutUs] = useState(null);
  const [imageUriMap, setImageUriMap] = useState(() =>
    Object.fromEntries(SWIPE_PICKS.map((pick) => [pick.title, pick.cover || null])),
  );

  /* ── Prefetch all swipe card images on mount via expo-image ── */
  useEffect(() => {
    const urls = [];
    SWIPE_PICKS.forEach((pick) => {
      if (pick.cover) {
        urls.push(pick.cover);
        const fallback = getFallbackImageUrl(pick.cover);
        if (fallback) urls.push(fallback);
      }
    });
    if (urls.length) Image.prefetch(urls);
  }, []);

  const totalSteps = 10;
  const progress = ((step + 1) / totalSteps) * 100;
  const StepIcon = STEP_ICONS[step] || Sparkles;

  /* ── Swipe animation ── */
  const pan = useRef(new Animated.ValueXY()).current;
  const cardIndexRef = useRef(0);

  const swipingRef = useRef(false);

  const swipeCard = useCallback(
    (direction) => {
      if (swipingRef.current) return;
      const idx = cardIndexRef.current;
      if (idx >= SWIPE_PICKS.length) return;

      swipingRef.current = true;

      if (direction === 'right') {
        setLikedItems((prev) => [...prev, SWIPE_PICKS[idx].title]);
      }

      const toX =
        direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
      Animated.timing(pan, {
        toValue: { x: toX, y: -40 },
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        cardIndexRef.current += 1;
        setCardIndex(cardIndexRef.current);
        pan.setValue({ x: 0, y: 0 });
        swipingRef.current = false;
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
  const toggleLifeGoal = (id) => {
    setLifeGoals((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleInterest = (value) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    );
  };

  const loaderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 6) {
      loaderAnim.setValue(0);
      Animated.timing(loaderAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      const timer = setTimeout(() => setStep(7), 2200);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(focus);
    if (step === 1) return true;
    if (step === 2) return lifeGoals.length > 0;
    if (step === 3) return interests.length >= 3;
    if (step === 4) return cardIndex >= SWIPE_PICKS.length;
    if (step === 5) return Boolean(goal);
    if (step === 6) return false;
    if (step === 7) return true;
    if (step === 8) return Boolean(hearAboutUs);
    if (step === 9) return true;
    return true;
  }, [step, focus, lifeGoals.length, interests.length, cardIndex, goal, hearAboutUs]);

  const handleCardImageError = useCallback((title) => {
    setImageUriMap((prev) => {
      const currentUrl = prev[title];
      if (!currentUrl) return prev;
      const fallback = getFallbackImageUrl(currentUrl);
      if (fallback && fallback !== currentUrl) {
        return { ...prev, [title]: fallback };
      }
      return { ...prev, [title]: null };
    });
  }, []);

  /* ── Render swipe step (step 3) ── */
  const renderSwipeStep = () => {
    const allDone = cardIndex >= SWIPE_PICKS.length;

    if (allDone) {
      return (
        <View style={styles.swipeDone}>
          <Image
            source={require('../assets/images/happy.png')}
            style={styles.swipeDoneMascot}
            contentFit="contain"
          />
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

    const renderCardContent = (pick, TypeIcon) => (
      <>
        {imageUriMap[pick.title] && (
          <Image
            source={imageUriMap[pick.title]}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
            onError={() => handleCardImageError(pick.title)}
          />
        )}
        <View style={styles.cardOverlay}>
          <View style={styles.typeBadge}>
            {TypeIcon && <TypeIcon size={11} color="#fff" strokeWidth={2.2} />}
            <Text style={styles.typeBadgeText}>
              {TYPE_LABEL[pick.type]}
              {pick.source ? ` · ${pick.source}` : ''}
            </Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {pick.title}
          </Text>
          <Text style={styles.cardAuthor}>{pick.by}</Text>
        </View>
      </>
    );

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
                  backgroundColor: nextPick.color || colors.surface,
                  transform: [{ scale: nextScale }],
                },
              ]}
            >
              {renderCardContent(nextPick, NextTypeIcon)}
            </Animated.View>
          )}

          {/* Top card (draggable) */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.swipeCard,
              {
                backgroundColor: currentPick.color || colors.surface,
                transform: [{ translateX: pan.x }, { rotate }],
                zIndex: 2,
              },
            ]}
          >
            {renderCardContent(currentPick, CurrentTypeIcon)}

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
      /* ── 0  Focus / Goal ── */
      case 0:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              What's your main{'\n'}focus here?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Choose the goal that matters most to you.
            </Text>

            <View style={styles.focusGrid}>
              {FOCUS_OPTIONS.map((opt) => {
                const selected = focus === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setFocus(opt.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.focusCard,
                      {
                        backgroundColor: selected
                          ? colors.accent + '1A'
                          : colors.surface,
                        borderColor: selected
                          ? colors.accent
                          : colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text style={styles.focusEmoji}>{opt.emoji}</Text>
                    <Text
                      style={[
                        styles.focusLabel,
                        {
                          color: selected
                            ? colors.textPrimary
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={next}
              activeOpacity={0.6}
              style={styles.skipLink}
            >
              <Text style={[styles.skipLinkText, { color: colors.textTertiary }]}>
                I'm not sure, skip
              </Text>
            </TouchableOpacity>
          </View>
        );

      /* ── 1  Why it works (informational) ── */
      case 1: {
        const headlineMap = {
          social:  ['Stop the mindless scroll. Short ideas are ',   'actually worth your time.'],
          reading: ['Short, clear & concise ideas are ',             'the best way to grow a reading habit.'],
          ideas:   ['The world\'s best ideas, ',                      'distilled into bite-sized reads.'],
          growth:  ['Small daily insights are ',                     'the best way to work on yourself.'],
        };
        const [hlStart, hlEnd] = headlineMap[focus] ?? ['Short, focused ideas are ', 'the fastest way to learn something new.'];
        return (
          <View style={styles.insightWrap}>
            <Text style={[styles.insightHeadline, { color: colors.textPrimary }]}>
              {hlStart}
              <Text style={{ color: colors.accent }}>{hlEnd}</Text>
            </Text>

            <View style={styles.insightCardOuter}>
              {/* Calendar badge */}
              <View style={[styles.calBadge, { shadowColor: colors.shadowColor }]}>
                <View style={[styles.calTop, { backgroundColor: '#EF4444' }]}>
                  <View style={styles.calPin} />
                  <View style={styles.calPin} />
                </View>
                <View style={[styles.calBottom, { backgroundColor: colors.background }]}>
                  <Text style={[styles.calNum, { color: colors.textPrimary }]}>30</Text>
                </View>
              </View>

              {/* Insight card */}
              <View
                style={[
                  styles.insightCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.surfaceBorder,
                    shadowColor: colors.shadowColor,
                  },
                ]}
              >
                <Text style={[styles.insightCardCat, { color: colors.textTertiary }]}>
                  Skills & Personal Growth
                </Text>
                <TrendLine color={colors.accent} />
                <Text style={[styles.insightCardTitle, { color: colors.textPrimary }]}>
                  The Compound Effect
                </Text>
                <Text style={[styles.insightCardBody, { color: colors.textSecondary }]}>
                  The small, seemingly insignificant action of reading ideas every day
                  will provide huge benefits for learning and skill development.
                </Text>
              </View>
            </View>
          </View>
        );
      }

      /* ── 2  Life goals ── */
      case 2:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              What are some of{'\n'}your goals?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Let's recommend the best content to get you started.
            </Text>
            <View style={styles.stack}>
              {LIFE_GOALS.map((g) => (
                <GoalPill
                  key={g.id}
                  label={g.label}
                  emoji={g.emoji}
                  selected={lifeGoals.includes(g.id)}
                  onPress={() => toggleLifeGoal(g.id)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        );

      /* ── 4  Gender ── */
      /* ── 3  Interests ── */
      case 3: {
        const recommended = getRecommendedTopicNames(focus, lifeGoals);
        return (
          <View style={{ gap: 24 }}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                What topics are you{'\n'}interested in?
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Pick at least 3 and we'll kickstart your journey in brainwave.
              </Text>
            </View>

            {/* Recommended section */}
            {recommended.length > 0 && (
              <View>
                <Text style={[styles.topicSectionLabel, { color: colors.textTertiary }]}>
                  RECOMMENDED FOR YOU
                </Text>
                <View style={styles.topicChipRow}>
                  {recommended.map((topic) => (
                    <TopicChip
                      key={topic}
                      label={topic}
                      selected={interests.includes(topic)}
                      onPress={() => toggleInterest(topic)}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* All sections */}
            {TOPIC_SECTIONS.map((section) => (
              <View key={section.label}>
                <Text style={[styles.topicSectionLabel, { color: colors.textTertiary }]}>
                  {section.label}
                </Text>
                <View style={styles.topicChipRow}>
                  {section.topics.map((topic) => (
                    <TopicChip
                      key={topic}
                      label={topic}
                      selected={interests.includes(topic)}
                      onPress={() => toggleInterest(topic)}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>
            ))}

            {/* Min selection hint */}
            {interests.length > 0 && interests.length < 3 && (
              <Text style={[styles.topicHint, { color: colors.textTertiary }]}>
                Select {3 - interests.length} more to continue
              </Text>
            )}
          </View>
        );
      }

      /* step 4 is handled by renderSwipeStep */

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

      /* ── 8  How did you hear about us ── */
      case 8:
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              How did you hear about us?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              This will help us to better understand you.
            </Text>
            <View style={styles.hearStack}>
              {HEAR_ABOUT_OPTIONS.map((option) => {
                const active = hearAboutUs === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setHearAboutUs(option)}
                    activeOpacity={0.8}
                    style={[
                      styles.hearPill,
                      {
                        backgroundColor: active ? colors.accent + '18' : colors.surface,
                        borderColor: active ? colors.accent : colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.hearPillText,
                        { color: active ? colors.accent : colors.textPrimary, fontWeight: active ? '700' : '500' },
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      /* ── 7  Trial / Get started ── */
      case 7: {
        const TRIAL_TIMELINE = [
          {
            Icon: Check,
            accent: true,
            done: true,
            title: 'Set up brainwave',
            strikethrough: true,
            desc: "You've personalized your experience.",
          },
          {
            Icon: BookOpen,
            accent: true,
            done: false,
            title: 'Today: Dive in for free',
            desc: 'Your personalized feed is ready. Big ideas in 5 minutes a day.',
          },
          {
            Icon: Bell,
            accent: false,
            done: false,
            title: 'Day 5: Learning reminder',
            desc: "We'll nudge you if you miss a day. Habits take time.",
          },
          {
            Icon: Star,
            accent: false,
            done: false,
            title: 'Day 7: Trial ends',
            desc: 'Your brainwave Pro subscription begins. Cancel anytime before then.',
          },
        ];
        return (
          <View>
            <Text style={[styles.title, { color: colors.textPrimary, fontSize: 32 }]}>
              How your free trial works
            </Text>

            <View style={styles.trialTimeline}>
              {TRIAL_TIMELINE.map((item, i) => (
                <View key={i} style={styles.trialStep}>
                  {/* Circle + connector line */}
                  <View style={styles.trialLeft}>
                    <View
                      style={[
                        styles.trialCircle,
                        {
                          backgroundColor: item.accent ? colors.accent : colors.surface,
                          borderColor: item.accent ? colors.accent : colors.surfaceBorder,
                        },
                      ]}
                    >
                      <item.Icon
                        size={16}
                        color={item.accent ? colors.textPrimary : colors.textTertiary}
                        strokeWidth={2.2}
                      />
                    </View>
                    {i < TRIAL_TIMELINE.length - 1 && (
                      <View style={[styles.trialLine, { backgroundColor: colors.surfaceBorder }]} />
                    )}
                  </View>

                  {/* Text */}
                  <View style={styles.trialRight}>
                    <Text
                      style={[
                        styles.trialStepTitle,
                        {
                          color: item.accent ? colors.accent : colors.textPrimary,
                          textDecorationLine: item.strikethrough ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.trialStepDesc, { color: colors.textSecondary }]}>
                      {item.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );
      }

      default:
        return null;
    }
  };

  /* ── Paywall step (step 9) ── */
  const renderPaywallStep = () => {
    const PLANS = [
      {
        id: 'yearly',
        badge: '7-DAY FREE TRIAL  ⭐  BEST VALUE',
        badgeAccent: true,
        label: 'Yearly Plan',
        sublabel: '1 yr',
        priceCross: '$7.99 / mo',
        price: '$3.99 / mo',
        savings: '-50%',
        perks: ['Best price — save 50% vs monthly', 'Cancel anytime in seconds'],
      },
      {
        id: 'monthly',
        badge: '7-DAY FREE TRIAL',
        badgeAccent: false,
        label: 'Monthly Plan',
        sublabel: 'Billed monthly',
        priceCross: null,
        price: '$7.99 / mo',
        savings: null,
        perks: ['Flexible — cancel anytime'],
      },
    ];

    return (
      <View style={[styles.paywallScreen, { backgroundColor: colors.background }]}>
        {/* Top skip */}
        <View style={[styles.paywallTopBar, { paddingTop: STATUS_BAR_HEIGHT + 12 }]}>
          <TouchableOpacity onPress={onComplete} activeOpacity={0.7} style={styles.paywallSkipBtn}>
            <X size={20} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.paywallScroll}
          contentContainerStyle={styles.paywallScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero text */}
          <Text style={[styles.paywallHero, { color: colors.textPrimary }]}>
            <Text style={{ color: colors.accent }}>Try 7 days for free,{'\n'}</Text>
            then $3.99 / month{'\n'}
            <Text style={[styles.paywallHeroSub, { color: colors.textSecondary }]}>
              billed yearly at $47.99
            </Text>
          </Text>

          <TouchableOpacity activeOpacity={0.6} style={styles.viewAllPlans}>
            <Text style={[styles.viewAllPlansText, { color: colors.textSecondary }]}>
              View all plans
            </Text>
          </TouchableOpacity>

          {/* Plan cards */}
          {PLANS.map((plan) => {
            const active = selectedPlan === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setSelectedPlan(plan.id)}
                activeOpacity={0.85}
                style={[
                  styles.planCard,
                  {
                    borderColor: active ? colors.accent : colors.surfaceBorder,
                    backgroundColor: active ? colors.accent + '0D' : colors.surface,
                  },
                ]}
              >
                {/* Badge */}
                <View
                  style={[
                    styles.planBadge,
                    { backgroundColor: active ? colors.accent : colors.surfaceBorder },
                  ]}
                >
                  <Text
                    style={[
                      styles.planBadgeText,
                      { color: active ? colors.textPrimary : colors.textSecondary },
                    ]}
                  >
                    {plan.badge}
                  </Text>
                </View>

                <View style={styles.planCardBody}>
                  {/* Left: radio + label */}
                  <View style={styles.planCardLeft}>
                    <View
                      style={[
                        styles.planRadio,
                        {
                          borderColor: active ? colors.accent : colors.surfaceBorder,
                          backgroundColor: active ? colors.accent : 'transparent',
                        },
                      ]}
                    >
                      {active && <View style={styles.planRadioInner} />}
                    </View>
                    <View style={{ gap: 2 }}>
                      <View style={styles.planLabelRow}>
                        <Text style={[styles.planLabel, { color: colors.textPrimary }]}>
                          {plan.label}
                        </Text>
                        {plan.savings && (
                          <View style={[styles.savingsBadge, { backgroundColor: colors.accent + '22' }]}>
                            <Text style={[styles.savingsBadgeText, { color: colors.accent }]}>
                              {plan.savings}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.planSublabel, { color: colors.textSecondary }]}>
                        {plan.id === 'yearly' ? (
                          <>
                            <Text>1 yr  •  </Text>
                            <Text style={{ textDecorationLine: 'line-through', color: colors.textTertiary }}>$59.99</Text>
                            <Text>  $47.99</Text>
                          </>
                        ) : plan.sublabel}
                      </Text>
                    </View>
                  </View>

                  {/* Right: price */}
                  <View style={styles.planPriceCol}>
                    {plan.priceCross && (
                      <Text style={[styles.planPriceCross, { color: colors.textTertiary }]}>
                        {plan.priceCross}
                      </Text>
                    )}
                    <Text style={[styles.planPrice, { color: active ? colors.accent : colors.textPrimary }]}>
                      {plan.price}
                    </Text>
                  </View>
                </View>

                {/* Perks */}
                <View style={styles.planPerks}>
                  {plan.perks.map((p, i) => (
                    <View key={i} style={styles.planPerkRow}>
                      <Check size={13} color={active ? colors.accent : colors.textTertiary} strokeWidth={2.5} />
                      <Text style={[styles.planPerkText, { color: colors.textSecondary }]}>{p}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer CTA */}
        <View style={[styles.paywallFooter, { paddingBottom: BOTTOM_INSET + 16 }]}>
          <Text style={[styles.paywallTagline, { color: colors.textTertiary }]}>
            Two taps to start, super easy to cancel.
          </Text>
          <TouchableOpacity
            onPress={onComplete}
            activeOpacity={0.85}
            style={[styles.paywallCTA, { backgroundColor: colors.textPrimary }]}
          >
            <Text style={[styles.paywallCTAText, { color: colors.background }]}>
              Start Your 7-Day Free Trial
            </Text>
          </TouchableOpacity>
          <View style={styles.paywallLinks}>
            <TouchableOpacity activeOpacity={0.6}>
              <Text style={[styles.paywallLinkText, { color: colors.textTertiary }]}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={[styles.paywallLinkSep, { color: colors.textTertiary }]}>|</Text>
            <TouchableOpacity activeOpacity={0.6}>
              <Text style={[styles.paywallLinkText, { color: colors.textTertiary }]}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={[styles.paywallLinkSep, { color: colors.textTertiary }]}>|</Text>
            <TouchableOpacity activeOpacity={0.6}>
              <Text style={[styles.paywallLinkText, { color: colors.textTertiary }]}>Restore Purchase</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /* ── Layout ── */
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {step === 9 ? renderPaywallStep() : step === 6 ? (
        <View style={styles.loaderScreen}>
          <View style={styles.loaderTop}>
            <View style={styles.loaderCircleWrap}>
              <Svg width={120} height={120} viewBox="0 0 120 120">
                <Path
                  d="M 60 10 A 50 50 0 0 1 110 60"
                  stroke={colors.surfaceBorder}
                  strokeWidth={6}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    transform: [{
                      rotate: loaderAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '270deg'],
                      }),
                    }],
                  },
                ]}
              >
                <Svg width={120} height={120} viewBox="0 0 120 120">
                  <Path
                    d="M 60 10 A 50 50 0 0 1 110 60"
                    stroke={colors.accent}
                    strokeWidth={6}
                    fill="none"
                    strokeLinecap="round"
                  />
                </Svg>
              </Animated.View>
            </View>
            <Text style={[styles.loaderText, { color: colors.textPrimary }]}>
              We're creating a personalized{'\n'}experience for you
            </Text>
          </View>
        </View>
      ) : (<>
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
      {step === 4 ? (
        <View style={styles.swipeWrapper}>{renderSwipeStep()}</View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>
      )}

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: BOTTOM_INSET + 10 }]}>
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
              {step === totalSteps - 1 ? 'Start Your 7-Day Free Trial' : step === 7 ? "I'm ready" : 'Continue'}
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
      </>)}
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
  /* ── Welcome hero (swipe done state) ── */
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

  /* ── Standard title / subtitle ── */
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
    marginBottom: 10,
  },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 20 },

  /* ── Insight screen (step 1) ── */
  insightWrap: { paddingBottom: 8 },
  insightHeadline: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 36,
  },
  insightCardOuter: {
    position: 'relative',
    marginTop: 52,
  },
  calBadge: {
    position: 'absolute',
    top: -36,
    left: 12,
    zIndex: 10,
    width: 70,
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    shadowOpacity: 0.16,
    elevation: 8,
  },
  calTop: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  calPin: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  calBottom: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNum: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -1,
  },
  insightCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    paddingTop: 48,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.08,
    elevation: 4,
  },
  insightCardCat: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  insightCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 10,
    marginBottom: 6,
  },
  insightCardBody: {
    fontSize: 13,
    lineHeight: 20,
  },

  /* ── Focus goal grid (step 0) ── */
  focusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  focusCard: {
    width: (SCREEN_WIDTH - 48 - 12) / 2,
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  focusEmoji: { fontSize: 42 },
  focusLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  skipLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },

  /* ── Goal pills (emoji right, multi-select) ── */
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  goalPillText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  goalPillEmoji: {
    fontSize: 28,
  },

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

  /* ── Chip pills (legacy, kept for safety) ── */
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

  /* ── Topic chips with emoji (step 5) ── */
  topicSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  topicChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 99,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  topicChipEmoji: { fontSize: 15 },
  topicChipLabel: { fontSize: 14, fontWeight: '600' },
  topicHint: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingBottom: 8,
  },

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
  swipeDoneMascot: { width: 240, height: 240 },

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

  /* ── Hear about us ── */
  hearStack: {
    gap: 10,
    marginTop: 8,
  },
  hearPill: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  hearPillText: {
    fontSize: 15,
  },

  /* ── Loader screen ── */
  loaderScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderTop: {
    alignItems: 'center',
    gap: 28,
  },
  loaderCircleWrap: {
    width: 120,
    height: 120,
  },
  loaderText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 30,
  },

  /* ── Paywall screen ── */
  paywallScreen: {
    flex: 1,
  },
  paywallTopBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  paywallSkipBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallScroll: {
    flex: 1,
  },
  paywallScrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  paywallHero: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 10,
  },
  paywallHeroSub: {
    fontSize: 18,
    fontWeight: '400',
  },
  viewAllPlans: {
    marginBottom: 22,
  },
  viewAllPlansText: {
    fontSize: 14,
  },
  planCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  planBadge: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  planCardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 12,
  },
  planCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  planRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  planLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  planLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  savingsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planSublabel: {
    fontSize: 13,
    marginTop: 2,
  },
  planPriceCol: {
    alignItems: 'flex-end',
  },
  planPriceCross: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  planPerks: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
    gap: 5,
  },
  planPerkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  planPerkText: {
    fontSize: 13,
  },
  paywallFooter: {
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 12,
    alignItems: 'center',
  },
  paywallTagline: {
    fontSize: 13,
  },
  paywallCTA: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallCTAText: {
    fontSize: 16,
    fontWeight: '700',
  },
  paywallLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  paywallLinkText: {
    fontSize: 11,
  },
  paywallLinkSep: {
    fontSize: 11,
  },

  /* Trial screen */
  trialTimeline: {
    marginTop: 36,
    gap: 0,
  },
  trialStep: {
    flexDirection: 'row',
    gap: 16,
  },
  trialLeft: {
    alignItems: 'center',
    width: 40,
  },
  trialCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 6,
  },
  trialRight: {
    flex: 1,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  trialStepTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  trialStepDesc: {
    fontSize: 14,
    lineHeight: 21,
  },
});
