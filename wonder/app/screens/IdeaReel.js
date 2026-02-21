import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from '../ThemeContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } =
  Dimensions.get('window');
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 0;

const HEADER_ZONE = STATUS_BAR_HEIGHT + 56;
const FOOTER_ZONE = BOTTOM_INSET + 72;
const CARD_MAX_HEIGHT = SCREEN_HEIGHT - HEADER_ZONE - FOOTER_ZONE;

function IdeaCard({ card, book, colors }) {
  const subtitle = card.subtitle || card.idea;
  const bodyParagraphs =
    Array.isArray(card.body) && card.body.length
      ? card.body
      : card.description
        ? [card.description]
        : [];

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
            <Text style={[styles.subtitleText, { color: colors.textPrimary + 'CC' }]}>
              {subtitle}
            </Text>
          )}

          {/* Divider */}
          <View
            style={[
              styles.cardDivider,
              { backgroundColor: book.color + '25' },
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
            <Text style={[styles.takeawayText, { color: colors.textPrimary + 'D9' }]}>
              {card.takeaway}
            </Text>
          )}
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

  const onScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
    setCurrentIndex(idx);
  }, []);

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
    borderRadius: 24,
    borderWidth: 1,
    width: '100%',
    maxWidth: 440,
    overflow: 'hidden',
  },
  cardScrollContent: {
    paddingHorizontal: 26,
    paddingVertical: 30,
  },

  // Title
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 32,
    marginBottom: 18,
  },

  // Subtitle
  subtitleText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 26,
    letterSpacing: 0.1,
    marginBottom: 22,
  },

  // Divider
  cardDivider: {
    height: 2,
    borderRadius: 1,
    marginBottom: 22,
  },

  // Body
  bodyParagraph: {
    fontSize: 15,
    lineHeight: 25,
    letterSpacing: 0.1,
    marginBottom: 14,
  },
  lastBodyParagraph: {
    marginBottom: 0,
  },
  takeawayText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0.1,
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
