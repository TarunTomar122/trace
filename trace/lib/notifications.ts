import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasReadToday } from './streaks';

// Dynamic import to handle case where expo-notifications isn't installed
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch {
  console.log('[Notifications] expo-notifications not installed - notifications disabled');
}

const NOTIFICATION_SETTINGS_KEY = '@trace_notification_settings';

interface NotificationSettings {
  streakReminderEnabled: boolean;
  streakReminderTime: string; // "20:00" format
  lastScheduledDate: string | null;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  streakReminderEnabled: true,
  streakReminderTime: '20:00',
  lastScheduledDate: null,
};

/**
 * Configure notification handler
 */
export function configureNotifications() {
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Get notification settings
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save notification settings
 */
export async function saveNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
  const current = await getNotificationSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
}

/**
 * Schedule daily streak reminder at 8pm
 */
export async function scheduleStreakReminder(): Promise<void> {
  if (!Notifications) return;

  const settings = await getNotificationSettings();

  if (!settings.streakReminderEnabled) {
    return;
  }

  // Check if already read today - don't bother scheduling
  const readToday = await hasReadToday();
  if (readToday) {
    return;
  }

  // Cancel existing streak reminders
  await cancelStreakReminder();

  // Parse time
  const [hours, minutes] = settings.streakReminderTime.split(':').map(Number);

  // Calculate next 8pm
  const now = new Date();
  const trigger = new Date();
  trigger.setHours(hours, minutes, 0, 0);

  // If 8pm already passed today, schedule for tomorrow
  if (trigger <= now) {
    trigger.setDate(trigger.getDate() + 1);
  }

  // Schedule notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don't break your streak! 🔥",
      body: "Read one article to keep your streak alive.",
      data: { type: 'streak_reminder' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
    },
    identifier: 'streak_reminder',
  });
}

/**
 * Cancel streak reminder
 */
export async function cancelStreakReminder(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync('streak_reminder');
}

/**
 * Update streak reminder based on reading activity
 * Call this when user reads an article
 */
export async function onArticleRead(): Promise<void> {
  // Cancel today's reminder since they've read
  await cancelStreakReminder();
}

/**
 * Initialize notifications on app start
 */
export async function initializeNotifications(): Promise<void> {
  configureNotifications();

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    return;
  }

  // Schedule reminder if needed
  await scheduleStreakReminder();
}

/**
 * Get all scheduled notifications (for debugging)
 */
export async function getScheduledNotifications() {
  if (!Notifications) return [];
  return Notifications.getAllScheduledNotificationsAsync();
}
