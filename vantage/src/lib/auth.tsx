import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile } from './types';
import { DEFAULT_PROFILE } from './mock';

// Prototype auth + profile store on localStorage.
// LIVE SWAP: replace signIn/signOut with Firebase Auth (onAuthStateChanged),
// and read/write `profile` + `subscribed` from Firestore user_profiles/{uid}.

interface User {
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  profile: Profile;
  subscribed: boolean;
  loading: boolean;
  signIn: (email: string, name?: string) => void;
  signOut: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  subscribe: () => void;
}

const KEY = 'vantage:v1';
const AuthCtx = createContext<AuthState | null>(null);

type Persisted = { user: User | null; profile: Profile; subscribed: boolean };

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { user: null, profile: DEFAULT_PROFILE, subscribed: false, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { user: null, profile: DEFAULT_PROFILE, subscribed: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => load());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<AuthState>(
    () => ({
      user: state.user,
      profile: state.profile,
      subscribed: state.subscribed,
      loading,
      signIn: (email, name) =>
        setState((s) => ({ ...s, user: { email, name: name || s.user?.name || email.split('@')[0] } })),
      signOut: () => setState((s) => ({ ...s, user: null })),
      updateProfile: (patch) => setState((s) => ({ ...s, profile: { ...s.profile, ...patch } })),
      subscribe: () => setState((s) => ({ ...s, subscribed: true })),
    }),
    [state, loading],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
