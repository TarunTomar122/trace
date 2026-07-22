import * as StoreReview from 'expo-store-review';
import { Alert, Linking, Platform } from 'react-native';
import { markDay2ReviewPrompted } from './firestore';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=online.yourtrace.app';

export const REVIEW_PROMPT_MIN_STREAK = 2;

function shouldPromptForReview(streak: number, day2ReviewPromptedAt?: string): boolean {
  return streak >= REVIEW_PROMPT_MIN_STREAK && !day2ReviewPromptedAt;
}

function promptPlayStoreFallback(uid: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Enjoying Trace?',
      'A quick Play Store review helps more people discover Trace.',
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Rate Trace',
          onPress: async () => {
            await markDay2ReviewPrompted(uid);
            await Linking.openURL(PLAY_STORE_URL);
            resolve(true);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Show the store review prompt on the user's 2nd visit day.
 * Applies to new and existing users who have not been prompted yet.
 */
export async function maybeRequestReview(
  uid: string,
  streak: number,
  day2ReviewPromptedAt?: string
): Promise<boolean> {
  if (!shouldPromptForReview(streak, day2ReviewPromptedAt)) {
    return false;
  }

  try {
    console.log('[AppReview] Starting review request for day-2 user...');

    const isAvailable = await StoreReview.isAvailableAsync();
    console.log('[AppReview] isAvailable:', isAvailable);
    if (!isAvailable) {
      if (Platform.OS === 'android') {
        return promptPlayStoreFallback(uid);
      }
      return false;
    }

    const hasAction = await StoreReview.hasAction();
    console.log('[AppReview] hasAction:', hasAction);
    if (!hasAction) {
      if (Platform.OS === 'android') {
        return promptPlayStoreFallback(uid);
      }
      console.log('[AppReview] No review action available (may be rate limited)');
      return false;
    }

    console.log('[AppReview] Calling requestReview()...');
    await StoreReview.requestReview();
    console.log('[AppReview] Review requested successfully');

    await markDay2ReviewPrompted(uid);
    return true;
  } catch (error) {
    console.warn('[AppReview] Error requesting review:', error);
    if (Platform.OS === 'android') {
      return promptPlayStoreFallback(uid);
    }
    return false;
  }
}
