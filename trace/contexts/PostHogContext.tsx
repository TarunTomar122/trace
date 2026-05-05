import React, { createContext, useContext, useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getPostHog, trackScreen, identifyUser, resetUser } from '@/lib/posthog';

const PostHogContext = createContext<{ isReady: boolean }>({ isReady: true });

export function usePostHog() {
  return useContext(PostHogContext);
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const lastPath = useRef<string | null>(null);

  // Identify user when auth state changes
  useEffect(() => {
    const client = getPostHog();
    if (!client) return;

    if (user?.uid) {
      const props: Record<string, any> = {
        email: profile?.email || user.email || undefined,
        name: profile?.displayName || profile?.name || user.displayName || undefined,
        subscription_status: profile?.subscriptionStatus || 'none',
        role: profile?.role || undefined,
        seniority: profile?.seniority || undefined,
        onboarded: profile?.onboarded ?? false,
        is_early_adopter: profile?.isEarlyAdopter ?? false,
        content_depth: profile?.contentDepth || undefined,
        timezone: profile?.timezone || undefined,
        locale: profile?.locale || undefined,
      };

      // Clean undefined values
      Object.keys(props).forEach((key) => {
        if (props[key] === undefined) delete props[key];
      });

      identifyUser(user.uid, props);
      console.log('[PostHog] Identified user:', user.uid);
    } else {
      resetUser();
      console.log('[PostHog] Reset user (signed out)');
    }
  }, [user?.uid, profile?.email, profile?.displayName, profile?.subscriptionStatus]);

  // Automatic screen tracking
  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;

    // Normalize pathname to a readable screen name
    const screenName = pathname
      .replace(/^\//, '')
      .replace(/\//g, '_')
      .replace(/[()]/g, '')
      || 'home';

    trackScreen(screenName, { path: pathname });
    console.log('[PostHog] Screen:', screenName);
  }, [pathname]);

  return (
    <PostHogContext.Provider value={{ isReady: true }}>
      {children}
    </PostHogContext.Provider>
  );
}
