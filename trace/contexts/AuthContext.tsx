import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthCredential,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { app, auth } from '@/lib/firebase';
import {
  getOrCreateUserProfile,
  getUserProfileWithSource,
  deleteUserData,
  UserProfile,
  getV3UserFeed,
  syncUserTimezone,
} from '@/lib/firestore';
import { enablePushNotifications } from '@/lib/notifications';
import { setPrefetchedFeed, setPrefetchPromise, clearFeedCache } from '@/lib/feed-cache';
import {
  clearCachedProfileInterests,
  readCachedProfileInterests,
  writeCachedProfileInterests,
} from '@/lib/profile-cache';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  bootUid: string | null;
  bootProfile: UserProfile | null;
  bootInterests: string[];
  loading: boolean;
  profileResolved: boolean;
  profileLoadError: boolean;
  profileServerVerified: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<{ profile: UserProfile | null; serverVerified: boolean }>;
  retryProfileLoad: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  bootUid: null,
  bootProfile: null,
  bootInterests: [],
  loading: true,
  profileResolved: false,
  profileLoadError: false,
  profileServerVerified: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
  refreshProfile: async () => ({ profile: null, serverVerified: false }),
  retryProfileLoad: async () => {},
});

const PROFILE_CACHE_PREFIX = 'trace_profile_snapshot_v1:';
const AUTH_BOOT_KEY = 'trace_auth_boot_v1';

function profileCacheKey(uid: string): string {
  return `${PROFILE_CACHE_PREFIX}${uid}`;
}

function toCachedProfile(profile: UserProfile): UserProfile {
  return {
    uid: profile.uid,
    email: profile.email || '',
    displayName: profile.displayName || '',
    photoURL: profile.photoURL ?? null,
    onboarded: !!profile.onboarded,
    name: profile.name || '',
    role: profile.role || '',
    seniority: profile.seniority,
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    selectedLearningSources: Array.isArray(profile.selectedLearningSources) ? profile.selectedLearningSources : [],
    careerGoals: Array.isArray(profile.careerGoals) ? profile.careerGoals : [],
    summaryStyle: profile.summaryStyle,
    company: profile.company,
    interestQueries: profile.interestQueries,
    hobbies: Array.isArray(profile.hobbies) ? profile.hobbies : [],
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    dislikedTopics: Array.isArray(profile.dislikedTopics) ? profile.dislikedTopics : [],
    sourcePreferences: profile.sourcePreferences || {
      youtube: 0,
      articles: 0,
      papers: 0,
      repos: 0,
      tweets: 0,
      discussions: 0,
    },
    contentDepth: profile.contentDepth || null,
    goals: profile.goals,
    subscriptionStatus: profile.subscriptionStatus || 'none',
    appSubscriptionStatus: profile.appSubscriptionStatus,
    isEarlyAdopter: profile.isEarlyAdopter,
    earlyAdopterOfferSeen: profile.earlyAdopterOfferSeen,
    newsletterOptIn: profile.newsletterOptIn,
    pushNotificationsEnabled: profile.pushNotificationsEnabled,
    pushToken: profile.pushToken,
    pushTokenUpdatedAt: profile.pushTokenUpdatedAt,
    feedBuildStatus: profile.feedBuildStatus,
    feedBuildRequestedAt: profile.feedBuildRequestedAt,
    referralSource: profile.referralSource,
    timezone: profile.timezone,
    locale: profile.locale,
    hasRequestedReview: profile.hasRequestedReview,
    reviewRequestedAt: profile.reviewRequestedAt,
    createdAt: profile.createdAt ?? null,
    updatedAt: profile.updatedAt ?? null,
    onboardedAt: profile.onboardedAt ?? null,
    lastActiveAt: profile.lastActiveAt ?? null,
  };
}

function firstNonEmptyString(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function mergeProfileWithSessionIdentity(
  nextProfile: UserProfile,
  firebaseUser: User | null,
  currentProfile?: UserProfile | null
): UserProfile {
  const displayName = firstNonEmptyString(
    nextProfile.displayName,
    nextProfile.name,
    currentProfile?.displayName,
    currentProfile?.name,
    firebaseUser?.displayName || ''
  );
  const name = firstNonEmptyString(
    nextProfile.name,
    nextProfile.displayName,
    currentProfile?.name,
    currentProfile?.displayName,
    firebaseUser?.displayName || ''
  );
  const email = firstNonEmptyString(
    nextProfile.email,
    currentProfile?.email,
    firebaseUser?.email || ''
  );
  const photoURL =
    firstNonEmptyString(
      nextProfile.photoURL || '',
      currentProfile?.photoURL || '',
      firebaseUser?.photoURL || ''
    ) || null;

  return {
    ...nextProfile,
    displayName,
    name,
    email,
    photoURL,
  };
}

async function readCachedProfile(uid: string): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(profileCacheKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch (error) {
    console.warn('[Auth] Failed to read cached profile:', error);
    return null;
  }
}

async function writeCachedProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(
      profileCacheKey(profile.uid),
      JSON.stringify(toCachedProfile(profile))
    );
  } catch (error) {
    console.warn('[Auth] Failed to write cached profile:', error);
  }
}

