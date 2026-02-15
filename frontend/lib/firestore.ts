import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  Timestamp,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { firestore } from './firebase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp | null;
}

export const COLLECTIONS = {
  userProfiles: 'user_profiles',
  userPreferences: 'user_preferences',
  userPatterns: 'user_patterns',
  userFeeds: 'user_feeds',
  userInteractions: 'user_interactions',
  userSeenUrls: 'user_seen_urls',
} as const;

export interface UserPreferences {
  source_distribution: {
    video: number;
    repo: number;
    paper: number;
    blog: number;
    discussion: number;
    launch: number;
    tweet: number;
    model: number;
  };
  enabled_sources: {
    youtube: boolean;
    github: boolean;
    arxiv: boolean;
    exa_blog: boolean;
    exa_discussion: boolean;
    exa_launch: boolean;
    exa_tweet: boolean;
    exa_model: boolean;
    exa_repo?: boolean;
  };
  min_popularity?: {
    stars?: number;
    views?: number;
  };
  format: {
    max_items: number;
  };
  contentDepth?: 'quick' | 'deep' | 'surprise' | null;
}

// Default preferences for new users (used by the agent)
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  source_distribution: {
    video: 30,      // YouTube - reduced from 40% to conserve API quota
    blog: 40,       // Technical articles - increased
    discussion: 15, // HN threads
    repo: 5,        // GitHub repos
    paper: 0,       // Disabled for most users
    launch: 5,      // Product Hunt - increased
    tweet: 5,       // Twitter/X - increased
    model: 0,       // HuggingFace models
  },
  enabled_sources: {
    youtube: true,
    github: false,  // Disabled by default
    arxiv: false,   // Disabled - too academic for most users
    exa_blog: true,
    exa_discussion: true,
    exa_launch: true,
    exa_tweet: true,
    exa_model: false, // Disabled by default
    exa_repo: false,  // Disabled by default
  },
  min_popularity: {
    stars: 50,
    views: 1000,
  },
  format: {
    max_items: 20,
  },
};

// Normalize slider preferences (0-10 scale) to percentages
export function normalizeSourcePreferences(sliders: {
  youtube: number;
  articles: number;
  papers: number;
  repos: number;
  tweets: number;
  discussions: number;
}): UserPreferences['source_distribution'] {
  // Sum all slider values
  const total = sliders.youtube + sliders.articles + sliders.papers + sliders.repos + sliders.tweets + sliders.discussions;
  
  // If all sliders are 0, use defaults
  if (total === 0) {
    return DEFAULT_USER_PREFERENCES.source_distribution;
  }
  
  // Convert to percentages
  return {
    video: Math.round((sliders.youtube / total) * 100),
    blog: Math.round((sliders.articles / total) * 100),
    paper: Math.round((sliders.papers / total) * 100),
    repo: Math.round((sliders.repos / total) * 100),
    tweet: Math.round((sliders.tweets / total) * 100),
    discussion: Math.round((sliders.discussions / total) * 100),
    launch: 0,  // Not in sliders, set to 0
    model: 0,   // Not in sliders, set to 0
  };
}

// Initialize user preferences in the user_preferences collection (for agent to read)
export async function initializeUserPreferences(
  uid: string, 
  sourceDistribution?: UserPreferences['source_distribution']
): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userPreferences, uid);
    await setDoc(docRef, {
      ...DEFAULT_USER_PREFERENCES,
      source_distribution: sourceDistribution || DEFAULT_USER_PREFERENCES.source_distribution,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.error('Error initializing user preferences:', error);
    throw error;
  }
}

