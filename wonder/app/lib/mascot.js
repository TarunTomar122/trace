import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@wonder_reading_activity';

// Mascot images
export const MASCOT_IMAGES = {
  happy: require('../assets/images/happy.png'),
  base: require('../assets/images/base.png'),
  sad1: require('../assets/images/sad1.png'),
  sad2: require('../assets/images/sad2.png'),
  sad3: require('../assets/images/sad3.png'),
  dead: require('../assets/images/dead.png'),
  scientist: require('../assets/images/scientist.png'),
};

// Mascot messages based on state
export const MASCOT_MESSAGES = {
  happy: [
    "You're on fire! Keep learning!",
    "I'm so proud of you!",
    "Your brain is growing!",
    "Amazing work today!",
  ],
  base: [
    "Hey there, ready to learn?",
    "Let's explore some ideas!",
    "Welcome back, friend!",
    "What shall we discover today?",
  ],
  sad1: [
    "I kinda miss you...",
    "It's been a little while...",
    "My brain feels dusty...",
    "Could use some company...",
  ],
  sad2: [
    "Did you forget about me?",
    "I'm getting lonely here...",
    "My neurons are sleepy...",
    "A quick read would help...",
  ],
  sad3: [
    "Please come back...",
    "I'm wilting without you...",
    "Just one idea? Please?",
    "I really miss learning with you...",
  ],
  dead: [
    "I've... seen better days...",
    "Help... me...",
    "Is anyone there...?",
    "I turned into a puddle...",
  ],
};

// Get a random message for the current state
export function getMascotMessage(state) {
  const messages = MASCOT_MESSAGES[state] || MASCOT_MESSAGES.base;
  return messages[Math.floor(Math.random() * messages.length)];
}

// Calculate days since a timestamp
function daysSince(timestamp) {
  if (!timestamp) return Infinity;
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Determine mascot state based on reading activity
export function getMascotState(lastReadTimestamp, cardsReadToday = 0) {
  // If they read today, they're happy!
  if (cardsReadToday > 0) {
    return 'happy';
  }

  const days = daysSince(lastReadTimestamp);

  if (days === 0) return 'happy';      // Read today
  if (days <= 2) return 'base';        // Read recently
  if (days <= 4) return 'sad1';        // Getting sad
  if (days <= 6) return 'sad2';        // More sad
  if (days <= 9) return 'sad3';        // Very sad
  return 'dead';                        // RIP
}

// Load reading activity from storage
export async function loadReadingActivity() {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load reading activity:', e);
  }
  return {
    lastReadTimestamp: null,
    cardsReadToday: 0,
    todayDate: null,
    totalCardsRead: 0,
    currentStreak: 0,
    longestStreak: 0,
  };
}

// Save reading activity to storage
export async function saveReadingActivity(activity) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(activity));
  } catch (e) {
    console.error('Failed to save reading activity:', e);
  }
}

// Record that the user read a card
export async function recordCardRead() {
  const activity = await loadReadingActivity();
  const today = new Date().toDateString();

  // Reset daily count if it's a new day
  if (activity.todayDate !== today) {
    // Check if yesterday was a reading day for streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = activity.todayDate === yesterday.toDateString();

    activity.cardsReadToday = 0;
    activity.todayDate = today;

    // Update streak
    if (wasYesterday) {
      activity.currentStreak += 1;
    } else if (activity.todayDate !== today) {
      activity.currentStreak = 1;
    }
  }

  activity.cardsReadToday += 1;
  activity.totalCardsRead += 1;
  activity.lastReadTimestamp = new Date().toISOString();

  // Update longest streak
  if (activity.currentStreak > activity.longestStreak) {
    activity.longestStreak = activity.currentStreak;
  }

  await saveReadingActivity(activity);
  return activity;
}

// Get current mascot state (async)
export async function getCurrentMascotState() {
  const activity = await loadReadingActivity();
  const today = new Date().toDateString();
  const cardsToday = activity.todayDate === today ? activity.cardsReadToday : 0;
  return getMascotState(activity.lastReadTimestamp, cardsToday);
}
