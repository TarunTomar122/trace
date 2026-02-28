import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BookOpen, FileText, Film, Bell, X, Check } from 'lucide-react-native';
import { useTheme } from '../ThemeContext';
import { getPage, getTotalCount, getTypeCount, PAGE_SIZE } from '../data';
import { useMascot } from '../lib/MascotContext';
import { DEV_MODE } from '../lib/devConfig';
import { getNextGoal } from '../lib/dailyGoals';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Darken a hex color for better text accessibility
const getAccessibleTextColor = (hex) => {
  if (!hex) return '#666';
  hex = hex.replace('#', '');

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // If color is light, darken it significantly
  if (luminance > 0.5) {
    const darken = 0.45; // 45% darker
    const newR = Math.max(0, Math.floor(r * (1 - darken)));
    const newG = Math.max(0, Math.floor(g * (1 - darken)));
    const newB = Math.max(0, Math.floor(b * (1 - darken)));
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  // Color is already dark enough
  return hex.startsWith('#') ? hex : `#${hex}`;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;

const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_IMAGE_HEIGHT = 360;

// Generate consistent Picsum image for items without covers
const getFallbackCover = (id) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash) % 1000;
  return `https://picsum.photos/seed/${seed}/${Math.round(CARD_WIDTH * 2)}/${Math.round(CARD_IMAGE_HEIGHT * 2)}`;
};

const TYPE_ICON = {
  book: BookOpen,
  article: FileText,
  video: Film,
};

const TYPE_LABEL = {
  book: 'Book',
  article: 'Article',
  video: 'Video',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'book', label: 'Books', Icon: BookOpen },
  { key: 'article', label: 'Articles', Icon: FileText },
  { key: 'video', label: 'Videos', Icon: Film },
];

const END_QUOTES = [
  { emoji: '🌱', text: 'Ideas need time to take root.', sub: 'Let today\'s insights settle in.' },
  { emoji: '🧠', text: 'Your brain processes while you rest.', sub: 'Come back tomorrow for more.' },
  { emoji: '✨', text: 'Quality over quantity.', sub: 'A few ideas deeply understood beat many skimmed.' },
  { emoji: '🎯', text: 'You\'ve done enough for today.', sub: 'Consistency beats intensity.' },
  { emoji: '💭', text: 'Give your mind space to wonder.', sub: 'The best ideas come when you\'re not trying.' },
  { emoji: '🌅', text: 'See you tomorrow!', sub: 'New ideas await.' },
];

