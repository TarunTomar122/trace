export type SubscriptionAccessProfile = {
  subscriptionStatus?: unknown;
  appSubscriptionStatus?: unknown;
  cancelledAt?: unknown;
  willCancelAt?: unknown;
  nextBillingDate?: unknown;
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  _seconds?: number;
};

export function toDateMaybe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object') {
    const timestamp = value as FirestoreTimestampLike;
    if (typeof timestamp.toDate === 'function') {
      try {
        const date = timestamp.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
      } catch {
        return null;
      }
    }
    const seconds = typeof timestamp.seconds === 'number'
      ? timestamp.seconds
      : timestamp._seconds;
    if (typeof seconds === 'number') {
      const date = new Date(seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function subscriptionStatuses(profile: SubscriptionAccessProfile | null | undefined) {
  return {
    web: String(profile?.subscriptionStatus || 'none'),
    app: String(profile?.appSubscriptionStatus || 'none'),
  };
}

/**
 * True only for a real, paid (Dodo/app) subscription. The web app is free for
 * everyone, so this must NOT gate any feature. It only decides whether to show
 * billing controls (cancel plan) to people who subscribed before Trace went free.
 */
export function hasPaidSubscription(
  profile: SubscriptionAccessProfile | null | undefined,
  now = new Date(),
): boolean {
  const { web, app } = subscriptionStatuses(profile);
  const appActive = ['trial', 'active'].includes(app);
  if (appActive) return true;

  const webActive = ['trial', 'active'].includes(web);
  if (!webActive || !profile?.cancelledAt) return webActive;

  const accessEndsAt = toDateMaybe(profile.willCancelAt) || toDateMaybe(profile.nextBillingDate);
  // Payment-provider status is authoritative. Cancellation timestamps are
  // advisory; if they are missing or malformed, keep an explicitly active
  // subscription accessible instead of silently locking out a paying user.
  return !accessEndsAt || now < accessEndsAt;
}
