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
  limit,
  documentId,
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
  seniority?: string;
  interests: string[];
  selectedLearningSources?: string[];
  careerGoals?: string[];
  summaryStyle?: string;

  // Legacy fields (kept for backward compat with existing profiles)
  company?: string;
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
  lastActiveAt?: Timestamp | null;
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
  summary?: {
    short_article?: {
      subtitle?: string;
      headline?: string;  // For trending carousel
      slides?: string[];  // For trending carousel
      outline?: string[];
      body?: string;
      key_takeaways?: string[];
      why_it_matters?: string;
      learning_cards?: Array<{
        type: 'hook' | 'insight' | 'why' | 'takeaway';
        emoji: string;
        content: string;
      }>;
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
  items: FeedItem[];
  daily_insight?: {
    text: string;
    source_title: string;
    source_url: string;
    generated_at: string;
  };
  metadata?: {
    is_preview?: boolean;
    source_counts?: Record<string, number>;
    generated_at?: string;
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

// ============ Onboarding Constants ============

export const ROLES = [
  { id: 'designer', label: 'Designer', subtitle: 'UI/UX, Product, Visual', icon: 'palette' },
  { id: 'developer', label: 'Developer', subtitle: 'Frontend, Backend, Full-stack', icon: 'code' },
  { id: 'pm', label: 'Product Manager', subtitle: 'Strategy & Roadmaps', icon: 'clipboard-list' },
  { id: 'marketer', label: 'Marketer', subtitle: 'Growth, Content, Brand', icon: 'bar-chart-3' },
  { id: 'founder', label: 'Founder / CEO', subtitle: 'Building & Leading', icon: 'rocket' },
  { id: 'other', label: 'Other', subtitle: 'Tell us your path', icon: 'globe' },
] as const;

export const SENIORITY_LEVELS = [
  { id: 'early', label: 'Early Career', subtitle: '0-3 years', icon: 'leaf' },
  { id: 'mid', label: 'Mid-Level', subtitle: '3-7 years', icon: 'zap' },
  { id: 'senior', label: 'Senior', subtitle: '7-12 years', icon: 'award' },
  { id: 'executive', label: 'Executive / Lead', subtitle: '12+ years', icon: 'crown' },
] as const;

export const ONBOARDING_INTERESTS = [
  { id: 'technology', label: 'AI & Machine Learning', icon: 'cpu' },
  { id: 'experience', label: 'Design & UX', icon: 'palette' },
  { id: 'business-market', label: 'Product Strategy', icon: 'target' },
  { id: 'startups', label: 'Startups & VC', icon: 'rocket' },
  { id: 'leadership', label: 'Leadership', icon: 'users' },
  { id: 'engineering', label: 'Engineering', icon: 'settings' },
  { id: 'marketing', label: 'Growth & Marketing', icon: 'bar-chart-3' },
  { id: 'fintech', label: 'Fintech', icon: 'dollar-sign' },
  { id: 'health', label: 'Health & Wellness', icon: 'heart' },
  { id: 'web3', label: 'Web3 & Crypto', icon: 'link' },
  { id: 'climate', label: 'Climate & Sustainability', icon: 'globe' },
  { id: 'productivity', label: 'Productivity', icon: 'zap' },
] as const;

export const LEARNING_SOURCE_CATEGORIES = [
  {
    id: 'design-ux',
    label: 'Design & UX',
    icon: 'palette',
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
    icon: 'settings',
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
    icon: 'bar-chart-3',
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
    icon: 'rocket',
    sources: [
      { name: 'Paul Graham Essays', description: 'Startups, ideas, working on hard things' },
      { name: 'Elad Gil Blog', description: 'High-growth startups, scaling, executive advice' },
    ],
  },
  {
    id: 'productivity-growth',
    label: 'Productivity & Growth',
    icon: 'trending-up',
    sources: [
      { name: 'Farnam Street Blog', description: 'Mental models, decision-making, learning' },
      { name: 'James Clear Articles', description: 'Habits, continuous improvement, behavioral psychology' },
      { name: 'Cal Newport Blog', description: 'Deep work, focus, digital minimalism' },
    ],
  },
  {
    id: 'finance-markets',
    label: 'Finance & Markets',
    icon: 'dollar-sign',
    sources: [
      { name: 'Of Dollars and Data', description: 'Data-driven personal finance and investing' },
      { name: 'A Wealth of Common Sense', description: 'Investing, markets, financial planning — plain language' },
    ],
  },
] as const;

export const CAREER_GOALS = [
  { id: 'get-promoted', label: 'Get promoted', subtitle: 'Level up in my current role', icon: 'trending-up' },
  { id: 'switch-careers', label: 'Switch careers', subtitle: 'Pivot to a new field', icon: 'refresh-cw' },
  { id: 'build-something', label: 'Build something', subtitle: 'Launch a product or startup', icon: 'wrench' },
  { id: 'lead-team', label: 'Lead a team', subtitle: 'Move into management', icon: 'users' },
  { id: 'stay-sharp', label: 'Stay sharp', subtitle: 'Keep up with industry trends', icon: 'brain' },
  { id: 'grow-network', label: 'Grow my network', subtitle: 'Connect with the right people', icon: 'globe' },
] as const;

// Legacy constants (kept for backward compat with old onboarding code paths)
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
    role: string;
    seniority: string;
    interests: string[];
    selectedLearningSources: string[];
    careerGoals: string[];
  }
): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);

    const updateData: Record<string, unknown> = {
      name: data.name,
      role: data.role,
      seniority: data.seniority,
      interests: data.interests,
      selectedLearningSources: data.selectedLearningSources,
      careerGoals: data.careerGoals,
      onboarded: true,
      updatedAt: serverTimestamp(),
      onboardedAt: serverTimestamp(),
    };
    
    updateData.feedBuildStatus = 'building';
    updateData.feedBuildRequestedAt = serverTimestamp();
    
    await setDoc(docRef, updateData, { merge: true });
    
    // Initialize user patterns with interests
    await initializeUserPatterns(uid, data.interests, []);
    
    // Initialize default preferences
    await initializeUserPreferences(uid, {
      youtube: 5, articles: 7, papers: 2,
      repos: 3, tweets: 3, discussions: 4,
    });

    triggerFeedGeneration(uid, { reason: 'onboarding', force: true });
    
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

