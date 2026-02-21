import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  Flame,
  Trophy,
  Calendar,
  Compass,
  Lock,
  Share2,
  Zap,
  BookOpen,
  Target,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { getReadingAnalytics, ReadingAnalyticsSnapshot } from '@/lib/reading-analytics';
import {
  ReadingStreak,
  WeeklyWrap,
  getReadingStreak,
  recordReadingDay,
  getLatestWeeklyWrap,
} from '@/lib/firestore';

function streakEmoji(n: number): string {
  if (n === 0) return '';
  if (n < 3) return '🔥';
  if (n < 7) return '🔥🔥';
  if (n < 30) return '🔥🔥🔥';
  return '🏆';
}

function streakMessage(s: ReadingStreak): string {
  if (s.current_streak === 0) return 'Open Trace daily to build your streak';
  if (s.current_streak === 1) return 'Day 1 — come back tomorrow to keep it alive';
  if (s.current_streak < 4) return 'Nice start — a week is within reach';
  if (s.current_streak < 7) return 'Almost a full week — keep pushing';
  if (s.current_streak < 14) return 'A real habit is forming';
  if (s.current_streak < 30) return 'Impressive consistency';
  return 'You are in the top tier';
}

const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function ActivityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { user } = useAuth();
  const { isProUser, presentPaywall } = useRevenueCat();

  const [analytics, setAnalytics] = useState<ReadingAnalyticsSnapshot | null>(null);
  const [streak, setStreak] = useState<ReadingStreak | null>(null);
  const [weeklyWrap, setWeeklyWrap] = useState<WeeklyWrap | null>(null);

  const loadAll = useCallback(async () => {
    const data = await getReadingAnalytics(14);
    setAnalytics(data);
    if (user) {
      const [s, w] = await Promise.all([
        recordReadingDay(user.uid),
        getLatestWeeklyWrap(user.uid),
      ]);
      setStreak(s);
      setWeeklyWrap(w);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const last14 = useMemo(() => {
    const trend = analytics?.dailyTrend || [];
    return trend.slice(-14);
  }, [analytics]);

  const maxCount = useMemo(() => Math.max(1, ...last14.map((d) => d.count)), [last14]);

  const topTopics = analytics?.topTopics?.slice(0, 4) || [];
  const totalInteractions = analytics?.totalInteractions || 0;

  const handleShareWrap = async () => {
    if (!weeklyWrap) return;
    const text = `${weeklyWrap.headline}\n\n${weeklyWrap.summary}\n\n${weeklyWrap.fun_stat}\n\n— My week on Trace`;
    try {
      await Share.share({
        message: text,
        ...(Platform.OS === 'ios' ? { url: 'https://www.yourtrace.online' } : {}),
      });
    } catch { /* cancelled */ }
  };

  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors[colorScheme].background }]} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <ThemedText style={s.pageTitle}>Activity</ThemedText>

        {/* ━━━ Streak Hero ━━━ */}
        {streak && (
          <View style={[s.streakHero, { backgroundColor: isDark ? '#181208' : '#fffbeb' }]}>
            <View style={s.streakCenter}>
              <ThemedText style={s.streakNumber}>
                {streak.current_streak}
              </ThemedText>
              <ThemedText style={[s.streakUnit, { color: '#f97316' }]}>
                {streak.current_streak === 1 ? 'day' : 'days'}
              </ThemedText>
            </View>

            <ThemedText style={[s.streakMsg, { color: Colors[colorScheme].muted }]}>
              {streakEmoji(streak.current_streak)} {streakMessage(streak)}
            </ThemedText>

            <View style={s.streakMeta}>
              <View style={s.metaItem}>
                <Trophy size={14} color="#eab308" strokeWidth={2} />
                <ThemedText style={[s.metaValue, { color: Colors[colorScheme].text }]}>
                  {streak.longest_streak}
                </ThemedText>
                <ThemedText style={[s.metaLabel, { color: Colors[colorScheme].muted }]}>best</ThemedText>
              </View>
              <View style={[s.metaDot, { backgroundColor: Colors[colorScheme].border }]} />
              <View style={s.metaItem}>
                <Calendar size={14} color="#f97316" strokeWidth={2} />
                <ThemedText style={[s.metaValue, { color: Colors[colorScheme].text }]}>
                  {streak.total_days_read}
                </ThemedText>
                <ThemedText style={[s.metaLabel, { color: Colors[colorScheme].muted }]}>total</ThemedText>
              </View>
              <View style={[s.metaDot, { backgroundColor: Colors[colorScheme].border }]} />
              <View style={s.metaItem}>
                <Zap size={14} color="#22c55e" strokeWidth={2} />
                <ThemedText style={[s.metaValue, { color: Colors[colorScheme].text }]}>
                  {totalInteractions}
                </ThemedText>
                <ThemedText style={[s.metaLabel, { color: Colors[colorScheme].muted }]}>reads</ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* ━━━ 14-day dot grid ━━━ */}
        {last14.length > 0 && (
          <View style={[s.dotCard, { backgroundColor: isDark ? '#111' : '#fff', borderColor: Colors[colorScheme].border }]}>
            <ThemedText style={[s.dotTitle, { color: Colors[colorScheme].muted }]}>Last 14 days</ThemedText>
            <View style={s.dotGrid}>
              {last14.map((d) => {
                const intensity = d.count === 0 ? 0 : Math.min(d.count / maxCount, 1);
                const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'narrow' });
                const dateLabel = new Date(d.date + 'T12:00:00').getDate().toString();
                return (
                  <View key={d.date} style={s.dotCol}>
                    <View
                      style={[
                        s.dot,
                        {
                          backgroundColor:
                            d.count === 0
                              ? (isDark ? '#222' : '#f0f0f0')
                              : `rgba(34,197,94,${0.25 + intensity * 0.75})`,
                        },
                      ]}
                    >
                      {d.count > 0 && (
                        <ThemedText style={s.dotCount}>{d.count}</ThemedText>
                      )}
                    </View>
                    <ThemedText style={[s.dotDay, { color: Colors[colorScheme].muted }]}>{dateLabel}</ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ━━━ Week in Review ━━━ */}
        {weeklyWrap && (
          <View style={[s.wrapCard, { backgroundColor: isDark ? '#14101f' : '#f8f5ff', borderColor: isDark ? '#2d2050' : '#ede9fe' }]}>
            <View style={s.wrapTop}>
              <ThemedText style={s.wrapEye}>WEEK IN REVIEW</ThemedText>
              <Pressable onPress={handleShareWrap} hitSlop={10}>
                <Share2 size={16} color={isDark ? '#a78bfa' : '#7c3aed'} strokeWidth={2} />
              </Pressable>
            </View>

            <ThemedText style={s.wrapHL}>{weeklyWrap.headline}</ThemedText>
            <ThemedText style={[s.wrapBody, { color: Colors[colorScheme].muted }]}>{weeklyWrap.summary}</ThemedText>

            <View style={s.wrapPills}>
              {[
                `${weeklyWrap.total_articles} articles`,
                `${weeklyWrap.days_with_feed} days`,
                weeklyWrap.top_topic,
              ]
                .filter(Boolean)
                .map((label) => (
                  <View key={label} style={[s.pill, { backgroundColor: isDark ? '#2a1d4a' : '#ede9fe' }]}>
                    <ThemedText style={[s.pillText, { color: isDark ? '#c4b5fd' : '#6d28d9' }]}>{label}</ThemedText>
                  </View>
                ))}
            </View>

            <ThemedText style={[s.wrapFun, { color: Colors[colorScheme].muted }]}>
              {weeklyWrap.fun_stat}
            </ThemedText>
          </View>
        )}

        {/* ━━━ Top Topics ━━━ */}
        {topTopics.length > 0 && (
          <View style={[s.topicsCard, { backgroundColor: isDark ? '#111' : '#fff', borderColor: Colors[colorScheme].border }]}>
            <View style={s.topicsHeader}>
              <Compass size={16} color={Colors[colorScheme].muted} strokeWidth={1.8} />
              <ThemedText style={s.topicsTitle}>What you read most</ThemedText>
            </View>
            {topTopics.map((t, i) => {
              const pct = analytics?.totalInteractions
                ? Math.round((t.count / analytics.totalInteractions) * 100)
                : 0;
              return (
                <View key={t.topic} style={s.topicRow}>
                  <ThemedText style={[s.topicRank, { color: Colors[colorScheme].muted }]}>{i + 1}</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={s.topicName}>{t.topic}</ThemedText>
                    <View style={[s.topicTrack, { backgroundColor: isDark ? '#222' : '#f0f0f0' }]}>
                      <View style={[s.topicFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                  <ThemedText style={[s.topicPct, { color: Colors[colorScheme].muted }]}>{pct}%</ThemedText>
                </View>
              );
            })}
          </View>
        )}

        {/* ━━━ Strongest Days ━━━ */}
        {analytics && analytics.weekdayBreakdown.some((d) => d.count > 0) && (
          <View style={[s.daysCard, { backgroundColor: isDark ? '#111' : '#fff', borderColor: Colors[colorScheme].border }]}>
            <View style={s.topicsHeader}>
              <Target size={16} color={Colors[colorScheme].muted} strokeWidth={1.8} />
              <ThemedText style={s.topicsTitle}>Strongest days</ThemedText>
            </View>
            <View style={s.daysRow}>
              {analytics.weekdayBreakdown.map((d, i) => {
                const maxDay = Math.max(1, ...analytics.weekdayBreakdown.map((dd) => dd.count));
                const h = d.count === 0 ? 4 : 8 + (d.count / maxDay) * 40;
                return (
                  <View key={d.label} style={s.dayCol}>
                    <View style={[s.dayBar, { height: h, backgroundColor: d.count > 0 ? '#22c55e' : (isDark ? '#222' : '#e5e5e5') }]} />
                    <ThemedText style={[s.dayLabel, {
                      color: d.count > 0 ? Colors[colorScheme].text : Colors[colorScheme].muted,
                      fontWeight: d.count > 0 ? '700' : '400',
                    }]}>
                      {WEEKDAY_SHORT[i]}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ━━━ Unlock Pro ━━━ */}
        {!isProUser && (
          <Pressable
            onPress={() => presentPaywall()}
            style={[s.lockCard, { backgroundColor: isDark ? '#0d1a12' : '#f0fdf4', borderColor: isDark ? '#1a3a1a' : '#dcfce7' }]}
          >
            <Lock size={18} color="#22c55e" strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <ThemedText style={s.lockTitle}>Unlock deeper insights</ThemedText>
              <ThemedText style={[s.lockSub, { color: Colors[colorScheme].muted }]}>
                See your full reading habits with Pro
              </ThemedText>
            </View>
            <ThemedText style={s.lockCta}>Go Pro</ThemedText>
          </Pressable>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 48, gap: 14 },
  pageTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, lineHeight: 40, marginBottom: 2 },

  // ━━━ Streak Hero ━━━
  streakHero: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  streakCenter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 6,
  },
  streakNumber: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -3,
    lineHeight: 68,
  },
  streakUnit: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  streakMsg: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  streakMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaLabel: {
    fontSize: 12,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },

  // ━━━ 14-day dots ━━━
  dotCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  dotTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  dotGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotCol: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCount: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  dotDay: {
    fontSize: 9,
    fontWeight: '500',
  },

  // ━━━ Week in Review ━━━
  wrapCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  wrapTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wrapEye: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#8b5cf6',
  },
  wrapHL: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  wrapBody: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  wrapPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  wrapFun: {
    fontSize: 12,
    fontStyle: 'italic',
  },

  // ━━━ Top Topics ━━━
  topicsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  topicsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  topicsTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  topicRank: {
    fontSize: 12,
    fontWeight: '600',
    width: 16,
    textAlign: 'center',
  },
  topicName: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  topicTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  topicFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  topicPct: {
    fontSize: 13,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },

  // ━━━ Strongest Days ━━━
  daysCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 64,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  dayBar: {
    width: 20,
    borderRadius: 6,
  },
  dayLabel: {
    fontSize: 11,
  },

  // ━━━ Lock ━━━
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  lockTitle: { fontSize: 14, fontWeight: '600' },
  lockSub: { fontSize: 12, lineHeight: 17 },
  lockCta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22c55e',
  },
});
