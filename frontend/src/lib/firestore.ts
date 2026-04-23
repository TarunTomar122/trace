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
import { firestore, auth } from './firebase';
import { patchAuthSessionCache } from './auth-session-cache';

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
  feed_type?: 'for_you' | 'trending';
  published_date?: string;
  published_at?: string;
  fetched_at?: string;
  signals?: Array<{
    id?: string;
    title: string;
    summary?: string;
    timestamp: string;
    source_name?: string;
    url?: string;
    signal_type?: string;
  }>;
  timeline?: Array<{
    id?: string;
    title: string;
    summary?: string;
    timestamp: string;
    source_name?: string;
    url?: string;
    signal_type?: string;
  }>;
  summary?: {
    short_article?: {
      subtitle?: string;
      outline?: string[];
      body?: string;
      slides?: string[];
      setup?: string;
      key_takeaways?: string[];
      why_it_matters?: string;
      learning_cards?: Array<{
        type: 'hook' | 'insight' | 'why' | 'bottom_line';
        emoji: string;
        content: string;
      }>;
    };
    worth_reading?: WorthReadingSummary;
    deep_dive?: {
      subtitle?: string;
      tldr?: string;
      chapters?: Array<{
        title: string;
        content: string;
        quote?: {
          text: string;
          source: string;
        };
      }>;
      bottom_line?: {
        title: string;
        content: string;
      };
      images?: string[];
    };
    reading_time_minutes?: number;
  };
  metadata?: {
    why_relevant?: string;
    is_hot?: boolean;
    feed_category?: string;
    feed_type?: string;
    source_description?: string;
    synthesized?: boolean;
    source_count?: number;
    pulse?: boolean;
    pulse_story?: boolean;
    theme?: string;
    heat?: number;
    signal_count?: number;
    source_labels?: string[];
    story_kind?: string;
  };
  sources?: Array<{
    name: string;
    title: string;
    url: string;
  }>;
  _seen?: boolean;
}

export interface TopicTimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
  source_name?: string;
  source_url?: string;
  article_url?: string;
}

export interface TrendingTopic {
  id: string;
  topic_key: string;
  title: string;
  summary: string;
  key_points?: string[];
  is_featured?: boolean;
  popularity_score?: number;
  article_count?: number;
  source_count?: number;
  interest_id?: string;
  thumbnail?: string | null;
  first_seen_at?: string;
  last_updated_at?: string;
  tags?: string[];
  timeline?: TopicTimelineEvent[];
  articles?: FeedItem[];
}

export interface WorthReadingSummary {
  paragraphs: string[];
}