function FilterBar({ active, onChange, colors }) {
  return (
    <View style={styles.filterBar}>
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        const count = getTypeCount(f.key);
        if (f.key !== 'all' && count === 0) return null;

        return (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterPill,
              {
                backgroundColor: isActive
                  ? colors.accent + '18'
                  : colors.surface,
                borderColor: isActive
                  ? colors.accent + '40'
                  : colors.surfaceBorder,
                borderWidth: 1,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => onChange(f.key)}
          >
            {f.Icon && (
              <f.Icon
                size={12}
                color={isActive ? colors.accent : colors.textTertiary}
                strokeWidth={2}
              />
            )}
            <Text
              style={[
                styles.filterText,
                {
                  color: isActive ? colors.accent : colors.textTertiary,
                },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function WeekTracker({ activity, colors }) {
  const today = new Date();
  const currentDayIndex = today.getDay(); // 0 = Sunday

  // Get the dates for this week (Sunday to Saturday)
  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayIndex);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Check if user was active on a given date
  const wasActiveOnDate = (date) => {
    // Check if this day is within the current streak
    const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));
    if (daysAgo < 0) return false; // Future
    if (daysAgo === 0) {
      // Today - check if they've read today
      return activity.todayDate === today.toDateString() && activity.cardsReadToday > 0;
    }
    // Past days - check if within streak (simplified)
    return daysAgo < (activity.currentStreak || 0);
  };

  return (
    <View style={[styles.weekTrackerCard, { backgroundColor: colors.surface }]}>
      <View style={styles.weekDays}>
        {WEEK_DAYS.map((day, index) => {
          const isToday = index === currentDayIndex;
          const isPast = index < currentDayIndex;
          const isFuture = index > currentDayIndex;
          const wasActive = wasActiveOnDate(weekDates[index]);

          return (
            <View
              key={index}
              style={[
                styles.weekDayCircle,
                isToday && { backgroundColor: colors.accent },
                isPast && wasActive && { backgroundColor: colors.accent },
                isPast && !wasActive && { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.surfaceBorder },
                isFuture && { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.surfaceBorder },
              ]}
            >
              {isPast && wasActive ? (
                <Check size={14} color="#fff" strokeWidth={3} />
              ) : isToday ? (
                <Text style={[styles.dayLetter, { color: colors.background, fontWeight: '700' }]}>
                  {day}
                </Text>
              ) : (
                <Text style={[styles.dayLetter, { color: colors.textMuted }]}>
                  {day}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MotivationCallout({ goal, onDismiss }) {
  if (!goal) return null;

  const isComplete = goal.completed;
  const bgColor = isComplete ? '#4CAF50' : '#FF8C42';
  const progressText = `${goal.progress}/${goal.target}`;

  return (
    <View style={[styles.motivationBanner, { backgroundColor: bgColor }]}>
      <Text style={styles.motivationEmoji}>
        {isComplete ? '🎉' : goal.emoji}
      </Text>
      <View style={styles.motivationContent}>
        <Text style={styles.motivationLabel}>
          {isComplete ? 'GOAL COMPLETE!' : goal.label}
        </Text>
        <Text style={styles.motivationText}>
          {isComplete ? 'Nice work today!' : goal.title}
        </Text>
      </View>
      {!isComplete && (
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>{progressText}</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

function FeedCard({ item, onPress, colors, itemHeight }) {
  const IconComponent = TYPE_ICON[item.type] || BookOpen;

  return (
    <View style={[styles.cardContainer, { height: itemHeight }]}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
          },
        ]}
        activeOpacity={0.92}
        onPress={() => onPress(item)}
      >
        {/* Cover image */}
        <Image
          source={{ uri: (item.cover && item.cover.length > 0) ? item.cover : getFallbackCover(item.id) }}
          style={[styles.cardImage, { backgroundColor: colors.coverPlaceholder }]}
          resizeMode="cover"
        />

        {/* Content */}
        <View style={styles.cardContent}>
          {/* Pills row */}
          <View style={styles.pillRow}>
            <View style={[styles.typePill, { backgroundColor: colors.background }]}>
              <IconComponent size={11} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.typeText, { color: colors.textSecondary }]}>
                {TYPE_LABEL[item.type]}
              </Text>
            </View>
            <View style={[styles.interestPill, { backgroundColor: item.color + '18' }]}>
              <Text style={[styles.interestText, { color: getAccessibleTextColor(item.color) }]}>
                {item.interest.replace('-', ' ')}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>

          {/* Subtitle */}
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.subtitle}
          </Text>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={[styles.ideaChip, { backgroundColor: item.color + '12' }]}>
              <Text style={[styles.ideaChipText, { color: getAccessibleTextColor(item.color) }]}>
                {item.cardCount} ideas
              </Text>
            </View>
            <Text style={[styles.readTime, { color: colors.textMuted }]}>
              {Math.ceil(item.cardCount * 0.5)} min read
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function LoadMoreCard({ onLoadMore, colors, remaining, itemHeight }) {
  return (
    <View style={[styles.cardContainer, { height: itemHeight }]}>
      <View style={styles.loadMoreInner}>
        <Text style={styles.loadMoreEmoji}>✨</Text>
        <Text style={[styles.loadMoreTitle, { color: colors.textPrimary }]}>
          Ready for more?
        </Text>
        <Text style={[styles.loadMoreSub, { color: colors.textTertiary }]}>
          {remaining} more {remaining === 1 ? 'item' : 'items'} to discover
        </Text>
        <TouchableOpacity
          style={[styles.loadMoreButton, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={onLoadMore}
        >
          <Text
            style={[styles.loadMoreButtonText, { color: colors.background }]}
          >
            Load more
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EndOfFeedCard({ colors, itemHeight }) {
  // Pick a quote based on today's date for consistency
  const today = new Date().getDate();
  const quote = END_QUOTES[today % END_QUOTES.length];

  return (
    <View style={[styles.cardContainer, { height: itemHeight }]}>
      <View style={styles.endOfFeedInner}>
        <Text style={styles.endOfFeedEmoji}>{quote.emoji}</Text>
        <Text style={[styles.endOfFeedTitle, { color: colors.textPrimary }]}>
          {quote.text}
        </Text>
        <Text style={[styles.endOfFeedSub, { color: colors.textTertiary }]}>
          {quote.sub}
        </Text>
        <View style={[styles.endOfFeedDivider, { backgroundColor: colors.surfaceBorder }]} />
        <Text style={[styles.endOfFeedHint, { color: colors.textMuted }]}>
          That's all for today
        </Text>
      </View>
    </View>
  );
}

export default function BookFeed() {
  const navigation = useNavigation();
  const listRef = useRef(null);
  const prefetchedUrisRef = useRef(new Set());
  const [page, setPage] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [filter, setFilter] = useState('all');
  const [dailyGoal, setDailyGoal] = useState(null);
  const [goalDismissed, setGoalDismissed] = useState(false);
  const { colors } = useTheme();
  const { mascotImage, activity } = useMascot();

  const loadGoal = useCallback(async () => {
    const goal = await getNextGoal();
    setDailyGoal(goal);
    setGoalDismissed(false); // Reset on each screen focus
  }, []);

  const handleDismissGoal = useCallback(() => {
    setGoalDismissed(true); // Only hides for this session
  }, []);

  // Load daily goal on mount and when returning to screen
  useFocusEffect(
    useCallback(() => {
      loadGoal();
    }, [loadGoal])
  );

  const todayReads = activity.todayDate === new Date().toDateString() ? activity.cardsReadToday : 0;

  const totalCount = useMemo(() => getTotalCount(filter), [filter]);
  const items = useMemo(() => getPage(page, filter), [page, filter]);
  const hasMore = items.length < totalCount;
  const remaining = totalCount - items.length;

  const feedData = useMemo(() => {
    if (hasMore) {
      return [...items, { id: '__load_more__', _isLoadMore: true }];
    }
    return items;
  }, [items, hasMore]);

  const prefetchCovers = useCallback((list) => {
    list.forEach((entry) => {
      if (!entry?.cover) return;
      if (prefetchedUrisRef.current.has(entry.cover)) return;
      prefetchedUrisRef.current.add(entry.cover);
      Image.prefetch(entry.cover).catch(() => {});
    });
  }, []);

  // Warm cache for current + next page whenever feed updates.
  useEffect(() => {
    const nextPageItems = getPage(page + 1, filter);
    prefetchCovers([...items, ...nextPageItems]);
  }, [items, page, filter, prefetchCovers]);

  // Keep a small look-ahead cache around current position.
  useEffect(() => {
    const windowStart = Math.max(0, currentIndex - 1);
    const windowEnd = Math.min(items.length, currentIndex + 5);
    prefetchCovers(items.slice(windowStart, windowEnd));
  }, [currentIndex, items, prefetchCovers]);

  const handleFilterChange = useCallback((key) => {
    setFilter(key);
    setPage(1);
    setCurrentIndex(0);
    // Scroll to top
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const handleSelect = useCallback(
    (item) => navigation.navigate('IdeaReel', { book: item }),
    [navigation]
  );

  const handleLoadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const onScrollEnd = useCallback(
    (e) => {
      if (!containerHeight) return;
      const idx = Math.round(
        e.nativeEvent.contentOffset.y / containerHeight
      );
      setCurrentIndex(idx);
    },
    [containerHeight]
  );

  const onLayout = useCallback((e) => {
    const { height } = e.nativeEvent.layout;
    setContainerHeight(height);
  }, []);

  const renderItem = useCallback(
    ({ item }) => {
      if (item._isLoadMore) {
        return (
          <LoadMoreCard
            onLoadMore={handleLoadMore}
            colors={colors}
            remaining={remaining}
            itemHeight={containerHeight}
          />
        );
      }
      if (item._isEndOfFeed) {
        return (
          <EndOfFeedCard
            colors={colors}
            itemHeight={containerHeight}
          />
        );
      }
      return (
        <FeedCard
          item={item}
          onPress={handleSelect}
          colors={colors}
          itemHeight={containerHeight}
        />
      );
    },
    [handleSelect, handleLoadMore, colors, remaining, containerHeight]
  );

  const getItemLayout = useCallback(
    (_, index) => ({
      length: containerHeight,
      offset: containerHeight * index,
      index,
    }),
    [containerHeight]
  );

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Floating header */}
      <View style={[styles.floatingHeader, { top: STATUS_BAR_HEIGHT + 8 }]}>
        {/* Left: Mascot + read count */}
        <TouchableOpacity
          style={styles.headerLeft}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={[styles.mascotCircle, { backgroundColor: colors.surface }]}>
            <Image source={mascotImage} style={styles.mascotAvatar} />
          </View>
          <Text style={[styles.readCount, { color: colors.textSecondary }]}>
            {todayReads} read today
          </Text>
        </TouchableOpacity>

        {/* Right: Streak + Notifications */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.streakPill, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <Text style={styles.fireEmoji}>🔥</Text>
            <Text style={[styles.streakCount, { color: colors.textPrimary }]}>
              {activity.currentStreak || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.notifButton, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <Bell size={20} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week Tracker */}
      <View style={[styles.weekTrackerWrap, { top: STATUS_BAR_HEIGHT + 56 }]}>
        <WeekTracker activity={activity} colors={colors} />
      </View>

      {/* Filter bar (dev only) */}
      {DEV_MODE && (
        <View style={[styles.filterBarWrap, { top: STATUS_BAR_HEIGHT + 110 }]}>
          <FilterBar active={filter} onChange={handleFilterChange} colors={colors} />
        </View>
      )}

      {/* Feed area */}
      <View style={[styles.feedArea, !DEV_MODE && styles.feedAreaCompact]} onLayout={onLayout}>
        {containerHeight > 0 && totalCount > 0 && (
          <FlatList
            ref={listRef}
            data={feedData}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            snapToInterval={containerHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            getItemLayout={getItemLayout}
          />
        )}
        {totalCount === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              No content yet for this filter
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Motivation Callout */}
      {dailyGoal && !goalDismissed && (
        <View style={styles.bottomCalloutWrap}>
          <MotivationCallout goal={dailyGoal} onDismiss={handleDismissGoal} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Floating header
  floatingHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mascotCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mascotAvatar: {
    width: 40,
    height: 40,
  },
  readCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fireEmoji: {
    fontSize: 16,
  },
  streakCount: {
    fontSize: 15,
    fontWeight: '700',
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Week Tracker
  weekTrackerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  weekTrackerCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayLetter: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Filter bar
  filterBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 24,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Motivation callout
  motivationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
  },
  motivationEmoji: {
    fontSize: 22,
  },
  motivationContent: {
    flex: 1,
  },
  motivationLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
    marginBottom: 2,
  },
  motivationText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  progressBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  dismissButton: {
    padding: 4,
  },

  // Feed area (below header + week tracker)
  feedArea: {
    flex: 1,
    marginTop: STATUS_BAR_HEIGHT + 145,
  },
  feedAreaCompact: {
    marginTop: STATUS_BAR_HEIGHT + 110,
  },

  // Bottom callout
  bottomCalloutWrap: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
  },

  // Card
  cardContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
  },
  cardContent: {
    padding: 20,
  },

  // Pills row
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  interestPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  interestText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Card content
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },

  // Card footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ideaChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  ideaChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  readTime: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Load more card
  loadMoreInner: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadMoreEmoji: {
    fontSize: 40,
    marginBottom: 20,
  },
  loadMoreTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  loadMoreSub: {
    fontSize: 15,
    marginBottom: 32,
  },
  loadMoreButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  loadMoreButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // End of feed
  endOfFeedInner: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  endOfFeedEmoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  endOfFeedTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  endOfFeedSub: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  endOfFeedDivider: {
    width: 40,
    height: 2,
    borderRadius: 1,
    marginBottom: 16,
  },
  endOfFeedHint: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
});
