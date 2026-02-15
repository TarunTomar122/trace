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
import { useNavigation } from '@react-navigation/native';
import { BookOpen, FileText, Film } from 'lucide-react-native';
import { useTheme } from '../ThemeContext';
import { getPage, getTotalCount, getTypeCount, PAGE_SIZE } from '../data';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;

const COVER_WIDTH = SCREEN_WIDTH * 0.48;
const COVER_HEIGHT = COVER_WIDTH * 1.5;

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

function FeedCard({ item, onPress, colors, itemHeight }) {
  const IconComponent = TYPE_ICON[item.type] || BookOpen;

  return (
    <View style={[styles.cardContainer, { height: itemHeight }]}>
      <TouchableOpacity
        style={styles.cardInner}
        activeOpacity={0.9}
        onPress={() => onPress(item)}
      >
        {/* Type + Interest row */}
        <View style={styles.pillRow}>
          <View style={[styles.typePill, { backgroundColor: colors.surface }]}>
            <IconComponent
              size={12}
              color={colors.textSecondary}
              strokeWidth={2}
            />
            <Text style={[styles.typeText, { color: colors.textSecondary }]}>
              {TYPE_LABEL[item.type]}
            </Text>
          </View>
          <View
            style={[
              styles.interestPill,
              { backgroundColor: item.color + '20' },
            ]}
          >
            <Text style={[styles.interestText, { color: item.color }]}>
              {item.interest.replace('-', ' ')}
            </Text>
          </View>
        </View>

        {/* Cover image */}
        <View
          style={[
            styles.coverShadow,
            {
              shadowColor: colors.shadowColor,
              shadowOpacity: colors.coverShadowOpacity,
            },
          ]}
        >
          {item.cover ? (
            <Image
              source={{ uri: item.cover, cache: 'force-cache' }}
              style={[
                styles.coverImage,
                { backgroundColor: colors.coverPlaceholder },
              ]}
              resizeMode="cover"
              fadeDuration={0}
            />
          ) : (
            <View
              style={[
                styles.coverImage,
                styles.coverPlaceholder,
                { backgroundColor: colors.coverPlaceholder },
              ]}
            >
              <IconComponent
                size={48}
                color={colors.textMuted}
                strokeWidth={1}
              />
            </View>
          )}
        </View>

        {/* Title + author */}
        <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
          {item.title}
        </Text>
        <Text style={[styles.itemSubtitle, { color: colors.textTertiary }]}>
          {item.subtitle}
        </Text>

        {/* Idea count badge */}
        <View
          style={[styles.ideaBadge, { backgroundColor: item.color + '18' }]}
        >
          <Text style={[styles.ideaCount, { color: item.color }]}>
            {item.cardCount} ideas
          </Text>
        </View>

        {/* Tap hint */}
        <Text style={[styles.tapHint, { color: colors.accent + '80' }]}>
          tap to explore →
        </Text>
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

export default function BookFeed() {
  const navigation = useNavigation();
  const listRef = useRef(null);
  const prefetchedUrisRef = useRef(new Set());
  const [page, setPage] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [filter, setFilter] = useState('all');
  const { colors } = useTheme();

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

  const displayIndex = Math.min(currentIndex + 1, items.length);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Floating header */}
      <View style={[styles.floatingHeader, { top: STATUS_BAR_HEIGHT + 6 }]}>
        <Text style={[styles.appName, { color: colors.accent }]}>wonder</Text>
        <View
          style={[
            styles.counterPill,
            {
              backgroundColor: colors.floatingBg,
              borderColor: colors.floatingBorder,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <Text style={[styles.counterText, { color: colors.textSecondary }]}>
            {totalCount > 0 ? `${displayIndex} / ${totalCount}` : '0'}
          </Text>
        </View>
      </View>

      {/* Filter bar below header */}
      <View style={[styles.filterBarWrap, { top: STATUS_BAR_HEIGHT + 46 }]}>
        <FilterBar active={filter} onChange={handleFilterChange} colors={colors} />
      </View>

      {/* Feed area */}
      <View style={styles.feedArea} onLayout={onLayout}>
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
    paddingHorizontal: 24,
    zIndex: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  counterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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

  // Feed area (below header + filter)
  feedArea: {
    flex: 1,
    marginTop: STATUS_BAR_HEIGHT + 84,
  },

  // Card
  cardContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardInner: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Type + Interest pills row
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  interestPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  interestText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Cover
  coverShadow: {
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 20,
    marginBottom: 24,
  },
  coverImage: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 12,
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Item info
  itemTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  itemSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Idea badge
  ideaBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 20,
  },
  ideaCount: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Tap hint
  tapHint: {
    fontSize: 13,
    letterSpacing: 0.5,
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
