import {
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  setDoc,
  serverTimestamp,
  Timestamp,
  collection,
  getDocs,
  getDocsFromCache,
  query,
  orderBy,
  limit,
  documentId,
  runTransaction,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from './firebase';

const FEED_CACHE_PREFIX = 'trace_v3_feed_snapshot_v1:';

function feedCacheKey(uid: string): string {
  return `${FEED_CACHE_PREFIX}${uid}`;
}

async function readCachedFeed(uid: string): Promise<V3UserFeed | null> {
  try {
    const raw = await AsyncStorage.getItem(feedCacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as V3UserFeed;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (error) {
    console.warn('[Feed] Failed to read cached feed snapshot:', error);
    return null;
  }
}

async function writeCachedFeed(uid: string, feed: V3UserFeed): Promise<void> {
  try {
    await AsyncStorage.setItem(feedCacheKey(uid), JSON.stringify(feed));
  } catch (error) {
    console.warn('[Feed] Failed to write cached feed snapshot:', error);
  }
}

function normalizeFeedRole(role?: string | null): string {
  const normalized = String(role || '').trim().toLowerCase();
  if (!normalized) return '';
  if (
    normalized === 'developer' ||
    normalized === 'engineer' ||
    normalized === 'software engineer' ||
    normalized === 'software developer' ||
    normalized === 'full stack developer' ||
    normalized === 'full-stack developer'
  ) {
    return 'developer';
  }
  if (
    normalized === 'designer' ||
    normalized === 'product designer' ||
    normalized === 'ux designer' ||
    normalized === 'ui designer'
  ) {
    return 'designer';
  }
  if (normalized === 'pm' || normalized === 'product manager') {
    return 'pm';
  }
  if (
    normalized === 'marketer' ||
    normalized === 'marketing' ||
    normalized === 'growth marketer' ||
    normalized === 'creator'
  ) {
    return 'marketer';
  }
  if (normalized === 'data scientist') {
    return 'developer';
  }
  if (normalized === 'founder' || normalized === 'co-founder' || normalized === 'startup founder') {
    return 'founder';
  }
  return normalized;
}

function canonicalUrlKey(url?: string | null): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
      'gclid', 'fbclid',
    ];
    for (const p of trackingParams) parsed.searchParams.delete(p);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    const query = parsed.searchParams.toString();
    return `${parsed.hostname.toLowerCase()}${normalizedPath}${query ? `?${query}` : ''}`;
  } catch {
    return raw
      .replace(/#.*$/, '')
      .replace(/[?&](utm_[^=&]+|gclid|fbclid)=[^&]*/g, '')
      .replace(/[?&]$/, '')
      .trim();
  }
}

function normalizeTitle(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceTitleKey(item: FeedItem): string {
  const source = String(item.source_name || item.source || '').trim().toLowerCase();
  const title = normalizeTitle(item.title);
  if (!title) return '';
  return `${source}|${title}`;
}

function dedupeFeedItems(items: FeedItem[]): FeedItem[] {
  const seenUrl = new Set<string>();
  const seenId = new Set<string>();
  const seenSourceTitle = new Set<string>();
  const out: FeedItem[] = [];
  for (const item of items) {
    const urlKey = canonicalUrlKey(item.url);
    const idKey = String(item.id || '').trim();
    const sourceTitle = sourceTitleKey(item);

    if (urlKey && seenUrl.has(urlKey)) continue;
    if (idKey && seenId.has(idKey)) continue;
    if (sourceTitle && seenSourceTitle.has(sourceTitle)) continue;

    if (urlKey) seenUrl.add(urlKey);
    if (idKey) seenId.add(idKey);
    if (sourceTitle) seenSourceTitle.add(sourceTitle);
    out.push(item);
  }
  return out;
}

function dedupeTrendingTopics(items: TrendingTopic[]): TrendingTopic[] {
  const seen = new Set<string>();
  const out: TrendingTopic[] = [];
  for (const topic of items) {
    const titleKey = normalizeTitle(topic.title);
    const key = String(topic.topic_key || topic.id || '').trim() || titleKey;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
  }
  return out;
}

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

  // Early adopter (launch promo - free access for first N users)
  isEarlyAdopter?: boolean;
  earlyAdopterOfferSeen?: boolean;

  // Newsletter preferences
  newsletterOptIn?: boolean;

  // Push notification preferences
  pushNotificationsEnabled?: boolean;
  pushToken?: string;
  pushTokenUpdatedAt?: string;

  // Feed build status (for new user onboarding)
  feedBuildStatus?: 'pending' | 'building' | 'ready' | 'error';
  feedBuildRequestedAt?: string;

  // How did they find us (onboarding)
  referralSource?: 'friend' | 'youtube' | 'twitter' | 'instagram' | 'other';
  timezone?: string;
  locale?: string;

  // App store review
  hasRequestedReview?: boolean;
  reviewRequestedAt?: string;

  // Timestamps
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  onboardedAt: Timestamp | null;
  lastActiveAt?: Timestamp | null;
}

export type UserProfileSource = 'server' | 'server_no_profile' | 'cache' | 'none';

export interface UserProfileResult {
  profile: UserProfile | null;
  source: UserProfileSource;
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
  feed_type?: 'for_you' | 'deep_dives' | 'trending' | 'curated';
  published_date?: string;
  summary?: {
    short_article?: {
      subtitle?: string;
      headline?: string;  // For trending carousel
      slides?: string[];  // For trending carousel
      outline?: string[];
      body?: string;
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
    curated?: boolean;
    curated_platform?: string;
    curated_url_type?: string;
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

export interface MergedFeedItem {
  id: string;
  item_kind: 'topic_now' | 'article_worth_reading';
  label: 'Now' | 'Worth Reading' | 'Signal' | 'Explainer';
  interest_id?: string;
  topic_id?: string;
  article_id?: string;
  published_date?: string;
  last_updated_at?: string;
  source_count?: number;
  article_count?: number;
  display_summary?: string;
  display_key_points?: string[];
  worth_reading?: WorthReadingSummary;
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

export interface DailyPulseBucket {
  tools: FeedItem[];
  blogs: FeedItem[];
  discussions: FeedItem[];
}

export interface V3UserFeed {
  date: string;
  for_you?: FeedItem[];
  curated?: FeedItem[];
  community_pulse?: FeedItem[];
  build_pulse?: FeedItem[];
  daily_pulse?: DailyPulseBucket;
  trending: FeedItem[];
  trending_topics?: TrendingTopic[];
  merged_feed?: MergedFeedItem[];
  assembled_at?: string;
  metadata?: {
    for_you_count?: number;
    trending_count?: number;
    trending_topics_count?: number;
    merged_feed_count?: number;
    total_items?: number;
    pipeline?: string;
  };
}

// ============ Onboarding Constants ============

export const ROLES = [
  { id: 'designer', label: 'Designer', subtitle: 'UI/UX, Product, Visual', icon: 'palette' },
  { id: 'developer', label: 'Developer', subtitle: 'Frontend, Backend, Full-stack', icon: 'code' },
  { id: 'pm', label: 'PM', subtitle: 'Strategy & Roadmaps', icon: 'clipboard-list' },
  { id: 'marketer', label: 'Marketer', subtitle: 'Growth, Content, Brand', icon: 'bar-chart-3' },
  { id: 'founder', label: 'Founder / CEO', subtitle: 'Building & Leading', icon: 'rocket' },
  { id: 'other', label: 'Other', subtitle: 'Tell us your path', icon: 'globe' },
] as const;

export const SENIORITY_LEVELS = [
  { id: 'early', label: 'Early Career', subtitle: '0-3 years', icon: 'leaf' },
  { id: 'mid', label: 'Mid-Level', subtitle: '3-7 years', icon: 'zap' },
  { id: 'senior', label: 'Senior', subtitle: '7-12 years', icon: 'award' },
  { id: 'executive', label: 'lead', subtitle: '12+ years', icon: 'crown' },
] as const;

export const ONBOARDING_INTERESTS = [
  { id: 'ai', label: 'AI', icon: 'cpu' },
  { id: 'products', label: 'Products', icon: 'package' },
  { id: 'tech', label: 'Tech', icon: 'code' },
  { id: 'startups', label: 'Startups', icon: 'rocket' },
  { id: 'engineering', label: 'Engineering', icon: 'settings' },
  { id: 'ux-design', label: 'UX Design', icon: 'palette' },
  { id: 'markets', label: 'Markets', icon: 'bar-chart-3' },
  { id: 'the-world', label: 'The World', icon: 'globe' },
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
  { id: 'ai', label: 'AI' },
  { id: 'products', label: 'Products' },
  { id: 'tech', label: 'Tech' },
  { id: 'startups', label: 'Startups' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'ux-design', label: 'UX Design' },
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

/**
 * Save how the user found us (referral source) - called during sign up flow.
 */
export async function saveReferralSource(
  uid: string,
  source: 'friend' | 'youtube' | 'twitter' | 'instagram' | 'other'
): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
    await setDoc(docRef, { referralSource: source }, { merge: true });
  } catch (error) {
    console.error('Error saving referral source:', error);
  }
}

/**
 * Mark that we've requested a review from this user (to avoid asking again).
 */
export async function markReviewRequested(uid: string): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
    await setDoc(
      docRef,
      {
        hasRequestedReview: true,
        reviewRequestedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error marking review requested:', error);
  }
}

export async function getUserProfileWithSource(uid: string, options?: { serverOnly?: boolean }): Promise<UserProfileResult> {
  const firstNonEmptyString = (...values: Array<string | null | undefined>): string => {
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    return '';
  };

  const mergeProfileIdentity = (
    primary: UserProfile,
    fallback?: UserProfile | null
  ): UserProfile => {
    const displayName = firstNonEmptyString(
      primary.displayName,
      primary.name,
      fallback?.displayName,
      fallback?.name
    );
    const name = firstNonEmptyString(
      primary.name,
      primary.displayName,
      fallback?.name,
      fallback?.displayName
    );
    const email = firstNonEmptyString(primary.email, fallback?.email);
    const photoURL =
      firstNonEmptyString(primary.photoURL || '', fallback?.photoURL || '') || null;

    return {
      ...primary,
      displayName,
      name,
      email,
      photoURL,
    };
  };

  const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
  const serverOnly = options?.serverOnly ?? false;
  let cachedProfile: UserProfile | null = null;

  if (!serverOnly) {
    // Read cache first for fast startup, but don't trust it as the final truth.
    try {
      const cached = await getDocFromCache(docRef);
      if (cached.exists()) {
        cachedProfile = mergeProfileIdentity(cached.data() as UserProfile);
      }
    } catch {
      // No cached profile yet; continue to server fetch below.
    }
  }

  try {
    // Server-only retries get a generous timeout since we're not blocking startup.
    const serverTimeoutMs = serverOnly ? 10000 : (cachedProfile ? 3000 : 5000);
    const docSnap = await Promise.race([
      getDocFromServer(docRef),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), serverTimeoutMs)),
    ]);
    if (!docSnap) {
      console.log('[Profile] Server fetch timed out, falling back to cache:', !!cachedProfile);
      return {
        profile: cachedProfile,
        source: cachedProfile ? 'cache' : 'none',
      };
    }
    if (docSnap.exists()) {
      console.log('[Profile] Server returned profile for uid:', uid, 'onboarded:', (docSnap.data() as any)?.onboarded);
      return {
        profile: mergeProfileIdentity(docSnap.data() as UserProfile, cachedProfile),
        source: 'server',
      };
    }
    // Doc does not exist on server — we reached the server but there's no profile.
    console.log('[Profile] Server confirmed no profile exists for uid:', uid);
    return { profile: null, source: 'server_no_profile' };
  } catch (error) {
    console.warn('[Profile] Server fetch error, falling back to cache:', error);
    return {
      profile: cachedProfile,
      source: cachedProfile ? 'cache' : 'none',
    };
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const result = await getUserProfileWithSource(uid);
  return result.profile;
}

export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string | null
): Promise<UserProfile> {
  const timezone = getLocalTimezone();
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
    timezone,
    locale: getLocalLocale(),
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
  const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);

  // Use a transaction to atomically check-then-create, preventing the race
  // where a slow getUserProfile returns null and createUserProfile overwrites
  // an existing onboarded profile with a fresh onboarded:false one.
  try {
    return await runTransaction(firestore, async (transaction) => {
      const docSnap = await transaction.get(docRef);

      if (docSnap.exists()) {
        const existing = docSnap.data() as UserProfile;
        const identityPatch: Partial<UserProfile> = {};
        if (!String(existing.email || '').trim() && email) {
          identityPatch.email = email;
        }
        if (!String(existing.displayName || '').trim() && displayName) {
          identityPatch.displayName = displayName;
        }
        if (!String(existing.name || '').trim() && displayName) {
          identityPatch.name = displayName;
        }
        if (!existing.photoURL && photoURL) {
          identityPatch.photoURL = photoURL;
        }
        if (Object.keys(identityPatch).length > 0) {
          transaction.update(docRef, { ...identityPatch, updatedAt: serverTimestamp() });
          return { ...existing, ...identityPatch };
        }
        return existing;
      }

      const timezone = getLocalTimezone();
      const newProfile: UserProfile = {
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
          youtube: 5, articles: 7, papers: 2,
          repos: 3, tweets: 3, discussions: 4,
        },
        contentDepth: null,
        subscriptionStatus: 'none',
        timezone,
        locale: getLocalLocale(),
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        onboardedAt: null,
      };
      transaction.set(docRef, newProfile);
      return newProfile;
    });
  } catch (error) {
    console.error('[Auth] getOrCreateUserProfile transaction failed:', error);
    // Fallback: try a non-transactional read — if profile exists, return it.
    const fallback = await getUserProfile(uid);
    if (fallback) return fallback;
    throw error;
  }
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
  if (!uid) {
    console.warn('updateUserProfile called without uid, skipping');
    return;
  }
  try {
    const docRef = doc(firestore, COLLECTIONS.userProfiles, uid);
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, { ...cleanData, updatedAt: serverTimestamp() }, { merge: true });
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
  if (!uid) return;
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

