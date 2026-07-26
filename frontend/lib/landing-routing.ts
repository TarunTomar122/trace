export type LandingIntent = 'read' | 'checkout';
type OnboardingProfile = { onboarded?: boolean } | null;

export function getPostAuthDestination(
  profile: OnboardingProfile,
  intent: LandingIntent = 'read',
): string {
  if (!profile?.onboarded) {
    return intent === 'checkout' ? '/onboarding?intent=checkout' : '/onboarding';
  }
  return intent === 'checkout' ? '/profile?tab=subscription&intent=checkout' : '/feed';
}

export function getSignedInLandingDestination(
  profile: OnboardingProfile,
  profileResolved: boolean,
  pendingIntent: LandingIntent | null,
): string | null {
  if (pendingIntent === 'checkout') {
    return profileResolved ? getPostAuthDestination(profile, pendingIntent) : null;
  }
  return '/feed';
}
