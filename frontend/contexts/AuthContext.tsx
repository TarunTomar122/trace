"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getOrCreateUserProfile, getUserProfile, UserProfile } from '@/lib/firestore';
import { identifyUser, resetUser, trackSignIn, trackSignOut } from '@/lib/posthog';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileResolved: boolean;
  signInWithGoogle: (intent?: 'read' | 'checkout') => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileResolved: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const CHECKOUT_INTENT_KEY = 'trace_post_auth_intent';

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
      } else {
        setProfile(null);
        setProfileResolved(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (intent: 'read' | 'checkout' = 'read') => {
    try {
      if (typeof window !== 'undefined') {
        if (intent === 'checkout') {
          sessionStorage.setItem(CHECKOUT_INTENT_KEY, 'checkout');
        } else {
          sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
        }
      }
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setProfileResolved(false);
        const userProfile = await loadProfile(result.user, { allowCreate: true });
        const postAuthIntent =
          typeof window !== 'undefined' ? sessionStorage.getItem(CHECKOUT_INTENT_KEY) : null;
        
        // Track sign in with PostHog
        identifyUser(result.user.uid, {
          email: result.user.email,
          name: result.user.displayName,
          onboarded: userProfile?.onboarded || false,
        });
        trackSignIn("google");
        
        if (!userProfile?.onboarded) {
          window.location.href = postAuthIntent === 'checkout'
            ? '/onboarding?intent=checkout'
            : '/onboarding';
        } else if (postAuthIntent === 'checkout') {
          sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
          window.location.href = '/profile?tab=subscription&intent=checkout';
        } else {
          window.location.href = '/feed';
        }
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
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
