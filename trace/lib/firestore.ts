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
  
  // Subscription (web / Dodo)
  subscriptionStatus: 'none' | 'trial' | 'active' | 'on_hold' | 'cancelled' | 'expired';
  // Subscription (app / RevenueCat)
  appSubscriptionStatus?: 'none' | 'trial' | 'active' | 'expired';
  
  // Newsletter preferences
  newsletterOptIn?: boolean;
  
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
  summary?: {
    short_article?: {
      subtitle?: string;
      outline?: string[];
      body?: string;
    };
    reading_time_minutes?: number;
  };
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
  { id: 'technology', label: 'Technology' },
  { id: 'business-market', label: 'Business & Market' },
  { id: 'experience', label: 'Experience' },
  { id: 'productivity', label: 'Productivity' },
];

export const INTEREST_SUBTOPICS: Record<string, { id: string; label: string }[]> = {
  technology: [
    { id: 'ai', label: 'AI' },
    { id: 'automation', label: 'Automation' },
    { id: 'software-tech', label: 'Software & Tech' },
    { id: 'productivity-tools', label: 'Productivity Tools' },
    { id: 'future-tech', label: 'Future Tech' },
  ],
  'business-market': [
    { id: 'product-strategy', label: 'Product Strategy' },
    { id: 'market-trends', label: 'Market Trends' },
    { id: 'economy-impact', label: 'Economy & Impact' },
    { id: 'startups', label: 'Startups' },
    { id: 'marketing', label: 'Marketing' },
  ],
  experience: [
    { id: 'creative-process', label: 'Creative Process' },
    { id: 'design-tools', label: 'Design Tools' },
    { id: 'ux-design', label: 'UX Design' },
    { id: 'brand-storytelling', label: 'Brand & Storytelling' },
    { id: 'user-psychology', label: 'User Psychology' },
  ],
  productivity: [
    { id: 'career-growth', label: 'Career Growth' },
    { id: 'personal-finance', label: 'Personal Finance' },
    { id: 'soft-skills', label: 'Soft Skills' },
    { id: 'investments', label: 'Investments' },
    { id: 'wellbeing', label: 'Wellbeing' },
  ],
};

export const SKILL_SUGGESTIONS = [
  { id: 'design', label: 'Design' },
  { id: 'writing', label: 'Writing' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'business', label: 'Business' },
  { id: 'software-tech', label: 'Software & Tech' },
  { id: 'data-analytics', label: 'Data & Analytics' },
  { id: 'finance', label: 'Finance' },
  { id: 'education', label: 'Education' },
  { id: 'health-wellness', label: 'Health & Wellness' },
  { id: 'creative-arts', label: 'Creative Arts' },
];

