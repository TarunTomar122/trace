import { useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Trash2, Quote } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useToast } from '@/contexts/ToastContext';
import { getSnippets, removeSnippet, Snippet } from '@/lib/bookmarks';

/** Renders inline markdown: **bold** and *italic* */
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
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export default function SnippetScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const colorScheme = useColorScheme() ?? 'light';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [snippet, setSnippet] = useState<Snippet | null>(null);

  useEffect(() => {
    const load = async () => {
      const snippets = await getSnippets();
      const found = snippets.find(s => s.id === id);
      setSnippet(found || null);
    };
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!snippet) return;
    await removeSnippet(snippet.id);
    showToast('Deleted', 'success');
    router.back();
  };

  if (!snippet) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors[colorScheme].foreground} strokeWidth={2} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Check if content has a quote (ends with "— Source")
  const quoteMatch = snippet.content.match(/^([\s\S]*?)\n\n"([^"]+)"\s*[—-]\s*(.+)$/);
  const mainContent = quoteMatch ? quoteMatch[1] : snippet.content;
  const quoteText = quoteMatch ? quoteMatch[2] : null;
  const quoteSource = quoteMatch ? quoteMatch[3] : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors[colorScheme].foreground} strokeWidth={2} />
        </Pressable>
        <View style={styles.topBarLabel}>
          <Quote size={14} color={Colors[colorScheme].muted} strokeWidth={2} />
          <Text style={[styles.topBarLabelText, { color: Colors[colorScheme].muted }]}>Snippet</Text>
        </View>
        <Pressable onPress={handleDelete} hitSlop={12} style={styles.deleteBtn}>
          <Trash2 size={20} color="#ef4444" strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Label / Source */}
        <Text style={[styles.label, { color: Colors[colorScheme].muted }]}>
          {snippet.label}
        </Text>

        {/* Main content */}
        <RichText style={[styles.content, { color: Colors[colorScheme].text }]}>
          {mainContent}
        </RichText>

        {/* Quote if present */}
        {quoteText && (
          <View style={[styles.quoteCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={[styles.quoteText, { color: Colors[colorScheme].text }]}>
              "{quoteText}"
            </Text>
            {quoteSource && (
              <Text style={[styles.quoteSource, { color: Colors[colorScheme].muted }]}>
                — {quoteSource}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topBarLabelText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
  content: {
    fontSize: 18,
    lineHeight: 30,
  },
  quoteCard: {
    borderLeftWidth: 3,
    paddingLeft: 16,
    paddingVertical: 8,
    marginTop: 24,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  quoteSource: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
});
