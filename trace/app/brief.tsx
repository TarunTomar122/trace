import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Share2, ExternalLink } from 'lucide-react-native';
import { Image } from 'react-native';

import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentArticle } from '@/lib/article-store';
import { getArticleImage } from '@/lib/fallback-images';

const ACCENT = '#F59E0B';

function RichText({ children, style }: { children: string; style?: any }) {
  const parts = children.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return (
    <Text style={style} selectable>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <Text key={i} style={[style, { fontFamily: FontFamily.bold }]}>
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

type BodyBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'link'; name: string; title: string; url: string };

function parseBodyBlocks(raw: string): BodyBlock[] {
  if (!raw) return [];
  const blocks: BodyBlock[] = [];
  const paragraphs = raw.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  for (const para of paragraphs) {
    const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // ## Heading
      if (line.startsWith('## ')) {
        blocks.push({ type: 'heading', text: line.replace(/^##\s*/, '') });
        continue;
      }

      // Link line: must have → ... (https://...) to be a link
      // Matches: → Source — Title (URL)  or  text → Source — Title (URL)
      const fullLinkMatch = line.match(/^(.*?)→\s*(.+?)\s*[—\-]+\s*(.+?)\s*\((https?:\/\/[^)]+)\)\s*$/);
      if (fullLinkMatch && fullLinkMatch[4]) {
        const prefix = fullLinkMatch[1].trim();
        if (prefix) {
          blocks.push({ type: 'paragraph', text: prefix });
        }
        blocks.push({ type: 'link', name: fullLinkMatch[2].trim(), title: fullLinkMatch[3].trim(), url: fullLinkMatch[4].trim() });
        continue;
      }

      // Standalone footnote refs like → [12, 8, 3] — strip the arrow + ref
      const footnoteRef = line.match(/^→\s*\[[\d,\s]+\]\s*$/);
      if (footnoteRef) continue;

      // Strip raw URLs in parens and trailing → footnote refs
      let cleaned = line
        .replace(/\s*\(https?:\/\/[^)]+\)/g, '')
        .replace(/\s*→\s*\[[\d,\s]+\]\s*$/, '')
        .trim();
      if (cleaned) {
        blocks.push({ type: 'paragraph', text: cleaned });
      }
    }
  }
  return blocks;
}

function formatAge(value?: string): string {
  if (!value) return '';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hours ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function BriefScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const item = getCurrentArticle();
  const isDark = colorScheme === 'dark';

  const lastScrollY = useSharedValue(0);
  const headerTranslateY = useSharedValue(0);
  const HEADER_HEIGHT = 60 + insets.top;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      const diff = currentY - lastScrollY.value;
      if (currentY > HEADER_HEIGHT) {
        if (diff > 0) {
          headerTranslateY.value = withTiming(-HEADER_HEIGHT, { duration: 200 });
        } else if (diff < -5) {
          headerTranslateY.value = withTiming(0, { duration: 200 });
        }
      } else {
        headerTranslateY.value = withTiming(0, { duration: 200 });
      }
      lastScrollY.value = currentY;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
  }));

  if (!item) {
    return (
      <View style={[s.root, { backgroundColor: Colors[colorScheme].background }]}>
        <Text style={{ color: Colors[colorScheme].text, padding: 40 }}>No brief available.</Text>
      </View>
    );
  }

  const body = item.summary?.short_article?.body || item.description || '';
  const blocks = useMemo(() => parseBodyBlocks(body), [body]);
  const age = formatAge(item.published_date);
  const imageUrl = getArticleImage(item.thumbnail ?? null, item.title);
  const sourceCount = 4;
  const updateCount = 7;

  return (
    <View style={[s.root, { backgroundColor: Colors[colorScheme].background }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 84 }}>

        {/* Hero image */}
        <View style={s.heroWrap}>
          <Image source={{ uri: imageUrl }} style={s.heroImage} resizeMode="cover" />
          <View style={s.heroOverlay} />
          <LinearGradient
            colors={['transparent', Colors[colorScheme].background]}
            style={s.heroGradient}
          />
        </View>

        {/* Title */}
        <View style={s.titleSection}>
          <Text style={[s.title, { color: Colors[colorScheme].text }]}>
            Your daily brief
          </Text>
          {age ? (
            <View style={s.ageBadge}>
              <Text style={s.ageBadgeText}>{age}</Text>
            </View>
          ) : null}
        </View>

        {/* Body blocks */}
        <View style={s.content}>
          {blocks.map((block, i) => {
            if (block.type === 'heading') {
              return (
                <Text key={i} style={[s.heading, { color: Colors[colorScheme].text }]}>
                  {block.text}
                </Text>
              );
            }
            if (block.type === 'link') {
              return (
                <Pressable
                  key={i}
                  onPress={() => WebBrowser.openBrowserAsync(block.url)}
                  style={[s.linkCard, { backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6' }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.linkName, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                      {block.name}
                    </Text>
                    <Text style={[s.linkTitle, { color: Colors[colorScheme].muted }]} numberOfLines={2}>
                      {block.title}
                    </Text>
                  </View>
                  <ExternalLink size={16} color={Colors[colorScheme].muted} strokeWidth={1.5} />
                </Pressable>
              );
            }
            return (
              <RichText key={i} style={[s.paragraph, { color: Colors[colorScheme].text }]}>
                {block.text}
              </RichText>
            );
          })}

          {/* Meta */}
          <Text style={[s.meta, { color: Colors[colorScheme].muted }]}>
            {sourceCount} SOURCES | {updateCount} UPDATES
          </Text>
        </View>
      </Animated.ScrollView>

      {/* Floating header */}
      <Animated.View style={[s.floatingHeader, headerAnimatedStyle]}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={s.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={s.headerBtn}>
              <ChevronLeft size={22} color={isDark ? '#fff' : '#000'} strokeWidth={2} />
            </Pressable>
            <View style={s.headerRight}>
              <Pressable hitSlop={12} style={s.headerBtn}>
                <Share2 size={18} color={isDark ? '#fff' : '#000'} strokeWidth={1.8} />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  heroWrap: { width: '100%', height: 220 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  heroGradient: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 100,
  },
  titleSection: {
    paddingHorizontal: 20,
    marginTop: -20,
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontFamily: FontFamilySerif.bold,
    lineHeight: 32,
  },
  ageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ageBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  heading: {
    fontSize: 18,
    fontFamily: FontFamilySerif.semiBold,
    lineHeight: 24,
    marginTop: 8,
  },
  paragraph: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 24,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  linkName: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  linkTitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  meta: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 52,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