export interface V3UserFeed {
  date: string;
  for_you: FeedItem[];
  pulse?: FeedItem[];
  daily_pulse?: {
    tools: FeedItem[];
    blogs: FeedItem[];
    discussions: FeedItem[];
  };
  community_pulse?: FeedItem[];
  build_pulse?: FeedItem[];
  trending: FeedItem[];
  trending_topics?: TrendingTopic[];
  assembled_at?: string;
  metadata?: {
    for_you_count?: number;
    trending_count?: number;
    trending_topics_count?: number;
    total_items?: number;
    pipeline?: string;
  };
  viewer_profile?: {
    role?: string;
    interests?: string[];
    onboarded?: boolean;
    subscription_status?: string;
    app_subscription_status?: string;
    has_access?: boolean;
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

  // Web affiliate attribution
  affiliateCode?: string | null;
  affiliateAttributedAt?: Timestamp | string | null;
  affiliateLandingPath?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmMedium?: string | null;
  timezone?: string;
  locale?: string;

  // Timestamps
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  onboardedAt: Timestamp | null;
}

export const INTERESTS = [
  { id: 'ai', label: 'AI' },
  { id: 'products', label: 'Products' },
  { id: 'tech', label: 'Tech' },
  { id: 'startups', label: 'Startups' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'ux-design', label: 'Design' },
  { id: 'markets', label: 'Markets' },
  { id: 'the-world', label: 'The World' },
];

export const INTEREST_SUBTOPICS: Record<string, { id: string; label: string }[]> = {
  ai: [
    { id: 'model-launches', label: 'Model Launches' },
    { id: 'agents', label: 'AI Agents' },
    { id: 'labs', label: 'Labs & Frontier Models' },
    { id: 'policy', label: 'AI Policy' },
    { id: 'tools', label: 'AI Tools' },
  ],
  tech: [
    { id: 'big-tech', label: 'Big Tech' },
    { id: 'consumer-tech', label: 'Consumer Tech' },
    { id: 'platforms', label: 'Platforms' },
    { id: 'devices', label: 'Devices' },
    { id: 'internet', label: 'Internet' },
  ],
  startups: [
    { id: 'funding', label: 'Funding' },
    { id: 'founders', label: 'Founders' },
    { id: 'm-and-a', label: 'M&A' },
    { id: 'early-stage', label: 'Early Stage' },
    { id: 'ecosystem', label: 'Ecosystem' },
  ],
  markets: [
    { id: 'earnings', label: 'Earnings' },
    { id: 'public-markets', label: 'Public Markets' },
    { id: 'company-strategy', label: 'Company Strategy' },
    { id: 'macro', label: 'Macro' },
    { id: 'deals', label: 'Deals' },
  ],
  engineering: [
    { id: 'developer-tools', label: 'Developer Tools' },
    { id: 'infra-cloud', label: 'Infra & Cloud' },
    { id: 'cybersecurity', label: 'Cybersecurity' },
    { id: 'open-source', label: 'Open Source' },
    { id: 'platform-engineering', label: 'Platform Engineering' },
  ],
  'ux-design': [
    { id: 'ux', label: 'UX Research' },
    { id: 'ui', label: 'UI' },
    { id: 'product-changes', label: 'Product Changes' },
    { id: 'app-redesigns', label: 'App Redesigns' },
    { id: 'design-systems', label: 'Design Systems' },
  ],
  products: [
    { id: 'product-launches', label: 'Product Launches' },
    { id: 'consumer-apps', label: 'Consumer Apps' },
    { id: 'b2b-tools', label: 'B2B Tools' },
    { id: 'product-strategy', label: 'Product Strategy' },
    { id: 'growth', label: 'Growth' },
  ],
  'the-world': [
    { id: 'policy', label: 'Policy' },
    { id: 'geopolitics', label: 'Geopolitics' },
    { id: 'climate', label: 'Climate' },
    { id: 'society', label: 'Society' },
    { id: 'economy', label: 'Economy' },
  ],
};

export const ROLES = [
  { id: 'developer', label: 'Developer', subtitle: 'Frontend, Backend, Full-stack' },
  { id: 'designer', label: 'Designer', subtitle: 'UI/UX, Product, Visual' },
  { id: 'pm', label: 'Product Manager', subtitle: 'Strategy & Roadmaps' },
  { id: 'founder', label: 'Founder / CEO', subtitle: 'Building & Leading' },
] as const;

export const SENIORITY_LEVELS = [
  { id: 'early', label: 'Student / Early Career', subtitle: '0-3 years' },
  { id: 'mid', label: 'Mid-Level', subtitle: '3-7 years' },
  { id: 'senior', label: 'Senior', subtitle: '7-12 years' },
  { id: 'executive', label: 'lead', subtitle: '12+ years' },
] as const;

export const ONBOARDING_INTERESTS = [
  { id: 'ai', label: 'AI' },
  { id: 'products', label: 'Products' },
  { id: 'tech', label: 'Tech' },
  { id: 'startups', label: 'Startups' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'ux-design', label: 'Design' },
  { id: 'markets', label: 'Markets' },
  { id: 'the-world', label: 'The World' },
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

// Get user profile from Firestore
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(firestore, 'user_profiles', uid);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
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


// Create initial user profile after sign in
export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string | null
): Promise<UserProfile> {
  const timezone = getLocalTimezone();
  const locale = getLocalLocale();
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
    affiliateCode: null,
    affiliateAttributedAt: null,
    affiliateLandingPath: null,
    utmSource: null,
    utmCampaign: null,
    utmMedium: null,
    timezone,
    locale,
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

    const u = auth.currentUser;
    if (u?.uid === uid) {
      patchAuthSessionCache(uid, u, {
        onboarded: true,
        role: data.role || '',
        interests: data.interests,
        name: data.name,
      });
    }
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

    const u = auth.currentUser;
    if (u?.uid === uid) {
      const patch: Parameters<typeof patchAuthSessionCache>[2] = {};
      if (data.onboarded !== undefined) patch.onboarded = data.onboarded;
      if (data.role !== undefined) patch.role = data.role;
      if (data.interests !== undefined) {
        patch.interests = Array.isArray(data.interests) ? data.interests : [];
      }
      if (data.name !== undefined) patch.name = data.name;
      if (data.email !== undefined) patch.email = data.email;
      if (data.displayName !== undefined) patch.displayName = data.displayName;
      if (data.photoURL !== undefined) patch.photoURL = data.photoURL;
      if (data.subscriptionStatus !== undefined) {
        patch.subscriptionStatus = data.subscriptionStatus;
      }
      if (data.appSubscriptionStatus !== undefined) {
        patch.appSubscriptionStatus = data.appSubscriptionStatus;
      }
      if (Object.keys(patch).length > 0) {
        patchAuthSessionCache(uid, u, patch);
      }
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export function getLocalTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.trim() ? tz.trim() : 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getLocalLocale(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return typeof locale === 'string' && locale.trim() ? locale.trim() : 'en-US';
  } catch {
    return 'en-US';
  }
}

export async function syncUserTimezone(
  uid: string,
  profile?: Pick<UserProfile, 'timezone' | 'locale'> | null
): Promise<void> {
  const timezone = getLocalTimezone();
  const locale = getLocalLocale();
  if (profile?.timezone === timezone && profile?.locale === locale) {
    return;
  }
  await updateUserProfile(uid, {
    timezone,
    locale,
  } as Partial<UserProfile>);
}

export async function syncAffiliateAttributionToProfile(
  uid: string,
  attribution: {
    code: string;
    landingPath?: string | null;
    utmSource?: string | null;
    utmCampaign?: string | null;
    utmMedium?: string | null;
  }
): Promise<void> {
  const existing = await getUserProfile(uid);
  if (existing?.affiliateCode) return;

  try {
    const docRef = doc(firestore, "user_profiles", uid);
    await setDoc(docRef, {
      affiliateCode: attribution.code,
      affiliateAttributedAt: serverTimestamp(),
      affiliateLandingPath: attribution.landingPath || null,
      utmSource: attribution.utmSource || null,
      utmCampaign: attribution.utmCampaign || null,
      utmMedium: attribution.utmMedium || null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("Error syncing affiliate attribution:", error);
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