// Sample feed items for preview
export const SAMPLE_FEED_ITEMS: FeedItem[] = [
  {
    id: '1',
    type: 'blog',
    title: 'A Simple Morning Routine That Actually Sticks',
    description: 'Why the first 30 minutes of your day determine the rest \u2014 and how to design them.',
    url: 'https://zenhabits.net/morning',
    thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&q=80',
    metadata: { why_relevant: 'Popular in Productivity', feed_category: 'trending_news', is_hot: true },
    tags: ['productivity'],
  },
  {
    id: '2',
    type: 'blog',
    title: 'How to Build a Budget You Will Keep Using',
    description: 'A no-guilt framework for tracking money that actually fits your life.',
    url: 'https://nerdwallet.com/budgeting',
    thumbnail: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80',
    metadata: { why_relevant: 'Popular in Money' },
    tags: ['money'],
  },
  {
    id: '3',
    type: 'news',
    title: 'Small Habits That Reduce Daily Stress',
    description: 'Psychologists share the micro-habits that compound into calmer days.',
    url: 'https://psychologytoday.com/stress',
    thumbnail: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&q=80',
    metadata: { why_relevant: 'Trending in Mental Wellness', is_hot: true },
    tags: ['mental-wellness'],
  },
  {
    id: '4',
    type: 'blog',
    title: 'How to Learn a New Skill Without Burning Out',
    description: 'The science of deliberate practice \u2014 minus the exhaustion.',
    url: 'https://medium.com/learning',
    metadata: { why_relevant: 'Popular in Learning' },
    tags: ['learning'],
  },
  {
    id: '5',
    type: 'video',
    title: 'The Hidden Power of Reading 20 Pages a Day',
    description: 'How a tiny reading habit can change your thinking in 6 months.',
    url: 'https://youtube.com/watch',
    thumbnail: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
    metadata: { why_relevant: 'Popular in Self-improvement' },
    tags: ['learning'],
  },
  {
    id: '6',
    type: 'blog',
    title: 'Why Walking Meetings Beat Sitting in a Room',
    description: 'Research shows walking boosts creative output by up to 60%.',
    url: 'https://hbr.org/walking-meetings',
    metadata: { why_relevant: 'Trending in Productivity', feed_category: 'suggested' },
    tags: ['productivity'],
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
    role?: string;
    interests: string[];
    interestQueries?: Record<string, string[]>;
    interestWeights?: Record<string, number>;
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

    if (data.role) {
      updateData.role = data.role;
    }
    
    if (data.interestQueries && Object.keys(data.interestQueries).length > 0) {
      updateData.interestQueries = data.interestQueries;
    }
    
    if (data.interestWeights && Object.keys(data.interestWeights).length > 0) {
      updateData.interestWeights = data.interestWeights;
    }
    
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

export async function deleteUserData(uid: string): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
    await setDoc(docRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error soft-deleting user data:', error);
    throw error;
  }
}

// ─── Web app base URL (same host the Dodo webhook & onboard API live on) ───
const WEB_APP_URL = 'https://www.yourtrace.online';
const FEED_GEN_DEFAULT_COOLDOWN_MS = 45_000;
const lastFeedGenTriggerAt = new Map<string, number>();

/**
 * Trigger the backend feed-generation pipeline for a user.
 * Calls the Next.js /api/onboard endpoint which dispatches a GitHub Action.
 * Fire-and-forget - failures are logged but never thrown.
 */
export async function triggerFeedGeneration(
  uid: string,
  options?: {
    reason?: 'onboarding' | 'preferences_edit' | 'purchase' | 'restore' | 'subscribed_fallback' | 'manual';
    force?: boolean;
    cooldownMs?: number;
  }
): Promise<boolean> {
  const reason = options?.reason || 'manual';
  const force = options?.force || false;
  const cooldownMs = options?.cooldownMs ?? FEED_GEN_DEFAULT_COOLDOWN_MS;
  const now = Date.now();
  const last = lastFeedGenTriggerAt.get(uid);
  if (!force && typeof last === 'number' && now - last < cooldownMs) {
    const waitMs = cooldownMs - (now - last);
    console.log(`[FeedGen] Skipping duplicate trigger for uid=${uid} reason=${reason}; cooldown ${waitMs}ms remaining`);
    return true;
  }

  const url = `${WEB_APP_URL}/api/onboard`;
  try {
    console.log(`[FeedGen] POST ${url} for uid=${uid} reason=${reason}`);
    lastFeedGenTriggerAt.set(uid, now);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    const text = await res.text();
    console.log(`[FeedGen] Status: ${res.status}, Body: ${text}`);
    if (res.ok) {
      try {
        const data = JSON.parse(text);
        const accepted = !!data.triggered || !!data.deduped;
        if (!accepted) {
          lastFeedGenTriggerAt.delete(uid);
        }
        return accepted;
      } catch {
        lastFeedGenTriggerAt.delete(uid);
        return false;
      }
    }
    lastFeedGenTriggerAt.delete(uid);
    return false;
  } catch (error) {
    lastFeedGenTriggerAt.delete(uid);
    console.error(`[FeedGen] Network error calling ${url}:`, error);
    return false;
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

/** Simple hash for generating stable IDs without Buffer/Node APIs. */
function _shortHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 8);
}

/**
 * Get trending news items (shown to unsubscribed users).
 * Reads from trending_news/{date}/topics subcollection and returns
 * up to `maxItems` FeedItem-shaped objects (no summaries).
 * Scans back up to 5 days to handle pipeline delays.
 */
export async function getTrendingFeed(maxItems = 6): Promise<FeedItem[]> {
  try {
    // Use IST date
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + istOffset);

    // Try today + last 4 days in case today's pipeline hasn't run yet
    const datesToTry: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(istNow.getTime() - i * 86400000);
      datesToTry.push(d.toISOString().split('T')[0]);
    }

    for (const date of datesToTry) {
      const topicsRef = collection(firestore, 'trending_news', date, 'topics');
      const snapshot = await getDocs(topicsRef);
      if (snapshot.empty) continue;

      const items: FeedItem[] = [];
      const perTopic = Math.max(2, Math.ceil(maxItems / snapshot.docs.length));

      for (const topicDoc of snapshot.docs) {
        const data = topicDoc.data();
        const articles: any[] = data.articles || [];
        const topicName: string = data.name || topicDoc.id;

        for (const article of articles.slice(0, perTopic)) {
          if (!article.url || !article.title) continue;
          const subtitle: string = article.subtitle || '';
          const details: string = article.details || '';
          items.push({
            id: `trending-${topicDoc.id}-${_shortHash(article.url)}`,
            title: article.title,
            url: article.url,
            type: 'news',
            source: article.source_domain || '',
            tags: [topicDoc.id],
            thumbnail: article.thumbnail || '',
            // Map backend subtitle/details → summary shape so FeedCard shows
            // the snippet and tapping opens the in-app detail view
            summary: (subtitle || details) ? {
              short_article: {
                subtitle,
                body: details || subtitle,
                outline: [],
              },
              reading_time_minutes: 2,
            } : undefined,
            metadata: {
              feed_category: 'trending_news',
              why_relevant: `Trending in ${topicName}`,
              is_hot: false,
            },
          });
          if (items.length >= maxItems) break;
        }
        if (items.length >= maxItems) break;
      }

      if (items.length > 0) {
        // Shuffle so same topics don't always appear first
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [items[i], items[j]] = [items[j], items[i]];
        }
        return items.slice(0, maxItems);
      }
    }

    console.log('[TrendingFeed] No trending news found in Firestore for last 5 days');
    return [];
  } catch (error) {
    console.error('Error getting trending feed:', error);
    return [];
  }
}

/**
 * @deprecated Use getTrendingFeed instead
 */
export async function getGeneralFeed(): Promise<UserFeed | null> {
  const items = await getTrendingFeed();
  if (!items.length) return null;
  return {
    date: new Date().toISOString().split('T')[0],
    items,
    metadata: { is_preview: true },
  };
}
