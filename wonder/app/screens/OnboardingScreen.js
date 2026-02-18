import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image as RNImage,
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
  UserRound,
  X,
} from 'lucide-react-native';
import { useTheme } from '../ThemeContext';
import businessVideos from '../../data/videos/business.json';
import moneyVideos from '../../data/videos/money.json';
import businessArticle from '../../data/articles/business.json';
import moneyArticle from '../../data/articles/money.json';
import topBooks from '../../data/top_books_by_interest_enriched.json';
import topArticles from '../../data/top_articles_by_interest.json';
import topVideos from '../../data/top_videos_by_interest.json';

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
    cover: 'https://covers.openlibrary.org/b/id/12539702-L.jpg',
  },
  {
    type: 'video',
    title: businessVideos.videos?.[1]?.title || 'How Amazon Makes Money',
    by: businessVideos.videos?.[1]?.creator || 'Polymatter',
    source: businessVideos.videos?.[1]?.platform || 'YouTube',
    cover: normalizeImageUrl(
      businessVideos.videos?.[1]?.thumbnail_url ||
        businessVideos.videos?.[0]?.thumbnail_url,
    ),
  },
  {
    type: 'book',
    title: 'Sapiens',
    by: 'Yuval Noah Harari',
    cover: 'https://covers.openlibrary.org/b/id/8634250-L.jpg',
  },
  {
    type: 'article',
    title: businessArticle.article?.title || 'The Myth of the Pivot',
    by: businessArticle.article?.author || 'Sarah Chen',
    source: businessArticle.article?.publication || 'Harvard Business Review',
    cover: normalizeImageUrl(businessArticle.article?.image_url),
  },
  {
    type: 'book',
    title: 'The Psychology of Money',
    by: 'Morgan Housel',
    cover: 'https://covers.openlibrary.org/b/id/10389354-L.jpg',
  },
  {
    type: 'video',
    title: moneyVideos.videos?.[1]?.title || 'The Psychology of Money',
    by: moneyVideos.videos?.[1]?.creator || 'The Plain Bagel',
    source: moneyVideos.videos?.[1]?.platform || 'YouTube',
    cover: normalizeImageUrl(
      moneyVideos.videos?.[1]?.thumbnail_url || moneyVideos.videos?.[0]?.thumbnail_url,
    ),
  },
  {
    type: 'book',
    title: 'Deep Work',
    by: 'Cal Newport',
    cover: 'https://covers.openlibrary.org/b/id/7988607-L.jpg',
  },
  {
    type: 'article',
    title:
      moneyArticle.article?.title ||
      'Index Funds Won Because Competitors Helped Them',
    by: moneyArticle.article?.author || 'Jason Park',
    source: moneyArticle.article?.publication || 'Bloomberg Markets',
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

function getPersonalizedPicks(focus, goals) {
  const seen = new Set();
  const interests = [];
  const add = (i) => { if (!seen.has(i)) { seen.add(i); interests.push(i); } };

  if (focus && FOCUS_INTERESTS[focus]) FOCUS_INTERESTS[focus].forEach(add);
  (goals || []).forEach((g) => (GOAL_INTERESTS[g] || []).forEach(add));
  if (!interests.length) add('self-development');

  const picks = [];
  const titles = new Set();

  const tryAdd = (item) => {
    if (!item?.title || titles.has(item.title) || picks.length >= 5) return false;
    titles.add(item.title);
    picks.push(item);
    return true;
  };

  // ~3 books from top interests
  for (const interest of interests) {
    for (const b of (topBooks[interest] || []).slice(0, 3)) {
      if (picks.length >= 3) break;
      tryAdd({ type: 'book', title: b.title, by: b.author, cover: b.cover });
    }
    if (picks.length >= 3) break;
  }

  // 1 article
  for (const interest of interests) {
    const a = (topArticles[interest] || [])[0];
    if (a && tryAdd({ type: 'article', title: a.title, by: a.author, source: a.source, cover: null })) break;
  }

  // 1 video
  for (const interest of interests) {
    const v = (topVideos[interest] || [])[0];
    if (v && tryAdd({ type: 'video', title: v.title, by: v.creator, source: v.source, cover: null })) break;
  }

  // Pad to 5 with more books if needed
  for (const interest of interests) {
    for (const b of (topBooks[interest] || [])) {
      if (picks.length >= 5) break;
      tryAdd({ type: 'book', title: b.title, by: b.author, cover: b.cover });
    }
    if (picks.length >= 5) break;
  }

  return picks;
}
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
  'For you',
  'About you',
  'Interests',
  'Picks',
  'Rhythm',
];

