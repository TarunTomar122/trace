import type { UserProfile } from '@/lib/firestore';
import { resolveFeedAccess } from '@/lib/subscription-access';
export {
  buildArticleShareUrl,
  FEED_TYPE_PREFIX,
  normalizeArticleShareId,
  SHARE_SITE_ORIGIN,
} from '@/lib/article-share-url';
export type { ShareableArticle } from '@/lib/article-share-url';

export function buildTopicShareUrl(topic: { id?: string; topic_key?: string }): string | null {
  const topicSlug = topic.topic_key || topic.id;
  if (!topicSlug) return null;
  return `https://www.yourtrace.online/topics/${encodeURIComponent(topicSlug)}`;
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
      href: '/feed?tab=profile',
      headerLabel: 'Try Pro',
      promoTitle: 'Unlock your full feed with Trace Pro',
      promoCopy:
        'Get unlimited reads, Pulse signals, and a feed tuned to your interests. Cancel anytime.',
      buttonLabel: 'Go Pro',
      showPromo: true,
    };
  }

  return {
    href: '/feed',
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