export async function recordLastActive(uid: string): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
    await setDoc(docRef, { lastActiveAt: serverTimestamp() }, { merge: true });
  } catch {
    // fire-and-forget — don't block the UI for this
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

export async function getV3UserFeed(uid: string): Promise<V3UserFeed | null> {
  try {
    // Fetch user-specific feed (for_you, deep_dives)
    const feedRef = collection(firestore, 'v3_user_feeds', uid, 'daily');
    const latestQuery = query(feedRef, orderBy(documentId(), 'desc'), limit(1));
    const snapshot = await getDocs(latestQuery);

    // Fetch GLOBAL trending feed (shared by all users)
    const globalFeedRef = collection(firestore, 'v3_user_feeds', '_global', 'daily');
    const globalQuery = query(globalFeedRef, orderBy(documentId(), 'desc'), limit(1));
    const globalSnapshot = await getDocs(globalQuery);

    let forYou: FeedItem[] = [];
    let deepDives: FeedItem[] = [];
    let trending: FeedItem[] = [];
    let feedDate = '';
    let assembledAt: string | undefined;
    let metadata: V3UserFeed['metadata'];

    // Get user's for_you and deep_dives
    if (!snapshot.empty) {
      const latestDoc = snapshot.docs[0];
      const data = latestDoc.data();
      feedDate = data.date || latestDoc.id;
      assembledAt = data.assembled_at;
      metadata = data.metadata;
      forYou = Array.isArray(data.for_you) ? data.for_you : [];
      deepDives = Array.isArray(data.deep_dives) ? data.deep_dives : [];
      console.log('[Feed] User feed doc:', latestDoc.id, 'for_you:', forYou.length, 'deep_dives:', deepDives.length);
    }

    // Get trending from global feed (new system) or fallback to user feed (legacy)
    if (!globalSnapshot.empty) {
      const globalDoc = globalSnapshot.docs[0];
      const globalData = globalDoc.data();
      trending = Array.isArray(globalData.trending) ? globalData.trending : [];
      console.log('[Feed] Global trending doc:', globalDoc.id, 'items:', trending.length);
    }

    // Fallback: if no global trending, try user's own trending (legacy per-user feeds)
    if (trending.length === 0 && !snapshot.empty) {
      const data = snapshot.docs[0].data();
      trending = Array.isArray(data.trending) ? data.trending : [];
      if (trending.length > 0) {
        console.log('[Feed] Using legacy user trending:', trending.length);
      }
    }

    if (forYou.length === 0 && deepDives.length === 0 && trending.length === 0) {
      console.log('[Feed] All sections empty');
      return null;
    }

    return {
      date: feedDate,
      for_you: forYou as FeedItem[],
      deep_dives: deepDives as FeedItem[],
      trending: trending as FeedItem[],
      assembled_at: assembledAt,
      metadata,
    };
  } catch (error) {
    console.error('Error getting v3 feed:', error);
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
 * Get trending feed for unsubscribed users.
 *
 * Priority:
 * 1) unified_newsletters/{date} so app trending = newsletter content
 * 2) fallback to trending_news/{date}/topics if unified draft is missing
 *
 * Scans back up to 5 days to handle pipeline delays.
 */
export async function getTrendingFeed(maxItems = 8): Promise<FeedItem[]> {
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
      // Prefer unified newsletter items so app + email stay in sync.
      const unifiedRef = doc(firestore, 'unified_newsletters', date);
      const unifiedSnap = await getDoc(unifiedRef);
      if (unifiedSnap.exists()) {
        const unifiedData = unifiedSnap.data() as any;
        const unifiedItems: any[] = unifiedData?.items || [];
        const mapped = unifiedItems
          .filter((item) => item?.url && item?.title)
          .slice(0, maxItems)
          .map((item) => {
            const summaryText: string = item.summary || '';
            const topicName: string = item.topic_name || item.topic_id || 'Trending';
            return {
              id: `trending-unified-${_shortHash(item.url)}`,
              title: item.title,
              url: item.url,
              type: item.type || 'news',
              source: item.source || 'trending_news',
              tags: item.tags || (item.topic_id ? [item.topic_id] : []),
              thumbnail: item.thumbnail || '',
              summary: summaryText
                ? {
                    short_article: {
                      subtitle: summaryText,
                      body: summaryText,
                      outline: [],
                    },
                    reading_time_minutes: 2,
                  }
                : undefined,
              metadata: {
                feed_category: 'trending_news',
                why_relevant: `Trending in ${topicName}`,
                is_hot: true,
              },
            } as FeedItem;
          });

        if (mapped.length > 0) {
          return mapped;
        }
      }

      // Fallback path: raw trending topics.
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

      if (items.length > 0) return items.slice(0, maxItems);
    }

    console.log('[TrendingFeed] No trending/unified content found for last 5 days');
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

// ============ Daily Insight ============

export interface DailyInsight {
  text: string;
  source_title: string;
  source_url: string;
  generated_at: string;
}

export async function getDailyInsight(uid: string): Promise<DailyInsight | null> {
  try {
    const feedRef = collection(firestore, COLLECTIONS.userFeeds, uid, 'daily');
    const snapshot = await getDocs(feedRef);
    if (snapshot.empty) return null;
    const sortedDocs = snapshot.docs.sort((a, b) => b.id.localeCompare(a.id));
    const data = sortedDocs[0].data() as any;
    return data?.daily_insight || null;
  } catch {
    return null;
  }
}

// ============ Reading Streak ============

export interface ReadingStreak {
  current_streak: number;
  longest_streak: number;
  last_read_date: string;
  total_days_read: number;
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

function _weekStartDateStr(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sunday, 1=Monday
  const daysSinceMonday = (day + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getReadingStreak(uid: string): Promise<ReadingStreak> {
  const defaults: ReadingStreak = {
    current_streak: 0,
    longest_streak: 0,
    last_read_date: '',
    total_days_read: 0,
  };
  try {
    const ref = doc(firestore, 'user_streaks', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return defaults;
    const data = snap.data() as Partial<ReadingStreak>;
    return { ...defaults, ...data };
  } catch {
    return defaults;
  }
}

export async function recordReadingDay(uid: string): Promise<ReadingStreak> {
  const today = _todayDateStr();
  const yesterday = _yesterdayDateStr();
  const ref = doc(firestore, 'user_streaks', uid);

  try {
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as ReadingStreak) : {
      current_streak: 0,
      longest_streak: 0,
      last_read_date: '',
      total_days_read: 0,
    };

    if (existing.last_read_date === today) return existing;

    let newStreak = 1;
    if (existing.last_read_date === yesterday) {
      newStreak = existing.current_streak + 1;
    }

    const updated: ReadingStreak = {
      current_streak: newStreak,
      longest_streak: Math.max(existing.longest_streak, newStreak),
      last_read_date: today,
      total_days_read: existing.total_days_read + 1,
    };

    await setDoc(ref, updated, { merge: true });
    return updated;
  } catch {
    return {
      current_streak: 0,
      longest_streak: 0,
      last_read_date: '',
      total_days_read: 0,
    };
  }
}

// ============ Weekly Wrap ============

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

export async function getLatestWeeklyWrap(uid: string): Promise<WeeklyWrap | null> {
  try {
    const weeksRef = collection(firestore, 'user_weekly_wraps', uid, 'weeks');
    const q = query(weeksRef, orderBy('generated_at', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as WeeklyWrap;
  } catch {
    return null;
  }
}

// ============ Free Daily Read Tracking ============

export async function getFreeDailyReadUsed(uid: string): Promise<boolean> {
  try {
    const today = _todayDateStr();
    const ref = doc(firestore, 'user_free_reads', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as any;
    return data?.last_free_read_date === today;
  } catch {
    return false;
  }
}

export async function markFreeDailyReadUsed(uid: string): Promise<void> {
  try {
    const today = _todayDateStr();
    const ref = doc(firestore, 'user_free_reads', uid);
    await setDoc(ref, { last_free_read_date: today }, { merge: true });
  } catch {
    // best-effort
  }
}

export async function getFreeWeeklyDeepDiveUsed(uid: string): Promise<boolean> {
  try {
    const weekStart = _weekStartDateStr();
    const ref = doc(firestore, 'user_free_deep_dives', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as any;
    return data?.last_free_deep_dive_week_start === weekStart;
  } catch {
    return false;
  }
}

export async function markFreeWeeklyDeepDiveUsed(uid: string): Promise<void> {
  try {
    const weekStart = _weekStartDateStr();
    const ref = doc(firestore, 'user_free_deep_dives', uid);
    await setDoc(ref, { last_free_deep_dive_week_start: weekStart }, { merge: true });
  } catch {
    // best-effort
  }
}

// ============ Force Update Check ============

function _compareVersions(current: string, minimum: string): boolean {
  const c = current.split('.').map(Number);
  const m = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    const cv = c[i] || 0;
    const mv = m[i] || 0;
    if (cv < mv) return false;
    if (cv > mv) return true;
  }
  return true;
}

/**
 * Checks Firestore doc `app_config/version` for a `min_version` field.
 * Returns true if the current app version meets the minimum, false if update needed.
 * Defaults to true (no blocking) on any error.
 */
export async function checkMinAppVersion(currentVersion: string): Promise<boolean> {
  try {
    const ref = doc(firestore, 'app_config', 'version');
    const snap = await getDoc(ref);
    if (!snap.exists()) return true;
    const data = snap.data() as { min_version?: string };
    if (!data.min_version) return true;
    return _compareVersions(currentVersion, data.min_version);
  } catch {
    return true;
  }
}
