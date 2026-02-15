import AsyncStorage from '@react-native-async-storage/async-storage';

const READING_EVENTS_KEY = '@trace_reading_events_v1';
const MAX_EVENTS = 2500;

export type ReadingEventType = 'feed_open' | 'summary_open' | 'external_open';

export interface ReadingEvent {
  timestamp: string;
  eventType: ReadingEventType;
  itemId?: string;
  title?: string;
  url?: string;
  tags?: string[];
  itemType?: string;
  feedCategory?: string;
}

export interface ReadingAnalyticsSnapshot {
  totalInteractions: number;
  totalSummaryOpens: number;
  totalExternalOpens: number;
  activeDays: number;
  lastInteractionAt: string | null;
  dailyTrend: { date: string; count: number }[];
  weekdayBreakdown: { label: string; count: number }[];
  topTopics: { topic: string; count: number }[];
}

function toDayKey(isoTs: string): string {
  const d = new Date(isoTs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayRange(days: number): string[] {
  const now = new Date();
  const list: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    list.push(`${year}-${month}-${day}`);
  }
  return list;
}

export async function getReadingEvents(): Promise<ReadingEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(READING_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReadingEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function logReadingEvent(event: Omit<ReadingEvent, 'timestamp'>): Promise<void> {
  try {
    const existing = await getReadingEvents();
    const entry: ReadingEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    const next = [entry, ...existing].slice(0, MAX_EVENTS);
    await AsyncStorage.setItem(READING_EVENTS_KEY, JSON.stringify(next));
  } catch {
    // best-effort analytics only
  }
}

export async function getReadingAnalytics(days = 30): Promise<ReadingAnalyticsSnapshot> {
  const events = await getReadingEvents();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));

  const inWindow = events.filter((e) => new Date(e.timestamp) >= cutoff);
  const dayKeys = getDayRange(days);
  const byDay = new Map<string, number>();
  dayKeys.forEach((k) => byDay.set(k, 0));

  const activeDaySet = new Set<string>();
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
  const topicCounts = new Map<string, number>();

  let totalSummaryOpens = 0;
  let totalExternalOpens = 0;

  for (const e of inWindow) {
    const dayKey = toDayKey(e.timestamp);
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);
    activeDaySet.add(dayKey);

    const weekday = new Date(e.timestamp).getDay();
    weekdayCounts[weekday] += 1;

    if (e.eventType === 'summary_open') totalSummaryOpens += 1;
    if (e.eventType === 'external_open') totalExternalOpens += 1;

    const tags = (e.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean);
    tags.forEach((tag) => {
      topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
    });
  }

  const dailyTrend = dayKeys.map((date) => ({
    date,
    count: byDay.get(date) || 0,
  }));

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayBreakdown = weekdayLabels.map((label, idx) => ({
    label,
    count: weekdayCounts[idx],
  }));

  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, count]) => ({ topic, count }));

  return {
    totalInteractions: inWindow.length,
    totalSummaryOpens,
    totalExternalOpens,
    activeDays: activeDaySet.size,
    lastInteractionAt: events.length > 0 ? events[0].timestamp : null,
    dailyTrend,
    weekdayBreakdown,
    topTopics,
  };
}

