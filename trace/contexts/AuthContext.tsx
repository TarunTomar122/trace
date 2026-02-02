import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { getOrCreateUserProfile, UserProfile } from '@/lib/firestore';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const getGoogleConfig = () => {
  const extra = Constants.expoConfig?.extra as
    | {
        googleAuth?: {
          expoClientId?: string;
          iosClientId?: string;
          androidClientId?: string;
          webClientId?: string;
        };
      }
    | undefined;

  return extra?.googleAuth ?? {};
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const googleConfig = useMemo(() => getGoogleConfig(), []);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    expoClientId: googleConfig.expoClientId,
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId,
    webClientId: googleConfig.webClientId,
  });

  const loadProfile = async (firebaseUser: User) => {
    try {
      const userProfile = await getOrCreateUserProfile(
        firebaseUser.uid,
        firebaseUser.email || '',
        firebaseUser.displayName || '',
        firebaseUser.photoURL
      );
      setProfile(userProfile);
      return userProfile;
    } catch (error) {
      console.error('Error loading profile:', error);
    }
    return null;
  };

  const refreshProfile = async () => {
    if (!user) return;
    const updated = await getOrCreateUserProfile(
      user.uid,
      user.email || '',
      user.displayName || '',
      user.photoURL
    );
    setProfile(updated);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const idToken = response?.type === 'success' ? response.params?.id_token : null;
    if (!idToken) return;

    (async () => {
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      } catch (error) {
        console.error('Error signing in with Google:', error);
        throw error;
      }
    })();
  }, [response]);

  const signInWithGoogle = async () => {
    const hasClientId =
      googleConfig.expoClientId ||
      googleConfig.iosClientId ||
      googleConfig.androidClientId ||
      googleConfig.webClientId;

    if (!hasClientId) {
      throw new Error('Missing Google OAuth client IDs in app.json.');
    }

    if (!request) {
      throw new Error('Google auth request is not ready yet.');
    }

    await promptAsync();
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