const STEP_ICONS = [Sparkles, BookOpen, Goal, Sparkles, UserRound, CircleHelp, Heart, Goal];

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
  const [recIndex, setRecIndex] = useState(0);
  const [addedRecs, setAddedRecs] = useState([]);
  const [gender, setGender] = useState(null);
  const [interests, setInterests] = useState([]);
  const [likedItems, setLikedItems] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [goal, setGoal] = useState(null);
  const [imageUriMap, setImageUriMap] = useState(() =>
    Object.fromEntries(SWIPE_PICKS.map((pick) => [pick.title, pick.cover || null])),
  );

  /* ── Prefetch all swipe card images on mount ── */
  useEffect(() => {
    SWIPE_PICKS.forEach((pick) => {
      if (pick.cover) {
        RNImage.prefetch(pick.cover).catch(() => {});
        const fallback = getFallbackImageUrl(pick.cover);
        if (fallback) {
          RNImage.prefetch(fallback).catch(() => {});
        }
      }
    });
  }, []);

  const totalSteps = 8;
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
  const toggleLifeGoal = (id) => {
    setLifeGoals((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const [personalizedPicks, setPersonalizedPicks] = useState([]);
  const picksComputedRef = useRef(false);

  // Compute picks exactly once when step 3 is reached, after focus + lifeGoals are set
  useEffect(() => {
    if (step === 3 && !picksComputedRef.current) {
      picksComputedRef.current = true;
      setPersonalizedPicks(getPersonalizedPicks(focus, lifeGoals));
    }
  }, [step, focus, lifeGoals]);

  const handleRecSkip = useCallback(() => setRecIndex((i) => i + 1), []);

  const handleRecAdd = useCallback((picks) => {
    const pick = picks[recIndex];
    if (pick) setAddedRecs((prev) => [...prev, pick.title]);
    setRecIndex((i) => i + 1);
  }, [recIndex]);

  const toggleInterest = (value) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    );
  };

  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(focus);
    if (step === 1) return true;
    if (step === 2) return lifeGoals.length > 0;
    if (step === 3) return recIndex >= personalizedPicks.length && personalizedPicks.length > 0;
    if (step === 4) return Boolean(gender);
    if (step === 5) return interests.length >= 3;
    if (step === 6) return cardIndex >= SWIPE_PICKS.length;
    if (step === 7) return Boolean(goal);
    return true;
  }, [step, focus, lifeGoals.length, recIndex, personalizedPicks.length, gender, interests.length, cardIndex, goal]);

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
              key={`next-${nextPick.title}`}
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
              {imageUriMap[nextPick.title] ? (
                <Image
                  source={imageUriMap[nextPick.title]}
                  recyclingKey={`next-${nextPick.title}`}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={120}
                  onError={() => handleCardImageError(nextPick.title)}
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
            key={`current-${currentPick.title}`}
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
            {imageUriMap[currentPick.title] ? (
              <Image
                source={imageUriMap[currentPick.title]}
                recyclingKey={`current-${currentPick.title}`}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
                onError={() => handleCardImageError(currentPick.title)}
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

  /* ── Render personalized recs step (step 3) ── */
  const renderRecsStep = () => {
    const allDone = recIndex >= personalizedPicks.length;

    if (allDone && personalizedPicks.length > 0) {
      return (
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Ok, here are some{'\n'}recommendations
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Pick what you'd like to explore first.
          </Text>

          <View style={{ flex: 1, position: 'relative' }}>
            {/* Stack shadow card behind */}
            <View
              style={[
                styles.recDoneBgCard,
                { backgroundColor: colors.surface },
              ]}
            />
            {/* Main done card */}
            <View
              style={[
                styles.recCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: 'transparent',
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <View style={styles.recDoneCheckCircle}>
                <Check size={26} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={[styles.recDoneLabel, { color: colors.textPrimary }]}>
                We saved your picks.{'\n'}You'll see them soon.
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // Loading state while picks are being computed
    if (personalizedPicks.length === 0) {
      return (
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Ok, here are some{'\n'}recommendations
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Pick what you'd like to explore first.
          </Text>
          <View style={{ flex: 1 }} />
        </View>
      );
    }

    const pick = personalizedPicks[recIndex];
    const TypeIcon = TYPE_ICON_MAP[pick.type] || BookOpen;
    const typeLabel = TYPE_LABEL[pick.type] || 'Book';
    const byPrefix = pick.type === 'video' ? 'By ' : 'Written by ';

    return (
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Ok, here are some{'\n'}recommendations
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Pick what you'd like to explore first.
        </Text>

        {/* Progress dots */}
        <View style={styles.recDots}>
          {personalizedPicks.map((_, i) => (
            <View
              key={i}
              style={[
                styles.recDot,
                {
                  backgroundColor:
                    i < recIndex
                      ? colors.accent
                      : i === recIndex
                        ? colors.textPrimary
                        : colors.surface,
                  width: i === recIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Card */}
        <View
          style={[
            styles.recCard,
            {
              backgroundColor: colors.background,
              borderColor: colors.surfaceBorder,
              shadowColor: colors.shadowColor,
            },
          ]}
        >
          {/* Cover area */}
          <View style={styles.recImageArea}>
            <View style={[styles.recGlow, { backgroundColor: colors.accent + '25' }]} />
            {pick.cover ? (
              <Image
                source={pick.cover}
                style={styles.recCoverImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.recCoverPlaceholder, { backgroundColor: colors.surface }]}>
                <TypeIcon size={52} color={colors.textMuted} strokeWidth={1.5} />
              </View>
            )}
          </View>

          {/* Meta */}
          <View style={[styles.recTypeBadge, { backgroundColor: colors.surface }]}>
            <TypeIcon size={11} color={colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.recTypeBadgeText, { color: colors.textSecondary }]}>
              {typeLabel}
              {pick.source ? ` · ${pick.source}` : ''}
            </Text>
          </View>
          <Text style={[styles.recCardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {pick.title}
          </Text>
          <Text style={[styles.recCardAuthor, { color: colors.textTertiary }]}>
            {byPrefix}{pick.by}
          </Text>
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
      case 4:
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

      /* ── 5  Interests ── */
      case 5: {
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

      /* step 6 is handled by renderSwipeStep */

      /* ── 7  Daily target ── */
      case 7:
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
      {step === 6 ? (
        <View style={styles.swipeWrapper}>{renderSwipeStep()}</View>
      ) : step === 3 ? (
        <View style={styles.recsWrapper}>{renderRecsStep()}</View>
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
      {step === 3 && recIndex < personalizedPicks.length ? (
        <View style={[styles.footer, { paddingBottom: BOTTOM_INSET + 10 }]}>
          <TouchableOpacity
            onPress={handleRecSkip}
            activeOpacity={0.8}
            style={styles.skipRecBtn}
          >
            <X size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.skipRecText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleRecAdd(personalizedPicks)}
            activeOpacity={0.8}
            style={styles.addRecBtn}
          >
            <Check size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addRecText}>Add</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
              {step === totalSteps - 1 ? 'Start exploring' : 'Continue'}
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
      )}
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
    marginTop: 16,
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

  /* ── Personalized recs step (step 3) ── */
  recsWrapper: { flex: 1 },
  recDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  recDot: { height: 8, borderRadius: 4 },
  recCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    shadowOpacity: 0.08,
    elevation: 8,
  },
  recImageArea: {
    width: 200,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  recGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  recCoverImage: {
    width: 140,
    height: 200,
    borderRadius: 10,
  },
  recCoverPlaceholder: {
    width: 140,
    height: 200,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    marginBottom: 10,
    alignSelf: 'center',
  },
  recTypeBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  recDoneBgCard: {
    position: 'absolute',
    top: -10,
    left: 12,
    right: 12,
    bottom: 0,
    borderRadius: 24,
    opacity: 0.45,
  },
  recDoneCheckCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  recDoneLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },

  recCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 26,
  },
  recCardAuthor: { fontSize: 13, fontWeight: '500', textAlign: 'center' },

  /* Skip / Add rec buttons */
  skipRecBtn: {
    flex: 1,
    height: 52,
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
  },
  skipRecText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  addRecBtn: {
    flex: 1,
    height: 52,
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
  },
  addRecText: { color: '#fff', fontSize: 16, fontWeight: '700' },

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
