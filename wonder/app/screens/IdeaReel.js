import React, { useState, useCallback } from 'react';
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

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } =
  Dimensions.get('window');
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 0;

function IdeaCard({ card, book }) {
  return (
    <View style={[styles.cardContainer, { height: SCREEN_HEIGHT }]}>
      {/* One card with everything */}
      <View style={[styles.contentCard, { borderColor: book.color + '12' }]}>
        {/* Title */}
        <Text style={styles.cardTitle}>{card.title}</Text>

        {/* Divider after title */}
        <View style={[styles.cardDivider, { backgroundColor: book.color + '20' }]} />

        {/* Idea */}
        <Text style={styles.ideaText}>{card.idea}</Text>

        {/* Divider before description */}
        <View style={[styles.cardDivider, { backgroundColor: book.color + '12' }]} />

        {/* Description */}
        <Text style={styles.descriptionText}>{card.description}</Text>
      </View>

      {/* Book info pinned near bottom */}
      <View style={[styles.bookInfoRow, { marginBottom: BOTTOM_INSET + 20 }]}>
        {book.cover && (
          <Image
            source={{ uri: book.cover }}
            style={styles.smallCover}
            resizeMode="cover"
          />
        )}
        <View style={styles.bookInfoText}>
          <Text style={styles.bookInfoTitle} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={styles.bookInfoAuthor} numberOfLines={1}>
            by {book.author}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function IdeaReel({ book, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
    setCurrentIndex(idx);
  }, []);

  const renderItem = useCallback(
    ({ item }) => <IdeaCard card={item} book={book} />,
    [book]
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
    <View style={styles.container}>
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
          onPress={onBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>← back</Text>
        </TouchableOpacity>
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>
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
    backgroundColor: '#0A0A0F',
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
    backgroundColor: 'rgba(22, 22, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: '#F5F5F7',
    fontSize: 14,
    fontWeight: '600',
  },
  counterPill: {
    backgroundColor: 'rgba(22, 22, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: {
    color: '#8E8EA0',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // Card layout
  cardContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  // Single content card — title + idea + description all in one
  contentCard: {
    backgroundColor: '#111120',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 26,
    width: '100%',
    maxWidth: 440,
  },

  // Title inside card
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F5F5F7',
    letterSpacing: -0.3,
    marginBottom: 16,
  },

  // Dividers inside card
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },

  // Idea text
  ideaText: {
    fontSize: 16,
    color: '#CDCDD8',
    lineHeight: 26,
    letterSpacing: 0.1,
    marginBottom: 16,
  },

  // Description text
  descriptionText: {
    fontSize: 13.5,
    color: '#6B6B80',
    lineHeight: 21,
    letterSpacing: 0.1,
  },

  // Book info
  bookInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 36,
    right: 36,
    paddingVertical: 10,
    gap: 12,
  },
  smallCover: {
    width: 32,
    height: 46,
    borderRadius: 5,
    backgroundColor: '#1A1A30',
  },
  bookInfoText: {
    flex: 1,
  },
  bookInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E9A',
  },
  bookInfoAuthor: {
    fontSize: 11,
    color: '#4A4A5E',
    marginTop: 1,
  },
});
