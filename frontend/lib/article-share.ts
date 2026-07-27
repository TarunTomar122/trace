import type { UserProfile } from '@/lib/firestore';
import { resolveFeedAccess } from '@/lib/subscription-access';

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
  profileFresh: boolean;
  profileRefreshFailed: boolean;
}): PublicStoryCta {
  const {
    user,
    profile,
    loading,
    profileFresh,
    profileRefreshFailed,
  } = options;
  const access = resolveFeedAccess({
    serverHasAccess: false,
    clientProfile: profile,
    clientProfileFresh: profileFresh,
    clientProfileRefreshFailed: profileRefreshFailed,
    authLoading: loading,
    signedIn: Boolean(user),
  });

  if (user && access.hasAccess) {
    return {
      href: '/feed',
      headerLabel: 'Open feed',
      promoTitle: '',
      promoCopy: '',
      buttonLabel: '',
      showPromo: false,
    };
  }

  if (access.pending) {
    return {
      href: '/feed',
      headerLabel: 'Open feed',
      promoTitle: '',
      promoCopy: '',
      buttonLabel: '',
      showPromo: false,
    };
  }

  if (user) {
    return {
      href: '/profile?tab=subscription',
      headerLabel: 'Try Pro',
      promoTitle: 'Unlock your full feed with Trace Pro',
      promoCopy:
        'Get unlimited reads, Pulse signals, and a feed tuned to your interests. Cancel anytime.',
      buttonLabel: 'Subscribe to Pro',
      showPromo: true,
    };
  }

  return {
    href: '/feed?view=pulse',
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
