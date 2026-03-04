import { useMemo, useCallback } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, MoreHorizontal, Share2, Zap } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentTopic } from '@/lib/topic-store';
import { setCurrentArticle } from '@/lib/article-store';
import type { FeedItem, TopicTimelineEvent } from '@/lib/firestore';

function RichText({ children, style }: { children: string; style?: any }) {
  const parts = children.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <Text key={i} style={[style, { fontWeight: '700' }]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <Text key={i} style={[style, { fontStyle: 'italic' }]}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

function formatAge(value?: string): string {
  if (!value) return '';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function TopicScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const topic = getCurrentTopic();

  const timeline = useMemo(() => {
    const events = Array.isArray(topic?.timeline) ? [...topic.timeline] : [];
    events.sort((a: TopicTimelineEvent, b: TopicTimelineEvent) => {
      const at = new Date(a.timestamp || '').getTime();
      const bt = new Date(b.timestamp || '').getTime();
      return at - bt;
    });
    return events;
  }, [topic]);

  const articlesByUrl = useMemo(() => {
    const map = new Map<string, FeedItem>();
    for (const article of topic?.articles ?? []) {
      if (article.url) map.set(article.url, article);
    }
    return map;
  }, [topic]);

  const handleTimelinePress = useCallback(
    (event: TopicTimelineEvent) => {
      const url = event.article_url;
      if (!url) return;
      const article = articlesByUrl.get(url);
      if (article && article.summary && Object.keys(article.summary).length > 0) {
        setCurrentArticle(article);
        router.push('/article');
      }
    },
    [articlesByUrl, router],
  );

  if (!topic) {
    router.back();
    return null;
  }

  const age = formatAge(topic.first_seen_at || topic.last_updated_at);
  const isDark = colorScheme === 'dark';

  const handleShare = () => {
    Share.share({ message: topic.title });
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors[colorScheme].background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Hero image with overlaid title — extends to screen top */}
        <View style={styles.heroWrap}>
          {topic.thumbnail ? (
            <Image
              source={{ uri: topic.thumbnail }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: isDark ? '#1c1c1c' : '#222' }]} />
          )}

          {/* Top gradient for button legibility */}
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent']}
            style={styles.heroGradientTop}
          />

          {/* Bottom gradient: transparent → solid background */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.35)', Colors[colorScheme].background]}
            locations={[0, 0.5, 1]}
            style={styles.heroGradient}
          />

          {/* Title overlaid on image bottom */}
          <View style={styles.heroOverlay}>
            {age ? (
              <View style={styles.ageRow}>
                <Zap size={11} color="#F97316" strokeWidth={2.5} fill="#F97316" />
                <Text style={styles.ageText}>{age.toUpperCase()}</Text>
              </View>
            ) : null}

            <Text style={[styles.title, { color: '#fff' }]}>
              {topic.title}
            </Text>
          </View>
        </View>

        {/* Summary + meta below image, flush with background */}
        <View style={styles.summaryBlock}>
          {topic.summary ? (
            <RichText style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
              {topic.summary}
            </RichText>
          ) : null}

          <Text style={[styles.meta, { color: Colors[colorScheme].muted }]}>
            {topic.source_count ?? 0} sources · {topic.article_count ?? 0} updates
          </Text>
        </View>

        {/* Overview content */}
        <View style={styles.tabContent}>
          {Array.isArray(topic.key_points) && topic.key_points.length > 0 ? (
            topic.key_points.slice(0, 6).map((point, idx) => (
              <View
                key={`kp-${idx}`}
                style={[
                  styles.bulletRow,
                  { borderBottomColor: Colors[colorScheme].border },
                ]}>
                <View style={styles.bulletDot} />
                <RichText style={[styles.bulletText, { color: Colors[colorScheme].text }]}>
                  {point}
                </RichText>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: Colors[colorScheme].muted }]}>
              No overview available yet.
            </Text>
          )}

          {timeline.length > 0 && (
            <View style={styles.timelineSection}>
              <Text style={[styles.timelineLabel, { color: Colors[colorScheme].muted }]}>
                TIMELINE
              </Text>
              {timeline.map((event, idx) => {
                const hasArticle =
                  !!event.article_url && articlesByUrl.has(event.article_url) &&
                  Object.keys(articlesByUrl.get(event.article_url)?.summary ?? {}).length > 0;
                return (
                  <Pressable
                    key={event.id || `ev-${idx}`}
                    onPress={() => handleTimelinePress(event)}
                    disabled={!hasArticle}
                    style={[
                      styles.timelineRow,
                      { borderLeftColor: Colors[colorScheme].border },
                    ]}>
                    <View style={styles.timelineDotWrap}>
                      <View
                        style={[
                          styles.timelineDot,
                          { backgroundColor: idx === 0 ? '#F97316' : Colors[colorScheme].muted },
                        ]}
                      />
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={[styles.timelineTime, { color: Colors[colorScheme].muted }]}>
                        {formatAge(event.timestamp)} · {event.source_name || 'Source'}
                      </Text>
                      <Text style={[styles.timelineTitle, { color: Colors[colorScheme].text }]}>
                        {event.title}
                      </Text>
                    {event.summary ? (
                      <RichText
                        style={[styles.timelineSummary, { color: Colors[colorScheme].muted }]}>
                        {event.summary}
                      </RichText>
                    ) : null}
                    </View>
                    {hasArticle && (
                      <View style={styles.timelineChevron}>
                        <ChevronRight size={16} color={Colors[colorScheme].muted} strokeWidth={2} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating header over hero image */}
      <SafeAreaView edges={['top']} style={styles.floatingHeader} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
            <ChevronLeft size={24} color="#fff" strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable onPress={handleShare} hitSlop={12} style={styles.headerBtn}>
              <Share2 size={20} color="#fff" strokeWidth={2} />
            </Pressable>
            <Pressable hitSlop={12} style={styles.headerBtn}>
              <MoreHorizontal size={20} color="#fff" strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Floating header over image
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    marginHorizontal: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Hero
  heroWrap: {
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 320,
  },
  heroGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 1,
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ageText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F97316',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  summaryBlock: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Content
  tabContent: {
    paddingTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  },
  emptyText: {
    padding: 20,
    fontSize: 14,
  },

  // Timeline
  timelineSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
    gap: 0,
  },
  timelineLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 24,
    borderLeftWidth: 1.5,
    marginLeft: 6,
    paddingLeft: 16,
  },
  timelineDotWrap: {
    position: 'absolute',
    left: -5,
    top: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineBody: {
    flex: 1,
    gap: 4,
  },
  timelineTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  timelineSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  timelineChevron: {
    justifyContent: 'center',
    paddingLeft: 4,
  },

});