export async function recordLastActive(uid: string): Promise<void> {
  if (!uid) return;
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

// ─── Web app base URL ───
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

export async function getV3UserFeed(
  uid: string,
  options?: { role?: string | null }
): Promise<V3UserFeed | null> {
  const fetchQueryWithFallback = async (
    q: ReturnType<typeof query>,
    label: string,
  ) => {
    try {
      return await getDocs(q);
    } catch (error) {
      console.warn(`[Feed] ${label} server fetch failed, trying Firestore cache:`, error);
      try {
        return await getDocsFromCache(q);
      } catch (cacheError) {
        console.warn(`[Feed] ${label} cache fetch failed:`, cacheError);
        return null;
      }
    }
  };

  try {
    const normalizedRole = normalizeFeedRole(options?.role);
    // Fetch user-specific feed (for_you)
    const feedRef = collection(firestore, 'v3_user_feeds', uid, 'daily');
    const latestQuery = query(feedRef, orderBy(documentId(), 'desc'), limit(5));
    const snapshot = await fetchQueryWithFallback(latestQuery, 'user feed');

    // Fetch GLOBAL trending feed (shared by all users).
    // Read a few days so we can recover from partial latest docs.
    const globalFeedRef = collection(firestore, 'v3_user_feeds', '_global', 'daily');
    const globalQuery = query(globalFeedRef, orderBy(documentId(), 'desc'), limit(5));
    const globalSnapshot = await fetchQueryWithFallback(globalQuery, 'global feed');

    let forYou: FeedItem[] = [];
    let trending: FeedItem[] = [];
    let trendingTopics: TrendingTopic[] = [];
    let mergedFeed: MergedFeedItem[] = [];
    let userTrending: FeedItem[] = [];
    let userTrendingTopics: TrendingTopic[] = [];
    let roleBasedForYou: FeedItem[] = [];
    let curated: FeedItem[] = [];
    let communityPulse: FeedItem[] = [];
    let buildPulse: FeedItem[] = [];
    let dailyPulse: DailyPulseBucket | undefined;
    let feedDate = '';
    let assembledAt: string | undefined;
    let metadata: V3UserFeed['metadata'];

    // Get the latest available user content per section instead of assuming
    // the newest daily doc already has every lane populated.
    if (snapshot && !snapshot.empty) {
      const userDocs = snapshot.docs;
      const latestDoc = userDocs[0];
      const latestData = latestDoc.data() as any;
      feedDate = latestData.date || latestDoc.id;
      assembledAt = latestData.assembled_at;
      metadata = latestData.metadata;

      for (const docSnap of userDocs) {
        const data = docSnap.data() as any;
        if (forYou.length === 0 && Array.isArray(data.for_you) && data.for_you.length > 0) {
          forYou = data.for_you;
        }
        if (userTrending.length === 0 && Array.isArray(data.trending) && data.trending.length > 0) {
          userTrending = data.trending;
        }
        if (
          mergedFeed.length === 0 &&
          Array.isArray(data.merged_feed) &&
          data.merged_feed.length > 0
        ) {
          mergedFeed = data.merged_feed;
        }
        if (
          userTrendingTopics.length === 0 &&
          Array.isArray(data.trending_topics) &&
          data.trending_topics.length > 0
        ) {
          userTrendingTopics = data.trending_topics;
        }
        if (
          forYou.length > 0 &&
          mergedFeed.length > 0 &&
          userTrending.length > 0 &&
          userTrendingTopics.length > 0
        ) {
          break;
        }
      }
      console.log('[Feed] User feed doc:', latestDoc.id, 'for_you:', forYou.length);
    }

    // Get trending from global feed.
    // Prefer the newest doc that actually has trending content.
    if (globalSnapshot && !globalSnapshot.empty) {
      const globalDocs = globalSnapshot.docs;
      let selectedGlobalDocId = globalDocs[0].id;
      for (const globalDoc of globalDocs) {
        const globalData = globalDoc.data() as any;
        const candidateTrending = Array.isArray(globalData.trending) ? globalData.trending : [];
        const candidateTopics = Array.isArray(globalData.trending_topics) ? globalData.trending_topics : [];
        const roleMap = globalData.for_you_roles && typeof globalData.for_you_roles === 'object'
          ? globalData.for_you_roles
          : null;
        const communityRoleMap = globalData.community_pulse_roles && typeof globalData.community_pulse_roles === 'object'
          ? globalData.community_pulse_roles
          : null;
        const buildRoleMap = globalData.build_pulse_roles && typeof globalData.build_pulse_roles === 'object'
          ? globalData.build_pulse_roles
          : null;
        const dailyPulseRoleMap = globalData.daily_pulse_roles && typeof globalData.daily_pulse_roles === 'object'
          ? globalData.daily_pulse_roles
          : null;
        const curatedGlobal = Array.isArray(globalData.curated)
          ? globalData.curated
          : [];
        const candidateRoleFeed = normalizedRole && roleMap && Array.isArray(roleMap[normalizedRole])
          ? roleMap[normalizedRole]
          : [];
        const candidateCurated = curatedGlobal;
        const candidateCommunityPulse = normalizedRole && communityRoleMap && Array.isArray(communityRoleMap[normalizedRole])
          ? communityRoleMap[normalizedRole]
          : [];
        const candidateBuildPulse = normalizedRole && buildRoleMap && Array.isArray(buildRoleMap[normalizedRole])
          ? buildRoleMap[normalizedRole]
          : [];
        const candidateDailyPulse = normalizedRole && dailyPulseRoleMap?.[normalizedRole] && typeof dailyPulseRoleMap[normalizedRole] === 'object'
          ? dailyPulseRoleMap[normalizedRole] as { tools: any[]; blogs: any[]; discussions: any[] }
          : null;
        if (roleBasedForYou.length === 0 && candidateRoleFeed.length > 0) {
          roleBasedForYou = candidateRoleFeed;
          if (!feedDate) {
            feedDate = globalData.date || globalDoc.id;
          }
        }
        if (curated.length === 0 && candidateCurated.length > 0) {
          curated = candidateCurated;
          if (!feedDate) {
            feedDate = globalData.date || globalDoc.id;
          }
        }
        if (communityPulse.length === 0 && candidateCommunityPulse.length > 0) {
          communityPulse = candidateCommunityPulse;
          if (!feedDate) {
            feedDate = globalData.date || globalDoc.id;
          }
        }
        if (buildPulse.length === 0 && candidateBuildPulse.length > 0) {
          buildPulse = candidateBuildPulse;
          if (!feedDate) {
            feedDate = globalData.date || globalDoc.id;
          }
        }
        if (!dailyPulse && candidateDailyPulse) {
          dailyPulse = {
            tools: Array.isArray(candidateDailyPulse.tools) ? candidateDailyPulse.tools : [],
            blogs: Array.isArray(candidateDailyPulse.blogs) ? candidateDailyPulse.blogs : [],
            discussions: Array.isArray(candidateDailyPulse.discussions) ? candidateDailyPulse.discussions : [],
          };
          if (!feedDate) {
            feedDate = globalData.date || globalDoc.id;
          }
        }
        if (candidateTrending.length > 0 || candidateTopics.length > 0) {
          trending = candidateTrending;
          trendingTopics = candidateTopics;
          selectedGlobalDocId = globalDoc.id;
          if (!feedDate) {
            feedDate = globalData.date || globalDoc.id;
          }
          break;
        }
      }

      // If every recent global doc is empty, still use latest as baseline.
      if (trending.length === 0 && trendingTopics.length === 0) {
        const latestGlobalData = globalDocs[0].data() as any;
        trending = Array.isArray(latestGlobalData.trending) ? latestGlobalData.trending : [];
        trendingTopics = Array.isArray(latestGlobalData.trending_topics) ? latestGlobalData.trending_topics : [];
        const roleMap = latestGlobalData.for_you_roles && typeof latestGlobalData.for_you_roles === 'object'
          ? latestGlobalData.for_you_roles
          : null;
        const communityRoleMap = latestGlobalData.community_pulse_roles && typeof latestGlobalData.community_pulse_roles === 'object'
          ? latestGlobalData.community_pulse_roles
          : null;
        const buildRoleMap = latestGlobalData.build_pulse_roles && typeof latestGlobalData.build_pulse_roles === 'object'
          ? latestGlobalData.build_pulse_roles
          : null;
        const dailyPulseRoleMapFb = latestGlobalData.daily_pulse_roles && typeof latestGlobalData.daily_pulse_roles === 'object'
          ? latestGlobalData.daily_pulse_roles
          : null;
        const curatedGlobal = Array.isArray(latestGlobalData.curated)
          ? latestGlobalData.curated
          : [];
        if (roleBasedForYou.length === 0 && normalizedRole && roleMap && Array.isArray(roleMap[normalizedRole])) {
          roleBasedForYou = roleMap[normalizedRole];
          if (!feedDate) {
            feedDate = latestGlobalData.date || globalDocs[0].id;
          }
        }
        if (curated.length === 0 && curatedGlobal.length > 0) {
          curated = curatedGlobal;
          if (!feedDate) {
            feedDate = latestGlobalData.date || globalDocs[0].id;
          }
        }
        if (communityPulse.length === 0 && normalizedRole && communityRoleMap && Array.isArray(communityRoleMap[normalizedRole])) {
          communityPulse = communityRoleMap[normalizedRole];
          if (!feedDate) {
            feedDate = latestGlobalData.date || globalDocs[0].id;
          }
        }
        if (buildPulse.length === 0 && normalizedRole && buildRoleMap && Array.isArray(buildRoleMap[normalizedRole])) {
          buildPulse = buildRoleMap[normalizedRole];
          if (!feedDate) {
            feedDate = latestGlobalData.date || globalDocs[0].id;
          }
        }
        if (!dailyPulse && normalizedRole && dailyPulseRoleMapFb?.[normalizedRole] && typeof dailyPulseRoleMapFb[normalizedRole] === 'object') {
          const dp = dailyPulseRoleMapFb[normalizedRole];
          dailyPulse = {
            tools: Array.isArray(dp.tools) ? dp.tools : [],
            blogs: Array.isArray(dp.blogs) ? dp.blogs : [],
            discussions: Array.isArray(dp.discussions) ? dp.discussions : [],
          };
          if (!feedDate) {
            feedDate = latestGlobalData.date || globalDocs[0].id;
          }
        }
      }

      // Expand timeframe for mobile by merging in the previous daily doc as well.
      if (globalDocs.length > 1) {
        const secondGlobalData = globalDocs[1].data() as any;
        const secondTrending = Array.isArray(secondGlobalData.trending) ? secondGlobalData.trending : [];
        const secondTopics = Array.isArray(secondGlobalData.trending_topics) ? secondGlobalData.trending_topics : [];
        trending = dedupeFeedItems([...trending, ...secondTrending]);
        trendingTopics = dedupeTrendingTopics([...trendingTopics, ...secondTopics]);
      }

      console.log(
        '[Feed] Global trending doc:',
        selectedGlobalDocId,
        'items:',
        trending.length,
        'topics:',
        trendingTopics.length
      );
    }

    if (roleBasedForYou.length > 0) {
      forYou = roleBasedForYou;
    }

    // Fallback: if global data is missing/lagging, use user doc sections assembled for that date.
    if (trending.length === 0) trending = userTrending;
    if (trendingTopics.length === 0) trendingTopics = userTrendingTopics;

    if (
      forYou.length === 0 &&
      mergedFeed.length === 0 &&
      trending.length === 0 &&
      trendingTopics.length === 0
    ) {
      const cachedFeed = await readCachedFeed(uid);
      if (cachedFeed) {
        console.log('[Feed] All sections empty, using AsyncStorage snapshot');
        return cachedFeed;
      }
      console.log('[Feed] All sections empty');
      return null;
    }

    const dedupedForYou = dedupeFeedItems(forYou as FeedItem[]);
    const dedupedCurated = dedupeFeedItems(curated as FeedItem[]);
    const dedupedCommunityPulse = dedupeFeedItems(communityPulse as FeedItem[]);
    const dedupedBuildPulse = dedupeFeedItems(buildPulse as FeedItem[]);
    const dedupedTrending = dedupeFeedItems(trending as FeedItem[]);
    const dedupedTrendingTopics = dedupeTrendingTopics(trendingTopics as TrendingTopic[]);

    const resolvedFeed: V3UserFeed = {
      date: feedDate,
      for_you: dedupedForYou,
      curated: dedupedCurated,
      community_pulse: dedupedCommunityPulse,
      build_pulse: dedupedBuildPulse,
      daily_pulse: dailyPulse,
      trending: dedupedTrending,
      trending_topics: dedupedTrendingTopics,
      merged_feed: mergedFeed as MergedFeedItem[],
      assembled_at: assembledAt,
      metadata,
    };
    await writeCachedFeed(uid, resolvedFeed);
    return resolvedFeed;
  } catch (error) {
    console.error('Error getting v3 feed:', error);
    const cachedFeed = await readCachedFeed(uid);
    if (cachedFeed) {
      console.log('[Feed] Returning AsyncStorage snapshot after fatal feed error');
      return cachedFeed;
    }
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
  const config = await getAppVersionConfig();
  if (!config?.min_version) return true;
  return _compareVersions(currentVersion, config.min_version);
}

export interface AppVersionConfig {
  min_version?: string;
  latest_version?: string;
}

export async function getAppVersionConfig(): Promise<AppVersionConfig | null> {
  try {
    const ref = doc(firestore, 'app_config', 'version');
    const snap = await Promise.race([
      getDoc(ref),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (!snap || !snap.exists()) return null;
    const data = snap.data() as AppVersionConfig;
    return {
      min_version: data.min_version,
      latest_version: data.latest_version,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a trending article by doc_id from v3_trending_pool.
 * Used for deep linking from notifications.
 *
 * The doc_id is a URL hash: sha256(url)[:32]
 * Backend sends this in the notification payload as `articleId`.
 */
export async function getArticleById(articleId: string): Promise<FeedItem | null> {
  try {
    const ref = doc(firestore, 'v3_trending_pool', articleId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data();
    // Transform pool item to FeedItem format expected by the app
    return {
      id: snap.id,
      title: data.title || '',
      url: data.url || '',
      type: data.type || 'article',
      source: data.source || data.source_name || '',
      source_name: data.source_name || data.source || '',
      thumbnail: data.thumbnail || data.og_image || null,
      tags: data.tags || [],
      published_date: data.published_date || data.fetched_at,
      summary: data.summary,
      metadata: data.metadata,
    } as FeedItem;
  } catch (error) {
    console.error('[firestore] Error fetching article by ID:', error);
    return null;
  }
}

/**
 * Fetch a trending topic by topic id from the recent global feeds.
 * Used for deep linking from notifications carrying `topicId`.
 */
export async function getTopicById(topicId: string): Promise<TrendingTopic | null> {
  try {
    const datesToTry: string[] = [];
    for (let offset = 0; offset < 5; offset++) {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      datesToTry.push(d.toISOString().split('T')[0]);
    }

    for (const date of datesToTry) {
      const ref = doc(firestore, 'v3_user_feeds', '_global', 'daily', date);
      const snap = await getDoc(ref);
      if (!snap.exists()) continue;

      const data = snap.data() || {};
      const topics = Array.isArray(data.trending_topics) ? data.trending_topics : [];
      const matched = topics.find((topic: any) => {
        const id = String(topic?.id || topic?.topic_key || '').trim();
        return id === topicId;
      });

      if (matched) {
        return matched as TrendingTopic;
      }
    }

    return null;
  } catch (error) {
    console.error('[firestore] Error fetching topic by ID:', error);
    return null;
  }
}
