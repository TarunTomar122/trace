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

// ============ Types ============
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp | null;
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
  interests: string[];
  hobbies: string[];
  skills: string[];
  dislikedTopics: string[];
  
  // Content source preferences (0-10 scale)
  sourcePreferences: {
    youtube: number;
    articles: number;
    papers: number;
    repos: number;
    tweets: number;
    discussions: number;
  };
  
  contentDepth: 'quick' | 'deep' | 'surprise' | null;
  goals?: {
    shortTerm?: string;
    longTerm?: string;
  };
  
  // Subscription
  subscriptionStatus: 'none' | 'trial' | 'active' | 'on_hold' | 'cancelled' | 'expired';
  
  // Timestamps
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  onboardedAt: Timestamp | null;
}

export interface FeedItem {
  id: string;
  type?: string;
  source?: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string | null;
  view_count?: number | null;
  stars?: number | null;
  tags?: string[];
  metadata?: {
    why_relevant?: string;
    is_hot?: boolean;
    feed_category?: string;
  };
  _seen?: boolean;
}

export interface UserFeed {
  date: string;
  items: FeedItem[];
  metadata?: {
    is_preview?: boolean;
    source_counts?: Record<string, number>;
    generated_at?: string;
  };
}

// ============ Constants ============
export const INTERESTS = [
  { id: 'mental-wellness', label: 'Mental Wellness' },
  { id: 'health-fitness', label: 'Health & Fitness' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'money', label: 'Money & Personal Finance' },
  { id: 'career', label: 'Career & Work' },
  { id: 'learning', label: 'Learning & Skills' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'creativity', label: 'Creativity' },
  { id: 'travel', label: 'Travel & Adventure' },
  { id: 'culture', label: 'Culture & Entertainment' },
];

export const HOBBY_SUGGESTIONS = [
  { id: 'running', label: 'Running' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'pottery', label: 'Pottery' },
  { id: 'sketching', label: 'Sketching' },
  { id: 'photography', label: 'Photography' },
  { id: 'music', label: 'Music' },
  { id: 'reading', label: 'Reading' },
  { id: 'fitness', label: 'Fitness' },
];

export const SKILL_SUGGESTIONS = [
  { id: 'software-engineering', label: 'Software Engineering' },
  { id: 'ai-engineer', label: 'AI Engineer' },
  { id: 'ux-designer', label: 'UX Designer' },
  { id: 'quant-researcher', label: 'Quant Researcher' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'trading', label: 'Trading' },
  { id: 'marketing', label: 'Marketing' },
];

export const ROLES = [
  'Founder',
  'UX Designer',
  'Software Engineer',
  'Marketing',
  'Student',
  'Other'
];

// Sample feed items for preview
export const SAMPLE_FEED_ITEMS: FeedItem[] = [
  {
    id: '1',
    type: 'blog',
    title: 'A Simple Morning Routine That Actually Sticks',
    url: 'https://example.com',
    metadata: { why_relevant: 'Popular in Productivity' },
    tags: ['productivity'],
  },
  {
    id: '2',
    type: 'blog',
    title: 'How to Build a Budget You Will Keep Using',
    url: 'https://example.com',
    metadata: { why_relevant: 'Popular in Money' },
    tags: ['money'],
  },
  {
    id: '3',
    type: 'blog',
    title: 'Small Habits That Reduce Daily Stress',
    url: 'https://example.com',
    metadata: { why_relevant: 'Trending in Mental Wellness' },
    tags: ['mental-wellness'],
  },
  {
    id: '4',
    type: 'blog',
    title: 'How to Learn a New Skill Without Burning Out',
    url: 'https://example.com',
    metadata: { why_relevant: 'Popular in Learning' },
    tags: ['learning'],
  },
];

