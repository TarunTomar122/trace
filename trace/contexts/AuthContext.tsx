import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import {
  AuthCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
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
  clearCachedBootProfile,
  clearCachedProfileInterests,
  readCachedBootProfile,
  writeCachedBootProfile,
  writeCachedProfileInterests,
} from '@/lib/profile-cache';

// ─── Public interface ───────────────────────────────────────────────────────

interface OnboardingCompletion {
  name: string;
  role: string;
  seniority: string;
  interests: string[];
  selectedLearningSources: string[];
  careerGoals: string[];
}

type OnboardingStatus = 'unknown' | 'onboarded' | 'needs_onboarding';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  onboardingStatus: OnboardingStatus;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  markOnboardingComplete: (completion: OnboardingCompletion) => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  onboardingStatus: 'unknown',
  loading: true,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
  refreshProfile: async () => null,
  markOnboardingComplete: async () => null,
});

export const useAuth = () => useContext(AuthContext);

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

function hasCompletedOnboarding(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.onboarded === true;
}

function applyOnboardingCompletion(
  profile: UserProfile | null,
  firebaseUser: User,
  completion: OnboardingCompletion,
): UserProfile {
  return {
    ...(profile || {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL,
      createdAt: null,
      updatedAt: null,
      onboardedAt: null,
    } as UserProfile),
    uid: firebaseUser.uid,
    email: pickString(profile?.email, firebaseUser.email),
    displayName: pickString(profile?.displayName, profile?.name, firebaseUser.displayName),
    photoURL: pickString(profile?.photoURL, firebaseUser.photoURL) || null,
    onboarded: true,
    name: pickString(completion.name, profile?.name, profile?.displayName, firebaseUser.displayName),
    role: completion.role || profile?.role || '',
    seniority: completion.seniority || profile?.seniority,
    interests: completion.interests.length ? completion.interests : (profile?.interests || []),
    selectedLearningSources: completion.selectedLearningSources.length
      ? completion.selectedLearningSources
      : (profile?.selectedLearningSources || []),
    careerGoals: completion.careerGoals.length ? completion.careerGoals : (profile?.careerGoals || []),
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>('unknown');
  const [loading, setLoading] = useState(true);

  const signInInFlightRef = useRef(false);
  const profileRef = useRef<UserProfile | null>(null);
  const lastUidRef = useRef<string | null>(null);

  useEffect(() => { profileRef.current = profile; }, [profile]);

  // ── commit helper: merges identity + updates state ──

  const commit = (
    next: UserProfile | null,
    firebaseUser: User | null,
  ): UserProfile | null => {
    if (!next) return null;
    const merged = mergeIdentity(next, firebaseUser, profileRef.current);
    profileRef.current = merged;
    setProfile(merged);
    void writeCachedProfileInterests(merged.uid, merged.interests || []);
    void writeCachedBootProfile(merged.uid, merged.onboarded === true, merged.interests || []);
    return merged;
  };

  const prefetchFeed = (uid: string): void => {
    const feedPromise = getV3UserFeed(uid)
      .then((feed) => {
        if (feed) setPrefetchedFeed(uid, feed);
        return feed;
      })
      .catch(() => null);
    setPrefetchPromise(feedPromise);
  };

  // ── fetch profile from server only; this is the routing source of truth ──

  const fetchProfile = async (
    firebaseUser: User,
    opts?: { allowCreate?: boolean },
  ): Promise<UserProfile | null> => {
    const allowCreate = opts?.allowCreate ?? false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let serverProfile: UserProfile | null = null;

        if (allowCreate) {
          serverProfile = await getOrCreateUserProfile(
            firebaseUser.uid,
            firebaseUser.email || '',
            firebaseUser.displayName || '',
            firebaseUser.photoURL,
          );
          setOnboardingStatus(hasCompletedOnboarding(serverProfile) ? 'onboarded' : 'needs_onboarding');
        } else {
          const result = await getUserProfileWithSource(firebaseUser.uid, { serverOnly: true });
          serverProfile = result.profile;

          if (result.source === 'server_no_profile') {
            profileRef.current = null;
            setProfile(null);
            setOnboardingStatus('needs_onboarding');
            return null;
          }

          if (result.source === 'server') {
            setOnboardingStatus(hasCompletedOnboarding(serverProfile) ? 'onboarded' : 'needs_onboarding');
          } else {
            throw new Error('No authoritative server profile');
          }
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
        const isLastAttempt = attempt === 2;
        if (isLastAttempt) {
          console.error('[Auth] fetchProfile retries exhausted:', error);
          // Keep the last known onboarding status if any, to avoid false routing.
          // If there is no known status yet, remain unknown so splash can keep waiting.
          if (onboardingStatus !== 'onboarded' && onboardingStatus !== 'needs_onboarding') {
            setOnboardingStatus('unknown');
          }
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    }
    return null;
  };

  // ── refreshProfile (public) ──

  const refreshProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    return fetchProfile(user);
  };

  const markOnboardingComplete = async (
    completion: OnboardingCompletion,
  ): Promise<UserProfile | null> => {
    if (!user) return null;
    await writeCachedProfileInterests(user.uid, completion.interests);

    const completed = applyOnboardingCompletion(
      profileRef.current,
      user,
      completion,
    );

    const resolved = commit(completed, user);
    setOnboardingStatus('onboarded');
    return resolved;
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
        const cachedBoot = await readCachedBootProfile(firebaseUser.uid);
        const hasFastOnboardedCache = !!cachedBoot && cachedBoot.onboarded === true && cachedBoot.interests.length > 0;

        if (hasFastOnboardedCache) {
          const fastProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            name: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || null,
            interests: cachedBoot.interests,
            onboarded: true,
          } as UserProfile;
          commit(fastProfile, firebaseUser);
          setOnboardingStatus('onboarded');
          setLoading(false);
        }

        const profileRequest = fetchProfile(firebaseUser);
        prefetchFeed(firebaseUser.uid);
        await profileRequest;

        if (!hasFastOnboardedCache) {
          setLoading(false);
        }
      }
      if (!firebaseUser && !cancelled) setLoading(false);
    };

    void boot().then(() => {
      if (cancelled) return;
      // 3. Listen for auth changes after boot (sign-in, sign-out, token refresh)
      return onAuthStateChanged(auth, async (firebaseUser) => {
        if (cancelled || signInInFlightRef.current) return;
        if (firebaseUser) {
          setUser(firebaseUser);
          const isUidChanged = lastUidRef.current !== firebaseUser.uid;
          lastUidRef.current = firebaseUser.uid;
          if (isUidChanged) {
            const cachedBoot = await readCachedBootProfile(firebaseUser.uid);
            const hasFastOnboardedCache = !!cachedBoot && cachedBoot.onboarded === true && cachedBoot.interests.length > 0;
            if (hasFastOnboardedCache) {
              const fastProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || '',
                name: firebaseUser.displayName || '',
                photoURL: firebaseUser.photoURL || null,
                interests: cachedBoot.interests,
                onboarded: true,
              } as UserProfile;
              commit(fastProfile, firebaseUser);
              setOnboardingStatus('onboarded');
            } else {
              setOnboardingStatus('unknown');
            }
          }
          prefetchFeed(firebaseUser.uid);
          await fetchProfile(firebaseUser);
        } else {
          profileRef.current = null;
          setProfile(null);
          setOnboardingStatus('unknown');
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
        const profileRequest = fetchProfile(result.user, { allowCreate: true });
        prefetchFeed(result.user.uid);
        await profileRequest;
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
          await updateProfile(result.user, { displayName: fullName });
        }

        const profileRequest = fetchProfile(result.user, { allowCreate: true });
        prefetchFeed(result.user.uid);
        await profileRequest;
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
        await clearCachedProfileInterests(uid);
        await clearCachedBootProfile(uid);
      }
      await firebaseSignOut(auth);
      profileRef.current = null;
      setProfile(null);
      setOnboardingStatus('unknown');
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
      await clearCachedProfileInterests(currentUser.uid);
      await clearCachedBootProfile(currentUser.uid);
      await auth.currentUser?.delete();
      profileRef.current = null;
      setProfile(null);
      setOnboardingStatus('unknown');
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
    <AuthContext.Provider value={{ user, profile, onboardingStatus, loading, signInWithGoogle, signInWithApple, signOut, deleteAccount, refreshProfile, markOnboardingComplete }}>
      {children}
    </AuthContext.Provider>
  );
}
