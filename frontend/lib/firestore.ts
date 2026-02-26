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

export interface FeedItem {
  id: string;
  type?: string;
  source?: string;
  source_name?: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string | null;
  view_count?: number | null;
  stars?: number | null;
  tags?: string[];
  interest_id?: string;
  feed_type?: 'for_you' | 'deep_dives' | 'trending';
  published_date?: string;
  published_at?: string;
  fetched_at?: string;
  summary?: {
    short_article?: {
      subtitle?: string;
      outline?: string[];
      body?: string;
      key_takeaways?: string[];
      why_it_matters?: string;
    };
    reading_time_minutes?: number;
  };
  metadata?: {
    why_relevant?: string;
    is_hot?: boolean;
    feed_category?: string;
    feed_type?: string;
    source_description?: string;
  };
  _seen?: boolean;
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

export interface V3UserFeed {
  date: string;
  for_you: FeedItem[];
  deep_dives: FeedItem[];
  trending: FeedItem[];
  assembled_at?: string;
  metadata?: {
    for_you_count?: number;
    deep_dives_count?: number;
    trending_count?: number;
    total_items?: number;
    pipeline?: string;
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
  seniority?: string;
  interests: string[];
  selectedLearningSources?: string[];
  careerGoals?: string[];
  summaryStyle?: string;

  // Legacy fields (kept for backward compat with existing profiles)
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
  
  // Feed build status
  feedBuildStatus?: 'building' | 'ready' | string;
  feedBuildRequestedAt?: Timestamp | string | null;

  // Newsletter settings
  newsletterOptIn?: boolean; // Default true for subscribed users
  dailyNewsletterEnabled?: boolean; // Daily digest email preference
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

export const ROLES = [
  { id: 'designer', label: 'Designer', subtitle: 'UI/UX, Product, Visual' },
  { id: 'developer', label: 'Developer', subtitle: 'Frontend, Backend, Full-stack' },
  { id: 'pm', label: 'Product Manager', subtitle: 'Strategy & Roadmaps' },
  { id: 'marketer', label: 'Marketer', subtitle: 'Growth, Content, Brand' },
  { id: 'founder', label: 'Founder / CEO', subtitle: 'Building & Leading' },
  { id: 'other', label: 'Other', subtitle: 'Tell us your path' },
] as const;

export const SENIORITY_LEVELS = [
  { id: 'early', label: 'Early Career', subtitle: '0-3 years' },
  { id: 'mid', label: 'Mid-Level', subtitle: '3-7 years' },
  { id: 'senior', label: 'Senior', subtitle: '7-12 years' },
  { id: 'executive', label: 'Executive / Lead', subtitle: '12+ years' },
] as const;

export const ONBOARDING_INTERESTS = [
  { id: 'technology', label: 'AI & Machine Learning' },
  { id: 'experience', label: 'Design & UX' },
  { id: 'business-market', label: 'Product Strategy' },
  { id: 'startups', label: 'Startups & VC' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'marketing', label: 'Growth & Marketing' },
  { id: 'fintech', label: 'Fintech' },
  { id: 'health', label: 'Health & Wellness' },
  { id: 'web3', label: 'Web3 & Crypto' },
  { id: 'climate', label: 'Climate & Sustainability' },
  { id: 'productivity', label: 'Productivity' },
] as const;

export const LEARNING_SOURCE_CATEGORIES = [
  {
    id: 'design-ux',
    label: 'Design & UX',
    sources: [
      { name: 'Nielsen Norman Group', description: 'Evidence-based UX research and guidelines' },
      { name: 'The Pudding', description: 'Visual essays explaining ideas in culture and society' },
      { name: 'UX Movement', description: 'Practical UI/UX patterns and usability' },
      { name: 'Baymard Institute Blog', description: 'E-commerce UX research, checkout usability' },
      { name: 'Aeon Essays', description: 'Philosophy, science, society — deep thoughtful essays' },
      { name: 'Sidebar', description: 'The 5 best design links, curated daily' },
      { name: "It's Nice That", description: 'Visual design, creative industry, inspiration' },
      { name: 'Creative Boom', description: 'Design industry insights and creative career advice' },
    ],
  },
  {
    id: 'tech-engineering',
    label: 'Tech & Engineering',
    sources: [
      { name: 'Chip Huyen Blog', description: 'ML engineering, AI systems design' },
      { name: 'Simon Willison Blog', description: 'Python, LLMs, data, developer tools' },
      { name: 'Julia Evans Blog', description: 'Systems, networking, debugging explained simply' },
      { name: 'Martin Fowler', description: 'Software architecture, design patterns, refactoring' },
      { name: "Lil'Log (Lilian Weng)", description: 'In-depth AI/ML explainers from OpenAI researcher' },
      { name: 'Quanta Magazine', description: 'Math, physics, CS, biology — deep explainers' },
    ],
  },
  {
    id: 'business-strategy',
    label: 'Business & Strategy',
    sources: [
      { name: 'Stratechery', description: 'Tech strategy, business models, platform dynamics' },
      { name: 'Benedict Evans', description: 'Tech/market macro analysis, annual trend decks' },
      { name: 'Andrew Chen Blog', description: 'Growth, marketplaces, network effects' },
      { name: "Lenny's Newsletter", description: 'Product management, growth, career' },
      { name: 'Noahpinion', description: 'Economics, policy, technology and society' },
    ],
  },
  {
    id: 'startups-product',
    label: 'Startups & Product',
    sources: [
      { name: 'Paul Graham Essays', description: 'Startups, ideas, working on hard things' },
      { name: 'Elad Gil Blog', description: 'High-growth startups, scaling, executive advice' },
    ],
  },
  {
    id: 'productivity-growth',
    label: 'Productivity & Growth',
    sources: [
      { name: 'Farnam Street Blog', description: 'Mental models, decision-making, learning' },
      { name: 'James Clear Articles', description: 'Habits, continuous improvement, behavioral psychology' },
      { name: 'Cal Newport Blog', description: 'Deep work, focus, digital minimalism' },
    ],
  },
  {
    id: 'finance-markets',
    label: 'Finance & Markets',
    sources: [
      { name: 'Of Dollars and Data', description: 'Data-driven personal finance and investing' },
      { name: 'A Wealth of Common Sense', description: 'Investing, markets, financial planning — plain language' },
    ],
  },
] as const;

export const CAREER_GOALS = [
  { id: 'get-promoted', label: 'Get promoted', subtitle: 'Level up in my current role' },
  { id: 'switch-careers', label: 'Switch careers', subtitle: 'Pivot to a new field' },
  { id: 'build-something', label: 'Build something', subtitle: 'Launch a product or startup' },
  { id: 'lead-team', label: 'Lead a team', subtitle: 'Move into management' },
  { id: 'stay-sharp', label: 'Stay sharp', subtitle: 'Keep up with industry trends' },
  { id: 'grow-network', label: 'Grow my network', subtitle: 'Connect with the right people' },
] as const;

export const SUMMARY_STYLES = [
  {
    id: 'executive',
    label: 'Executive Brief',
    subtitle: 'Key takeaways + business impact. No jargon, just what matters.',
  },
  {
    id: 'practitioner',
    label: 'Practitioner Deep-Dive',
    subtitle: 'How-to details, frameworks, and actionable steps.',
  },
  {
    id: 'casual',
    label: 'Water Cooler Ready',
    subtitle: 'Talking points to sound smart in meetings. Casual but informed.',
  },
] as const;

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

export async function getV3UserFeed(uid: string): Promise<V3UserFeed | null> {
  try {
    const feedRef = collection(firestore, 'v3_user_feeds', uid, 'daily');
    const snapshot = await getDocs(feedRef);
    if (snapshot.empty) return null;

    const sortedDocs = snapshot.docs.sort((a, b) => b.id.localeCompare(a.id));
    const data = sortedDocs[0].data();
    const forYou = Array.isArray(data.for_you) ? data.for_you : [];
    const deepDives = Array.isArray(data.deep_dives) ? data.deep_dives : [];
    const trending = Array.isArray(data.trending) ? data.trending : [];

    if (forYou.length === 0 && deepDives.length === 0 && trending.length === 0) {
      return null;
    }

    return {
      date: data.date || sortedDocs[0].id,
      for_you: forYou as FeedItem[],
      deep_dives: deepDives as FeedItem[],
      trending: trending as FeedItem[],
      assembled_at: data.assembled_at,
      metadata: data.metadata,
    };
  } catch (error) {
    console.error('Error getting v3 feed:', error);
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
    seniority?: string;
    interests: string[];
    selectedLearningSources?: string[];
    careerGoals?: string[];
    summaryStyle?: string;
    interestQueries?: Record<string, string[]>;
    hobbies?: string[];
    skills?: string[];
    dislikedTopics?: string[];
    sourcePreferences?: {
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
    const docRef = doc(firestore, 'user_profiles', uid);
    
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    
    await setDoc(docRef, {
      ...cleanData,
      uid,
      onboarded: true,
      feedBuildStatus: 'building',
      feedBuildRequestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      onboardedAt: serverTimestamp(),
    }, { merge: true });
    
    const normalizedPreferences = data.sourcePreferences 
      ? normalizeSourcePreferences(data.sourcePreferences)
      : undefined;
    
    if (normalizedPreferences) {
      await initializeUserPreferences(uid, normalizedPreferences);
    }
    
    await initializeUserPatterns(uid, data.interests, data.hobbies || []);

    triggerFeedGeneration(uid);
    
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw error;
  }
}

export async function triggerFeedGeneration(uid: string): Promise<void> {
  try {
    const res = await fetch('/api/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    const text = await res.text();
    console.log('[FeedGen] Status:', res.status, 'Body:', text);
  } catch (error) {
    console.error('[FeedGen] Error:', error);
  }
}

// Update user profile
export async function recordLastActive(uid: string): Promise<void> {
  try {
    const docRef = doc(firestore, 'user_profiles', uid);
    await setDoc(docRef, { lastActiveAt: serverTimestamp() }, { merge: true });
  } catch {
    // fire-and-forget
  }
}

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

// ============ Streak + Insight + Weekly Wrap ============

export interface ReadingStreak {
  current_streak: number;
  longest_streak: number;
  last_read_date: string;
  total_days_read: number;
}

export interface DailyInsight {
  text: string;
  source_title: string;
  source_url: string;
  generated_at: string;
}

export interface WeeklyWrap {
  week_id: string;
  start_date: string;
  end_date: string;
  total_articles: number;
  days_with_feed: number;
  top_topics: string[];
  headline: string;
  summary: string;
  top_topic: string;
  fun_stat: string;
  generated_at: string;
}

function _todayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function _yesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getReadingStreak(uid: string): Promise<ReadingStreak> {
  const defaults: ReadingStreak = { current_streak: 0, longest_streak: 0, last_read_date: '', total_days_read: 0 };
  try {
    const ref = doc(firestore, 'user_streaks', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return defaults;
    return { ...defaults, ...(snap.data() as Partial<ReadingStreak>) };
  } catch { return defaults; }
}

export async function recordReadingDay(uid: string): Promise<ReadingStreak> {
  const today = _todayDateStr();
  const yesterday = _yesterdayDateStr();
  const ref = doc(firestore, 'user_streaks', uid);
  try {
    const snap = await getDoc(ref);
    const existing = snap.exists()
      ? (snap.data() as ReadingStreak)
      : { current_streak: 0, longest_streak: 0, last_read_date: '', total_days_read: 0 };
    if (existing.last_read_date === today) return existing;
    let newStreak = 1;
    if (existing.last_read_date === yesterday) newStreak = existing.current_streak + 1;
    const updated: ReadingStreak = {
      current_streak: newStreak,
      longest_streak: Math.max(existing.longest_streak, newStreak),
      last_read_date: today,
      total_days_read: existing.total_days_read + 1,
    };
    await setDoc(ref, updated, { merge: true });
    return updated;
  } catch {
    return { current_streak: 0, longest_streak: 0, last_read_date: '', total_days_read: 0 };
  }
}

export async function getDailyInsight(uid: string): Promise<DailyInsight | null> {
  try {
    const feedRef = collection(firestore, COLLECTIONS.userFeeds, uid, 'daily');
    const snapshot = await getDocs(feedRef);
    if (snapshot.empty) return null;
    const sortedDocs = snapshot.docs.sort((a, b) => b.id.localeCompare(a.id));
    const data = sortedDocs[0].data() as Record<string, unknown>;
    return (data?.daily_insight as DailyInsight) || null;
  } catch { return null; }
}

export async function getLatestWeeklyWrap(uid: string): Promise<WeeklyWrap | null> {
  try {
    const weeksRef = collection(firestore, 'user_weekly_wraps', uid, 'weeks');
    const q = query(weeksRef, orderBy('generated_at', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as WeeklyWrap;
  } catch { return null; }
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
