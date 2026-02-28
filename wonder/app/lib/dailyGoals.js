import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_GOALS_KEY = '@brainwave_daily_goals';

// Daily goal templates - rotate through these
export const GOAL_TEMPLATES = [
  {
    id: 'read_one',
    emoji: '📖',
    label: 'DAILY CHALLENGE',
    title: 'Read 1 idea today',
    target: 1,
    metric: 'cards_read',
  },
  {
    id: 'read_three',
    emoji: '🎯',
    label: 'NEXT STEP FOR TODAY',
    title: 'Learn 3 key points',
    target: 3,
    metric: 'cards_read',
  },
  {
    id: 'complete_one',
    emoji: '✨',
    label: 'TODAY\'S GOAL',
    title: 'Finish 1 full piece',
    target: 1,
    metric: 'content_completed',
  },
  {
    id: 'explore_new',
    emoji: '🔍',
    label: 'DISCOVER',
    title: 'Explore a new topic',
    target: 1,
    metric: 'new_topic_viewed',
  },
  {
    id: 'read_five',
    emoji: '🚀',
    label: 'STRETCH GOAL',
    title: 'Read 5 ideas today',
    target: 5,
    metric: 'cards_read',
  },
  {
    id: 'bookmark_one',
    emoji: '💾',
    label: 'SAVE FOR LATER',
    title: 'Bookmark 1 favorite idea',
    target: 1,
    metric: 'bookmarks_added',
  },
];

// Get today's date string
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// Load daily goals state
export async function loadDailyGoals() {
  try {
    const stored = await AsyncStorage.getItem(DAILY_GOALS_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Check if it's today's data AND has the new single-goal structure
      if (data.date === getTodayKey() && data.goal) {
        return data;
      }
    }
    // Generate new goal for today (or migrate from old structure)
    return await generateTodayGoals();
  } catch (e) {
    console.log('Error loading daily goals:', e);
    return await generateTodayGoals();
  }
}

// Generate goal for today
async function generateTodayGoals() {
  const today = getTodayKey();
  // Use date as seed to pick consistent goal for the day
  const dayNum = parseInt(today.replace(/-/g, ''), 10);
  const templateIndex = dayNum % GOAL_TEMPLATES.length;

  const goal = {
    ...GOAL_TEMPLATES[templateIndex],
    progress: 0,
    completed: false,
  };

  const data = {
    date: today,
    goal,
    dismissed: false,
  };

  await saveDailyGoals(data);
  return data;
}

// Save daily goals state
async function saveDailyGoals(data) {
  try {
    await AsyncStorage.setItem(DAILY_GOALS_KEY, JSON.stringify(data));
  } catch (e) {
    console.log('Error saving daily goals:', e);
  }
}

// Update progress for a metric
export async function updateGoalProgress(metric, increment = 1) {
  try {
    const data = await loadDailyGoals();

    if (data.goal.metric === metric && !data.goal.completed) {
      data.goal.progress += increment;
      if (data.goal.progress >= data.goal.target) {
        data.goal.completed = true;
      }
      await saveDailyGoals(data);
    }

    return data;
  } catch (e) {
    console.log('Error updating goal progress:', e);
    return null;
  }
}

// Get today's goal for callout display
export async function getNextGoal() {
  const data = await loadDailyGoals();
  return data.goal;
}

// Get today's goal for display (e.g., in streaks page)
export async function getDailyGoal() {
  const data = await loadDailyGoals();
  return data.goal;
}
