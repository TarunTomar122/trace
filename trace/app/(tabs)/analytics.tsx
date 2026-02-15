import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Lock, TrendingUp, CalendarDays, Compass, Sparkles } from 'lucide-react-native';
import Svg, { Line, Polyline, Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { getReadingAnalytics, ReadingAnalyticsSnapshot } from '@/lib/reading-analytics';

function formatLastSeen(isoTs: string | null): string {
  if (!isoTs) return 'No activity yet';
  const d = new Date(isoTs);
  return d.toLocaleString();
}

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { isProUser, presentPaywall } = useRevenueCat();
  const [analytics, setAnalytics] = useState<ReadingAnalyticsSnapshot | null>(null);
  const [rangeDays, setRangeDays] = useState<30 | 90>(30);
  const [activeInsight, setActiveInsight] = useState<'trend' | 'week' | 'topics'>('trend');

  const loadAnalytics = useCallback(async () => {
    const data = await getReadingAnalytics(rangeDays);
    setAnalytics(data);
  }, [rangeDays]);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [loadAnalytics])
  );

  const trendMax = useMemo(() => {
    const values = analytics?.dailyTrend.map((d) => d.count) || [0];
    return Math.max(1, ...values);
  }, [analytics]);

  const weekMax = useMemo(() => {
    const values = analytics?.weekdayBreakdown.map((d) => d.count) || [0];
    return Math.max(1, ...values);
  }, [analytics]);

  const hasAnyActivity = (analytics?.totalInteractions || 0) > 0;
  const engagementRate = useMemo(() => {
    if (!analytics?.totalInteractions) return 0;
    return Math.round((analytics.totalSummaryOpens / analytics.totalInteractions) * 100);
  }, [analytics]);
  const trendWindow = (analytics?.dailyTrend || []).slice(-14);
  const trendPolylinePoints = useMemo(() => {
    if (trendWindow.length === 0) return '';
    const width = 280;
    const height = 90;
    const padX = 8;
    const padY = 8;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;
    return trendWindow
      .map((d, idx) => {
        const x =
          trendWindow.length <= 1
            ? width / 2
            : padX + (idx / (trendWindow.length - 1)) * usableW;
        const y = padY + (1 - d.count / trendMax) * usableH;
        return `${x},${y}`;
      })
      .join(' ');
  }, [trendWindow, trendMax]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Your reading analytics</ThemedText>
          <ThemedText style={[styles.sub, { color: Colors[colorScheme].muted }]}>
            A quick pulse on your habits, then deeper insights when you need them.
          </ThemedText>
        </View>

        <View style={styles.rangeRow}>
          {[30, 90].map((d) => {
            const active = rangeDays === d;
            return (
              <Pressable
                key={d}
                onPress={() => setRangeDays(d as 30 | 90)}
                style={[
                  styles.rangePill,
                  active
                    ? { backgroundColor: Colors[colorScheme].foreground }
                    : { borderColor: Colors[colorScheme].border, borderWidth: 1 },
                ]}>
                <ThemedText
                  style={[
                    styles.rangePillText,
                    { color: active ? Colors[colorScheme].background : Colors[colorScheme].text },
                  ]}>
                  {d} days
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.heroCard,
            { backgroundColor: colorScheme === 'dark' ? '#111618' : '#F4FBF6', borderColor: Colors[colorScheme].border },
          ]}>
          <View style={styles.heroTop}>
            <Sparkles size={16} color="#16a34a" strokeWidth={1.9} />
            <ThemedText style={styles.heroTitle}>Reading pulse</ThemedText>
          </View>
          {hasAnyActivity ? (
            <>
              <ThemedText style={styles.heroBig}>
                {analytics?.totalInteractions || 0} interactions in last {rangeDays} days
              </ThemedText>
              <ThemedText style={[styles.heroSub, { color: Colors[colorScheme].muted }]}>
                {engagementRate}% were in-app summaries · {analytics?.activeDays || 0} active days
              </ThemedText>
            </>
          ) : (
            <>
              <ThemedText style={styles.heroBig}>No reading data yet</ThemedText>
              <ThemedText style={[styles.heroSub, { color: Colors[colorScheme].muted }]}>
                Open a few articles and this page will start showing useful patterns.
              </ThemedText>
            </>
          )}
        </View>

        <View style={[styles.lastSeenRow, { borderColor: Colors[colorScheme].border }]}>
          <CalendarDays size={16} color={Colors[colorScheme].muted} strokeWidth={1.8} />
          <ThemedText style={[styles.lastSeenText, { color: Colors[colorScheme].muted }]}>
            Last interaction: {formatLastSeen(analytics?.lastInteractionAt || null)}
          </ThemedText>
        </View>

        {!isProUser && (
          <View style={[styles.lockCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <Lock size={18} color={Colors[colorScheme].muted} strokeWidth={1.8} />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText style={styles.lockTitle}>Unlock deeper reading insights</ThemedText>
              <ThemedText style={[styles.lockSub, { color: Colors[colorScheme].muted }]}>
                Track trends over time, strongest weekdays, and your top topics.
              </ThemedText>
            </View>
            <Pressable onPress={() => presentPaywall()} style={styles.lockBtn}>
              <ThemedText style={styles.lockBtnText}>See plans</ThemedText>
            </Pressable>
          </View>
        )}

        <View style={styles.insightTabsRow}>
          {[
            { id: 'trend', label: 'Trend', icon: TrendingUp },
            { id: 'week', label: 'Weekdays', icon: CalendarDays },
            { id: 'topics', label: 'Topics', icon: Compass },
          ].map((tab) => {
            const active = activeInsight === tab.id;
            const Icon = tab.icon;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveInsight(tab.id as 'trend' | 'week' | 'topics')}
                style={[
                  styles.insightTab,
                  active
                    ? { backgroundColor: Colors[colorScheme].foreground }
                    : { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border, borderWidth: 1 },
                ]}>
                <Icon size={13} color={active ? Colors[colorScheme].background : Colors[colorScheme].muted} strokeWidth={1.8} />
                <ThemedText
                  style={[
                    styles.insightTabText,
                    { color: active ? Colors[colorScheme].background : Colors[colorScheme].text },
                  ]}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.section, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          {isProUser ? (
            <>
              {activeInsight === 'trend' && (
                <>
                  <View style={styles.sectionHead}>
                    <TrendingUp size={16} color={Colors[colorScheme].muted} strokeWidth={1.8} />
                    <ThemedText style={styles.sectionTitle}>Last 14 days</ThemedText>
                  </View>
                  {hasAnyActivity ? (
                    <View style={styles.chartRow}>
                      <Svg width="100%" height={90} viewBox="0 0 280 90" preserveAspectRatio="none">
                        <Line x1="8" y1="82" x2="272" y2="82" stroke={Colors[colorScheme].border} strokeWidth="1" />
                        <Polyline
                          points={trendPolylinePoints}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {trendWindow.map((d, idx) => {
                          const x =
                            trendWindow.length <= 1
                              ? 140
                              : 8 + (idx / (trendWindow.length - 1)) * 264;
                          const y = 8 + (1 - d.count / trendMax) * 74;
                          return (
                            <Circle
                              key={d.date}
                              cx={x}
                              cy={y}
                              r={d.count === 0 ? 1.8 : 2.8}
                              fill="#22c55e"
                              opacity={d.count === 0 ? 0.4 : 0.95}
                            />
                          );
                        })}
                      </Svg>
                    </View>
                  ) : (
                    <ThemedText style={[styles.lockedText, { color: Colors[colorScheme].muted }]}>
                      Read a few items and your trend appears here.
                    </ThemedText>
                  )}
                </>
              )}

              {activeInsight === 'week' && (
                <>
                  <View style={styles.sectionHead}>
                    <CalendarDays size={16} color={Colors[colorScheme].muted} strokeWidth={1.8} />
                    <ThemedText style={styles.sectionTitle}>Your strongest weekdays</ThemedText>
                  </View>
                  {(analytics?.weekdayBreakdown || []).map((d) => (
                    <View key={d.label} style={styles.weekRow}>
                      <ThemedText style={[styles.weekLabel, { color: Colors[colorScheme].muted }]}>{d.label}</ThemedText>
                      <View style={[styles.weekTrack, { backgroundColor: Colors[colorScheme].border }]}>
                        <View
                          style={[
                            styles.weekFill,
                            { width: `${(d.count / weekMax) * 100}%`, backgroundColor: '#22c55e' },
                          ]}
                        />
                      </View>
                      <ThemedText style={styles.weekCount}>{d.count}</ThemedText>
                    </View>
                  ))}
                </>
              )}

              {activeInsight === 'topics' && (
                <>
                  <View style={styles.sectionHead}>
                    <Compass size={16} color={Colors[colorScheme].muted} strokeWidth={1.8} />
                    <ThemedText style={styles.sectionTitle}>Most read topics</ThemedText>
                  </View>
                  {analytics?.topTopics?.length ? (
                    analytics.topTopics.map((t) => (
                      <View key={t.topic} style={styles.topicRow}>
                        <ThemedText style={styles.topicName}>{t.topic}</ThemedText>
                        <ThemedText style={[styles.topicCount, { color: Colors[colorScheme].muted }]}>
                          {t.count}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText style={[styles.lockedText, { color: Colors[colorScheme].muted }]}>
                      Read more and your top topics appear here.
                    </ThemedText>
                  )}
                </>
              )}
            </>
          ) : (
            <View style={{ gap: 8 }}>
              <ThemedText style={styles.sectionTitle}>Pro insights preview</ThemedText>
              <ThemedText style={[styles.lockedText, { color: Colors[colorScheme].muted }]}>
                - See your daily reading momentum
              </ThemedText>
              <ThemedText style={[styles.lockedText, { color: Colors[colorScheme].muted }]}>
                - Discover your best reading weekdays
              </ThemedText>
              <ThemedText style={[styles.lockedText, { color: Colors[colorScheme].muted }]}>
                - Learn which topics you naturally gravitate to
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 42, gap: 14 },
  header: { gap: 4 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.3, lineHeight: 40 },
  sub: { fontSize: 14, lineHeight: 20 },
  rangeRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  rangePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  rangePillText: { fontSize: 12, fontWeight: '600' },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTitle: { fontSize: 13, fontFamily: Fonts.mono, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroBig: { fontSize: 20, fontWeight: '700', lineHeight: 26, letterSpacing: -0.2 },
  heroSub: { fontSize: 13, lineHeight: 18 },
  lastSeenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  lastSeenText: { fontSize: 13, flex: 1 },
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  lockTitle: { fontSize: 14, fontWeight: '600' },
  lockSub: { fontSize: 12, lineHeight: 17 },
  lockBtn: { backgroundColor: '#22c55e', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  lockBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  insightTabsRow: { flexDirection: 'row', gap: 8 },
  insightTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  insightTabText: { fontSize: 12, fontWeight: '600' },
  section: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  chartRow: { height: 90, marginTop: 4 },
  lockedText: { fontSize: 13, lineHeight: 19 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekLabel: { width: 30, fontSize: 12, fontWeight: '500' },
  weekTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  weekFill: { height: '100%', borderRadius: 999 },
  weekCount: { width: 22, textAlign: 'right', fontSize: 12, fontWeight: '600' },
  topicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  topicName: { fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  topicCount: { fontSize: 13, fontWeight: '600' },
});