async function clearCachedProfile(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(profileCacheKey(uid));
  } catch (error) {
    console.warn('[Auth] Failed to clear cached profile:', error);
  }
}

async function readBootUid(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_BOOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { uid?: string };
    return parsed?.uid || null;
  } catch (error) {
    console.warn('[Auth] Failed to read boot snapshot:', error);
    return null;
  }
}

async function writeBootUid(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_BOOT_KEY, JSON.stringify({ uid, updatedAt: Date.now() }));
  } catch (error) {
    console.warn('[Auth] Failed to write boot snapshot:', error);
  }
}

async function clearBootUid(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_BOOT_KEY);
  } catch (error) {
    console.warn('[Auth] Failed to clear boot snapshot:', error);
  }
}

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bootUid, setBootUid] = useState<string | null>(null);
  const [bootProfile, setBootProfile] = useState<UserProfile | null>(null);
  const [bootInterests, setBootInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileResolved, setProfileResolved] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [profileServerVerified, setProfileServerVerified] = useState(false);
  const signInInFlightRef = useRef(false);
  const lastHandledAuthUidRef = useRef<string | null | undefined>(undefined);
  const profileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const commitProfile = (nextProfile: UserProfile | null, firebaseUser: User | null) => {
    if (!nextProfile) return null;
    const mergedProfile = mergeProfileWithSessionIdentity(
      nextProfile,
      firebaseUser,
      profileRef.current
    );
    profileRef.current = mergedProfile;
    setProfile(mergedProfile);
    setBootUid(mergedProfile.uid);
    setBootProfile(mergedProfile);
    setBootInterests(Array.isArray(mergedProfile.interests) ? mergedProfile.interests : []);
    return mergedProfile;
  };

  const applyAuthState = async (firebaseUser: User | null) => {
    const nextUid = firebaseUser?.uid ?? null;
    if (lastHandledAuthUidRef.current === nextUid) {
      return;
    }
    const previousUid = lastHandledAuthUidRef.current ?? null;
    lastHandledAuthUidRef.current = nextUid;

    setUser(firebaseUser);
    if (firebaseUser) {
      setProfileResolved(false);
      setProfileServerVerified(false);
      const cachedProfile = await readCachedProfile(firebaseUser.uid);
      if (cachedProfile) {
        commitProfile(cachedProfile, firebaseUser);
      }
      // Startup should never create/overwrite profiles.
      // Single attempt - getUserProfile already uses cache-first with server fallback.
      await loadProfile(firebaseUser, { allowCreate: false });

      // Prefetch feed in parallel with profile load for faster startup
      const feedPromise = getV3UserFeed(firebaseUser.uid, {
        role: cachedProfile?.role || profileRef.current?.role || null,
      }).then((feed) => {
        if (feed) {
          setPrefetchedFeed(firebaseUser.uid, feed);
        }
        return feed;
      }).catch(() => null);
      setPrefetchPromise(feedPromise);
    } else {
      profileRef.current = null;
      setProfile(null);
      setBootUid(null);
      setBootProfile(null);
      setBootInterests([]);
      setProfileResolved(true);
      setProfileServerVerified(false);
      clearFeedCache();
      if (previousUid) {
        void clearCachedProfile(previousUid);
        void clearCachedProfileInterests(previousUid);
      }
      void clearBootUid();
    }
    setLoading(false);
  };

  const loadProfile = async (firebaseUser: User, options?: { allowCreate?: boolean }) => {
    const allowCreate = options?.allowCreate ?? true;
    setProfileLoadError(false);
    try {
      let userProfile: UserProfile | null = null;
      let serverVerified = false;

      if (allowCreate) {
        const createdOrExistingProfile = await getOrCreateUserProfile(
          firebaseUser.uid,
          firebaseUser.email || '',
          firebaseUser.displayName || '',
          firebaseUser.photoURL
        );
        const verification = await getUserProfileWithSource(firebaseUser.uid);
        userProfile = verification.profile || createdOrExistingProfile;
        serverVerified = verification.source === 'server';
      } else {
        const result = await getUserProfileWithSource(firebaseUser.uid);
        userProfile = result.profile;
        serverVerified = result.source === 'server';
      }
      const resolvedProfile = commitProfile(userProfile, firebaseUser);
      setProfileServerVerified(serverVerified);

      // Prefetch profile photo for instant loading
      if (firebaseUser.photoURL) {
        Image.prefetch(firebaseUser.photoURL).catch(() => {
          // Silent fail - not critical
        });
      }

      // Register for push notifications if user has onboarded and hasn't disabled them
      if (resolvedProfile?.onboarded && resolvedProfile?.pushNotificationsEnabled !== false) {
        enablePushNotifications(firebaseUser.uid).catch((err) => {
          console.warn('[Auth] Push notification registration failed:', err);
        });
      }

      if (resolvedProfile) {
        if (serverVerified) {
          void writeCachedProfile(resolvedProfile);
          void writeBootUid(resolvedProfile.uid);
        } else {
          void clearCachedProfile(resolvedProfile.uid);
          void clearBootUid();
        }
        void writeCachedProfileInterests(resolvedProfile.uid, resolvedProfile.interests || []);
        void syncUserTimezone(resolvedProfile.uid, resolvedProfile);
      }

      return resolvedProfile;
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfileLoadError(true);
      setProfileServerVerified(false);
    } finally {
      setProfileResolved(true);
    }
    return null;
  };

  const refreshProfile = async () => {
    if (user) {
      const result = await getUserProfileWithSource(user.uid);
      const resolvedProfile = commitProfile(result.profile, user);
      const serverVerified = result.source === 'server';
      setProfileServerVerified(serverVerified);
      if (resolvedProfile) {
        if (serverVerified) {
          void writeCachedProfile(resolvedProfile);
          void writeBootUid(resolvedProfile.uid);
        } else {
          void clearCachedProfile(resolvedProfile.uid);
          void clearBootUid();
        }
        void writeCachedProfileInterests(resolvedProfile.uid, resolvedProfile.interests || []);
        void syncUserTimezone(resolvedProfile.uid, resolvedProfile);
      }
      return { profile: resolvedProfile, serverVerified };
    }
    return { profile: null, serverVerified: false };
  };

  const retryProfileLoad = async () => {
    if (user && (profileLoadError || !profileServerVerified)) {
      setProfileResolved(false);
      await loadProfile(user, { allowCreate: false });
    }
  };

  useEffect(() => {
    // Configure Google Sign-In with web client ID from Firebase
    GoogleSignin.configure({
      webClientId: '94335303623-qun0r1562s64vck72483r9lhed22u5h0.apps.googleusercontent.com',
      offlineAccess: true,
    });

    let cancelled = false;
    let unsubscribe = () => {};

    const hydrateBootSnapshot = async () => {
      const cachedUid = await readBootUid();
      if (!cachedUid || cancelled) return;
      const cachedInterests = await readCachedProfileInterests(cachedUid);
      if (cancelled) return;
      if (cachedInterests.length > 0) {
        setBootUid(cachedUid);
        setBootInterests(cachedInterests);
      }
      const cachedProfile = await readCachedProfile(cachedUid);
      if (cancelled || !cachedProfile) return;
      const mergedCachedProfile = (
        (!Array.isArray(cachedProfile.interests) || cachedProfile.interests.length === 0) &&
        cachedInterests.length > 0
      ) ? { ...cachedProfile, interests: cachedInterests } : cachedProfile;
      setBootUid(cachedUid);
      setBootProfile(mergedCachedProfile);
      // Seed profile for the first paint if Firebase is slow.
      profileRef.current = mergedCachedProfile;
      setProfile((current) => current ?? mergedCachedProfile);
    };

    const initAuth = async () => {
      await hydrateBootSnapshot();
      if (cancelled) return;
      try {
        const authStateReady = (auth as any).authStateReady;
        if (typeof authStateReady === 'function') {
          await authStateReady.call(auth);
        }
      } catch (error) {
        console.warn('[Auth] authStateReady failed, falling back to currentUser:', error);
      }

      if (cancelled) return;

      await applyAuthState(auth.currentUser);
      if (cancelled) return;

      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        void applyAuthState(firebaseUser);
      });
    };

    void initAuth();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signInWithCredentialWithRetry = async (
    credential: AuthCredential
  ): Promise<Awaited<ReturnType<typeof signInWithCredential>>> => {
    try {
      return await signInWithCredential(auth, credential);
    } catch (error: any) {
      const code = error?.code as string | undefined;
      if (code === 'auth/network-request-failed') {
        console.warn('[Auth] signInWithCredential network failure, retrying once...');
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return signInWithCredential(auth, credential);
      }
      throw error;
    }
  };

  const preflightFirebaseAuth = async () => {
    const apiKey = app.options.apiKey;
    if (!apiKey) {
      throw new Error('Missing Firebase API key in app config');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            continueUri: 'http://localhost',
            identifier: 'preflight@trace.local',
          }),
          signal: controller.signal,
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Firebase auth preflight failed (${res.status}): ${text}`);
      }
    } finally {
      clearTimeout(timer);
    }
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const signInWithGoogle = async () => {
    if (signInInFlightRef.current) {
      console.log('[Auth] Google sign-in already in flight, ignoring duplicate call');
      return;
    }
    signInInFlightRef.current = true;
    try {
      // Check if device supports Google Play (no-op on iOS)
      console.log('[Auth] Checking Play Services...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('[Auth] Play Services OK. Starting Google Sign-In...');

      // Sign in with native Google Sign-In
      const signInResult = await GoogleSignin.signIn();
      console.log('[Auth] Google Sign-In returned, checking token...');
      const idToken = signInResult.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token received from Google Sign-In');
      }
      console.log('[Auth] Got ID token. Signing into Firebase...');

      // Create Firebase credential from Google ID token
      const credential = GoogleAuthProvider.credential(idToken);

      // Helpful early signal for Android networking / API-key restrictions.
      if (Platform.OS === 'android') {
        console.log('[Auth] Running Firebase auth preflight...');
        try {
          await preflightFirebaseAuth();
          console.log('[Auth] Firebase auth preflight OK');
        } catch (preflightError) {
          // Do not block real sign-in based on preflight; it is diagnostic only.
          console.warn('[Auth] Firebase auth preflight failed, continuing anyway:', preflightError);
        }
      }

      console.log('[Auth] Calling signInWithCredential...');
      const result = await withTimeout(
        signInWithCredentialWithRetry(credential),
        30000,
        'Firebase sign-in timed out. Check Android network/Play Services and try again.'
      );
      console.log('[Auth] Firebase sign-in complete. Loading profile...');
      
      // Load or create profile
      if (result.user) {
        await loadProfile(result.user);
      }
      console.log('[Auth] Sign-in flow complete.');
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      const code = (error as any)?.code as string | undefined;
      const message = error instanceof Error ? error.message : String(error);
      if (
        code === 'auth/network-request-failed' ||
        message.includes('Firebase sign-in timed out') ||
        message.includes('AbortError')
      ) {
        throw new Error(
          'Could not reach Firebase Auth on this network. Please try mobile data or another Wi-Fi.'
        );
      }
      throw error;
    } finally {
      signInInFlightRef.current = false;
    }
  };

  const signOut = async () => {
    try {
      // Sign out of Google
      await GoogleSignin.signOut();
      // Sign out of Firebase
      if (user?.uid) {
        await clearCachedProfile(user.uid);
        await clearCachedProfileInterests(user.uid);
      }
      await clearBootUid();
      await firebaseSignOut(auth);
      profileRef.current = null;
      setProfile(null);
      setBootUid(null);
      setBootProfile(null);
      setBootInterests([]);
    } catch (error) {
      console.error('Sign Out Error:', error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No user signed in');

      // Re-authenticate before sensitive operation (required by Firebase)
      try {
        const { data } = await GoogleSignin.signIn();
        if (data?.idToken) {
          const credential = GoogleAuthProvider.credential(data.idToken);
          await signInWithCredential(auth, credential);
        }
      } catch (reAuthError) {
        console.warn('Re-auth failed, trying without:', reAuthError);
      }

      // Delete all Firestore data first
      await deleteUserData(currentUser.uid);
      // Sign out of Google
      await GoogleSignin.signOut();
      await clearCachedProfile(currentUser.uid);
      await clearCachedProfileInterests(currentUser.uid);
      await clearBootUid();
      // Delete the Firebase auth account
      await auth.currentUser?.delete();
      profileRef.current = null;
      setProfile(null);
      setUser(null);
      setBootUid(null);
      setBootProfile(null);
      setBootInterests([]);
    } catch (error) {
      console.error('Delete Account Error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        bootUid,
        bootProfile,
        bootInterests,
        loading,
        profileResolved,
        profileLoadError,
        profileServerVerified,
        signInWithGoogle,
        signOut,
        deleteAccount,
        refreshProfile,
        retryProfileLoad,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
