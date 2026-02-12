import React, { createContext, useContext, useEffect, useState } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
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

  const signInWithGoogle = async () => {
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

      // Quick network check
      try {
        const testResp = await fetch('https://identitytoolkit.googleapis.com/v1/projects', { method: 'HEAD' });
        console.log('[Auth] Network to Firebase: reachable, status', testResp.status);
      } catch (netErr) {
        console.error('[Auth] Network to Firebase FAILED:', netErr);
      }

      // Create Firebase credential from Google ID token
      const credential = GoogleAuthProvider.credential(idToken);

      console.log('[Auth] Calling signInWithCredential...');
      // Add timeout so it doesn't hang forever
      const result = await Promise.race([
        signInWithCredential(auth, credential),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('signInWithCredential timed out after 15s')), 15000)
        ),
      ]);
      console.log('[Auth] Firebase sign-in complete. Loading profile...');
      
      // Load or create profile
      if (result.user) {
        await loadProfile(result.user);
      }
      console.log('[Auth] Sign-in flow complete.');
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
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
