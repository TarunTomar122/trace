import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Image } from 'expo-image';
import {
  AuthCredential,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { app, auth } from '@/lib/firebase';
import { getOrCreateUserProfile, getUserProfile, deleteUserData, UserProfile } from '@/lib/firestore';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const signInInFlightRef = useRef(false);

  const loadProfile = async (firebaseUser: User) => {
    try {
      const userProfile = await getOrCreateUserProfile(
        firebaseUser.uid,
        firebaseUser.email || '',
        firebaseUser.displayName || '',
        firebaseUser.photoURL
      );
      setProfile(userProfile);
      
      // Prefetch profile photo for instant loading
      if (firebaseUser.photoURL) {
        Image.prefetch(firebaseUser.photoURL).catch(() => {
          // Silent fail - not critical
        });
      }
      
      return userProfile;
    } catch (error) {
      console.error('Error loading profile:', error);
    }
    return null;
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await getUserProfile(user.uid);
      setProfile(p);
    }
  };

  useEffect(() => {
    // Configure Google Sign-In with web client ID from Firebase
    GoogleSignin.configure({
      webClientId: '94335303623-qun0r1562s64vck72483r9lhed22u5h0.apps.googleusercontent.com',
      offlineAccess: true,
    });

    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
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
      await firebaseSignOut(auth);
      setProfile(null);
    } catch (error) {
      console.error('Sign Out Error:', error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No user signed in');
      // Delete all Firestore data first
      await deleteUserData(currentUser.uid);
      // Sign out of Google
      await GoogleSignin.signOut();
      // Delete the Firebase auth account
      await currentUser.delete();
      setProfile(null);
      setUser(null);
    } catch (error) {
      console.error('Delete Account Error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut, deleteAccount, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
