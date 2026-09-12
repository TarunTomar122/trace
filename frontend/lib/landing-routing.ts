export type LandingIntent = 'read' | 'checkout';
type OnboardingProfile = { onboarded?: boolean } | null;

export function getPostAuthDestination(
  _profile: OnboardingProfile,
  intent: LandingIntent = 'read',
): string {
  return intent === 'checkout'
    ? '/feed?tab=profile'
    : '/feed';
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
