"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  getAdditionalUserInfo,
  onIdTokenChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getOrCreateUserProfile, getUserProfile, syncAffiliateAttributionToProfile, syncUserTimezone, UserProfile } from '@/lib/firestore';
import { readAffiliateAttribution } from '@/lib/affiliate';
import { identifyUser, resetUser, trackSignIn, trackSignOut, trackSignUp } from '@/lib/posthog';
import {
  clearAuthSessionCache,
  isAuthSessionCacheFresh,
  optimisticProfileFromCache,
  readAuthSessionCache,
  writeAuthSessionCache,
} from '@/lib/auth-session-cache';

export type SignInIntent = 'read' | 'checkout';

export type SignInResult =
  | { status: 'success'; user: User; profile: UserProfile | null; intent: SignInIntent }
  | { status: 'redirecting'; intent: SignInIntent }
  | { status: 'cancelled'; code?: string; intent: SignInIntent }
  | { status: 'error'; code?: string; message: string; intent: SignInIntent };

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileResolved: boolean;
  profileFresh: boolean;
  profileRefreshFailed: boolean;
  signInWithGoogle: (intent?: SignInIntent, options?: { rememberIntent?: boolean }) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileResolved: false,
  profileFresh: false,
  profileRefreshFailed: false,
  signInWithGoogle: async () => ({ status: 'cancelled', intent: 'read' }),
  signOut: async () => {},
  refreshProfile: async () => null,
});

export const useAuth = () => useContext(AuthContext);

const CHECKOUT_INTENT_KEY = 'trace_post_auth_intent';

export function peekPendingPostAuthIntent(): SignInIntent | null {
  if (typeof window === 'undefined') return null;
  const intent = sessionStorage.getItem(CHECKOUT_INTENT_KEY);
  return intent === 'read' || intent === 'checkout' ? intent : null;
}

export function consumePendingPostAuthIntent(): SignInIntent | null {
  const intent = peekPendingPostAuthIntent();
  if (intent) sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
  return intent;
}

function setPendingPostAuthIntent(intent: SignInIntent | null) {
  if (typeof window === 'undefined') return;
  if (intent) {
    sessionStorage.setItem(CHECKOUT_INTENT_KEY, intent);
    return;
  }
  sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
}

export { getPostAuthDestination } from '@/lib/landing-routing';

function isPopupFallbackEnvironment() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isEmbedded = /(FBAN|FBAV|Instagram|Line|LinkedInApp|wv|WebView)/i.test(ua);
  return isMobile || isEmbedded;
}

