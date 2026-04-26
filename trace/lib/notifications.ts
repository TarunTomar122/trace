/**
 * Push Notifications Service
 *
 * Handles registration, token management, and notification handling.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and get the Expo push token.
 * Returns the token string or null if registration fails.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[notifications] Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[notifications] Permission not granted');
      return null;
    }

    // Get the Expo push token
    // Try multiple sources for projectId
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.slug; // Fallback to slug for Expo Go

    let tokenData;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
    } catch (e) {
      // If projectId fails, try without it (works in some Expo Go scenarios)
      console.log('[notifications] Trying without explicit projectId...');
      tokenData = await Notifications.getExpoPushTokenAsync();
    }

    if (__DEV__) {
      console.log('[notifications] Push token:', tokenData.data);
    }

    return tokenData.data;
  } catch (error) {
    console.error('[notifications] Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Save the push token to Firestore for the given user.
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    const db = getFirestore();
    const userRef = doc(db, 'user_profiles', userId);
    await updateDoc(userRef, {
      pushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
      pushNotificationsEnabled: true,
    });
    console.log('[notifications] Token saved to Firestore');
  } catch (error) {
    console.error('[notifications] Error saving push token:', error);
  }
}

/**
 * Disable push notifications for a user (clears token from Firestore).
 */
export async function disablePushNotifications(userId: string): Promise<void> {
  try {
    const db = getFirestore();
    const userRef = doc(db, 'user_profiles', userId);
    await updateDoc(userRef, {
      pushNotificationsEnabled: false,
      pushToken: null,
      pushTokenUpdatedAt: new Date().toISOString(),
    });
    console.log('[notifications] Push notifications disabled');
  } catch (error) {
    console.error('[notifications] Error disabling push notifications:', error);
  }
}

/**
 * Enable push notifications for a user (registers and saves token).
 */
export async function enablePushNotifications(userId: string): Promise<boolean> {
  const token = await registerForPushNotifications();
  if (token) {
    await savePushToken(userId, token);
    return true;
  }
  return false;
}

/**
 * Add a listener for when a notification is received while the app is foregrounded.
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a listener for when a user taps on a notification.
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Schedule a local notification (for testing).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
}

/**
 * Get the current notification permissions status.
 */
export async function getNotificationPermissions(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export const STORY_CATEGORY_ID = 'story';
export const READ_ACTION_ID = 'read';

/**
 * Register notification categories so the OS shows a "Read Story" action button.
 * iOS: appears as a button beneath the notification banner.
 * Android: shown as an action button on the expanded notification.
 */
async function setupNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(STORY_CATEGORY_ID, [
    {
      identifier: READ_ACTION_ID,
      buttonTitle: 'Read Story',
      options: { opensAppToForeground: true },
    },
  ]);
}

/**
 * Initialize notifications - sets up Android channel and notification categories.
 * Call this early in the app lifecycle.
 */
export async function initializeNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F59E0B',
    });
  }
  await setupNotificationCategories();
}

/**
 * Returns the notification response that launched the app (cold start).
 * Use this on mount to handle taps that happened before listeners were registered.
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Track article read for engagement (placeholder for future analytics).
 */
export async function onArticleRead(): Promise<void> {
  // Placeholder for engagement tracking
  // Could be used to adjust notification frequency based on engagement
}
