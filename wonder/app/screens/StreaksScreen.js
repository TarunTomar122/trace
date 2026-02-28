import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';
import { ChevronLeft, ChevronRight, Flame, Target, TrendingUp, Check } from 'lucide-react-native';
import { useTheme } from '../ThemeContext';
import { useMascot } from '../lib/MascotContext';
import { getDailyGoal } from '../lib/dailyGoals';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function StatCard({ icon: Icon, value, label, color, colors }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '15' }]}>
        <Icon size={20} color={color} strokeWidth={2} />
      </View>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function GoalItem({ goal, colors }) {
  const isComplete = goal.completed;
  const progress = Math.min(goal.progress, goal.target);
  const progressPercent = (progress / goal.target) * 100;

  return (
    <View style={[styles.goalItem, { backgroundColor: colors.surface }]}>
      <View style={styles.goalLeft}>
        <Text style={styles.goalEmoji}>{goal.emoji}</Text>
        <View style={styles.goalInfo}>
          <Text style={[styles.goalTitle, { color: colors.textPrimary }]}>
            {goal.title}
          </Text>
          <View style={styles.goalProgressRow}>
            <View style={[styles.goalProgressBar, { backgroundColor: colors.background }]}>
              <View
                style={[
                  styles.goalProgressFill,
                  {
                    backgroundColor: isComplete ? '#4CAF50' : colors.accent,
                    width: `${progressPercent}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.goalProgressText, { color: colors.textTertiary }]}>
              {progress}/{goal.target}
            </Text>
          </View>
        </View>
      </View>
      {isComplete && (
        <View style={[styles.goalCheck, { backgroundColor: '#4CAF50' }]}>
          <Check size={14} color="#fff" strokeWidth={3} />
        </View>
      )}
    </View>
  );
}

function CalendarDay({ day, isToday, isCurrentMonth, hasActivity, colors }) {
  if (!day) {
    return <View style={styles.dayCell} />;
  }

  return (
    <View style={styles.dayCell}>
      <View
        style={[
          styles.dayInner,
          isToday && { backgroundColor: colors.accent },
          hasActivity && !isToday && { backgroundColor: colors.accent + '20' },
        ]}
      >
        <Text
          style={[
            styles.dayText,
            { color: isCurrentMonth ? colors.textPrimary : colors.textMuted },
            isToday && { color: colors.background, fontWeight: '700' },
            hasActivity && !isToday && { color: colors.accent, fontWeight: '600' },
          ]}
        >
          {day}
        </Text>
        {hasActivity && !isToday && (
          <View style={[styles.activityDot, { backgroundColor: colors.accent }]} />
        )}
      </View>
    </View>
  );
}

export default function StreaksScreen({ navigation }) {
  const { colors } = useTheme();
  const { activity } = useMascot();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyGoal, setDailyGoal] = useState(null);

  const loadGoal = useCallback(async () => {
    const goal = await getDailyGoal();
    setDailyGoal(goal);
  }, []);

  // Load daily goal on mount
  React.useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get days with activity from stored data
  const activityDays = useMemo(() => {
    // This would come from activity.readDates or similar
    // For now, simulate some activity based on streak
    const days = new Set();
    const today = new Date();

    // Mark days based on current streak
    for (let i = 0; i < (activity.currentStreak || 0); i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.add(d.toDateString());
    }

    // Add some random past activity for visual interest
    for (let i = 0; i < 10; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - Math.floor(Math.random() * 30) - 5);
      days.add(d.toDateString());
    }

    return days;
  }, [activity.currentStreak]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];

    // Add empty cells for padding
    for (let i = 0; i < startPadding; i++) {
      days.push({ day: null, key: `pad-${i}` });
    }

    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      const isToday = date.toDateString() === new Date().toDateString();
      const hasActivity = activityDays.has(date.toDateString());

      days.push({
        day: i,
        key: `day-${i}`,
        isToday,
        isCurrentMonth: true,
        hasActivity,
      });
    }

    return days;
  }, [currentMonth, currentYear, activityDays]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const isCurrentMonthToday =
    currentMonth === new Date().getMonth() &&
    currentYear === new Date().getFullYear();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: STATUS_BAR_HEIGHT + 8 }]}>
        {navigation.canGoBack() ? (
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Activity
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Streak Hero */}
        <View style={styles.heroSection}>
          <View style={[styles.streakCircle, { backgroundColor: colors.accent + '15' }]}>
            <Text style={styles.fireEmoji}>🔥</Text>
            <Text style={[styles.streakNumber, { color: colors.accent }]}>
              {activity.currentStreak || 0}
            </Text>
            <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>
              day streak
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon={Flame}
            value={activity.longestStreak || activity.currentStreak || 0}
            label="Best Streak"
            color="#FF6B35"
            colors={colors}
          />
          <StatCard
            icon={Target}
            value={activity.totalCardsRead || 0}
            label="Ideas Read"
            color="#4ECDC4"
            colors={colors}
          />
          <StatCard
            icon={TrendingUp}
            value={activityDays.size}
            label="Active Days"
            color="#9B59B6"
            colors={colors}
          />
        </View>

        {/* Today's Goal */}
        {dailyGoal && (
          <View style={styles.goalsSection}>
            <Text style={[styles.goalsSectionTitle, { color: colors.textPrimary }]}>
              Today's Goal
            </Text>
            <GoalItem goal={dailyGoal} colors={colors} />
          </View>
        )}

        {/* Calendar Section */}
        <View style={[styles.calendarSection, { backgroundColor: colors.surface }]}>
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={[styles.monthArrow, { backgroundColor: colors.background }]}
              onPress={goToPrevMonth}
              activeOpacity={0.7}
            >
              <ChevronLeft size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>

            <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>
              {MONTHS[currentMonth]} {currentYear}
            </Text>

            <TouchableOpacity
              style={[
                styles.monthArrow,
                { backgroundColor: colors.background },
                isCurrentMonthToday && { opacity: 0.3 },
              ]}
              onPress={goToNextMonth}
              activeOpacity={0.7}
              disabled={isCurrentMonthToday}
            >
              <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Days Header */}
          <View style={styles.daysHeader}>
            {DAYS.map((day) => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={[styles.dayHeaderText, { color: colors.textTertiary }]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((item) => (
              <CalendarDay
                key={item.key}
                day={item.day}
                isToday={item.isToday}
                isCurrentMonth={item.isCurrentMonth}
                hasActivity={item.hasActivity}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* Motivation Card */}
        <View style={[styles.motivationCard, { backgroundColor: colors.accent + '10' }]}>
          <Text style={[styles.motivationTitle, { color: colors.textPrimary }]}>
            Keep it going! 💪
          </Text>
          <Text style={[styles.motivationText, { color: colors.textSecondary }]}>
            {activity.currentStreak >= 7
              ? "You're on fire! A whole week of learning."
              : activity.currentStreak >= 3
              ? "Great progress! Keep the momentum going."
              : "Read one idea today to build your streak!"}
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  streakCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fireEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  streakLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -4,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  // Today's Goal
  goalsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  goalsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  goalEmoji: {
    fontSize: 24,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  goalProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalProgressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalProgressText: {
    fontSize: 11,
    fontWeight: '600',
    width: 30,
  },
  goalCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  // Calendar Section
  calendarSection: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Days Header
  daysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Calendar Grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: (SCREEN_WIDTH - 80) / 7,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activityDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Motivation Card
  motivationCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
  },
  motivationTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  motivationText: {
    fontSize: 14,
    lineHeight: 20,
  },

  bottomPadding: {
    height: 40,
  },
});
