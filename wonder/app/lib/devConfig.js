/**
 * Development Configuration
 *
 * Toggle these flags to test different app states during development.
 * All flags default to production behavior (false/null).
 *
 * Set DEV_MODE to true to enable dev overrides.
 */

// Master switch - set to false for production behavior
export const DEV_MODE = false;

// ============================================
// MASCOT & READING STATES
// ============================================

// Override mascot state directly (bypasses streak calculation)
// Options: 'happy', 'base', 'sad1', 'sad2', 'sad3', 'dead', null (use real state)
export const DEV_MASCOT_STATE = 'sad1';

// Override streak count (null = use real streak)
export const DEV_STREAK_COUNT = 7; // e.g., 7

// Override cards read today (null = use real count)
export const DEV_CARDS_READ_TODAY = 2; // e.g., 5

// Override total cards read (null = use real count)
export const DEV_TOTAL_CARDS_READ = 2; // e.g., 150

// Override days since last read (null = use real calculation)
// This affects mascot mood: 0=happy, 1-2=base, 3-4=sad1, 5-6=sad2, 7-9=sad3, 10+=dead
export const DEV_DAYS_SINCE_READ = 4; // e.g., 5

// ============================================
// SUBSCRIPTION & USER STATES
// ============================================

// Override subscription status
// Options: 'free', 'pro', 'premium', null (use real status)
export const DEV_SUBSCRIPTION_STATUS = null;

// Override user signed-in state (null = use real auth)
export const DEV_IS_SIGNED_IN = null; // true, false, or null

// ============================================
// FEATURE FLAGS
// ============================================

// Show dev indicator badge in app
export const DEV_SHOW_DEV_BADGE = true;

// Skip onboarding flow
export const DEV_SKIP_ONBOARDING = false;

// Enable verbose console logging
export const DEV_VERBOSE_LOGGING = false;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a dev override value or fall back to the real value
 */
export function getDevOverride(devValue, realValue) {
  if (!DEV_MODE) return realValue;
  return devValue !== null && devValue !== undefined ? devValue : realValue;
}

/**
 * Log only in dev mode with verbose logging enabled
 */
export function devLog(...args) {
  if (DEV_MODE && DEV_VERBOSE_LOGGING) {
    console.log('[DEV]', ...args);
  }
}

/**
 * Get current dev config summary (useful for debugging)
 */
export function getDevConfigSummary() {
  if (!DEV_MODE) return 'Production mode';

  return {
    mode: 'Development',
    mascotState: DEV_MASCOT_STATE || 'auto',
    streak: DEV_STREAK_COUNT ?? 'auto',
    cardsToday: DEV_CARDS_READ_TODAY ?? 'auto',
    subscription: DEV_SUBSCRIPTION_STATUS || 'auto',
    daysSinceRead: DEV_DAYS_SINCE_READ ?? 'auto',
  };
}
