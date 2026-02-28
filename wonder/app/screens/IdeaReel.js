import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  Share,
} from 'react-native';
import Constants from 'expo-constants';
import { Eye, Share2, Bookmark } from 'lucide-react-native';
import { useTheme } from '../ThemeContext';
import { useMascot } from '../lib/MascotContext';
import { useBookmarks } from '../lib/BookmarksContext';
import { markContentSeen, markContentCompleted } from '../lib/userPreferences';
import { updateGoalProgress } from '../lib/dailyGoals';

// Generate a consistent number from string for Picsum seed
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } =
  Dimensions.get('window');
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 0;

const HEADER_ZONE = STATUS_BAR_HEIGHT + 56;
const FOOTER_ZONE = BOTTOM_INSET + 72;
const CARD_MAX_HEIGHT = SCREEN_HEIGHT - HEADER_ZONE - FOOTER_ZONE;

function IdeaCard({ card, book, colors }) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(card.id);
  const subtitle = card.subtitle || card.idea;
  const bodyParagraphs =
    Array.isArray(card.body) && card.body.length
      ? card.body
      : card.description
        ? [card.description]
        : [];

  // Generate consistent image URL from card ID
  const imageUrl = `https://picsum.photos/seed/${hashCode(card.id)}/800/400`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${card.title}\n\n${subtitle}\n\nFrom "${book.title}" on Brainwave`,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  return (
    <View style={[styles.cardContainer, { height: SCREEN_HEIGHT }]}>
      {/* The card */}
      <View
        style={[
          styles.contentCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
            maxHeight: CARD_MAX_HEIGHT,
          },
        ]}
      >
        {/* Cover image at top */}
        <Image
          source={{ uri: imageUrl }}
          style={styles.cardCoverImage}
          resizeMode="cover"
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.cardScrollContent}
        >
          {/* Title */}
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {card.title}
          </Text>

          {/* Subtitle */}
          {!!subtitle && (
            <Text style={[styles.subtitleText, { color: colors.textPrimary }]}>
              {subtitle}
            </Text>
          )}

          {/* Divider */}
          <View
            style={[
              styles.cardDivider,
              { backgroundColor: colors.surfaceBorder },
            ]}
          />

          {/* Body */}
          {bodyParagraphs.map((paragraph, index) => (
            <Text
              key={`${card.id}-paragraph-${index}`}
              style={[
                styles.bodyParagraph,
                { color: colors.textSecondary },
                index === bodyParagraphs.length - 1 && !card.takeaway
                  ? styles.lastBodyParagraph
                  : null,
              ]}
            >
              {paragraph}
            </Text>
          ))}

          {!!card.takeaway && (
            <Text style={[styles.takeawayText, { color: colors.textPrimary }]}>
              {card.takeaway}
            </Text>
          )}

          {/* Footer action bar */}
          <View style={[styles.footerBar, { borderTopColor: colors.surfaceBorder }]}>
            {/* Views */}
            <TouchableOpacity style={styles.footerAction} activeOpacity={0.7}>
              <Eye size={18} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={[styles.footerCount, { color: colors.textTertiary }]}>
                {Math.floor(Math.random() * 20 + 5)}K
              </Text>
            </TouchableOpacity>

            {/* Share + Bookmark */}
            <View style={styles.footerRight}>
              <TouchableOpacity
                style={styles.footerAction}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Share2 size={18} color={colors.textTertiary} strokeWidth={1.5} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerAction}
                onPress={() => toggleBookmark({
                  id: card.id,
                  type: book.type,
                  interest: book.interest,
                  title: card.title,
                  subtitle: subtitle,
                  body: bodyParagraphs,
                  takeaway: card.takeaway,
                  source: book.title,
                  sourceAuthor: book.author,
                  sourceCover: book.cover,
                  color: book.color,
                })}
                activeOpacity={0.7}
              >
                <Bookmark
                  size={18}
                  color={bookmarked ? colors.accent : colors.textTertiary}
                  fill={bookmarked ? colors.accent : 'transparent'}
                  strokeWidth={1.5}
                />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Book info pinned near bottom */}
      <View style={[styles.bookInfoRow, { bottom: BOTTOM_INSET + 16 }]}>
        {book.cover && (
          <Image
            source={{ uri: book.cover }}
            style={[
              styles.smallCover,
              { backgroundColor: colors.coverPlaceholder },
            ]}
            resizeMode="cover"
          />
        )}
        <View style={styles.bookInfoText}>
          <Text
            style={[styles.bookInfoTitle, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {book.title}
          </Text>
          <Text
            style={[styles.bookInfoAuthor, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {book.subtitle || `by ${book.author}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function IdeaReel({ route, navigation }) {
  const { book } = route.params;
  const [currentIndex, setCurrentIndex] = useState(0);
  const { colors } = useTheme();
  const { onCardRead } = useMascot();

  // Record first card view and mark content as seen when opening
  useEffect(() => {
    onCardRead();
    markContentSeen(book.id);
    updateGoalProgress('cards_read', 1);
    updateGoalProgress('new_topic_viewed', 1);
  }, [book.id]);

  const onScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
    if (idx !== currentIndex) {
      onCardRead(); // Record card read when user scrolls to new card
      updateGoalProgress('cards_read', 1);

      // Mark as completed when reaching last card
      if (idx === book.cards.length - 1) {
        markContentCompleted(book.id);
        updateGoalProgress('content_completed', 1);
      }
    }
    setCurrentIndex(idx);
  }, [currentIndex, onCardRead, book.id, book.cards.length]);

  const renderItem = useCallback(
    ({ item }) => <IdeaCard card={item} book={book} colors={colors} />,
    [book, colors]
  );

  const getItemLayout = useCallback(
    (_, index) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={book.cards}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={getItemLayout}
        decelerationRate="fast"
      />

      {/* Floating header */}
      <View style={[styles.floatingHeader, { top: STATUS_BAR_HEIGHT + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            styles.backButton,
            {
              backgroundColor: colors.floatingBg,
              borderColor: colors.floatingBorder,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.backText, { color: colors.textPrimary }]}>
            ← back
          </Text>
        </TouchableOpacity>
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
            {currentIndex + 1} / {book.cards.length}
          </Text>
        </View>
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
    paddingHorizontal: 20,
    zIndex: 10,
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  counterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // Full-screen page for each card
  cardContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  // The visible card
  contentCard: {
    borderRadius: 20,
    borderWidth: 1,
    width: '100%',
    maxWidth: 440,
    overflow: 'hidden',
  },
  cardCoverImage: {
    width: '100%',
    height: 160,
  },
  cardScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },

  // Title
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: 12,
  },

  // Subtitle
  subtitleText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 16,
  },

  // Divider
  cardDivider: {
    height: 1,
    marginBottom: 16,
  },

  // Body
  bodyParagraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  lastBodyParagraph: {
    marginBottom: 0,
  },
  takeawayText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    marginBottom: 16,
  },

  // Footer action bar
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerCount: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Book info at bottom
  bookInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: 28,
    right: 28,
    gap: 12,
  },
  smallCover: {
    width: 30,
    height: 44,
    borderRadius: 5,
  },
  bookInfoText: {
    flex: 1,
  },
  bookInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  bookInfoAuthor: {
    fontSize: 11,
    marginTop: 1,
  },
});
