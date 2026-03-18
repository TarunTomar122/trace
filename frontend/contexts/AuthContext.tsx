"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getOrCreateUserProfile, getUserProfile, syncAffiliateAttributionToProfile, UserProfile } from '@/lib/firestore';
import { readAffiliateAttribution } from '@/lib/affiliate';
import { identifyUser, resetUser, trackSignIn, trackSignOut } from '@/lib/posthog';

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
  signInWithGoogle: (intent?: SignInIntent, options?: { rememberIntent?: boolean }) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileResolved: false,
  signInWithGoogle: async () => ({ status: 'cancelled', intent: 'read' }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const CHECKOUT_INTENT_KEY = 'trace_post_auth_intent';

export function consumePendingPostAuthIntent(): SignInIntent | null {
  if (typeof window === 'undefined') return null;
  const intent = sessionStorage.getItem(CHECKOUT_INTENT_KEY);
  if (intent === 'read' || intent === 'checkout') {
    sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
    return intent;
  }
  return null;
}

function setPendingPostAuthIntent(intent: SignInIntent | null) {
  if (typeof window === 'undefined') return;
  if (intent) {
    sessionStorage.setItem(CHECKOUT_INTENT_KEY, intent);
    return;
  }
  sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
}

export function getPostAuthDestination(profile: UserProfile | null, intent: SignInIntent = 'read'): string {
  if (!profile?.onboarded) {
    return intent === 'checkout' ? '/onboarding?intent=checkout' : '/onboarding';
  }
  return intent === 'checkout' ? '/profile?tab=subscription&intent=checkout' : '/feed';
}

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
      setProfile(userProfile);
      setProfileResolved(true);
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
    if (user) {
      try {
        const p = await getUserProfile(user.uid);
        setProfile(p);
      } catch (error) {
        console.error('Error refreshing profile:', error);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setProfileResolved(false);
        let userProfile: UserProfile | null = null;
        try {
          userProfile = await loadProfile(firebaseUser, { allowCreate: false });
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 600));
          try {
            userProfile = await loadProfile(firebaseUser, { allowCreate: false });
          } catch {
            // Leave profile unresolved on startup if we cannot verify state.
            setProfileResolved(false);
          }
        }
        // Identify returning users for PostHog
        identifyUser(firebaseUser.uid, {
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          onboarded: userProfile?.onboarded || false,
        });
        await syncPendingAffiliate(firebaseUser.uid, userProfile);
      } else {
        setProfile(null);
        setProfileResolved(true);
      }
      setLoading(false);
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
        // Keep intent in sessionStorage — page.tsx useEffect reads it once profileResolved=true
        setProfileResolved(false);
        const userProfile = await loadProfile(result.user, { allowCreate: true });

        // Track sign in with PostHog
        identifyUser(result.user.uid, {
          email: result.user.email,
          name: result.user.displayName,
          onboarded: userProfile?.onboarded || false,
        });
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
      await firebaseSignOut(auth);
      setProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileResolved, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
