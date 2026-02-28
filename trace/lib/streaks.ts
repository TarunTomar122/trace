import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReadingEvents } from './reading-analytics';

const STREAK_DATA_KEY = '@trace_streak_data_v1';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  shieldsRemaining: number;
  shieldLastReplenished: string | null; // YYYY-MM-DD of last Sunday
  celebratedMilestones: number[]; // [7, 14, 30, etc.]
  streakHistory: string[]; // dates with activity
}

const DEFAULT_STREAK_DATA: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  shieldsRemaining: 1,
  shieldLastReplenished: null,
  celebratedMilestones: [],
  streakHistory: [],
};

export const MILESTONES = [7, 14, 30, 60, 100, 200, 365];

/**
 * Get today's date as YYYY-MM-DD
 */
function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Get yesterday's date as YYYY-MM-DD
 */
function getYesterday(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Get the most recent Sunday as YYYY-MM-DD
 */
function getLastSunday(): string {
  const now = new Date();
  const day = now.getDay();
  now.setDate(now.getDate() - day);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Check if user was active on a given date
 */
async function wasActiveOnDate(date: string): Promise<boolean> {
  const events = await getReadingEvents();
  return events.some((e) => e.timestamp.startsWith(date));
}

/**
 * Load streak data from storage
 */
export async function getStreakData(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_DATA_KEY);
    if (!raw) return { ...DEFAULT_STREAK_DATA };
    return { ...DEFAULT_STREAK_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STREAK_DATA };
  }
}

/**
 * Save streak data to storage
 */
async function saveStreakData(data: StreakData): Promise<void> {
  try {
    await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(data));
  } catch {
    // Best effort
  }
}

/**
 * Replenish shields if it's a new week
 */
function maybeReplenishShields(data: StreakData): StreakData {
  const lastSunday = getLastSunday();
  if (data.shieldLastReplenished !== lastSunday) {
    return {
      ...data,
      shieldsRemaining: 1, // 1 free shield per week
      shieldLastReplenished: lastSunday,
    };
  }
  return data;
}

/**
 * Calculate and update streak based on reading activity
 * Call this when app opens or after reading an article
 */
export async function updateStreak(): Promise<{
  data: StreakData;
  streakBroken: boolean;
  shieldUsed: boolean;
  newMilestone: number | null;
}> {
  let data = await getStreakData();
  data = maybeReplenishShields(data);

  const today = getToday();
  const yesterday = getYesterday();

  const activeToday = await wasActiveOnDate(today);
  const activeYesterday = await wasActiveOnDate(yesterday);

  let streakBroken = false;
  let shieldUsed = false;
  let newMilestone: number | null = null;

  // Already recorded activity today
  if (data.lastActiveDate === today) {
    await saveStreakData(data);
    return { data, streakBroken, shieldUsed, newMilestone };
  }

  // Active today for the first time
  if (activeToday) {
    // Check if streak continues from yesterday
    if (data.lastActiveDate === yesterday) {
      // Streak continues!
      data.currentStreak += 1;
    } else if (data.lastActiveDate && data.lastActiveDate < yesterday) {
      // Missed yesterday - check for shield
      if (data.shieldsRemaining > 0) {
        // Use shield to protect streak
        data.shieldsRemaining -= 1;
        data.currentStreak += 1;
        shieldUsed = true;
      } else {
        // Streak broken, start fresh
        streakBroken = data.currentStreak > 0;
        data.currentStreak = 1;
      }
    } else {
      // First day or continuing same day
      data.currentStreak = Math.max(data.currentStreak, 1);
    }

    data.lastActiveDate = today;

    // Update longest streak
    if (data.currentStreak > data.longestStreak) {
      data.longestStreak = data.currentStreak;
    }

    // Add to history
    if (!data.streakHistory.includes(today)) {
      data.streakHistory = [today, ...data.streakHistory].slice(0, 100);
    }

    // Check for new milestone
    for (const milestone of MILESTONES) {
      if (data.currentStreak === milestone && !data.celebratedMilestones.includes(milestone)) {
        newMilestone = milestone;
        data.celebratedMilestones.push(milestone);
        break;
      }
    }
  }

  await saveStreakData(data);
  return { data, streakBroken, shieldUsed, newMilestone };
}

/**
 * Check if user has read today
 */
export async function hasReadToday(): Promise<boolean> {
  return wasActiveOnDate(getToday());
}

/**
 * Get streak status for display
 */
export async function getStreakStatus(): Promise<{
  currentStreak: number;
  longestStreak: number;
  hasReadToday: boolean;
  shieldsRemaining: number;
  isAtRisk: boolean; // hasn't read today and has a streak to lose
}> {
  const data = await getStreakData();
  const readToday = await hasReadToday();
  const today = getToday();
  const yesterday = getYesterday();

  // Streak is at risk if:
  // - User has a streak > 0
  // - Hasn't read today
  // - Last activity was yesterday (streak still valid but needs action)
  const isAtRisk = !readToday && data.currentStreak > 0 && data.lastActiveDate === yesterday;

  return {
    currentStreak: data.currentStreak,
    longestStreak: data.longestStreak,
    hasReadToday: readToday,
    shieldsRemaining: data.shieldsRemaining,
    isAtRisk,
  };
}

/**
 * Manually use a shield (for testing or UI)
 */
export async function useShield(): Promise<boolean> {
  const data = await getStreakData();
  if (data.shieldsRemaining > 0) {
    data.shieldsRemaining -= 1;
    await saveStreakData(data);
    return true;
  }
  return false;
}

/**
 * Get the next milestone to achieve
 */
export function getNextMilestone(currentStreak: number): number | null {
  for (const milestone of MILESTONES) {
    if (currentStreak < milestone) {
      return milestone;
    }
  }
  return null;
}

/**
 * Get motivational message based on streak
 */
export function getStreakMessage(streak: number, hasReadToday: boolean): string {
  if (!hasReadToday) {
    if (streak === 0) {
      return 'Start your streak today!';
    }
    return 'Read an article to keep your streak alive!';
  }

  if (streak === 1) return 'Great start! Come back tomorrow.';
  if (streak < 7) return `${7 - streak} days until your first milestone!`;
  if (streak === 7) return 'One week strong!';
  if (streak < 14) return 'Building a habit!';
  if (streak === 14) return 'Two weeks! You\'re on fire!';
  if (streak < 30) return `${30 - streak} days to a month!`;
  if (streak === 30) return 'A whole month! Incredible!';
  if (streak < 100) return 'Keep the momentum going!';
  if (streak >= 100) return 'Legendary reader!';

  return 'Keep it up!';
}
