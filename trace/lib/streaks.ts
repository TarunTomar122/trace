import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_DATA_KEY = '@trace_streak_data_v2';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  streakHistory: string[];       // YYYY-MM-DD dates, newest first, capped at 120
}

const DEFAULT_STREAK_DATA: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  streakHistory: [],
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getToday(): string {
  return toDateStr(new Date());
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

export async function getStreakData(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_DATA_KEY);
    if (!raw) return { ...DEFAULT_STREAK_DATA };
    const parsed = JSON.parse(raw) as Partial<StreakData>;
    return { ...DEFAULT_STREAK_DATA, ...parsed };
  } catch {
    return { ...DEFAULT_STREAK_DATA };
  }
}

async function saveStreakData(data: StreakData): Promise<void> {
  try {
    await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * Call once per app open. Records today, recalculates streak.
 * Safe to call multiple times — idempotent for the same day.
 */
export async function recordAppOpen(): Promise<StreakData> {
  const data = await getStreakData();
  const today = getToday();

  if (data.lastActiveDate === today) return data;

  const yesterday = getYesterday();
  let newStreak: number;

  if (data.lastActiveDate === yesterday) {
    newStreak = data.currentStreak + 1;
  } else {
    newStreak = 1;
  }

  const history = data.streakHistory.includes(today)
    ? data.streakHistory
    : [today, ...data.streakHistory].slice(0, 120);

  const updated: StreakData = {
    currentStreak: newStreak,
    longestStreak: Math.max(data.longestStreak, newStreak),
    lastActiveDate: today,
    streakHistory: history,
  };

  await saveStreakData(updated);
  return updated;
}
