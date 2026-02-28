import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = '@wonder_user_preferences';
const SEEN_KEY = '@wonder_seen_content';

// Default preferences structure
const DEFAULT_PREFS = {
  onboarding: {
    focus: null,           // 'social' | 'reading' | 'ideas' | 'growth'
    goals: [],             // ['productivity', 'career', 'habits', 'money', 'smarter', 'social']
    topics: [],            // Selected interest topics
    timeGoal: null,        // '10 min/day' | '20 min/day' | '30+ min/day'
    swipeLikes: [],        // IDs of liked sample cards
    swipeDislikes: [],     // IDs of disliked sample cards
  },
  completedAt: null,       // ISO timestamp when onboarding finished
};

// Default seen content structure
const DEFAULT_SEEN = {
  seenContent: [],         // IDs of content user has viewed
  completedContent: [],    // IDs of content user finished reading
  likedContent: [],        // IDs of explicitly liked content
  lastActivity: null,      // ISO timestamp
  dailyHistory: {},        // { '2024-01-15': ['id1', 'id2', ...] }
};

// ─────────────────────────────────────────────────────────────
// Preferences (onboarding data)
// ─────────────────────────────────────────────────────────────

export async function loadUserPreferences() {
  try {
    const json = await AsyncStorage.getItem(PREFS_KEY);
    if (json) {
      return { ...DEFAULT_PREFS, ...JSON.parse(json) };
    }
  } catch (e) {
    console.warn('Failed to load user preferences:', e);
  }
  return DEFAULT_PREFS;
}

export async function saveUserPreferences(prefs) {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch (e) {
    console.warn('Failed to save user preferences:', e);
    return false;
  }
}

export async function saveOnboardingData({ focus, goals, topics, timeGoal, swipeLikes, swipeDislikes }) {
  const prefs = await loadUserPreferences();
  prefs.onboarding = {
    focus,
    goals: goals || [],
    topics: topics || [],
    timeGoal,
    swipeLikes: swipeLikes || [],
    swipeDislikes: swipeDislikes || [],
  };
  prefs.completedAt = new Date().toISOString();
  return saveUserPreferences(prefs);
}

export async function hasCompletedOnboarding() {
  const prefs = await loadUserPreferences();
  return !!prefs.completedAt;
}

export async function clearUserPreferences() {
  try {
    await AsyncStorage.removeItem(PREFS_KEY);
    return true;
  } catch (e) {
    console.warn('Failed to clear user preferences:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Seen Content Tracking
// ─────────────────────────────────────────────────────────────

export async function loadSeenContent() {
  try {
    const json = await AsyncStorage.getItem(SEEN_KEY);
    if (json) {
      return { ...DEFAULT_SEEN, ...JSON.parse(json) };
    }
  } catch (e) {
    console.warn('Failed to load seen content:', e);
  }
  return DEFAULT_SEEN;
}

export async function saveSeenContent(data) {
  try {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Failed to save seen content:', e);
    return false;
  }
}

export async function markContentSeen(contentId) {
  const data = await loadSeenContent();
  const today = new Date().toISOString().split('T')[0];

  if (!data.seenContent.includes(contentId)) {
    data.seenContent.push(contentId);
  }

  // Track daily history
  if (!data.dailyHistory[today]) {
    data.dailyHistory[today] = [];
  }
  if (!data.dailyHistory[today].includes(contentId)) {
    data.dailyHistory[today].push(contentId);
  }

  data.lastActivity = new Date().toISOString();
  return saveSeenContent(data);
}

export async function markContentCompleted(contentId) {
  const data = await loadSeenContent();

  if (!data.completedContent.includes(contentId)) {
    data.completedContent.push(contentId);
  }

  // Also mark as seen
  if (!data.seenContent.includes(contentId)) {
    data.seenContent.push(contentId);
  }

  data.lastActivity = new Date().toISOString();
  return saveSeenContent(data);
}

export async function toggleContentLiked(contentId) {
  const data = await loadSeenContent();
  const idx = data.likedContent.indexOf(contentId);

  if (idx === -1) {
    data.likedContent.push(contentId);
  } else {
    data.likedContent.splice(idx, 1);
  }

  return saveSeenContent(data);
}

export async function isContentSeen(contentId) {
  const data = await loadSeenContent();
  return data.seenContent.includes(contentId);
}

export async function getSeenCountForToday() {
  const data = await loadSeenContent();
  const today = new Date().toISOString().split('T')[0];
  return data.dailyHistory[today]?.length || 0;
}

export async function clearSeenContent() {
  try {
    await AsyncStorage.removeItem(SEEN_KEY);
    return true;
  } catch (e) {
    console.warn('Failed to clear seen content:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Combined reset (for testing)
// ─────────────────────────────────────────────────────────────

export async function resetAllUserData() {
  await clearUserPreferences();
  await clearSeenContent();
}
