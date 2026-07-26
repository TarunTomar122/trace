import type { UserProfile, V3UserFeed } from '@/lib/firestore';

function normalizedInterests(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase())
    .sort();
}

export function shouldRefreshPersonalizedFeed({
  feed,
  initialFeedAuthenticated,
  profile,
  profileFresh,
}: {
  feed: V3UserFeed | null;
  initialFeedAuthenticated: boolean;
  profile: UserProfile | null;
  profileFresh: boolean;
}): boolean {
  if (!profileFresh || !profile) return false;
  if (!feed || !initialFeedAuthenticated) return true;

  const viewer = feed.viewer_profile;
  if ((viewer?.role || '') !== (profile.role || '')) return true;
  if (viewer?.onboarded !== profile.onboarded) return true;

  return JSON.stringify(normalizedInterests(viewer?.interests))
    !== JSON.stringify(normalizedInterests(profile.interests));
}

export function personalizedFeedRefreshKey(profile: UserProfile): string {
  return [
    profile.uid,
    profile.role || '',
    profile.onboarded ? '1' : '0',
    normalizedInterests(profile.interests).join(','),
  ].join(':');
}