// Initialize user patterns (empty defaults for agent to read)
export async function initializeUserPatterns(uid: string, interests: string[], hobbies: string[]): Promise<void> {
  try {
    // Create initial tag scores from interests
    const tags: Record<string, { score: number; shown: number }> = {};
    for (const interest of interests) {
      tags[interest.toLowerCase().replace(/\s+/g, '-')] = { score: 50, shown: 0 };
    }
    
    const docRef = doc(firestore, COLLECTIONS.userPatterns, uid);
    await setDoc(docRef, {
      tags,
      exclude_tags: [],
      exploration: {
        adjacent_searches: interests.slice(0, 4).map(i => `${i} latest trends`),
        serendipity_queries: hobbies.slice(0, 2).map(h => `${h} tips and ideas`),
      },
      history: [],
      updated: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.error('Error initializing user patterns:', error);
    throw error;
  }
}

export interface UserPatterns {
  tags: Record<string, { score: number; up?: number; down?: number; shown?: number }>;
  exclude_tags: string[];
  summary?: string;
  personal_signals?: Array<{
    signal_id?: string;
    query?: string;
    priority?: number;
    confidence?: number;
    created_at?: string;
    expires_at?: string;
    source?: string;
  }>;
  exploration: {
    adjacent_searches: string[];
    serendipity_queries: string[];
  };
  history?: Array<{
    date: string;
    summary: string;
    insights?: string;
    suggested_explorations?: string[];
  }>;
  updated?: string;
}

export interface UserFeed {
  date: string;
  items: unknown[];
  metadata?: {
    source_counts?: Record<string, number>;
    freshness_ratio?: number;
    generated_at?: string;
    version?: string;
  };
}

export interface UserInteraction {
  item_id: string;
  action: 'upvote' | 'downvote' | 'click';
  timestamp: string;
  item_metadata?: Record<string, unknown>;
}

export interface UserSeenUrls {
  urls: Record<string, string>;
  updated_at?: string;
}

export interface RetrievalPoolEntry {
  topic: string;
  items: Array<Record<string, unknown>>;
  updated_at: string;
  expires_at?: string;
}

export interface TrendingQueries {
  updated_at: string;
  queries: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  
  // Onboarding data
  onboarded: boolean;
  name: string;
  role: string;
  company?: string;
  location?: string;
  experienceYears?: number | null;
  currentWork?: {
    project?: string;
    focus?: string;
    company?: string;
  };
  projects?: string[];
  goals?: {
    shortTerm?: string;
    longTerm?: string;
  };
  learningStyle?: string;
  attentionConstraints?: string;
  motivationTriggers?: string[];
  interests: string[]; // Free-form interest tags
  interestQueries?: Record<string, string[]>; // Optional focus subtopics per interest
  hobbies: string[]; // Free-form hobby tags
  skills: string[]; // Free-form skill tags
  dislikedTopics: string[]; // Topics to avoid
  
  // Content source preferences (preference level 0-10, higher = more preferred)
  sourcePreferences: {
    youtube: number; // 0-10
    articles: number; // 0-10
    papers: number; // 0-10
    repos: number; // 0-10
    tweets: number; // 0-10
    discussions: number; // 0-10
  };
  
  // Content preferences
  contentDepth: 'quick' | 'deep' | 'surprise' | null;
  contentPreferences?: {
    likes?: string[];
    dislikes?: string[];
  };
  favoriteSources?: string[];
  personalityTraits?: string[];
  petPeeves?: string[];
  
  // AI-gathered insights (added progressively through chat)
  insights?: {
    currentProjects?: string[];
    goals?: string[];
    skillLevel?: string;
    learningStyle?: string;
    preferredSources?: string[];
    additionalContext?: string;
  };

  traceSummary?: {
    text: string;
    updatedAt?: string;
    source?: string;
  };
  
  // Chat history with profile agent
  chatHistory?: ChatMessage[];
  
  // Subscription fields (managed by Dodo Payments — web)
  subscriptionStatus: 'none' | 'trial' | 'active' | 'on_hold' | 'cancelled' | 'expired';
  // Subscription field (managed by RevenueCat — mobile app)
  appSubscriptionStatus?: 'none' | 'trial' | 'active' | 'expired';
  subscriptionId: string | null; // Dodo subscription ID
  dodoCustomerId: string | null; // Dodo customer ID
  planId: string | null; // Product ID from Dodo
  nextBillingDate: Timestamp | null;
  trialEndDate: Timestamp | null;
  lastPaymentDate: Timestamp | null;
  lastCheckoutSessionId: string | null; // Track checkout attempts
  lastCheckoutCreatedAt: Timestamp | null; // When checkout was created
  cancelledAt: Timestamp | null; // When cancellation was requested
  willCancelAt: Timestamp | null; // When subscription will actually end
  
  // Newsletter settings
  newsletterOptIn?: boolean; // Default true for subscribed users
  newsletterSendTime?: string; // Default '10:00' IST
  newsletterFrequency?: string; // Default 'daily'
  newsletterLastSentAt?: string | null; // ISO datetime

  // Timestamps
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  onboardedAt: Timestamp | null;
}

export const INTERESTS = [
  { id: 'technology', label: 'Technology' },
  { id: 'science', label: 'Science' },
  { id: 'psychology', label: 'Psychology' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'business', label: 'Business' },
  { id: 'money', label: 'Money' },
  { id: 'design', label: 'Design' },
  { id: 'career', label: 'Career' },
  { id: 'self-development', label: 'Self development' },
  { id: 'health', label: 'Health' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'culture', label: 'Culture' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'society', label: 'Society' },
];

export const INTEREST_SUBTOPICS: Record<string, { id: string; label: string }[]> = {
  technology: [
    { id: 'ai', label: 'AI' },
    { id: 'automation', label: 'Automation' },
    { id: 'software', label: 'Software' },
    { id: 'productivity-tools', label: 'Productivity Tools' },
    { id: 'future-tech', label: 'Future Tech' },
  ],
  science: [
    { id: 'space', label: 'Space' },
    { id: 'biology', label: 'Biology' },
    { id: 'physics', label: 'Physics' },
    { id: 'climate', label: 'Climate' },
    { id: 'explained', label: 'Explained' },
  ],
  psychology: [
    { id: 'mental-health', label: 'Mental Health' },
    { id: 'habits', label: 'Habits' },
    { id: 'learning', label: 'Learning' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'emotions', label: 'Emotions' },
  ],
  ideas: [
    { id: 'philosophy', label: 'Philosophy' },
    { id: 'essays', label: 'Essays' },
    { id: 'creativity', label: 'Creativity' },
    { id: 'meaning', label: 'Meaning' },
    { id: 'big-ideas', label: 'Big Ideas' },
  ],
  business: [
    { id: 'startups', label: 'Startups' },
    { id: 'product', label: 'Product' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'operations', label: 'Operations' },
    { id: 'leadership', label: 'Leadership' },
  ],
  money: [
    { id: 'personal-finance', label: 'Personal Finance' },
    { id: 'investing', label: 'Investing' },
    { id: 'income', label: 'Income' },
    { id: 'markets', label: 'Markets' },
    { id: 'crypto', label: 'Crypto' },
  ],
  design: [
    { id: 'visual-design', label: 'Visual Design' },
    { id: 'ux', label: 'UX' },
    { id: 'branding', label: 'Branding' },
    { id: 'creative-process', label: 'Creative Process' },
    { id: 'tools', label: 'Tools' },
  ],
  career: [
    { id: 'job-search', label: 'Job Search' },
    { id: 'skills', label: 'Skills' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'career-growth', label: 'Career Growth' },
    { id: 'workplace', label: 'Workplace' },
  ],
  'self-development': [
    { id: 'focus', label: 'Focus' },
    { id: 'routines', label: 'Routines' },
    { id: 'mindset', label: 'Mindset' },
    { id: 'confidence', label: 'Confidence' },
    { id: 'life-design', label: 'Life Design' },
  ],
  health: [
    { id: 'workouts', label: 'Workouts' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'sleep', label: 'Sleep' },
    { id: 'recovery', label: 'Recovery' },
    { id: 'fitness', label: 'Fitness' },
  ],
  cooking: [
    { id: 'recipes', label: 'Recipes' },
    { id: 'healthy-meals', label: 'Healthy Meals' },
    { id: 'baking', label: 'Baking' },
    { id: 'drinks', label: 'Drinks' },
    { id: 'food-culture', label: 'Food Culture' },
  ],
  culture: [
    { id: 'movies', label: 'Movies' },
    { id: 'music', label: 'Music' },
    { id: 'games', label: 'Games' },
    { id: 'books', label: 'Books' },
    { id: 'internet', label: 'Internet' },
  ],
  relationships: [
    { id: 'dating', label: 'Dating' },
    { id: 'family', label: 'Family' },
    { id: 'friendships', label: 'Friendships' },
    { id: 'communication', label: 'Communication' },
    { id: 'conflict', label: 'Conflict' },
  ],
  society: [
    { id: 'politics', label: 'Politics' },
    { id: 'economics', label: 'Economics' },
    { id: 'history', label: 'History' },
    { id: 'media', label: 'Media' },
    { id: 'technology-impact', label: 'Technology Impact' },
  ],
};

export const ROLES = [
  'Software Engineer',
  'Designer',
  'Product Manager',
  'Marketing',
  'Creator',
  'Student',
  'Founder',
  'Data Scientist',
  'Other'
];

// Get user profile from Firestore
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(firestore, 'user_profiles', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

export async function getUserPatterns(uid: string): Promise<UserPatterns | null> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userPatterns, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserPatterns;
    }
    return null;
  } catch (error) {
    console.error('Error getting user patterns:', error);
    return null;
  }
}

