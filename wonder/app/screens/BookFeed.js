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

const COVER_WIDTH = SCREEN_WIDTH * 0.52;
const COVER_HEIGHT = COVER_WIDTH * 1.5;

function BookCard({ item, onPress }) {
  return (
    <View style={[styles.cardContainer, { height: SCREEN_HEIGHT }]}>
      <TouchableOpacity
        style={styles.cardInner}
        activeOpacity={0.9}
        onPress={() => onPress(item)}
      >
        {/* Interest pill */}
        <View
          style={[styles.interestPill, { backgroundColor: item.color + '20' }]}
        >
          <Text style={[styles.interestText, { color: item.color }]}>
            {item.interest.replace('-', ' ')}
          </Text>
        </View>

        {/* Cover image */}
        <View style={styles.coverShadow}>
          {item.cover ? (
            <Image
              source={{ uri: item.cover }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.coverImage, styles.coverPlaceholder]}>
              <Text style={styles.placeholderEmoji}>📚</Text>
            </View>
          )}
        </View>

        {/* Book info */}
        <Text style={styles.bookTitle}>{item.title}</Text>
        <Text style={styles.bookAuthor}>by {item.author}</Text>

        {/* Idea count badge */}
        <View style={[styles.ideaBadge, { backgroundColor: item.color + '18' }]}>
          <Text style={[styles.ideaCount, { color: item.color }]}>
            {item.cardCount} ideas
          </Text>
        </View>

        {/* Tap hint */}
        <Text style={styles.tapHint}>tap to explore →</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function BookFeed({ books, onSelectBook }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
    setCurrentIndex(idx);
  }, []);

  const renderItem = useCallback(
    ({ item }) => <BookCard item={item} onPress={onSelectBook} />,
    [onSelectBook]
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
        data={books}
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
        <Text style={styles.appName}>wonder</Text>
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {books.length}
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
    paddingHorizontal: 24,
    zIndex: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F5F5F7',
    letterSpacing: -0.5,
  },
  counterPill: {
    backgroundColor: 'rgba(22, 22, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  counterText: {
    color: '#8E8EA0',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // Card
  cardContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInner: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Interest pill
  interestPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 28,
  },
  interestText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Cover
  coverShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
    marginBottom: 28,
  },
  coverImage: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#16162A',
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
  },

  // Book info
  bookTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F5F5F7',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  bookAuthor: {
    fontSize: 15,
    color: '#6B6B7B',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Idea badge
  ideaBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 24,
  },
  ideaCount: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Tap hint
  tapHint: {
    fontSize: 13,
    color: '#3A3A4E',
    letterSpacing: 0.5,
  },
});
