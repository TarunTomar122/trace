import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthCredential,
  GoogleAuthProvider,
  OAuthProvider,
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
  writeCachedProfileInterests,
} from '@/lib/profile-cache';

// ─── Public interface ───────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
  refreshProfile: async () => null,
});

export const useAuth = () => useContext(AuthContext);

// ─── AsyncStorage profile cache ─────────────────────────────────────────────

const PROFILE_CACHE_KEY = 'trace_profile_v2:';

function cacheKey(uid: string) {
  return `${PROFILE_CACHE_KEY}${uid}`;
}

function serialize(profile: UserProfile): UserProfile {
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
      youtube: 0, articles: 0, papers: 0,
      repos: 0, tweets: 0, discussions: 0,
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

async function readCache(uid: string): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

async function writeCache(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(profile.uid), JSON.stringify(serialize(profile)));
  } catch { /* non-critical */ }
}

async function clearCache(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(uid));
  } catch { /* non-critical */ }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pickString(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function mergeIdentity(
  next: UserProfile,
  firebaseUser: User | null,
  current?: UserProfile | null,
): UserProfile {
  return {
    ...next,
    displayName: pickString(next.displayName, next.name, current?.displayName, current?.name, firebaseUser?.displayName),
    name: pickString(next.name, next.displayName, current?.name, current?.displayName, firebaseUser?.displayName),
    email: pickString(next.email, current?.email, firebaseUser?.email),
    photoURL: pickString(next.photoURL, current?.photoURL, firebaseUser?.photoURL) || null,
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const signInInFlightRef = useRef(false);
  const profileRef = useRef<UserProfile | null>(null);

  useEffect(() => { profileRef.current = profile; }, [profile]);

  // ── commit helper: merges identity + updates state + writes cache ──

  const commit = (next: UserProfile | null, firebaseUser: User | null): UserProfile | null => {
    if (!next) return null;
    const merged = mergeIdentity(next, firebaseUser, profileRef.current);
    profileRef.current = merged;
    setProfile(merged);
    void writeCache(merged);
    void writeCachedProfileInterests(merged.uid, merged.interests || []);
    return merged;
  };

  // ── fetch profile from server, fall back to cache ──

  const fetchProfile = async (
    firebaseUser: User,
    opts?: { allowCreate?: boolean },
  ): Promise<UserProfile | null> => {
    const allowCreate = opts?.allowCreate ?? false;
    try {
      let serverProfile: UserProfile | null = null;

      if (allowCreate) {
        serverProfile = await getOrCreateUserProfile(
          firebaseUser.uid,
          firebaseUser.email || '',
          firebaseUser.displayName || '',
          firebaseUser.photoURL,
        );
      } else {
        const result = await getUserProfileWithSource(firebaseUser.uid);
        serverProfile = result.profile;
      }

      const resolved = commit(serverProfile, firebaseUser);

      if (resolved?.onboarded && resolved.pushNotificationsEnabled !== false) {
        enablePushNotifications(firebaseUser.uid).catch(() => {});
      }
      if (resolved) {
        void syncUserTimezone(resolved.uid, resolved);
      }
      if (firebaseUser.photoURL) {
        Image.prefetch(firebaseUser.photoURL).catch(() => {});
      }
      return resolved;
    } catch (error) {
      console.error('[Auth] fetchProfile error:', error);
      return profileRef.current;
    }
  };

  // ── refreshProfile (public) ──

  const refreshProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    return fetchProfile(user);
  };

  // ── Startup: wait for auth, then load profile ──

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '94335303623-qun0r1562s64vck72483r9lhed22u5h0.apps.googleusercontent.com',
      offlineAccess: true,
    });

    let cancelled = false;

    const boot = async () => {
      // 1. Wait for Firebase Auth to restore session
      try {
        const ready = (auth as any).authStateReady;
        if (typeof ready === 'function') {
          await ready.call(auth);
        }
      } catch {
        console.warn('[Auth] authStateReady unavailable, using currentUser');
      }

      if (cancelled) return;
      const firebaseUser = auth.currentUser;
      setUser(firebaseUser);

      if (firebaseUser) {
        // 2a. Instant: show cached profile while server fetch is in flight
        const cached = await readCache(firebaseUser.uid);
        if (cached && !cancelled) {
          commit(cached, firebaseUser);
        }

        // 2b. Server fetch (updates profile + cache in background)
        if (!cancelled) {
          await fetchProfile(firebaseUser);
        }

        // 2c. Prefetch feed for fast first paint
        if (!cancelled) {
          const role = profileRef.current?.role || null;
          const feedPromise = getV3UserFeed(firebaseUser.uid, { role })
            .then((feed) => { if (feed) setPrefetchedFeed(firebaseUser.uid, feed); return feed; })
            .catch(() => null);
          setPrefetchPromise(feedPromise);
        }
      }

      if (!cancelled) setLoading(false);
    };

    void boot().then(() => {
      if (cancelled) return;
      // 3. Listen for auth changes after boot (sign-in, sign-out, token refresh)
      return onAuthStateChanged(auth, async (firebaseUser) => {
        if (cancelled || signInInFlightRef.current) return;
        if (firebaseUser) {
          await fetchProfile(firebaseUser);
          if (!cancelled) setUser(firebaseUser);
        } else {
          profileRef.current = null;
          setProfile(null);
          setUser(null);
          clearFeedCache();
        }
      });
    });

    return () => { cancelled = true; };
  }, []);

  // ── signInWithGoogle ──

  const signInWithGoogle = async () => {
    if (signInInFlightRef.current) return;
    signInInFlightRef.current = true;
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error('No ID token received from Google Sign-In');

      const credential = GoogleAuthProvider.credential(idToken);

      if (Platform.OS === 'android') {
        const apiKey = app.options.apiKey;
        if (apiKey) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 8000);
            await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
              { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ continueUri: 'http://localhost', identifier: 'preflight@trace.local' }),
                signal: ctrl.signal },
            ).finally(() => clearTimeout(timer));
          } catch { /* diagnostic only */ }
        }
      }

      const result = await signInWithCredentialRetry(credential);

      if (result.user) {
        await fetchProfile(result.user, { allowCreate: true });
        setUser(result.user);
      }
    } catch (error) {
      console.error('[Auth] Google Sign-In Error:', error);
      const code = (error as any)?.code as string | undefined;
      const msg = error instanceof Error ? error.message : String(error);
      if (code === 'auth/network-request-failed' || msg.includes('timed out') || msg.includes('AbortError')) {
        throw new Error('Could not reach Firebase Auth on this network. Please try mobile data or another Wi-Fi.');
      }
      throw error;
    } finally {
      signInInFlightRef.current = false;
    }
  };

  // ── signInWithApple ──

  const signInWithApple = async () => {
    if (signInInFlightRef.current) return;
    signInInFlightRef.current = true;
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({
        idToken: credential.identityToken!,
        rawNonce: credential.authorizationCode ?? undefined,
      });

      const result = await signInWithCredentialRetry(firebaseCredential);

      if (result.user) {
        // Apple only sends name on first sign-in — persist it
        const fullName = [
          credential.fullName?.givenName,
          credential.fullName?.familyName,
        ].filter(Boolean).join(' ');

        if (fullName && !result.user.displayName) {
          await result.user.updateProfile({ displayName: fullName });
        }

        await fetchProfile(result.user, { allowCreate: true });
        setUser(result.user);
      }
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') return; // user dismissed sheet
      console.error('[Auth] Apple Sign-In Error:', error);
      throw error;
    } finally {
      signInInFlightRef.current = false;
    }
  };

  // ── signOut ──

  const signOut = async () => {
    try {
      const uid = user?.uid;
      await GoogleSignin.signOut();
      if (uid) {
        await clearCache(uid);
        await clearCachedProfileInterests(uid);
      }
      await firebaseSignOut(auth);
      profileRef.current = null;
      setProfile(null);
      setUser(null);
      clearFeedCache();
    } catch (error) {
      console.error('[Auth] Sign Out Error:', error);
      throw error;
    }
  };

  // ── deleteAccount ──

  const deleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No user signed in');
    try {
      try {
        const { data } = await GoogleSignin.signIn();
        if (data?.idToken) {
          const cred = GoogleAuthProvider.credential(data.idToken);
          await signInWithCredential(auth, cred);
        }
      } catch { /* re-auth best-effort */ }

      await deleteUserData(currentUser.uid);
      await GoogleSignin.signOut();
      await clearCache(currentUser.uid);
      await clearCachedProfileInterests(currentUser.uid);
      await auth.currentUser?.delete();
      profileRef.current = null;
      setProfile(null);
      setUser(null);
      clearFeedCache();
    } catch (error) {
      console.error('[Auth] Delete Account Error:', error);
      throw error;
    }
  };

  // ── small helpers ──

  const signInWithCredentialRetry = async (
    credential: AuthCredential,
  ): Promise<Awaited<ReturnType<typeof signInWithCredential>>> => {
    try {
      return await signInWithCredential(auth, credential);
    } catch (error: any) {
      if (error?.code === 'auth/network-request-failed') {
        await new Promise((r) => setTimeout(r, 1200));
        return signInWithCredential(auth, credential);
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signInWithApple, signOut, deleteAccount, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