export async function getUserPreferences(uid: string): Promise<UserPreferences | null> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userPreferences, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserPreferences;
    }
    return null;
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return null;
  }
}

export async function getLatestUserFeed(uid: string): Promise<UserFeed | null> {
  try {
    const feedRef = collection(firestore, COLLECTIONS.userFeeds, uid, 'daily');
    // Get all docs and sort client-side (avoids needing Firestore index)
    const snapshot = await getDocs(feedRef);
    if (snapshot.empty) return null;
    
    // Sort by document ID (which is the date string YYYY-MM-DD) descending
    const sortedDocs = snapshot.docs.sort((a, b) => b.id.localeCompare(a.id));
    return sortedDocs[0].data() as UserFeed;
  } catch (error) {
    console.error('Error getting latest feed:', error);
    return null;
  }
}

export async function getUserFeedDates(uid: string, limitCount = 10): Promise<string[]> {
  try {
    const feedRef = collection(firestore, COLLECTIONS.userFeeds, uid, 'daily');
    // Only fetch the IDs we need, ordered by date desc
    const q = query(feedRef, orderBy('__name__', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];
    return snapshot.docs.map(docSnap => docSnap.id);
  } catch (error) {
    console.error('Error getting feed dates:', error);
    return [];
  }
}

export async function getUserFeedByDate(uid: string, date: string): Promise<UserFeed | null> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userFeeds, uid, 'daily', date);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data() as UserFeed;
  } catch (error) {
    console.error('Error getting feed by date:', error);
    return null;
  }
}

