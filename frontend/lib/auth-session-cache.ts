import type { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/firestore';

const STORAGE_KEY = 'trace_auth_session_v1';
const CACHE_VERSION = 1;

export type AuthSessionCachePayload = {
  v: typeof CACHE_VERSION;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  name: string;
  onboarded: boolean;
  role: string;
  interests: string[];
  subscriptionStatus: UserProfile['subscriptionStatus'];
  appSubscriptionStatus?: UserProfile['appSubscriptionStatus'];
  updatedAt: string;
};

/** Partial updates merged into an existing cache entry (same uid + current Firebase user). */
export type AuthSessionCachePatch = Partial<
  Pick<
    AuthSessionCachePayload,
    | 'email'
    | 'displayName'
    | 'photoURL'
    | 'name'
    | 'onboarded'
    | 'role'
    | 'interests'
    | 'subscriptionStatus'
    | 'appSubscriptionStatus'
  >
>;

function emptyProfileShell(user: User): Omit<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL'> {
  return {
    onboarded: false,
    name: user.displayName || '',
    role: '',
    interests: [],
    hobbies: [],
    skills: [],
    dislikedTopics: [],
    sourcePreferences: {
      youtube: 5,
      articles: 5,
      papers: 5,
      repos: 5,
      tweets: 5,
      discussions: 5,
    },
    contentDepth: null,
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
    createdAt: null,
    updatedAt: null,
    onboardedAt: null,
  };
}

/** Merge cached fields onto a shell so feed hooks get role / interests / subscription immediately. */
export function optimisticProfileFromCache(user: User, cached: AuthSessionCachePayload): UserProfile {
  const shell = emptyProfileShell(user);
  const normalizedInterests = Array.isArray(cached.interests)
    ? cached.interests.filter((interest): interest is string => typeof interest === 'string' && interest.trim().length > 0)
    : [];
  return {
    ...shell,
    uid: user.uid,
    email: user.email || cached.email || '',
    displayName: user.displayName || cached.displayName || '',
    photoURL: user.photoURL ?? cached.photoURL,
    name: cached.name || user.displayName || '',
    onboarded: cached.onboarded,
    role: typeof cached.role === 'string' ? cached.role : '',
    interests: normalizedInterests,
    subscriptionStatus: cached.subscriptionStatus ?? 'none',
    appSubscriptionStatus: cached.appSubscriptionStatus,
  };
}

export function readAuthSessionCache(): AuthSessionCachePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSessionCachePayload;
    if (
      parsed?.v !== CACHE_VERSION
      || !parsed.uid
      || typeof parsed.onboarded !== 'boolean'
      || typeof parsed.role !== 'string'
      || !Array.isArray(parsed.interests)
    ) {
      return null;
    }
    if (parsed.onboarded && parsed.interests.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Merge fields after a partial Firestore profile write (no extra getDoc). */
export function patchAuthSessionCache(
  uid: string,
  firebaseUser: User | null,
  patch: AuthSessionCachePatch,
): void {
  if (typeof window === 'undefined') return;
  const existing = readAuthSessionCache();
  if (!existing || existing.uid !== uid) return;

  const next: AuthSessionCachePayload = {
    ...existing,
    updatedAt: new Date().toISOString(),
  };

  (Object.entries(patch) as [keyof AuthSessionCachePatch, unknown][]).forEach(([key, value]) => {
    if (value !== undefined) {
      (next as unknown as Record<string, unknown>)[key] = value;
    }
  });

  if (firebaseUser?.uid === uid) {
    if (firebaseUser.email) next.email = firebaseUser.email;
    if (firebaseUser.displayName) next.displayName = firebaseUser.displayName;
    if (firebaseUser.photoURL !== undefined) next.photoURL = firebaseUser.photoURL;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function writeAuthSessionCache(user: User, profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: AuthSessionCachePayload = {
      v: CACHE_VERSION,
      uid: user.uid,
      email: user.email || profile.email || '',
      displayName: user.displayName || profile.displayName || '',
      photoURL: user.photoURL ?? profile.photoURL,
      name: profile.name || user.displayName || '',
      onboarded: profile.onboarded === true,
      role: profile.role || '',
      interests: Array.isArray(profile.interests) ? profile.interests : [],
      subscriptionStatus: profile.subscriptionStatus ?? 'none',
      appSubscriptionStatus: profile.appSubscriptionStatus,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearAuthSessionCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
