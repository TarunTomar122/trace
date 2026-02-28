import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  Flame,
  Trophy,
  Shield,
  Zap,
  Star,
  Crown,
  Sparkles,
  Award,
  CheckCircle2,
  Circle,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getStreakStatus,
  getStreakData,
  getNextMilestone,
  getStreakMessage,
  MILESTONES,
  StreakData,
} from '@/lib/streaks';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function StreaksScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [hasReadToday, setHasReadToday] = useState(false);

  const flameScale = useSharedValue(1);

  useEffect(() => {
    loadData();

    // Subtle breathing animation
    flameScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const loadData = async () => {
    const data = await getStreakData();
    const status = await getStreakStatus();
    setStreakData(data);
    setHasReadToday(status.hasReadToday);
  };

  const flameAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  const currentStreak = streakData?.currentStreak ?? 0;
  const longestStreak = streakData?.longestStreak ?? 0;
  const shields = streakData?.shieldsRemaining ?? 0;
  const nextMilestone = getNextMilestone(currentStreak);
  const progress = nextMilestone ? (currentStreak / nextMilestone) * 100 : 100;
  const message = getStreakMessage(currentStreak, hasReadToday);
  const totalDays = streakData?.streakHistory?.length ?? 0;

  // Get last 7 days
  const getLast7Days = () => {
    const days = [];
    const today = new Date();
    const history = new Set(streakData?.streakHistory || []);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      days.push({
        day: WEEKDAYS[dayOfWeek],
        date: date.getDate(),
        active: history.has(dateStr),
        isToday: i === 0,
      });
    }
    return days;
  };

  // Get monthly data for heatmap
  const getMonthlyData = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const history = new Set(streakData?.streakHistory || []);

    const days = [];
    const startPadding = firstDay.getDay();

    for (let i = 0; i < startPadding; i++) {
      days.push({ day: 0, active: false, isToday: false });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        day: d,
        active: history.has(dateStr),
        isToday: d === today.getDate(),
      });
    }

    return days;
  };

  const last7Days = getLast7Days();
  const monthlyData = getMonthlyData();
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });

  const cardBg = isDark ? '#151515' : '#fff';
  const cardBorder = isDark ? '#252525' : '#e8e8e8';
  const subtleBg = isDark ? '#1a1a1a' : '#f5f5f5';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors[colorScheme].background }]} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText style={s.pageTitle}>Streaks</ThemedText>

        {/* Hero - Clean and minimal */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <View style={[s.heroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Animated.View style={flameAnimatedStyle}>
              <Flame
                size={52}
                color="#F97316"
                fill={hasReadToday ? '#F97316' : 'transparent'}
                strokeWidth={1.5}
              />
            </Animated.View>

            <Text style={s.heroNumber}>{currentStreak}</Text>
            <Text style={[s.heroLabel, { color: Colors[colorScheme].muted }]}>
              day streak
            </Text>

            <Text style={[s.heroMessage, { color: Colors[colorScheme].secondary }]}>
              {message}
            </Text>

            {/* Progress */}
            {nextMilestone && currentStreak > 0 && (
              <View style={s.progressWrap}>
                <View style={s.progressLabels}>
                  <Text style={[s.progressText, { color: Colors[colorScheme].muted }]}>
                    {currentStreak} / {nextMilestone}
                  </Text>
                </View>
                <View style={[s.progressTrack, { backgroundColor: subtleBg }]}>
                  <View style={[s.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* This Week */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={[s.sectionLabel, { color: Colors[colorScheme].muted }]}>This Week</Text>
          <View style={[s.weekCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {last7Days.map((day, i) => (
              <View key={i} style={s.dayCol}>
                <Text style={[s.dayName, { color: Colors[colorScheme].muted }]}>{day.day}</Text>
                <View
                  style={[
                    s.dayCircle,
                    day.active && s.dayCircleActive,
                    day.isToday && !day.active && [s.dayCircleToday, { borderColor: Colors[colorScheme].border }],
                    !day.active && !day.isToday && { backgroundColor: subtleBg },
                  ]}
                >
                  {day.active && <Flame size={14} color="#fff" fill="#fff" strokeWidth={0} />}
                  {day.isToday && !day.active && (
                    <Text style={[s.dayDate, { color: Colors[colorScheme].muted }]}>{day.date}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Stats Row */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={s.statsRow}>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Trophy size={18} color="#F59E0B" strokeWidth={1.5} />
            <Text style={[s.statNum, { color: Colors[colorScheme].text }]}>{longestStreak}</Text>
            <Text style={[s.statLabel, { color: Colors[colorScheme].muted }]}>best</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Shield size={18} color="#3B82F6" strokeWidth={1.5} />
            <Text style={[s.statNum, { color: Colors[colorScheme].text }]}>{shields}</Text>
            <Text style={[s.statLabel, { color: Colors[colorScheme].muted }]}>shields</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Circle size={18} color="#10B981" strokeWidth={1.5} fill="#10B981" />
            <Text style={[s.statNum, { color: Colors[colorScheme].text }]}>{totalDays}</Text>
            <Text style={[s.statLabel, { color: Colors[colorScheme].muted }]}>days</Text>
          </View>
        </Animated.View>

        {/* Monthly Calendar */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <Text style={[s.sectionLabel, { color: Colors[colorScheme].muted }]}>{monthName}</Text>
          <View style={[s.calendarCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={s.calendarHeader}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={[s.calendarHeaderText, { color: Colors[colorScheme].muted }]}>{d}</Text>
              ))}
            </View>
            <View style={s.calendarGrid}>
              {monthlyData.map((day, i) => (
                <View key={i} style={s.calendarCell}>
                  {day.day > 0 && (
                    <View
                      style={[
                        s.calendarDot,
                        day.active && s.calendarDotActive,
                        day.isToday && !day.active && [s.calendarDotToday, { borderColor: '#F97316' }],
                        !day.active && !day.isToday && { backgroundColor: subtleBg },
                      ]}
                    >
                      {(day.isToday || day.active) && (
                        <Text style={[s.calendarDayNum, { color: day.active ? '#fff' : '#F97316' }]}>
                          {day.day}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Shield Explainer */}
        <Animated.View entering={FadeInDown.duration(400).delay(500)}>
          <View style={[s.infoRow, { backgroundColor: subtleBg, borderColor: cardBorder }]}>
            <Shield size={16} color="#3B82F6" strokeWidth={1.5} />
            <Text style={[s.infoText, { color: Colors[colorScheme].secondary }]}>
              Shields protect your streak when you miss a day. 1 free per week.
            </Text>
          </View>
        </Animated.View>

        {/* Milestones */}
        <Animated.View entering={FadeInDown.duration(400).delay(600)}>
          <Text style={[s.sectionLabel, { color: Colors[colorScheme].muted }]}>Milestones</Text>
          <View style={s.milestonesGrid}>
            {MILESTONES.map((milestone, index) => {
              const achieved = currentStreak >= milestone;
              const isCurrent = currentStreak < milestone && (index === 0 || currentStreak >= MILESTONES[index - 1]);
              const config = getMilestoneConfig(milestone);

              return (
                <View
                  key={milestone}
                  style={[
                    s.milestoneItem,
                    {
                      backgroundColor: achieved ? '#F9731610' : cardBg,
                      borderColor: achieved ? '#F9731630' : cardBorder,
                      opacity: achieved || isCurrent ? 1 : 0.4,
                    },
                  ]}
                >
                  <config.Icon
                    size={18}
                    color={achieved ? '#F97316' : Colors[colorScheme].muted}
                    strokeWidth={1.5}
                  />
                  <Text style={[s.milestoneNum, { color: achieved ? '#F97316' : Colors[colorScheme].text }]}>
                    {milestone}
                  </Text>
                  <Text style={[s.milestoneName, { color: Colors[colorScheme].muted }]}>
                    {config.label}
                  </Text>
                  {achieved && (
                    <CheckCircle2
                      size={14}
                      color="#F97316"
                      fill="#F97316"
                      strokeWidth={0}
                      style={s.milestoneCheck}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getMilestoneConfig(milestone: number) {
  switch (milestone) {
    case 7: return { Icon: Zap, label: '1 week' };
    case 14: return { Icon: Star, label: '2 weeks' };
    case 30: return { Icon: Trophy, label: '1 month' };
    case 60: return { Icon: Award, label: '2 months' };
    case 100: return { Icon: Crown, label: 'century' };
    case 200: return { Icon: Sparkles, label: 'legend' };
    case 365: return { Icon: Crown, label: '1 year' };
    default: return { Icon: Flame, label: `${milestone}d` };
  }
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 20,
  },

  // Hero
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroNumber: {
    fontSize: 72,
    fontWeight: '700',
    color: '#F97316',
    marginTop: 4,
    letterSpacing: -3,
  },
  heroLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: -6,
    marginBottom: 12,
  },
  heroMessage: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressWrap: {
    width: '100%',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F97316',
    borderRadius: 2,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Week
  weekCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  dayCol: {
    alignItems: 'center',
    gap: 8,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: '#F97316',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  dayDate: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Calendar
  calendarCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 24,
  },
  calendarHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDot: {
    width: '85%',
    height: '85%',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDotActive: {
    backgroundColor: '#F97316',
  },
  calendarDotToday: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  calendarDayNum: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Info
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },

  // Milestones
  milestonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  milestoneItem: {
    width: '31.5%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  milestoneNum: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  milestoneName: {
    fontSize: 10,
    fontWeight: '500',
  },
  milestoneCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
