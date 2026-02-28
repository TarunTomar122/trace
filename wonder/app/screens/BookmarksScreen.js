import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Share,
} from 'react-native';
import Constants from 'expo-constants';
import { Bookmark, BookOpen, FileText, Film, Search, ChevronLeft, Share2, Trash2 } from 'lucide-react-native';
import { useTheme } from '../ThemeContext';
import { useBookmarks } from '../lib/BookmarksContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;

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

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'book', label: 'Books' },
  { key: 'article', label: 'Articles' },
  { key: 'video', label: 'Videos' },
];

// Generate consistent image for items without covers
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function TabBar({ active, onChange, colors, counts }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const count = counts[tab.key] || 0;
        if (tab.key !== 'all' && count === 0) return null;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => onChange(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                { color: isActive ? colors.accent : colors.textTertiary },
              ]}
            >
              {tab.label} {count > 0 ? count : ''}
            </Text>
            {isActive && (
              <View style={[styles.tabIndicator, { backgroundColor: colors.accent }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SourceCard({ source, ideas, colors, onExpand, isExpanded }) {
  const IconComponent = TYPE_ICON[ideas[0]?.type] || BookOpen;
  const coverUrl = ideas[0]?.sourceCover || `https://picsum.photos/seed/${hashCode(source)}/100/150`;
  const itemColor = ideas[0]?.color || colors.accent;

  return (
    <TouchableOpacity
      style={[styles.sourceCard, { backgroundColor: colors.surface }]}
      activeOpacity={0.8}
      onPress={() => onExpand(source)}
    >
      <Image
        source={{ uri: coverUrl }}
        style={[styles.sourceCover, { backgroundColor: colors.coverPlaceholder }]}
        resizeMode="cover"
      />
      <View style={styles.sourceInfo}>
        <Text style={[styles.sourceTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {source}
        </Text>
        <Text style={[styles.sourceAuthor, { color: colors.textTertiary }]} numberOfLines={1}>
          {ideas[0]?.sourceAuthor || TYPE_LABEL[ideas[0]?.type]}
        </Text>
      </View>
      <View style={[styles.countBadge, { backgroundColor: colors.background }]}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          {ideas.length}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function IdeaDetail({ idea, colors, onRemove, onShare, sourceName }) {
  const bodyParagraphs = Array.isArray(idea.body) ? idea.body : [];

  return (
    <View style={[styles.ideaDetail, { backgroundColor: colors.surface }]}>
      {/* Title */}
      <Text style={[styles.ideaTitle, { color: colors.textPrimary }]}>
        {idea.title}
      </Text>

      {/* Subtitle */}
      {idea.subtitle && idea.subtitle !== idea.title && (
        <Text style={[styles.ideaSubtitle, { color: colors.textPrimary }]}>
          {idea.subtitle}
        </Text>
      )}

      {/* Body paragraphs */}
      {bodyParagraphs.length > 0 && (
        <View style={styles.ideaBody}>
          {bodyParagraphs.map((paragraph, index) => (
            <Text
              key={`${idea.id}-p-${index}`}
              style={[styles.ideaBodyText, { color: colors.textSecondary }]}
            >
              {paragraph}
            </Text>
          ))}
        </View>
      )}

      {/* Takeaway */}
      {idea.takeaway && (
        <Text style={[styles.ideaTakeaway, { color: colors.textPrimary }]}>
          {idea.takeaway}
        </Text>
      )}

      <View style={styles.ideaFooter}>
        <Text style={[styles.ideaSource, { color: colors.textMuted }]}>
          From {sourceName}
        </Text>
        <View style={styles.ideaActions}>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.surfaceBorder }]}
            onPress={() => onShare(idea)}
            activeOpacity={0.7}
          >
            <Share2 size={14} color={colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.surfaceBorder }]}
            onPress={() => onRemove(idea.id)}
            activeOpacity={0.7}
          >
            <Trash2 size={14} color={colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ExpandedSourceView({ source, ideas, colors, onBack, onRemove }) {
  const handleShare = async (idea) => {
    try {
      await Share.share({
        message: `${idea.title}\n\n${idea.takeaway || idea.subtitle || ''}\n\nFrom "${source}"`,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  return (
    <View style={[styles.expandedContainer, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.expandedHeader, { paddingTop: STATUS_BAR_HEIGHT + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.expandedTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {source}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Ideas List */}
      <ScrollView
        style={styles.ideasList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.ideasListContent}
      >
        {ideas.map((idea) => (
          <IdeaDetail
            key={idea.id}
            idea={idea}
            colors={colors}
            onRemove={onRemove}
            onShare={handleShare}
            sourceName={source}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function EmptyState({ colors, hasFilters }) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface }]}>
        <Bookmark size={48} color={colors.textMuted} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {hasFilters ? 'No matches' : 'No saved ideas yet'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
        {hasFilters
          ? 'Try adjusting your filters to\nsee more saved ideas'
          : 'Tap the bookmark icon while reading\nto save ideas you want to remember'}
      </Text>
    </View>
  );
}

export default function BookmarksScreen() {
  const { colors } = useTheme();
  const { bookmarks, removeBookmark } = useBookmarks();
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedSource, setExpandedSource] = useState(null);

  // Group bookmarks by source
  const groupedBookmarks = useMemo(() => {
    let filtered = bookmarks;
    if (typeFilter !== 'all') {
      filtered = bookmarks.filter(b => b.type === typeFilter);
    }

    const groups = {};
    filtered.forEach((bookmark) => {
      const source = bookmark.source || 'Unknown';
      if (!groups[source]) {
        groups[source] = [];
      }
      groups[source].push(bookmark);
    });

    return groups;
  }, [bookmarks, typeFilter]);

  const sourceList = Object.keys(groupedBookmarks);

  // Count bookmarks by type
  const counts = useMemo(() => ({
    all: bookmarks.length,
    book: bookmarks.filter(b => b.type === 'book').length,
    article: bookmarks.filter(b => b.type === 'article').length,
    video: bookmarks.filter(b => b.type === 'video').length,
  }), [bookmarks]);

  // Count grouped sources for current filter
  const groupCounts = useMemo(() => ({
    all: Object.keys(groupedBookmarks).length,
    book: Object.values(groupedBookmarks).filter(ideas => ideas[0]?.type === 'book').length,
    article: Object.values(groupedBookmarks).filter(ideas => ideas[0]?.type === 'article').length,
    video: Object.values(groupedBookmarks).filter(ideas => ideas[0]?.type === 'video').length,
  }), [groupedBookmarks]);

  const handleTabChange = useCallback((key) => {
    setTypeFilter(key);
  }, []);

  const handleExpand = useCallback((source) => {
    setExpandedSource(source);
  }, []);

  const handleBack = useCallback(() => {
    setExpandedSource(null);
  }, []);

  const handleRemove = useCallback((id) => {
    removeBookmark(id);
    // If we removed the last idea from this source, go back
    if (expandedSource) {
      const remainingIdeas = groupedBookmarks[expandedSource]?.filter(i => i.id !== id);
      if (!remainingIdeas || remainingIdeas.length === 0) {
        setExpandedSource(null);
      }
    }
  }, [removeBookmark, expandedSource, groupedBookmarks]);

  // Show expanded view if a source is selected
  if (expandedSource && groupedBookmarks[expandedSource]) {
    return (
      <ExpandedSourceView
        source={expandedSource}
        ideas={groupedBookmarks[expandedSource]}
        colors={colors}
        onBack={handleBack}
        onRemove={handleRemove}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: STATUS_BAR_HEIGHT + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Saved
        </Text>
        <TouchableOpacity style={styles.searchButton} activeOpacity={0.7}>
          <Search size={22} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <TabBar
        active={typeFilter}
        onChange={handleTabChange}
        colors={colors}
        counts={counts}
      />

      {/* Source List */}
      {sourceList.length > 0 ? (
        <ScrollView
          style={styles.sourceList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sourceListContent}
        >
          {sourceList.map((source) => (
            <SourceCard
              key={source}
              source={source}
              ideas={groupedBookmarks[source]}
              colors={colors}
              onExpand={handleExpand}
              isExpanded={false}
            />
          ))}
        </ScrollView>
      ) : (
        <EmptyState colors={colors} hasFilters={typeFilter !== 'all'} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  searchButton: {
    padding: 8,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tab: {
    marginRight: 24,
    paddingBottom: 12,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },

  // Source List
  sourceList: {
    flex: 1,
  },
  sourceListContent: {
    padding: 20,
    gap: 12,
  },

  // Source Card
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 14,
  },
  sourceCover: {
    width: 50,
    height: 70,
    borderRadius: 8,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  sourceAuthor: {
    fontSize: 13,
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Expanded View
  expandedContainer: {
    flex: 1,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  expandedTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  headerSpacer: {
    width: 32,
  },

  // Ideas List
  ideasList: {
    flex: 1,
  },
  ideasListContent: {
    padding: 20,
    gap: 16,
  },

  // Idea Detail
  ideaDetail: {
    padding: 20,
    borderRadius: 16,
  },
  ideaTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 12,
  },
  ideaSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 12,
  },
  ideaBody: {
    marginBottom: 16,
  },
  ideaBodyText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  ideaTakeaway: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 16,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4ECDC4',
  },
  ideaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  ideaSource: {
    fontSize: 12,
  },
  ideaActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