function shouldFallbackToRedirect(errorCode?: string) {
  return errorCode === 'auth/popup-blocked'
    || errorCode === 'auth/operation-not-supported-in-this-environment';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileResolved, setProfileResolved] = useState(false);
  const [profileFresh, setProfileFresh] = useState(false);
  const [profileRefreshFailed, setProfileRefreshFailed] = useState(false);

  const syncServerSession = async (idToken: string, forceProfileRefresh = false) => {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ idToken, forceProfileRefresh }),
    });
    if (!response.ok) {
      throw new Error(`Server session sync failed (${response.status})`);
    }
  };

  const clearServerSession = async () => {
    await fetch('/api/auth/session', {
      method: 'DELETE',
      credentials: 'same-origin',
    });
  };

  const loadProfile = async (firebaseUser: User, options?: { allowCreate?: boolean }) => {
    const allowCreate = options?.allowCreate ?? true;
    try {
      const userProfile = allowCreate
        ? await getOrCreateUserProfile(
            firebaseUser.uid,
            firebaseUser.email || '',
            firebaseUser.displayName || '',
            firebaseUser.photoURL
          )
        : await getUserProfile(firebaseUser.uid);
      if (userProfile !== null) {
        setProfile(userProfile);
        void syncUserTimezone(firebaseUser.uid, userProfile);
        writeAuthSessionCache(firebaseUser, userProfile);
      } else {
        setProfile(null);
        clearAuthSessionCache();
      }
      setProfileResolved(true);
      setProfileFresh(true);
      setProfileRefreshFailed(false);
      return userProfile;
    } catch (error) {
      console.error('Error loading profile:', error);
      throw error;
    }
  };

  const syncPendingAffiliate = async (uid: string, profile: UserProfile | null) => {
    if (profile?.affiliateCode) return;
    const attribution = readAffiliateAttribution();
    if (!attribution?.code) return;
    try {
      await syncAffiliateAttributionToProfile(uid, attribution);
      setProfile((prev) => prev ? {
        ...prev,
        affiliateCode: attribution.code,
        affiliateLandingPath: attribution.landingPath || null,
        utmSource: attribution.utmSource || null,
        utmCampaign: attribution.utmCampaign || null,
        utmMedium: attribution.utmMedium || null,
      } : prev);
    } catch (error) {
      console.error('Error syncing pending affiliate attribution:', error);
    }
  };

  const refreshProfile = async () => {
    if (!user) return null;
    setProfileFresh(false);
    setProfileRefreshFailed(false);
    try {
      const p = await getUserProfile(user.uid);
      setProfile(p);
      if (p) {
        void syncUserTimezone(user.uid, p);
        writeAuthSessionCache(user, p);
      } else {
        clearAuthSessionCache();
      }
      setProfileFresh(true);
      try {
        const idToken = await user.getIdToken();
        await syncServerSession(idToken, true);
      } catch (sessionError) {
        console.error('Error refreshing server session:', sessionError);
      }
      return p;
    } catch (error) {
      setProfileRefreshFailed(true);
      console.error('Error refreshing profile:', error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        setProfileFresh(false);
        setProfileRefreshFailed(false);
        const cached = readAuthSessionCache();
        const cachedProfileFresh = Boolean(
          cached?.uid === firebaseUser.uid && isAuthSessionCacheFresh(cached)
        );
        if (cached?.uid === firebaseUser.uid) {
          const optimistic = optimisticProfileFromCache(firebaseUser, cached);
          setProfile(optimistic);
          setProfileFresh(cachedProfileFresh);
          setProfileResolved(true);
        } else {
          setProfile(null);
          setProfileResolved(false);
        }
        // Don't block the app on Firestore — Firebase session is enough to show shell + start feed fetch.
        setLoading(false);

        const loadProfileInBackground = async () => {
          let userProfile: UserProfile | null = null;
          try {
            userProfile = await loadProfile(firebaseUser, { allowCreate: true });
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 600));
            try {
              userProfile = await loadProfile(firebaseUser, { allowCreate: true });
            } catch {
              setProfileRefreshFailed(true);
              if (!cached || cached.uid !== firebaseUser.uid) {
                setProfileResolved(false);
              }
            }
          }
          if (userProfile) {
            identifyUser(firebaseUser.uid, {
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              onboarded: userProfile.onboarded || false,
            });
            await syncPendingAffiliate(firebaseUser.uid, userProfile);
          }
        };

        identifyUser(firebaseUser.uid, {
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          onboarded: cached?.onboarded || false,
        });
        if (!cachedProfileFresh) {
          void loadProfileInBackground();
        }
      } else {
        clearAuthSessionCache();
        setProfile(null);
        setProfileResolved(true);
        setProfileFresh(true);
        setProfileRefreshFailed(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          await clearServerSession();
          return;
        }
        const idToken = await firebaseUser.getIdToken();
        await syncServerSession(idToken);
      } catch (error) {
        console.error('Error syncing server session:', error);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (
    intent: SignInIntent = 'read',
    options?: { rememberIntent?: boolean }
  ): Promise<SignInResult> => {
    const rememberIntent = options?.rememberIntent ?? true;
    try {
      setPendingPostAuthIntent(rememberIntent ? intent : null);
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const idToken = await result.user.getIdToken();
        await syncServerSession(idToken);
        // Keep intent in sessionStorage — page.tsx useEffect reads it once profileResolved=true
        setProfileResolved(false);
        const userProfile = await loadProfile(result.user, { allowCreate: true });

        // Track sign in with PostHog
        identifyUser(result.user.uid, {
          email: result.user.email,
          name: result.user.displayName,
          onboarded: userProfile?.onboarded || false,
        });
        if (getAdditionalUserInfo(result)?.isNewUser) {
          trackSignUp("google");
        }
        trackSignIn("google");
        await syncPendingAffiliate(result.user.uid, userProfile);

        return {
          status: 'success',
          user: result.user,
          profile: userProfile,
          intent,
        };
      }
      setPendingPostAuthIntent(null);
      return { status: 'cancelled', intent };
    } catch (error) {
      console.error('Error signing in with Google:', error);
      const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined;
      const errorMessage = error instanceof Error ? error.message : 'Sign-in failed';

      if (shouldFallbackToRedirect(errorCode) && isPopupFallbackEnvironment()) {
        await signInWithRedirect(auth, googleProvider);
        return { status: 'redirecting', intent };
      }

      setPendingPostAuthIntent(null);

      if (errorCode === 'auth/popup-closed-by-user' || errorCode === 'auth/cancelled-popup-request') {
        return { status: 'cancelled', code: errorCode, intent };
      }

      return {
        status: 'error',
        code: errorCode,
        message: errorMessage,
        intent,
      };
    }
  };

  const signOut = async () => {
    try {
      trackSignOut();
      resetUser();
      clearAuthSessionCache();
      await clearServerSession();
      await firebaseSignOut(auth);
      setProfile(null);
      setProfileFresh(true);
      setProfileRefreshFailed(false);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileResolved, profileFresh, profileRefreshFailed, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
