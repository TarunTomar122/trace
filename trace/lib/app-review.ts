import * as StoreReview from 'expo-store-review';
import { markReviewRequested } from './firestore';

/**
 * Request an app store review if:
 * - User has streak >= 2
 * - We haven't already asked them
 * - The device supports in-app reviews
 */
export async function maybeRequestReview(
  uid: string,
  streak: number,
  hasRequestedReview?: boolean
): Promise<boolean> {
  // Only ask users with streak >= 2 who haven't been asked before
  if (streak < 2 || hasRequestedReview) {
    return false;
  }

  try {
    console.log('[AppReview] Starting review request...');

    // Check if the device supports in-app reviews
    const isAvailable = await StoreReview.isAvailableAsync();
    console.log('[AppReview] isAvailable:', isAvailable);
    if (!isAvailable) {
      console.log('[AppReview] Store review not available on this device');
      return false;
    }

    // Check if we can actually request a review (rate limiting by OS)
    const hasAction = await StoreReview.hasAction();
    console.log('[AppReview] hasAction:', hasAction);
    if (!hasAction) {
      console.log('[AppReview] No review action available (may be rate limited)');
      return false;
    }

    // Request the review
    console.log('[AppReview] Calling requestReview()...');
    await StoreReview.requestReview();
    console.log('[AppReview] Review requested successfully');

    // Mark that we've asked (even if user dismisses - we don't want to spam)
    await markReviewRequested(uid);

    return true;
  } catch (error) {
    console.warn('[AppReview] Error requesting review:', error);
    return false;
  }
}
