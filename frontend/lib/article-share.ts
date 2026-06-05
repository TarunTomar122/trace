import type { UserProfile } from '@/lib/firestore';

export const SHARE_SITE_ORIGIN = 'https://www.yourtrace.online';

export const FEED_TYPE_PREFIX: Record<string, string> = {
  for_you: 'fy',
  trending: 'tr',
};

export type ShareableArticle = {
  id: string;
  feed_type?: string;
  metadata?: { feed_type?: string };
};

export function normalizeArticleShareId(article: ShareableArticle): string | null {
  const rawId = typeof article.id === 'string' ? article.id.trim() : '';
  if (!rawId) return null;

  if (rawId.startsWith('fy_') || rawId.startsWith('tr_')) {
    return rawId;
  }

  const feedType = article.feed_type || article.metadata?.feed_type;
  const prefix = feedType ? FEED_TYPE_PREFIX[feedType] : null;
  if (!prefix) return null;

  return `${prefix}_${rawId}`;
}

export function buildArticleShareUrl(article: ShareableArticle): string | null {
  const shareId = normalizeArticleShareId(article);
  if (!shareId) return null;
  return `${SHARE_SITE_ORIGIN}/articles/${shareId}`;
}

export function isTraceProUser(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return (
    profile.subscriptionStatus === 'active'
    || profile.subscriptionStatus === 'trial'
    || profile.appSubscriptionStatus === 'active'
    || profile.appSubscriptionStatus === 'trial'
  );
}

export type PublicStoryCta = {
  href: string;
  headerLabel: string;
  promoTitle: string;
  promoCopy: string;
  buttonLabel: string;
  showPromo: boolean;
};

export function getPublicStoryCta(options: {
  user: { uid: string } | null;
  profile: UserProfile | null;
  loading: boolean;
}): PublicStoryCta {
  const { user, profile, loading } = options;

  if (!loading && user && isTraceProUser(profile)) {
    return {
      href: '/feed',
      headerLabel: 'Open feed',
      promoTitle: '',
      promoCopy: '',
      buttonLabel: '',
      showPromo: false,
    };
  }

  if (!loading && user) {
    return {
      href: '/profile?tab=subscription',
      headerLabel: 'Try Pro',
      promoTitle: 'Unlock your full feed with Trace Pro',
      promoCopy:
        'Get unlimited reads, Pulse signals, and a feed tuned to your interests. Start with a 3-day free trial — cancel anytime.',
      buttonLabel: 'Start free trial',
      showPromo: true,
    };
  }

  return {
    href: '/onboarding?intent=read',
    headerLabel: 'Get started',
    promoTitle: 'Build your own personalized feed',
    promoCopy:
      'Trace turns the stories you care about into one daily brief — AI summaries, key takeaways, and trending topics picked for you.',
    buttonLabel: 'Build my feed',
    showPromo: true,
  };
}

export async function copyOrShareUrl(url: string): Promise<'copied'> {
  await navigator.clipboard.writeText(url);
  return 'copied';
}