// ============ Firestore Functions ============
const COLLECTIONS = {
  userProfiles: 'user_profiles',
  userPreferences: 'user_preferences',
  userPatterns: 'user_patterns',
  userFeeds: 'user_feeds',
};

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
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
    interests: [],
    hobbies: [],
    skills: [],
    dislikedTopics: [],
    sourcePreferences: {
      youtube: 5,
      articles: 7,
      papers: 2,
      repos: 3,
      tweets: 3,
      discussions: 4,
    },
    contentDepth: null,
    subscriptionStatus: 'none',
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    onboardedAt: null,
  };

  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
    await setDoc(docRef, profile);
    return profile;
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

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

export async function completeOnboarding(
  uid: string,
  data: {
    name: string;
    role: string;
    interests: string[];
    hobbies: string[];
    skills: string[];
    goalsShortTerm?: string;
    sourcePreferences: {
      youtube: number;
      articles: number;
      papers: number;
      repos: number;
      tweets: number;
      discussions: number;
    };
    contentDepth?: 'quick' | 'deep' | 'surprise' | null;
  }
): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
    
    const updateData: Record<string, unknown> = {
      name: data.name,
      role: data.role,
      interests: data.interests,
      hobbies: data.hobbies,
      skills: data.skills,
      sourcePreferences: data.sourcePreferences,
      contentDepth: data.contentDepth ?? null,
      dislikedTopics: [],
      onboarded: true,
      updatedAt: serverTimestamp(),
      onboardedAt: serverTimestamp(),
    };
    
    // Only set goals if provided (Firebase doesn't accept undefined)
    if (data.goalsShortTerm) {
      updateData.goals = { shortTerm: data.goalsShortTerm };
    }
    
    await setDoc(docRef, updateData, { merge: true });
    
    // Initialize user patterns
    await initializeUserPatterns(uid, data.interests, data.hobbies);
    
    // Initialize user preferences
    await initializeUserPreferences(uid, data.sourcePreferences);
    
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw error;
  }
}

async function initializeUserPatterns(uid: string, interests: string[], hobbies: string[]): Promise<void> {
  try {
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
  }
}

async function initializeUserPreferences(
  uid: string, 
  sliders: { youtube: number; articles: number; papers: number; repos: number; tweets: number; discussions: number }
): Promise<void> {
  try {
    const total = sliders.youtube + sliders.articles + sliders.papers + sliders.repos + sliders.tweets + sliders.discussions;
    
    const sourceDistribution = total === 0 ? {
      video: 30, blog: 40, paper: 0, repo: 5, tweet: 5, discussion: 15, launch: 5, model: 0
    } : {
      video: Math.round((sliders.youtube / total) * 100),
      blog: Math.round((sliders.articles / total) * 100),
      paper: Math.round((sliders.papers / total) * 100),
      repo: Math.round((sliders.repos / total) * 100),
      tweet: Math.round((sliders.tweets / total) * 100),
      discussion: Math.round((sliders.discussions / total) * 100),
      launch: 0,
      model: 0,
    };
    
    const docRef = doc(firestore, COLLECTIONS.userPreferences, uid);
    await setDoc(docRef, {
      source_distribution: sourceDistribution,
      enabled_sources: {
        youtube: true,
        github: false,
        arxiv: false,
        exa_blog: true,
        exa_discussion: true,
        exa_launch: true,
        exa_tweet: true,
        exa_model: false,
      },
      format: { max_items: 20 },
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.error('Error initializing user preferences:', error);
  }
}

export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
    const cleanData = JSON.parse(JSON.stringify({
      ...data,
      updatedAt: serverTimestamp(),
    }));
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function getLatestUserFeed(uid: string): Promise<UserFeed | null> {
  try {
    const feedRef = collection(firestore, COLLECTIONS.userFeeds, uid, 'daily');
    const snapshot = await getDocs(feedRef);
    if (snapshot.empty) return null;
    
    const sortedDocs = snapshot.docs.sort((a, b) => b.id.localeCompare(a.id));
    return sortedDocs[0].data() as UserFeed;
  } catch (error) {
    console.error('Error getting latest feed:', error);
    return null;
  }
}
