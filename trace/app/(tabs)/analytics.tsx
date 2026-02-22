import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flame, BarChart3, TrendingUp } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ACCENT = '#F59E0B';

export default function ActivityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors[colorScheme].background }]} edges={['top']}>
      <View style={s.inner}>
        <ThemedText style={s.pageTitle}>Activity</ThemedText>

        <View style={s.hero}>
          <View style={[s.iconRow]}>
            <View style={[s.iconCircle, { backgroundColor: isDark ? '#1a1408' : '#fffbeb' }]}>
              <Flame size={28} color="#f97316" strokeWidth={2} />
            </View>
            <View style={[s.iconCircle, { backgroundColor: isDark ? '#1a1408' : '#fffbeb' }]}>
              <TrendingUp size={28} color="#F59E0B" strokeWidth={2} />
            </View>
            <View style={[s.iconCircle, { backgroundColor: isDark ? '#14101f' : '#f5f3ff' }]}>
              <BarChart3 size={28} color="#8b5cf6" strokeWidth={2} />
            </View>
          </View>

          <ThemedText style={s.comingTitle}>Coming Soon</ThemedText>
          <ThemedText style={[s.comingSub, { color: Colors[colorScheme].muted }]}>
            Streaks, weekly reviews, reading insights, and more — we're building something great.
          </ThemedText>

          <View style={[s.pill, { backgroundColor: ACCENT + '18' }]}>
            <ThemedText style={[s.pillText, { color: ACCENT }]}>Stay tuned</ThemedText>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  pageTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, lineHeight: 40, marginBottom: 2 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 16,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  comingSub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
