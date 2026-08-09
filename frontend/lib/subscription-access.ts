export type SubscriptionAccessProfile = {
  subscriptionStatus?: unknown;
  appSubscriptionStatus?: unknown;
  cancelledAt?: unknown;
  willCancelAt?: unknown;
  nextBillingDate?: unknown;
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

function toDateMaybe(value: unknown): Date | null {
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

export function hasActiveSubscription(
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

export function resolveFeedAccess({
  serverHasAccess,
  clientProfile,
  clientProfileFresh,
  clientProfileRefreshFailed,
  authLoading,
  signedIn,
}: {
  serverHasAccess: boolean;
  clientProfile: SubscriptionAccessProfile | null;
  clientProfileFresh: boolean;
  clientProfileRefreshFailed: boolean;
  authLoading: boolean;
  signedIn: boolean;
}): { hasAccess: boolean; pending: boolean; verificationFailed: boolean } {
  if (clientProfileFresh && hasActiveSubscription(clientProfile)) {
    return { hasAccess: true, pending: false, verificationFailed: false };
  }
  if (serverHasAccess) {
    return { hasAccess: true, pending: false, verificationFailed: false };
  }
  if (clientProfileFresh) {
    return { hasAccess: false, pending: false, verificationFailed: false };
  }
  if (authLoading || signedIn) {
    return {
      hasAccess: false,
      pending: true,
      verificationFailed: clientProfileRefreshFailed,
    };
  }
  return { hasAccess: false, pending: false, verificationFailed: false };
}
