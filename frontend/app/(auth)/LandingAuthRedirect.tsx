'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Signed-in readers skip the pitch: straight to the feed.
 * (proxy.ts redirects requests that carry the session cookies; this covers
 * Firebase client sessions that haven't synced a cookie yet.)
 */
export default function LandingAuthRedirect() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) window.location.replace('/feed');
    });
    return unsub;
  }, []);
  return null;
}
