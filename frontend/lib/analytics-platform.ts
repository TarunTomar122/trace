export type SignupPlatform = 'web' | 'mobile';

type ProfilePlatformSignals = {
  signupPlatform?: unknown;
  referralSource?: unknown;
  pushToken?: unknown;
  pushNotificationsEnabled?: unknown;
  hasRequestedReview?: unknown;
  appSubscriptionStatus?: unknown;
};

export function classifySignupPlatform(profile: ProfilePlatformSignals): SignupPlatform {
  if (profile.signupPlatform === 'web' || profile.signupPlatform === 'mobile') {
    return profile.signupPlatform;
  }

  const hasMobileSignals = Boolean(
    profile.referralSource ||
    profile.pushToken ||
    Object.hasOwn(profile, 'pushNotificationsEnabled') ||
    Object.hasOwn(profile, 'hasRequestedReview') ||
    (profile.appSubscriptionStatus && profile.appSubscriptionStatus !== 'none')
  );

  return hasMobileSignals ? 'mobile' : 'web';
}