// Create initial user profile after sign in
export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string | null
): Promise<UserProfile> {
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    photoURL,
    onboarded: false,
    name: displayName || '',
    role: '',
    company: '',
    location: '',
    experienceYears: null,
    currentWork: {},
    projects: [],
    goals: {},
    learningStyle: '',
    attentionConstraints: '',
    motivationTriggers: [],
    interests: [],
    hobbies: [],
    skills: [],
    dislikedTopics: [],
    sourcePreferences: {
      youtube: 8,
      articles: 8,
      papers: 1,
      repos: 1,
      tweets: 5,
      discussions: 5,
    },
    contentDepth: null,
    contentPreferences: { likes: [], dislikes: [] },
    favoriteSources: [],
    personalityTraits: [],
    petPeeves: [],
    // Initialize without subscription
    subscriptionStatus: 'none',
    subscriptionId: null,
    dodoCustomerId: null,
    planId: null,
    nextBillingDate: null,
    trialEndDate: null,
    lastPaymentDate: null,
    lastCheckoutSessionId: null,
    lastCheckoutCreatedAt: null,
    cancelledAt: null,
    willCancelAt: null,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    onboardedAt: null,
  };

  try {
    const docRef = doc(firestore, 'user_profiles', uid);
    await setDoc(docRef, profile);
    return profile;
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

// Update user profile with onboarding data
export async function completeOnboarding(
  uid: string,
  data: {
    name: string;
    role?: string;
    company?: string;
    location?: string;
    experienceYears?: number | null;
    currentWork?: {
      project?: string;
      focus?: string;
      company?: string;
    };
    projects?: string[];
    goals?: {
      shortTerm?: string;
      longTerm?: string;
    };
    learningStyle?: string;
    attentionConstraints?: string;
    motivationTriggers?: string[];
    interests: string[];
    interestQueries?: Record<string, string[]>;
    hobbies: string[];
    skills: string[];
    dislikedTopics: string[];
    sourcePreferences: {
      youtube: number;
      articles: number;
      papers: number;
      repos: number;
      tweets: number;
      discussions: number;
    };
    contentDepth?: 'quick' | 'deep' | 'surprise' | null;
    contentPreferences?: {
      likes?: string[];
      dislikes?: string[];
    };
    favoriteSources?: string[];
    personalityTraits?: string[];
    petPeeves?: string[];
    insights?: Partial<UserProfile['insights']>;
    chatHistory?: ChatMessage[];
  }
): Promise<void> {
  try {
    const docRef = doc(firestore, 'user_profiles', uid);
    
    // Remove undefined values from data
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    
    // Use setDoc with merge to create if doesn't exist or update if it does
    await setDoc(docRef, {
      ...cleanData,
      uid,
      onboarded: true,
      updatedAt: serverTimestamp(),
      onboardedAt: serverTimestamp(),
    }, { merge: true });
    
    // Normalize slider preferences to percentages
    const normalizedPreferences = normalizeSourcePreferences(data.sourcePreferences);
    
    // Initialize user_preferences collection (for agent to read)
    await initializeUserPreferences(uid, normalizedPreferences);
    
    // Initialize user_patterns collection with interests/hobbies
    await initializeUserPatterns(uid, data.interests, data.hobbies);
    
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw error;
  }
}

// Update user profile
export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  try {
    const docRef = doc(firestore, 'user_profiles', uid);
    
    // Filter out undefined values to prevent Firestore errors
    const cleanData = JSON.parse(JSON.stringify({
      ...data,
      updatedAt: serverTimestamp(),
    }));
    
    // Use setDoc with merge to handle cases where doc might not exist
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Get or create user profile (used after sign in)
export async function getOrCreateUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string | null
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  if (existing) {
    return existing;
  }
  return createUserProfile(uid, email, displayName, photoURL);
}

// Add a chat message to the profile
export async function addChatMessage(
  uid: string,
  message: { role: 'user' | 'assistant'; content: string }
): Promise<void> {
  try {
    const profile = await getUserProfile(uid);
    const chatHistory = profile?.chatHistory || [];
    
    // Don't use serverTimestamp inside array - use Date instead
    chatHistory.push({
      ...message,
      timestamp: new Date() as unknown as Timestamp,
    });

    const docRef = doc(firestore, 'user_profiles', uid);
    await setDoc(docRef, {
      chatHistory,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error adding chat message:', error);
    throw error;
  }
}

// Clear chat history to start a fresh session
export async function clearChatHistory(uid: string): Promise<void> {
  try {
    const docRef = doc(firestore, 'user_profiles', uid);
    await setDoc(docRef, {
      chatHistory: [],
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    throw error;
  }
}

// Update user insights from AI chat
export async function updateUserInsights(
  uid: string,
  insights: Partial<UserProfile['insights']>
): Promise<void> {
  try {
    const profile = await getUserProfile(uid);
    const currentInsights = profile?.insights || {};
    
    const mergedInsights = {
      ...currentInsights,
      ...insights,
      // Merge arrays instead of replacing
      currentProjects: [...(currentInsights.currentProjects || []), ...(insights?.currentProjects || [])].filter((v, i, a) => a.indexOf(v) === i),
      goals: [...(currentInsights.goals || []), ...(insights?.goals || [])].filter((v, i, a) => a.indexOf(v) === i),
      preferredSources: [...(currentInsights.preferredSources || []), ...(insights?.preferredSources || [])].filter((v, i, a) => a.indexOf(v) === i),
    };

    const docRef = doc(firestore, 'user_profiles', uid);
    await setDoc(docRef, {
      insights: mergedInsights,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error updating user insights:', error);
    throw error;
  }
}
