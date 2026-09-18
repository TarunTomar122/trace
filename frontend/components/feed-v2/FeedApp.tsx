'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { resolveFeedAccess, hasActiveSubscription } from '@/lib/subscription-access';
import { shortPriceDisplay } from '@/lib/subscription-pricing';
import FeedSkeleton from './FeedSkeleton';
import ProCheckoutButton from './ProCheckoutButton';
import {
  trackCheckoutClicked,
  trackFeedFilterChanged,
  trackFeedItemBookmarked,
  trackFeedItemClicked,
  trackFeedViewed,
  trackFeedOlderLoaded,
  trackBlogFeedWelcomeShown,
  trackBlogFeedWelcomeCta,
  trackDailyBriefPreferenceChanged,
  trackPaywallShown,
  trackProfileUpdated,
  trackPromoCtaClicked,
  trackPromoIntent,
  trackPromoModalOpened,
  trackPromoSubmitted,
  trackPurchaseCompleted,
  trackShareInitiated,
  trackSubscriptionCancelled,
  trackSummaryOpened,
  trackRetentionCaughtUpShare,
  trackRetentionExtensionClicked,
  trackRetentionMilestoneShown,
  trackRetentionThreadFollowed,
} from '@/lib/posthog';
import { bodyParagraphs } from '@/lib/body-text';
import { rankStoriesForProfile } from '@/lib/feed-ranking';
import { flattenRows, layoutFeed, omitStoryFromRows, resolveHeadlines, takeFeedRows, type HeadlineRef } from '@/lib/story-headlines';
import { feedTabLabel, normalizeFeedTab, partitionFeedCats } from '@/lib/feed-links';
import {
  buildCaughtUpShareText,
  buildCaughtUpShareUrl,
  checkNewMilestone,
  dismissExtensionCta,
  markMilestoneSeen,
  pickLatestStory,
  pickStoryOfDay,
  readFollowedThreads,
  readMilestoneSeen,
  toggleFollowedThread,
  type ReadingStreak,
  type WeeklyWrapSummary,
} from '@/lib/retention';
import {
  ActivityHeatmapPanel,
  AgentRetentionCard,
  CaughtUpLaunchpad,
  MilestoneModal,
  PulseAfternoonHook,
  StoryOfDayCard,
  storyDek,
  StreakPill,
  ThreadFollowButton,
  WeeklyWrapPanel,
  retentionCss,
  shouldShowExtensionCta,
  useCaughtUpShare,
} from './retention/RetentionPanels';
import {
  Bookmark, Share, ArrowLeft, User, Check, Star, Plus, X, Clock,
  Home, Sparkles, TrendingUp, Rocket, Code2, Cpu, PenTool, MessageCircle, Lock,
  type LucideIcon,
} from 'lucide-react';

export interface CoverageLink {
  title: string;
  source: string;
  url: string;
  time: string;
}

export interface PromotedTool {
  id: string;
  title: string;
  url: string;
  sub: string;
}

export interface FeedStory {
  id: string;
  /** Topic ids absorbed when same-event cards were folded into this one. */
  mergedIds?: string[];
  threadId?: string;
  rank: number;
  title: string;
  body: string;
  takeaways: string[];
  img: string | null;
  source: string;
  sources: string[];
  sourceNames: string[];
  coverage: CoverageLink[];
  time: string;
  ts: number;
  cat: string;
  url: string;
  tags?: string[];
}

export interface PulseItem {
  id: string;
  title: string;
  sum: string;
  sub: string;
  source: string;
  signal: string;
  url: string;
  img?: string | null;
  read?: number | null;
}

interface Profile {
  name: string;
  email: string;
  interests: string[];
}

const CAT_LABELS: Record<string, string> = {
  ai: 'AI',
  markets: 'Markets',
  'ux-design': 'Design',
  engineering: 'Engineering',
  tech: 'Tech',
  startups: 'Startups',
};

const CAT_ICONS: Record<string, LucideIcon> = {
  ai: Sparkles,
  markets: TrendingUp,
  'ux-design': PenTool,
  engineering: Code2,
  tech: Cpu,
  startups: Rocket,
};

// The lanes Trace actually publishes. Extras from older profiles (engineering,
// security, open-source, policy) are ignored and dropped on the next save.
export const ALL_INTERESTS = ['ai', 'markets', 'tech', 'ux-design', 'startups'];
const FREE_LIMIT_SIGNED_OUT = 4;
const FREE_LIMIT_SIGNED_IN = 5;
/** Max stories shown per Home / AI / Markets / Tech / Startups / Design tab. */
const PER_TAB_STORY_CAP = 15;
/** Max tool rows on the desktop right rail (promoted + house + pulse combined). */
const RAIL_TOOLS_CAP = 3;

function renderBold(text: string): React.ReactNode {
  const parts = text.split('**');
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>));
}

function fmtReach(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

const SORT_STORAGE_KEY = 'trace_feed_sort_v1';

function readStoredSort(): null | 'for_you' | 'recent' {
  try {
    if (typeof window === 'undefined') return null;
    const value = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (value === 'recent') return 'recent';
    // 'top' is the pre-personalization value; treat it as For you.
    if (value === 'top' || value === 'for_you') return 'for_you';
    return null;
  } catch {
    return null;
  }
}

function storeSort(mode: 'for_you' | 'recent'): void {
  try {
    window.localStorage.setItem(SORT_STORAGE_KEY, mode);
  } catch {
    // private mode etc. — preference just won't persist
  }
}

const READ_STORAGE_KEY = 'trace_feed_read_v1';

function readStorageKey(uid?: string | null): string {
  return `${READ_STORAGE_KEY}:${uid || 'guest'}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readStoredReads(uid?: string | null): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = window.localStorage.getItem(readStorageKey(uid));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date?: string; ids?: string[] };
    if (parsed.date !== todayKey() || !Array.isArray(parsed.ids)) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function storeReads(uid: string | null | undefined, ids: Set<string>): void {
  try {
    window.localStorage.setItem(readStorageKey(uid), JSON.stringify({ date: todayKey(), ids: [...ids].slice(-200) }));
  } catch {
    // private mode etc. — read state just won't persist
  }
}

function storyKey(s: { id: string; url: string }): string {
  const raw = s.url && s.url !== '#' ? s.url : s.id;
  return raw.replace(/[#?].*$/, '').replace(/\/$/, '');
}

interface StoredBookmark {
  item_id: string;
  item_metadata?: {
    title?: string;
    url?: string;
    thumbnail?: string;
    source?: string;
    description?: string;
    type?: string;
  };
  bookmarked_at?: string;
}

const GUEST_MARKS_KEY = 'trace_guest_bookmarks_v1';

function readGuestBookmarks(): StoredBookmark[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(GUEST_MARKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((b): b is StoredBookmark => Boolean(b && typeof b.item_id === 'string'))
      : [];
  } catch {
    return [];
  }
}

function writeGuestBookmarks(list: StoredBookmark[]): void {
  try {
    window.localStorage.setItem(GUEST_MARKS_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    // private mode etc. — guest bookmarks just won't persist
  }
}

function bookmarkedAgo(iso?: string): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return '';
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function FeedApp({
  stories, headlines = [], pulse, promoted = [], monthlyReach = 0, generated, serverPro = false, feedDate = '',
  priceDisplay = '', feedError = false, initialStory = null, initialStoryId = null, unlockedId = null,
}: {
  stories: FeedStory[];
  headlines?: HeadlineRef[];
  pulse: { tools: PulseItem[]; discussions: PulseItem[]; blogs: PulseItem[] };
  promoted?: PromotedTool[];
  monthlyReach?: number;
  generated: string | null;
  serverPro?: boolean;
  /** Date id of today's feed doc — cursor start for older stories. */
  feedDate?: string;
  /** Server-resolved price ("$2.99/month" or "₹49/month") for checkout CTAs. */
  priceDisplay?: string;
  /** Global feed load failed server-side — show a retry state, not a blank page. */
  feedError?: boolean;
  /** Archived story resolved server-side for a shared link (not in today's feed). */
  initialStory?: FeedStory | null;
  /** Pre-open a story (shared article page). Falls back to ?story= when present. */
  initialStoryId?: string | null;
  /** This story always opens full — the shared link must work for everyone. */
  unlockedId?: string | null;
}) {
  const reachLine = monthlyReach > 0 ? `${fmtReach(monthlyReach)} readers last month` : 'Seen by builders daily';
  const { user, profile: authProfile, loading: authLoading, profileResolved, profileFresh, profileRefreshFailed, signInWithGoogle, signOut, refreshProfile } = useAuth();
  const access = resolveFeedAccess({
    serverHasAccess: serverPro,
    clientProfile: authProfile,
    clientProfileFresh: profileFresh,
    clientProfileRefreshFailed: profileRefreshFailed,
    authLoading,
    signedIn: !!user,
  });
  const pro = serverPro || access.hasAccess;
  const accessPending = access.pending;
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  // View state lives client-side: the feed data is already here, so opening
  // a story must never hit the server. URL is kept in sync via History API
  // (shareable, back-button friendly) without triggering Next navigation.
  const [view, setView] = useState<{ story: string | null; pulse: string | null }>(() => ({
    story: params.get('story') ?? initialStoryId,
    pulse: params.get('pulse'),
  }));

  const [tab, setTab] = useState<string>(() =>
    normalizeFeedTab(
      params.get('tab') ?? params.get('q'),
      stories.map((s) => s.cat),
    ),
  );
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = useState<StoredBookmark[]>([]);
  const [bookmarkQuery, setBookmarkQuery] = useState('');
  const [readIds, setReadIds] = useState<Set<string>>(() => readStoredReads(null));
  const [toast, setToast] = useState<string | null>(null);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [campaignWelcome, setCampaignWelcome] = useState<{ source: string; campaign: string } | null>(null);
  const sortSegRef = useRef<HTMLDivElement | null>(null);
  const [sortPill, setSortPill] = useState<{ left: number; width: number } | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Older stories are fetched on demand (24-ish per click) for Pro readers,
  // paging back through the daily archive docs.
  const [olderStories, setOlderStories] = useState<FeedStory[]>([]);
  const [olderBefore, setOlderBefore] = useState<string | null>(feedDate || null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderDone, setOlderDone] = useState(false);
  const [olderError, setOlderError] = useState(false);
  // Everything loaded for this session: today's edition plus older batches.
  const allStories = [...stories, ...olderStories];
  const mainRef = useRef<HTMLElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const savedScroll = useRef(0);

  // tools carousel: map vertical wheel to horizontal + drag-to-scroll
  // (touch swipe works natively; this covers mouse/trackpad).
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    let down = false;
    let startX = 0;
    let startLeft = 0;
    const onDown = (e: PointerEvent) => { down = true; startX = e.clientX; startLeft = el.scrollLeft; };
    const onMove = (e: PointerEvent) => { if (down) el.scrollLeft = startLeft - (e.clientX - startX); };
    const onUp = () => { down = false; };
    // seamless infinite glide; pauses for 6s after any manual interaction.
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let paused = false;
    let raf = 0;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tick = () => {
      const track = el.querySelector('.tools-track') as HTMLElement | null;
      const half = track ? track.scrollWidth / 2 : 0;
      if (half > el.clientWidth && half > 0) {
        if (!paused && !down && !reduceMotion) {
          let next = el.scrollLeft + 0.6;
          if (next >= half) next -= half;
          el.scrollLeft = next;
        } else if (el.scrollLeft >= half) {
          el.scrollLeft -= half;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const poke = () => {
      paused = true;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { paused = false; }, 6000);
    };
    const onTouch = () => poke();
    const onWheelPoke = (e: WheelEvent) => { onWheel(e); poke(); };
    const onDownPoke = (e: PointerEvent) => { onDown(e); poke(); };
    el.addEventListener('wheel', onWheelPoke, { passive: false });
    el.addEventListener('pointerdown', onDownPoke);
    el.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (idleTimer) clearTimeout(idleTimer);
      el.removeEventListener('wheel', onWheelPoke);
      el.removeEventListener('pointerdown', onDownPoke);
      el.removeEventListener('touchstart', onTouch);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [tab]);

  // purchase return (?subscription=success / ?tool_promo=success):
  // clean the URL, then verify Pro before celebrating — the webhook can lag.
  const [activating, setActivating] = useState(false);
  const [proReturnPending, setProReturnPending] = useState(false);
  const verifyStarted = useRef(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const kind =
      q.get('subscription') === 'success' ? 'pro'
      : q.get('tool_promo') === 'success' ? 'promo'
      : null;
    if (!kind) return;
    window.history.replaceState(null, '', base());
    refreshProfile().catch(() => null);
    if (kind === 'promo') {
      trackPurchaseCompleted('tool_promo');
      setCelebrate('promo');
      void fireConfetti();
      return;
    }
    setProReturnPending(true);
    setActivating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!proReturnPending || authLoading || !user) return;
    if (verifyStarted.current) return;
    verifyStarted.current = true;
    let cancelled = false;
    (async () => {
      let active = pro;
      for (let attempt = 0; attempt < 6 && !active && !cancelled; attempt++) {
        const p = await refreshProfile().catch(() => null);
        active = hasActiveSubscription(p || authProfile);
        if (!active) await new Promise((r) => setTimeout(r, 1500));
      }
      if (cancelled) return;
      setProReturnPending(false);
      setActivating(false);
      if (active) {
        trackPurchaseCompleted('pro');
        setCelebrate('pro');
        void fireConfetti();
      } else {
        showToast('Payment received — Pro is still activating. Refresh in a minute.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proReturnPending, authLoading, user, authProfile]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profile, setProfile] = useState<Profile>({ name: '', email: '', interests: [] });
  const [savedProfile, setSavedProfile] = useState<Profile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [celebrate, setCelebrate] = useState<null | 'pro' | 'promo'>(null);
  const [dailyOn, setDailyOn] = useState(false);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [streak, setStreak] = useState<ReadingStreak | null>(null);
  const [weeklyWrap, setWeeklyWrap] = useState<WeeklyWrapSummary | null>(null);
  const [followedThreads, setFollowedThreads] = useState<Set<string>>(() => new Set());
  const [milestoneDays, setMilestoneDays] = useState<number | null>(null);
  const [showExtensionCta, setShowExtensionCta] = useState(true);
  const streakRecorded = useRef(false);

  // Reflect the profile's daily-brief preference in the paywall CTA.
  useEffect(() => {
    if (!authProfile) return;
    setDailyOn(authProfile.newsletterOptIn === true || authProfile.dailyNewsletterEnabled === true);
  }, [authProfile]);

  useEffect(() => {
    setFollowedThreads(readFollowedThreads(user?.uid));
    setShowExtensionCta(shouldShowExtensionCta(user?.uid));
    streakRecorded.current = false;
  }, [user?.uid]);

  useEffect(() => {
    const from = params.get('from');
    if (from) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('from');
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
      } catch { /* ignore */ }
    }
  }, [params]);

  useEffect(() => {
    if (!user) {
      setStreak(null);
      setWeeklyWrap(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [streakRes, wrapRes] = await Promise.all([
          fetch('/api/retention/streak', { credentials: 'same-origin' }),
          fetch('/api/retention/weekly-wrap', { credentials: 'same-origin' }),
        ]);
        if (cancelled) return;
        if (streakRes.ok) {
          const data = await streakRes.json();
          const s = data.streak as ReadingStreak;
          setStreak(s);
          const milestone = checkNewMilestone(s.current_streak, readMilestoneSeen(user.uid));
          if (milestone) {
            setMilestoneDays(milestone);
            markMilestoneSeen(milestone, user.uid);
            trackRetentionMilestoneShown(milestone);
          }
        }
        if (wrapRes.ok) {
          const data = await wrapRes.json();
          setWeeklyWrap(data.wrap as WeeklyWrapSummary | null);
        }
      } catch { /* offline etc. */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // hydrate bookmarks from the real store when signed in (same store the app uses).
  // Guests keep theirs on this device so the tab isn't a lie; on sign-in we
  // push the local copies into the account once.
  useEffect(() => {
    if (!user) {
      const guest = readGuestBookmarks();
      setMarks(new Set(guest.map((b) => b.item_id)));
      setBookmarks(guest);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        let unsynced: StoredBookmark[] = [];
        const guest = readGuestBookmarks();
        if (guest.length) {
          try {
            const token = await user.getIdToken();
            const results = await Promise.allSettled(guest.map((b) => fetch('/api/bookmarks', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ item_id: b.item_id, item_metadata: b.item_metadata }),
            })));
            const allLanded = results.every((r) => r.status === 'fulfilled' && r.value.ok);
            if (allLanded) {
              writeGuestBookmarks([]);
            } else {
              // Keep the local copies that did not land so nothing is lost.
              unsynced = guest.filter((_, i) => {
                const r = results[i];
                return r.status !== 'fulfilled' || !r.value.ok;
              });
              writeGuestBookmarks(unsynced);
            }
          } catch {
            unsynced = guest;
          }
        }
        try {
          const token = await user.getIdToken();
          const q = pro && bookmarkQuery.trim() ? `&q=${encodeURIComponent(bookmarkQuery.trim())}` : '';
          const res = await fetch(`/api/bookmarks?limit=100${q}`, { headers: { Authorization: `Bearer ${token}` } });
          if (cancelled) return;
          if (res.status === 403) {
            // Server disagrees about Pro (e.g. revoked) — drop the filter and say so.
            showToast('Saved search is a Pro feature');
            setBookmarkQuery('');
            return;
          }
          if (!res.ok) return;
          const data = await res.json();
          const rows: StoredBookmark[] = Array.isArray(data.bookmarks) ? data.bookmarks : [];
          const known = new Set(rows.map((b) => b.item_id));
          const merged = [...rows, ...unsynced.filter((b) => !known.has(b.item_id))];
          setBookmarks(merged);
          setMarks(new Set(merged.map((b) => b.item_id)));
        } catch { /* offline is fine, local state still works */ }
      })();
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [user, pro, bookmarkQuery]);

  useEffect(() => {
    if (!user) return;
    const hydrated = {
      name: user.displayName || authProfile?.name || 'Reader',
      email: user.email || '',
      interests: ((authProfile?.interests as string[]) || []).filter((i) => ALL_INTERESTS.includes(i)),
    };
    setProfile(hydrated);
    setSavedProfile(hydrated);
  }, [user, authProfile]);

  // browser back/forward: sync view and lane from URL (no server fetch)
  useEffect(() => {
    const cats = stories.map((s) => s.cat);
    const onPop = () => {
      const q = new URLSearchParams(window.location.search);
      setView({ story: q.get('story'), pulse: q.get('pulse') });
      setTab(normalizeFeedTab(q.get('tab') ?? q.get('q'), cats));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [stories]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get('tab') ?? q.get('q');
    if (!raw) return;
    const mapped = normalizeFeedTab(raw, stories.map((s) => s.cat));
    if (mapped !== 'conversations') return;
    const slug = raw.trim().toLowerCase();
    if (slug === 'conversations') return;
    q.delete('q');
    q.set('tab', 'conversations');
    const qs = q.toString();
    window.history.replaceState(null, '', qs ? `${pathname || '/feed'}?${qs}` : (pathname || '/feed'));
  }, [pathname, stories]);

  // Membership is already resolved server-side (session cookie), so paint
  // immediately after mount instead of blocking on Firebase init. The gate
  // below only holds for the very first paint (server + hydration agree).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // First-touch framing for campaign traffic (blog etc.): the free edition is
  // a tier, not a bait-and-switch. Dismissal lasts the session.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('trace_campaign_welcome_dismissed') === '1') return;
      const q = new URLSearchParams(window.location.search);
      const source = q.get('utm_source');
      if (!source) return;
      setCampaignWelcome({ source, campaign: q.get('utm_campaign') || '' });
    } catch { /* private mode etc. */ }
  }, []);

  // Show/event only once auth has resolved, and never for signed-in readers.
  const campaignWelcomeVisible = Boolean(campaignWelcome && !user && !pro && !authLoading);
  const welcomeTracked = useRef(false);
  useEffect(() => {
    if (!campaignWelcomeVisible) return;
    if (!welcomeTracked.current) {
      welcomeTracked.current = true;
      trackBlogFeedWelcomeShown({
        utm_source: campaignWelcome?.source || '',
        utm_campaign: campaignWelcome?.campaign || '',
      });
    }
  }, [campaignWelcomeVisible, campaignWelcome]);

  useEffect(() => {
    if (user) setCampaignWelcome(null);
  }, [user]);

  const feedAlive = useRef(true);
  function flashBurst(id: string) {
    if (!feedAlive.current) return;
    setBurstId(id);
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurstId((cur) => (cur === id ? null : cur)), 520);
  }
  useEffect(() => () => {
    feedAlive.current = false;
    if (burstTimer.current) clearTimeout(burstTimer.current);
  }, []);

  // First sign-in: send readers through the interests step once.
  const onboardRedirected = useRef(false);
  useEffect(() => {
    if (onboardRedirected.current) return;
    if (!user || !profileResolved || !authProfile) return;
    if (authProfile.onboarded === false && sessionStorage.getItem('trace_onboarding_skipped') !== '1') {
      onboardRedirected.current = true;
      router.replace('/onboarding');
    }
  }, [user, profileResolved, authProfile, router]);

  const storyParam = view.story;
  const pulseParam = view.pulse;

  // detail opened: start at the top (.main keeps its scroll position otherwise)
  useEffect(() => {
    if ((storyParam || pulseParam) && mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [storyParam, pulseParam]);

  // restore feed scroll when returning from a detail view
  useEffect(() => {
    if (!storyParam && !pulseParam && mainRef.current && savedScroll.current) {
      mainRef.current.scrollTop = savedScroll.current;
      savedScroll.current = 0;
    }
  }, [storyParam, pulseParam, tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (promoOpen || celebrate) {
        setPromoOpen(false);
        setCelebrate(null);
        return;
      }
      goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [promoOpen, celebrate]);

  const [signingIn, setSigningIn] = useState(false);

  async function fireConfetti() {
    try {
      const confetti = (await import('canvas-confetti')).default;
      const colors = ['#1D9BF0', '#0F1419', '#00BA7C', '#FFD400'];
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.25 }, colors });
      setTimeout(
        () => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.4 }, colors }),
        250,
      );
      setTimeout(
        () => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.4 }, colors }),
        400,
      );
    } catch {
      /* confetti is garnish */
    }
  }

  async function handleSignIn() {
    if (signingIn) return;
    setSigningIn(true);
    try {
      const result = await signInWithGoogle();
      if (result.status === 'error') showToast('Sign-in failed — please try again');
    } catch {
      showToast('Sign-in failed — please try again');
    } finally {
      setSigningIn(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  function base(): string {
    return pathname || '/feed';
  }
  function openStory(s: FeedStory) {
    const blocked = isFree
      && s.id !== unlockedId
      && !fullIds.has(s.id);
    if (mainRef.current) savedScroll.current = mainRef.current.scrollTop;
    setView({ story: s.id, pulse: null });
    if (!blocked) {
      setReadIds((cur) => {
        if (cur.has(s.id)) return cur;
        const next = new Set(cur);
        next.add(s.id);
        storeReads(user?.uid, next);
        return next;
      });
    }
    window.history.pushState(null, '', `${base()}?story=${encodeURIComponent(s.id)}`);
    trackFeedItemClicked(s.id, 'story', s.source || '');
    trackSummaryOpened(s.id, pro, {
      surface: 'feed_v2', item_type: 'story', source: s.source,
      position: s.rank, sources_count: s.sources.length,
    });
  }
  function openPulseItem(t: PulseItem) {
    if (mainRef.current) savedScroll.current = mainRef.current.scrollTop;
    setView({ story: null, pulse: t.id });
    window.history.pushState(null, '', `${base()}?pulse=${encodeURIComponent(t.id)}`);
    trackFeedItemClicked(t.id, 'pulse', t.source || '');
    trackSummaryOpened(t.id, pro, {
      surface: 'feed_v2', item_type: 'pulse', source: t.source,
    });
  }
  function goBack() {
    setView({ story: null, pulse: null });
    window.history.replaceState(null, '', base());
  }
  function go(t: string) {
    if (t !== tab) {
      trackFeedFilterChanged(t, tab, { surface: 'feed_v2' });
      // All tabs share .main. A new tab starts at its own top, not
      // the previous tab's scroll position. Discard any saved detail
      // position so the restoration effect cannot undo this reset.
      savedScroll.current = 0;
      if (mainRef.current) mainRef.current.scrollTop = 0;
    }
    setTab(t);
    if (view.story || view.pulse) {
      setView({ story: null, pulse: null });
    }
    // Lane links are shareable: /feed?tab=markets (older /feed?q= works too).
    const q = new URLSearchParams(window.location.search);
    q.delete('story');
    q.delete('pulse');
    q.delete('q');
    if (t === 'all') q.delete('tab');
    else q.set('tab', t);
    const qs = q.toString();
    window.history.replaceState(null, '', qs ? `${base()}?${qs}` : base());
  }

  function share(id: string, kind: 'story' | 'pulse' = 'story') {
    trackShareInitiated(id, { surface: 'feed_v2' });
    const url = kind === 'pulse'
      ? `${window.location.origin}/feed?pulse=${encodeURIComponent(id)}`
      : `${window.location.origin}/story/${id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => showToast(kind === 'pulse' ? 'Link copied' : 'Link copied — anyone can open this story'),
        () => showToast(url),
      );
    } else showToast(url);
  }

  async function saveProfile() {
    if (!user || savingProfile) return;
    setSavingProfile(true);
    const added = profile.interests.filter((i) => !savedProfile.interests.includes(i));
    const removed = savedProfile.interests.filter((i) => !profile.interests.includes(i));
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          interests: profile.interests,
        }),
      });
      if (!response.ok) throw new Error(`Profile save failed (${response.status})`);
      await refreshProfile().catch(() => null);
      setSavedProfile(profile);
      trackProfileUpdated(['interests']);
      const parts: string[] = [];
      if (added.length) parts.push(`+${added.length} interest${added.length > 1 ? 's' : ''}`);
      if (removed.length) parts.push(`−${removed.length} interest${removed.length > 1 ? 's' : ''}`);
      showToast(parts.length ? `Saved — ${parts.join(', ')} · feed re-ranked` : 'Profile saved — feed re-ranked');
      setProfileNotice('Saved. Your For You feed is re-ordered around these — check Home.');
    } catch {
      setProfileNotice(null);
      showToast('Could not save profile — try again');
    } finally {
      setSavingProfile(false);
    }
  }

  function bookmarkMetadata(id: string) {
    const pulseMeta = allPulse.find((t) => t.id === id);
    const meta = stories.find((s) => s.id === id)
      || olderStories.find((s) => s.id === id)
      || (initialStory && initialStory.id === id ? initialStory : undefined)
      || pulseMeta;
    return {
      title: meta?.title || id,
      type: pulseMeta ? 'discussion' : 'article',
      url: meta?.url || '',
      thumbnail: meta?.img || undefined,
      source: meta?.source || '',
      description: ('sum' in (meta ?? {}) ? (meta as PulseItem).sum : (meta as FeedStory | undefined)?.body || '').slice(0, 500),
    };
  }

  async function toggleMark(id: string) {
    const isMarked = marks.has(id);
    const previousMarks = marks;
    const previousBookmarks = bookmarks;
    const apply = (cur: Set<string>): Set<string> => {
      const next = new Set(cur);
      if (isMarked) next.delete(id); else next.add(id);
      return next;
    };
    setMarks(apply);
    const isStory = stories.some((s) => s.id === id) || olderStories.some((s) => s.id === id);
    trackFeedItemBookmarked(id, isStory ? 'story' : 'pulse', {
      surface: 'feed_v2', action: isMarked ? 'removed' : 'saved',
    });

    if (!user) {
      // Guests: keep them on this device so Saved isn't a lie, and nudge sign-in.
      const guest = readGuestBookmarks().filter((b) => b.item_id !== id);
      if (!isMarked) {
        guest.unshift({ item_id: id, item_metadata: bookmarkMetadata(id), bookmarked_at: new Date().toISOString() });
      }
      writeGuestBookmarks(guest);
      setBookmarks(guest);
      if (!isMarked) flashBurst(id);
      showToast(isMarked ? 'Removed from Bookmarks' : 'Saved on this device — sign in to keep it across devices');
      return;
    }

    try {
      const token = await user.getIdToken();
      if (isMarked) {
        const res = await fetch(`/api/bookmarks?item_id=${encodeURIComponent(id)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`delete failed (${res.status})`);
        setBookmarks((cur) => cur.filter((b) => b.item_id !== id));
      } else {
        const res = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: id, item_metadata: bookmarkMetadata(id) }),
        });
        if (!res.ok) throw new Error(`save failed (${res.status})`);
        setBookmarks((cur) => [
          { item_id: id, item_metadata: bookmarkMetadata(id), bookmarked_at: new Date().toISOString() },
          ...cur.filter((b) => b.item_id !== id),
        ]);
        flashBurst(id);
      }
      showToast(isMarked ? 'Removed from Bookmarks' : 'Added to Bookmarks');
    } catch {
      // Restore both the mark set and the stored-row list.
      setMarks(previousMarks);
      setBookmarks(previousBookmarks);
      showToast('Could not sync bookmark — try again');
    }
  }

  async function loadOlder() {
    if (olderLoading || olderDone || !pro) return;
    setOlderLoading(true);
    setOlderError(false);
    const wantCat = tab === 'all' ? '' : tab;
    try {
      let before = olderBefore || feedDate;
      let cursor: string | null = before;
      const added: FeedStory[] = [];
      // Days can repeat stories across the lookback window; skip those and
      // keep paging until the ACTIVE tab actually gets fresh cards, so a
      // category tab doesn't page past days that only had other topics.
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await fetch(`/api/feed/older?before=${encodeURIComponent(before)}&limit=24`);
        if (!res.ok) throw new Error(`older fetch failed (${res.status})`);
        const data = await res.json() as { stories?: FeedStory[]; nextBefore?: string | null };
        const batch = Array.isArray(data.stories) ? data.stories : [];
        const seen = new Set<string>();
        for (const s of [...stories, ...olderStories, ...added]) seen.add(storyKey(s));
        for (const s of batch) {
          const key = storyKey(s);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          added.push(s);
        }
        cursor = data.nextBefore ?? null;
        const gainedForTab = wantCat ? added.some((s) => s.cat === wantCat) : added.length > 0;
        if (gainedForTab || !cursor) break;
        before = cursor;
      }
      const base = stories.length + olderStories.length;
      setOlderStories((cur) => [...cur, ...added.map((s, i) => ({ ...s, rank: base + i + 1 }))]);
      setOlderBefore(cursor);
      if (!cursor) setOlderDone(true);
      trackFeedOlderLoaded(added.length, base + added.length);
    } catch {
      setOlderError(true);
    } finally {
      setOlderLoading(false);
    }
  }

  async function toggleDailyEmails(location: 'onboarding' | 'feed' | 'profile' = 'profile') {
    if (!user) { void handleSignIn(); return; }
    const next = !dailyOn;
    setDailyOn(next);
    setDailyBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ newsletterOptIn: next, dailyNewsletterEnabled: next }),
      });
      if (!res.ok) throw new Error(`Profile save failed (${res.status})`);
      trackDailyBriefPreferenceChanged(next, location);
      showToast(next ? 'Daily brief on — see you tomorrow morning' : 'Daily brief off');
      refreshProfile().catch(() => null);
    } catch {
      setDailyOn(!next);
      showToast('Could not update the daily brief — try again');
    } finally {
      setDailyBusy(false);
    }
  }

  function toggleThreadFollow(story: FeedStory) {
    const threadId = story.threadId;
    if (!threadId) return;
    const on = toggleFollowedThread(threadId, user?.uid);
    setFollowedThreads(readFollowedThreads(user?.uid));
    trackRetentionThreadFollowed({
      threadId,
      following: on,
      storyId: story.id,
      title: story.title,
      cat: story.cat,
      tab,
    });
    showToast(on ? 'Following this story thread' : 'Unfollowed thread');
  }

  const shareCaughtUp = useCaughtUpShare(streak?.current_streak || 0, readIds.size);

  const counts: Record<string, number> = {};
  for (const s of allStories) counts[s.cat] = (counts[s.cat] || 0) + 1;
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  // Home is the reader's lanes only; other lanes stay one click away in the
  // rail. Signed-out readers (no saved interests) see everything.
  const { mine: myCats, others: otherCats } = partitionFeedCats(cats, savedProfile.interests);
  const homeStories = myCats.length
    ? stories.filter((s) => myCats.includes(s.cat))
    : stories;
  const isProfile = tab === 'profile';
  // sort: Top on Home, Recent elsewhere; the toggle is a persisted preference
  // (localStorage) that wins over the per-tab default, across tabs + sessions.
  const [sortOverride, setSortOverride] = useState<null | 'for_you' | 'recent'>(() => readStoredSort());
  const sortMode = sortOverride ?? (tab === 'all' ? 'for_you' : 'recent');
  const byRecent = (a: FeedStory, b: FeedStory) => (b.ts || 0) - (a.ts || 0);
  const rankedForTab = useMemo(() => {
    const list = tab === 'all'
      ? homeStories
      : stories.filter((s) => s.cat === tab);
    return sortMode === 'recent'
      ? [...list].sort(byRecent)
      : rankStoriesForProfile(
        list,
        { interests: savedProfile.interests, role: authProfile?.role },
      );
  }, [tab, sortMode, homeStories, stories, savedProfile.interests, authProfile?.role]);
  const pulsePool = useMemo(
    () => pulse.discussions.filter((item) => item.id && item.title),
    [pulse.discussions],
  );
  const tabHeadlines = useMemo(
    () => resolveHeadlines(rankedForTab, headlines, pulsePool),
    [rankedForTab, headlines, pulsePool],
  );
  const feedRows = useMemo(
    () => takeFeedRows(layoutFeed(rankedForTab, tabHeadlines, pulsePool), PER_TAB_STORY_CAP),
    [rankedForTab, tabHeadlines, pulsePool],
  );
  const visible = useMemo(() => flattenRows(feedRows), [feedRows]);
  // Older batches shown after the ranked list, narrowed to the active tab
  // (and to the reader's lanes on Home, matching the fresh list).
  const olderForTab = tab === 'all'
    ? (myCats.length ? olderStories.filter((s) => myCats.includes(s.cat)) : olderStories)
    : olderStories.filter((s) => s.cat === tab);
  function setSort(next: 'for_you' | 'recent') {
    if (next === sortMode) return;
    setSortOverride(next);
    storeSort(next);
    trackFeedFilterChanged(`sort:${next}`, `sort:${sortMode}`, { surface: 'feed_v2' });
  }
  // Sliding pill under the active sort option (transitions.dev tabs-sliding).
  // useLayoutEffect so the selected state paints on the first frame.
  useLayoutEffect(() => {
    const seg = sortSegRef.current;
    if (!seg) {
      setSortPill(null);
      return;
    }
    const measure = () => {
      const active = seg.querySelector('.sort-opt.on') as HTMLElement | null;
      if (!active) return;
      const segRect = seg.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      // Absolutely positioned child sits against the padding box, so drop the border.
      setSortPill({ left: rect.left - segRect.left - seg.clientLeft, width: rect.width });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(seg);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sortMode, tab, mounted]);

  const open = storyParam
    ? allStories.find((s) => s.id === storyParam)
      || (initialStory && initialStory.id === storyParam ? initialStory : null)
    : null;
  const allPulse = [...pulse.tools, ...pulse.discussions, ...pulse.blogs];
  const openPulse = pulseParam ? allPulse.find((t) => t.id === pulseParam) || null : null;
  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);

  const proLabel = priceDisplay ? `Go Pro — ${shortPriceDisplay(priceDisplay)}` : 'Go Pro';
  const isFree = !pro;
  // Signed-out readers get 4 stories/day; a free account gets 5. The quota
  // counts distinct stories opened today (across tabs), so it can't leak.
  const freeLimit = accessPending || user ? FREE_LIMIT_SIGNED_IN : FREE_LIMIT_SIGNED_OUT;
  const isStoryLane = tab !== 'all' && tab !== 'bookmarks' && tab !== 'profile'
    && tab !== 'conversations' && tab !== 'reading';
  const laneFree = isFree && isStoryLane;
  // Home keeps the daily quota. Category tabs show the top story plus one more.
  const unlockedCap = laneFree ? 2 : freeLimit;
  // Free readers see the first N stories of the view (4 signed out, 7 with
  // a free account), then a few blurred teasers and the paywall.
  const full = isFree ? visible.slice(0, unlockedCap) : visible;
  const lockedStories = isFree ? visible.slice(unlockedCap) : [];
  const teasers = lockedStories.slice(0, laneFree ? 2 : 4);
  const fullIds = new Set(full.map((s) => s.id));
  const showIds = new Set([...fullIds, ...teasers.map((s) => s.id)]);
  const viewRank = new Map(visible.map((s, i) => [s.id, i + 1]));
  // A card that renders as open always opens; only blurred teasers paywall.
  const openBlocked = Boolean(open)
    && isFree
    && open!.id !== unlockedId
    && !fullIds.has(open!.id);

  const markedStories = allStories.filter((s) => marks.has(s.id));
  const markedPulse = allPulse.filter((t) => marks.has(t.id));

  // Bookmarks tab: stored rows can outlive today's feed, so render them from
  // the bookmark store and use loaded stories only for the richer card.
  const searchingBookmarks = Boolean(user) && bookmarkQuery.trim().length > 0;
  const bookmarkIdSet = new Set(bookmarks.map((b) => b.item_id));
  const richMarkedStories = markedStories.filter((s) => !searchingBookmarks || bookmarkIdSet.has(s.id));
  const richMarkedPulse = markedPulse.filter((t) => !searchingBookmarks || bookmarkIdSet.has(t.id));
  const matchedBookmarkIds = new Set([
    ...richMarkedStories.map((s) => s.id),
    ...richMarkedPulse.map((t) => t.id),
  ]);
  const extraBookmarks = bookmarks.filter((b) => !matchedBookmarkIds.has(b.item_id));
  const bookmarkCount = richMarkedStories.length + richMarkedPulse.length + extraBookmarks.length;

  // "caught up" only after a Pro reader has opened every story they can
  // see, including the archive. Free readers still have locked stories
  // behind the paywall, so celebrating would be a lie.
  const caughtUp = !isFree
    && full.length > 0
    && full.every((s) => readIds.has(s.id))
    && lockedStories.length === 0
    && (olderStories.length === 0 || olderStories.every((s) => readIds.has(s.id)))
    && olderDone;

  // feed viewed (once per mount) + paywall impression (once per session).
  const viewedRef = useRef(false);
  const paywallRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackFeedViewed(stories.length, !pro, 'edition', pro ? 'pro' : 'free', user ? 'authenticated' : 'guest');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (paywallRef.current || !isFree || lockedStories.length === 0) return;
    paywallRef.current = true;
    trackPaywallShown('feed_free_limit', { free_limit: freeLimit, locked_count: lockedStories.length });
  }, [isFree, lockedStories.length, freeLimit]);

  // detail view open? (URL-driven)
  const detailOpen = !!open || !!openPulse;

  const canFeature = !detailOpen
    && tab !== 'bookmarks' && tab !== 'profile'
    && tab !== 'conversations' && tab !== 'reading';
  const featuredPool = isFree ? full : rankedForTab;
  const featuredStory = !canFeature
    ? null
    : sortMode === 'recent'
      ? pickLatestStory(featuredPool)
      : pickStoryOfDay(featuredPool);
  const categoryLeadCats = myCats.length
    ? myCats
    : [...new Set(rankedForTab.map((s) => s.cat))];
  const categoryLeads = tab === 'all' && featuredStory && sortMode !== 'recent'
    ? categoryLeadCats.flatMap((cat) => {
        const pool = featuredPool.filter((s) => s.cat === cat);
        const lead = pickStoryOfDay(pool);
        return lead && lead.id !== featuredStory.id ? [lead] : [];
      })
    : [];
  const pinnedStories = featuredStory ? [featuredStory, ...categoryLeads] : [];
  const listRows = omitStoryFromRows(
    feedRows,
    pinnedStories.flatMap((story) => [story.id, ...(story.mergedIds || [])]),
  );
  const pulseAfternoonItems = [...pulse.discussions, ...pulse.tools].slice(0, 3);

  // Viewing a story counts as reading it — covers shared links and
  // back-button restores too, not just taps in the list.
  const openStoryId = open ? open.id : null;
  useEffect(() => {
    if (!openStoryId || openBlocked) return;
    setReadIds((cur) => {
      if (cur.has(openStoryId)) return cur;
      const next = new Set(cur);
      next.add(openStoryId);
      storeReads(user?.uid, next);
      return next;
    });
    if (!user || streakRecorded.current) return;
    streakRecorded.current = true;
    fetch('/api/retention/streak', { method: 'POST', credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.streak) return;
        const s = data.streak as ReadingStreak;
        setStreak(s);
        const milestone = checkNewMilestone(s.current_streak, readMilestoneSeen(user.uid));
        if (milestone) {
          setMilestoneDays(milestone);
          markMilestoneSeen(milestone, user.uid);
          trackRetentionMilestoneShown(milestone);
        }
      })
      .catch(() => null);
  }, [openStoryId, openBlocked, user?.uid, user]);

  // Reads are per-account: switching users must not inherit the quota.
  useEffect(() => {
    setReadIds(readStoredReads(user?.uid || null));
  }, [user?.uid]);

  // tools carousel cards (rendered twice for a seamless infinite loop).
  const toolCards = (dup: string) => (
    <>
      <a key={`house-${dup}`} className="tool-card" href="https://stocksbrew.online" target="_blank" rel="noreferrer" onClick={() => trackFeedItemClicked('house-stocksbrew', 'house_ad', 'stocksbrew')}>
        <span className="tool-card-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="fav-solo" style={{ borderRadius: 5 }} src="https://www.google.com/s2/favicons?domain=stocksbrew.online&sz=64" alt="" loading="lazy" />
          <span className="rail-ad">AD</span>
        </span>
        <span className="tool-card-title">Stocksbrew - Understand any US stock in minutes</span>
        <span className="tool-card-sub">Reads fundamentals, earnings and news, then tells you exactly what to do.</span>
      </a>
      <PromoSlot key={`promo-${dup}`} monthlyReach={monthlyReach} placement="pulse_mobile" onOpen={() => setPromoOpen(true)} compact />
      {promoted.map((p) => (
        <a key={`${p.id}-${dup}`} className="tool-card" href={p.url} target="_blank" rel="noreferrer" onClick={() => trackFeedItemClicked(p.id, 'promo', '')}>
          <span className="tool-card-top">
            {domainOf(p.url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="fav-solo" style={{ borderRadius: 5 }} src={`https://www.google.com/s2/favicons?domain=${domainOf(p.url)}&sz=64`} alt="" loading="lazy" />
            ) : null}
            <span className="rail-ad">AD</span>
          </span>
          <span className="tool-card-title">{p.title}</span>
          {p.sub ? <span className="tool-card-sub">{p.sub}</span> : null}
        </a>
      ))}
      {topTools(pulse.tools).map((t) => (
        <a key={`${t.id}-${dup}`} className="tool-card" href={t.url} target="_blank" rel="noreferrer" onClick={() => trackFeedItemClicked(t.id, 'pulse', t.source || '')}>
          <span className="tool-card-top">
            {domainOf(t.url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="fav-solo" style={{ borderRadius: 5 }} src={`https://www.google.com/s2/favicons?domain=${domainOf(t.url)}&sz=64`} alt="" loading="lazy" />
            ) : null}
            {t.source ? <span className="tool-card-meta">{t.source}</span> : null}
          </span>
          <span className="tool-card-title">{t.title}</span>
          {(t.sub || t.sum) ? <span className="tool-card-sub">{t.sub || t.sum}</span> : null}
        </a>
      ))}
    </>
  );

  if (authLoading && !mounted) {
    return <FeedSkeleton />;
  }

  return (
    <div className="xw" data-feed-ui="editorial">
      <style>{css}</style>

      {/* mobile bottom nav */}
      <aside className="side">
        <div className="side-inner">
          {user ? (
            <button
              className="brand brand-btn"
              onClick={() => { go('all'); mainRef.current?.scrollTo({ top: 0 }); }}
              aria-label="Back to top of feed"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/trace.webp" alt="Trace" className="brand-logo" />
              <span className="wordmark">Trace</span>
            </button>
          ) : (
            <a className="brand" href="/" aria-label="Trace home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/trace.webp" alt="Trace" className="brand-logo" />
              <span className="wordmark">Trace</span>
            </a>
          )}
          {(streak?.current_streak ?? 0) > 0 ? (
            <div className="ret-streak-slot">
              <StreakPill streak={streak?.current_streak ?? 0} />
            </div>
          ) : null}
          <nav className="nav">
            <NavItem icon={Home} label="Home" active={tab === 'all'} onClick={() => go('all')} />
            {myCats.length === 0
              ? cats.map((c) => {
                  const Icon = CAT_ICONS[c] || Sparkles;
                  return <NavItem key={c} icon={Icon} label={CAT_LABELS[c] || c} active={tab === c} onClick={() => go(c)} />;
                })
              : myCats.map((c) => {
                  const Icon = CAT_ICONS[c] || Sparkles;
                  return <NavItem key={c} icon={Icon} label={CAT_LABELS[c] || c} active={tab === c} onClick={() => go(c)} />;
                })}
            {myCats.length > 0 && otherCats.length > 0 && (
              <>
                <div className="nav-group-label">Others</div>
                {otherCats.map((c) => {
                  const Icon = CAT_ICONS[c] || Sparkles;
                  return <NavItem key={c} icon={Icon} label={CAT_LABELS[c] || c} active={tab === c} onClick={() => go(c)} />;
                })}
              </>
            )}
            <div className="nav-group-label">Pulse</div>
            <NavItem icon={MessageCircle} label={feedTabLabel('conversations')} active={tab === 'conversations' || tab === 'reading'} onClick={() => go('conversations')} />
            <div className="nav-div" />
            <NavItem icon={Bookmark} label="Bookmarks" active={tab === 'bookmarks'} onClick={() => go('bookmarks')} />
          </nav>
          <div className="side-spacer" />
          <div className="account">
            {user ? (
              <button className="account-row" onClick={() => go('profile')}>
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="acct-avatar" src={user.photoURL} alt="" />
                ) : (
                  <span className="acct-avatar acct-fallback">{(user.displayName || 'U')[0]}</span>
                )}
                <span className="acct-main">
                  <b>{user.displayName || authProfile?.name || 'Reader'}</b>
                  <span>{pro ? 'Pro member' : 'Free plan'}</span>
                </span>
              </button>
            ) : (
              <button className="signin-btn" onClick={handleSignIn} disabled={signingIn}>
                <User size={18} /> {signingIn ? 'Signing in…' : 'Sign in'}
              </button>
            )}
          </div>
          <p className="side-foot">{allStories.length} stories · ranked</p>
        </div>
      </aside>

      {/* center rail */}
      <main className="main" ref={mainRef}>
        {activating && (
          <div className="activating" role="status" aria-live="polite">
            <span className="activating-spin" /> Activating your subscription…
          </div>
        )}
        {openPulse ? (
          !pro ? (
            <PaywallPlate what="Pulse — the builders' radar" ask="pro" proLabel={proLabel} />
          ) : (
            <PulseDetail item={openPulse} onBack={goBack} onShare={share} marked={marks.has(openPulse.id)} toggleMark={toggleMark} />
          )
        ) : open ? (
          openBlocked ? (
            <>
              <header className="head">
                <button className="back" onClick={goBack} aria-label="Back to feed"><ArrowLeft size={20} /></button>
                <h1 className="head-title">Story</h1>
                <span className="head-spacer" />
              </header>
              <PaywallPlate
                what="This story"
                ask={user ? 'daily' : 'signup'}
                signingIn={signingIn}
                proLabel={proLabel}
                onSignIn={handleSignIn}
              />
            </>
          ) : (
            <Detail story={open} displayRank={viewRank.get(open.id)} onBack={goBack} onShare={share} marked={marks.has(open.id)} toggleMark={toggleMark} />
          )
        ) : storyParam ? (
          <EmptyFeed
            title="Story not found"
            sub="It may no longer be in today’s feed."
            onRetry={goBack}
            retryLabel="Back to the feed"
          />
        ) : pulseParam ? (
          <EmptyFeed
            title="Pulse item not found"
            sub="It may no longer be in today’s feed."
            onRetry={goBack}
            retryLabel="Back to the feed"
          />
        ) : isProfile ? (
          <ProfileView
            profile={profile} setProfile={setProfile} storyCount={stories.length}
            dirty={dirty} saving={savingProfile} onSave={saveProfile}
            pro={pro} onBack={() => go('all')}
            notice={profileNotice}
            signingIn={signingIn}
            onEdit={() => setProfileNotice(null)}
            notify={showToast}
            dailyOn={dailyOn}
            onToggleDaily={() => toggleDailyEmails('profile')}
            streak={streak}
            weeklyWrap={weeklyWrap}
            getToken={async () => (user ? user.getIdToken() : '')}
            onSubscriptionChanged={() => { refreshProfile().catch(() => null); }}
            user={user ? { displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null}
            onSignOut={() => { signOut(); go('all'); }}
            onSignIn={handleSignIn}
          />
        ) : tab === 'bookmarks' ? (
          <>
            <header className="head">
              <h1 className="head-title">Bookmarks</h1>
              <span className="head-meta">{bookmarkCount}</span>
              {user && pro ? (
                <input
                  className="bm-search"
                  type="search"
                  value={bookmarkQuery}
                  onChange={(e) => setBookmarkQuery(e.target.value)}
                  placeholder="Search saved"
                  aria-label="Search bookmarks"
                />
              ) : null}
            </header>
            <div className="feed">
              {richMarkedStories.length === 0 && richMarkedPulse.length === 0 && extraBookmarks.length === 0 && (
                <div className="empty">
                  <p className="empty-title">{searchingBookmarks ? 'No saved stories match' : 'Nothing saved yet'}</p>
                  <p className="empty-sub">
                    {searchingBookmarks
                      ? 'Try a different search.'
                      : user
                        ? 'Tap the bookmark on any story and it lands here.'
                        : 'Tap the bookmark on any story — sign in to keep them across devices.'}
                  </p>
                </div>
              )}
              {richMarkedStories.map((s) => (
                <article key={s.id} className="post" onClick={() => openStory(s)}>
                  <div className="post-meta">
                    <SourceStack sources={s.sources} />
                    <span className="post-src">{s.source}</span>
                    <span className="post-time">{s.time}</span>
                    {s.sources.length > 1 && <span className="post-group">· {s.sources.length} sources</span>}
                    {s.threadId && <span className="post-group">· Ongoing story</span>}
                    <span className="post-spacer" />
                    <span className="post-rank">#{s.rank}</span>
                  </div>
                  <h2 className="post-title">{s.title}</h2>
                  <Actions id={s.id} size={18} marked={marks.has(s.id)} onToggleMark={toggleMark} onShare={share} />
                </article>
              ))}
              {richMarkedPulse.map((t) => (
                <article key={t.id} className="post" onClick={() => openPulseItem(t)}>
                  <div className="post-meta">
                    <span className="post-src">{t.source}</span>
                    {t.signal && <span className="signal">{t.signal}</span>}
                    <span className="post-spacer" />
                  </div>
                  <h2 className="post-title">{t.title}</h2>
                  <Actions id={t.id} size={18} marked={marks.has(t.id)} onToggleMark={toggleMark} onShare={share} />
                </article>
              ))}
              {extraBookmarks.map((b) => {
                const loadedStory = allStories.find((s) => s.id === b.item_id);
                const loadedPulse = allPulse.find((t) => t.id === b.item_id);
                const url = b.item_metadata?.url || '';
                return (
                  <article
                    key={b.item_id}
                    className="post"
                    role="button"
                    tabIndex={0}
                    aria-label={b.item_metadata?.title || b.item_id}
                    onClick={() => {
                      if (loadedStory) openStory(loadedStory);
                      else if (loadedPulse) openPulseItem(loadedPulse);
                      else if (url) window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      if (loadedStory) openStory(loadedStory);
                      else if (loadedPulse) openPulseItem(loadedPulse);
                      else if (url) window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <div className="post-meta">
                      {b.item_metadata?.source ? <span className="post-src">{b.item_metadata.source}</span> : null}
                      <span className="post-time">{bookmarkedAgo(b.bookmarked_at)}</span>
                      <span className="post-spacer" />
                    </div>
                    <h2 className="post-title">{b.item_metadata?.title || b.item_id}</h2>
                    {b.item_metadata?.description ? (
                      <p className="post-desc">{b.item_metadata.description}</p>
                    ) : null}
                    <Actions
                      id={b.item_id}
                      size={18}
                      marked={marks.has(b.item_id)}
                      onToggleMark={toggleMark}
                      onShare={share}
                      shareKind={b.item_metadata?.type === 'discussion' ? 'pulse' : 'story'}
                    />
                  </article>
                );
              })}
            </div>
          </>
        ) : tab === 'conversations' || tab === 'reading' ? (
          <>
            <header className="head">
              <h1 className="head-title">{feedTabLabel('conversations')}</h1>
              <span className="head-meta">{pulse.discussions.length}</span>
            </header>
            <div className="tools-carousel-wrap">
              <div className="tools-carousel-title"><span>Tools</span><span className="head-meta">{promoted.length + pulse.tools.length}</span></div>
              <div className="tools-carousel" ref={carouselRef}>
                <div className="tools-track">
                  <div className="tools-group">{toolCards('a')}</div>
                  <div className="tools-group" aria-hidden="true" inert>{toolCards('b')}</div>
                </div>
              </div>
            </div>
            <PulseFeed
              items={pulse.discussions}
              title={feedTabLabel('conversations')}
              hideHeader
              mode="inline"
              marks={marks} toggleMark={toggleMark} share={share}
            />
          </>
        ) : (
          <>
            <div className="cat-strip" role="group" aria-label="Topics">
              <div className="cat-strip-track">
                <button className={`cat-chip${tab === 'all' ? ' on' : ''}`} onClick={() => go('all')}>All</button>
                {[...myCats, ...otherCats].map((c) => (
                  <button key={c} className={`cat-chip${tab === c ? ' on' : ''}`} onClick={() => go(c)}>
                    {CAT_LABELS[c] || c}
                  </button>
                ))}
              </div>
            </div>
            <header className="head">
              <h1 className="head-title">{tab === 'all' ? 'Home' : CAT_LABELS[tab] || tab}</h1>
              <span className="head-meta">
                {isFree
                  ? `${Math.min(unlockedCap, visible.length)} of ${visible.length}`
                  : String(visible.length)}
              </span>
              <StreakPill streak={streak?.current_streak || 0} />
              <span className="post-spacer" />
              <div className="sort-seg" role="group" aria-label="Sort stories" ref={sortSegRef}>
                {sortPill && (
                  <span
                    className="sort-pill"
                    aria-hidden="true"
                    style={{ transform: `translateX(${sortPill.left}px)`, width: sortPill.width }}
                  />
                )}
                <button
                  className={`sort-opt${sortMode === 'for_you' ? ' on' : ''}`}
                  onClick={() => setSort('for_you')}
                  aria-pressed={sortMode === 'for_you'}
                >
                  <Sparkles size={14} /> {user ? 'For you' : 'Top'}
                </button>
                <button
                  className={`sort-opt${sortMode === 'recent' ? ' on' : ''}`}
                  onClick={() => setSort('recent')}
                  aria-pressed={sortMode === 'recent'}
                >
                  <Clock size={14} /> Recent
                </button>
              </div>
            </header>
            {featuredStory && (
              <StoryOfDayCard
                story={featuredStory}
                kicker={
                  sortMode === 'recent'
                    ? (tab === 'all' ? 'Latest' : `Latest in ${CAT_LABELS[tab] || tab}`)
                    : (tab === 'all' ? 'Story of the day' : `Top in ${CAT_LABELS[tab] || tab}`)
                }
                onOpen={() => openStory(featuredStory)}
                following={featuredStory.threadId ? followedThreads.has(featuredStory.threadId) : false}
                onToggleFollow={featuredStory.threadId ? () => toggleThreadFollow(featuredStory) : undefined}
                locked={isFree && !fullIds.has(featuredStory.id)}
              />
            )}
            {categoryLeads.map((story) => (
              <StoryOfDayCard
                key={`lead-${story.id}`}
                story={story}
                size="lead"
                kicker={`Top in ${CAT_LABELS[story.cat] || story.cat}`}
                onOpen={() => openStory(story)}
                following={story.threadId ? followedThreads.has(story.threadId) : false}
                onToggleFollow={story.threadId ? () => toggleThreadFollow(story) : undefined}
                locked={isFree && !fullIds.has(story.id)}
              />
            ))}
            {campaignWelcomeVisible && campaignWelcome && (
              <div className="welcome-strip">
                <div className="welcome-strip-main" role="status">
                  <p className="welcome-strip-title">You&rsquo;re reading the free edition</p>
                  <p className="welcome-strip-sub">First 4 stories are yours. A free account gets 5 a day plus the morning email.</p>
                </div>
                <div className="welcome-strip-actions">
                  <button
                    className="welcome-strip-cta"
                    onClick={() => {
                      trackBlogFeedWelcomeCta(campaignWelcome.source, campaignWelcome.campaign);
                      void handleSignIn();
                    }}
                    disabled={signingIn}
                  >
                    {signingIn ? 'Signing in…' : 'Create free account'}
                  </button>
                  <button
                    className="welcome-strip-x"
                    aria-label="Dismiss free-edition notice"
                    onClick={() => {
                      try { sessionStorage.setItem('trace_campaign_welcome_dismissed', '1'); } catch {}
                      setCampaignWelcome(null);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
            <div className="feed">
              {feedError ? (
                <EmptyFeed
                  title="Couldn’t load the feed"
                  sub="Something went wrong on our side. Try again in a moment."
                  onRetry={() => window.location.reload()}
                />
              ) : stories.length === 0 ? (
                <EmptyFeed
                  title="No stories yet today"
                  sub="We add stories throughout the day. Check back in a bit."
                  onRetry={() => window.location.reload()}
                />
              ) : tab === 'all' && visible.length === 0 ? (
                <EmptyFeed
                  title="Nothing in your topics yet"
                  sub="Home shows only the topics you picked. Add more, or open another tag from the rail."
                  onRetry={() => go('profile')}
                  retryLabel="Edit topics"
                />
              ) : visible.length === 0 ? (
                <EmptyFeed
                  title={`No ${CAT_LABELS[tab] || tab} stories today`}
                  sub="Nothing in this topic made today's edition. Try Home or another tag."
                  onRetry={() => go('all')}
                  retryLabel="Back to Home"
                />
              ) : (
                listRows.map((row, rowIndex) => {
                  const renderCard = (s: FeedStory, grouped: boolean, showImage = !grouped) => {
                    if (!showIds.has(s.id)) return null;
                    const locked = isFree && !fullIds.has(s.id);
                    return (
                      <StoryCard
                        key={s.id}
                        story={s}
                        displayRank={viewRank.get(s.id)}
                        hideRank={grouped}
                        showImage={showImage}
                        locked={locked}
                        lockedLabel={locked ? (user ? 'Buy Pro to see full stories and daily email' : 'Sign up to see full stories') : undefined}
                        burst={burstId === s.id}
                        onClick={() => openStory(s)}
                        marked={marks.has(s.id)}
                        onToggleMark={toggleMark}
                        onShare={share}
                        threadFollowing={s.threadId ? followedThreads.has(s.threadId) : false}
                        onToggleThreadFollow={s.threadId ? () => toggleThreadFollow(s) : undefined}
                      />
                    );
                  };
                  if (row.kind === 'story') return renderCard(row.story, false);
                  const members = row.stories.filter((s) => showIds.has(s.id));
                  if (members.length < 2) {
                    return <Fragment key={row.id}>{members.map((s) => renderCard(s, false))}</Fragment>;
                  }
                  const tone = listRows.slice(0, rowIndex).filter((entry) => entry.kind === 'headline').length % 4;
                  return (
                    <HeadlineSection key={row.id} label={row.label} tone={tone}>
                      {members.map((s) => renderCard(s, true, true))}
                      {row.related.map((item) => {
                        const pulseItem = pulsePool.find((entry) => entry.id === item.id);
                        if (!pulseItem) return null;
                        const kind = 'Conversation';
                        return (
                          <article
                            key={pulseItem.id}
                            className="post headline-related"
                            role="button"
                            tabIndex={0}
                            onClick={() => openPulseItem(pulseItem)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openPulseItem(pulseItem);
                              }
                            }}
                          >
                            <div className="post-row">
                              {pulseItem.img ? <FeedImage src={pulseItem.img} className="post-thumb post-thumb-sm" alt="" /> : null}
                              <div className="post-copy">
                                <h2 className="post-title">{pulseItem.title}</h2>
                                <div className="post-meta">
                                  {domainOf(pulseItem.url) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img className="fav-solo" src={`https://www.google.com/s2/favicons?domain=${domainOf(pulseItem.url)}&sz=64`} alt="" loading="lazy" />
                                  ) : null}
                                  <span className="post-src">{pulseItem.source || kind}</span>
                                  <span className="post-group">· {kind}</span>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </HeadlineSection>
                  );
                })
              )}

              {!feedError && isFree && lockedStories.length > 0 && (
                <PaywallPlate
                  what="the full ranked feed"
                  ask={user ? 'daily' : 'signup'}
                  signingIn={signingIn}
                  proLabel={proLabel}
                  onSignIn={handleSignIn}
                  compact={laneFree}
                />
              )}

              {!feedError && !caughtUp && tab === 'all' && visible.length > 0 && readIds.size > 0 && pulseAfternoonItems.length > 0 && (
                <PulseAfternoonHook
                  items={pulseAfternoonItems}
                  onOpen={() => go('conversations')}
                  onOpenItem={(item) => openPulseItem(item)}
                />
              )}

              {!isFree && (
                <>
                  {olderForTab.length > 0 && (
                    <div className="older-sep">
                      <span>{tab === 'all' ? 'Earlier stories' : `Earlier in ${CAT_LABELS[tab] || tab}`}</span>
                    </div>
                  )}
                  {olderForTab.map((s) => (
                    <StoryCard
                      key={s.id}
                      story={s}
                      burst={burstId === s.id}
                      onClick={() => openStory(s)}
                      marked={marks.has(s.id)}
                      onToggleMark={toggleMark}
                      onShare={share}
                    />
                  ))}
                  {!olderDone && (
                    <button className="load-older" onClick={loadOlder} disabled={olderLoading}>
                      <Clock size={16} />
                      {olderLoading
                        ? 'Loading older stories…'
                        : tab === 'all'
                          ? 'See older stories'
                          : `See older ${CAT_LABELS[tab] || tab} stories`}
                    </button>
                  )}
                  {olderDone && olderStories.length > 0 && (
                    <p className="older-end">
                      {tab === 'all'
                        ? 'That’s the whole archive for now.'
                        : `That’s every ${CAT_LABELS[tab] || tab} story in the archive.`}
                    </p>
                  )}
                  {olderError && (
                    <p className="older-error">Couldn&rsquo;t load older stories. Try again.</p>
                  )}
                </>
              )}

              {caughtUp && (
                <CaughtUpLaunchpad
                  streak={streak?.current_streak || 0}
                  storiesRead={readIds.size}
                  dailyOn={dailyOn}
                  dailyBusy={dailyBusy}
                  onToggleDaily={() => toggleDailyEmails('feed')}
                  onShare={async () => {
                    trackRetentionCaughtUpShare(streak?.current_streak || 0, readIds.size);
                    if (typeof navigator.share === 'function') {
                      try {
                        await navigator.share({
                          title: 'Trace',
                          text: buildCaughtUpShareText(streak?.current_streak || 0, readIds.size),
                          url: buildCaughtUpShareUrl(),
                        });
                        return;
                      } catch { /* cancelled or failed — fall through */ }
                    }
                    shareCaughtUp();
                    showToast('Share link copied');
                  }}
                  onOpenPulse={() => go('conversations')}
                  showExtension={showExtensionCta}
                  onDismissExtension={() => {
                    dismissExtensionCta(user?.uid);
                    setShowExtensionCta(false);
                    trackRetentionExtensionClicked('caught_up');
                  }}
                  pulsePreview={pulseAfternoonItems}
                />
              )}
            </div>
          </>
        )}
      </main>

      {milestoneDays !== null && (
        <MilestoneModal days={milestoneDays} onClose={() => setMilestoneDays(null)} />
      )}

      {/* right rail: two pulse cards */}
      <aside className="right">
        <div className="rail">
          <div className="rail-head">
            <h2 className="rail-title">Tools</h2>
            <span className="rail-meta">{generated ? `updated ${generated}` : 'hourly'}</span>
          </div>
          <div className="rail-items">
            {railToolSlots(promoted, pulse.tools).map((slot) => {
              if (slot.kind === 'promoted') {
                const p = slot.item;
                return (
                  <a key={p.id} className="pulse-row" href={p.url} target="_blank" rel="noreferrer" onClick={() => trackFeedItemClicked(p.id, 'promo', '')}>
                    <RailLogo item={{ url: p.url, source: '' } as PulseItem} />
                    <span className="pulse-main">
                      <span className="pulse-title">{p.title} <span className="rail-ad">AD</span></span>
                      {p.sub ? <span className="rail-sub">{p.sub}</span> : null}
                    </span>
                  </a>
                );
              }
              if (slot.kind === 'house') {
                return (
                  <a key="house-stocksbrew" className="pulse-row" href="https://stocksbrew.online" target="_blank" rel="noreferrer" onClick={() => trackFeedItemClicked('house-stocksbrew', 'house_ad', 'stocksbrew')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="fav-solo" style={{ borderRadius: 5, alignSelf: 'flex-start', marginTop: 2 }} src="https://www.google.com/s2/favicons?domain=stocksbrew.online&sz=64" alt="" loading="lazy" />
                    <span className="pulse-main">
                      <span className="pulse-title">Stocksbrew - Understand any US stock in minutes <span className="rail-ad">AD</span></span>
                      <span className="rail-sub">Stocksbrew reads fundamentals, earnings and news for you then tells you exactly what to do with your stocks.</span>
                    </span>
                  </a>
                );
              }
              const t = slot.item;
              return (
                <a key={t.id} className="pulse-row" href={t.url} target="_blank" rel="noreferrer" onClick={() => trackFeedItemClicked(t.id, 'pulse', t.source || '')}>
                  <RailLogo item={t} />
                  <span className="pulse-main">
                    <span className="pulse-title">{t.title}</span>
                    {(t.sub || (!isGithubItem(t) && t.signal)) ? (
                      <span className="rail-sub">{t.sub || t.signal}</span>
                    ) : null}
                    {isGithubItem(t) && t.signal ? (
                      <span className="rail-stars"><Star size={12} /> {t.signal}</span>
                    ) : null}
                  </span>
                </a>
              );
            })}
          </div>
          <PromoSlot monthlyReach={monthlyReach} placement="tools_rail" onOpen={() => setPromoOpen(true)} />
        </div>
      </aside>

      {/* mobile bottom nav */}
      <nav className="bottom-nav">
        <button className={`bn-item${tab === 'all' ? ' on' : ''}`} onClick={() => go('all')}><Home size={24} /><span>Home</span></button>
        <button className={`bn-item${tab === 'conversations' || tab === 'reading' ? ' on' : ''}`} onClick={() => go('conversations')}><MessageCircle size={24} /><span>{feedTabLabel('conversations')}</span></button>
        <button className={`bn-item${tab === 'bookmarks' ? ' on' : ''}`} onClick={() => go('bookmarks')}><Bookmark size={24} /><span>Saved</span></button>
        <button className={`bn-item${isProfile ? ' on' : ''}`} onClick={() => go('profile')}><User size={24} /><span>Profile</span></button>
      </nav>

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      {promoOpen && (
        <PromoteModal
          onClose={() => setPromoOpen(false)}
          onSignIn={handleSignIn}
          signedIn={!!user}
          getToken={async () => (user ? user.getIdToken() : '')}
        />
      )}
      {celebrate && <WelcomeModal kind={celebrate} onClose={() => setCelebrate(null)} />}
    </div>
  );
}

function WelcomeModal({ kind, onClose }: { kind: 'pro' | 'promo'; onClose: () => void }) {
  const isPro = kind === 'pro';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const perks = isPro
    ? [
      'The full ranked feed, no 7-story cap',
      'Full summaries with key points',
      'Pulse: Top HN',
      'Profile-ranked picks plus the daily email brief',
    ]
    : [
      'Your tool is featured in Tools for 30 days',
      'Seen across the feed on desktop and mobile',
      'Support anytime: tomartarun2001@gmail.com',
    ];
  return (
    <div className="promo-overlay" onClick={onClose}>
      <div className="promo-modal celebrate-modal" role="dialog" aria-modal="true" aria-label={isPro ? 'Welcome to Pro' : 'Your tool is live'} onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-badge"><Check size={26} /></div>
        <h2 className="promo-title celebrate-title">
          {isPro ? 'Welcome to Pro' : 'Your tool is live'}
        </h2>
        <p className="promo-price celebrate-sub">
          {isPro
            ? 'Payment confirmed. Thanks for backing Trace, here is what just unlocked.'
            : 'Payment confirmed. Thanks for backing Trace, your promo is now running.'}
        </p>
        <ul className="perk-list">
          {perks.map((p) => (
            <li key={p}><Check size={16} /><span>{p}</span></li>
          ))}
        </ul>
        <button className="promo-pay" onClick={onClose} autoFocus>
          {isPro ? 'Start exploring' : 'Nice'}
        </button>
        {isPro && <p className="promo-support">$2.99/mo · cancel anytime in Profile</p>}
      </div>
    </div>
  );
}

function PromoteModal({ onClose, onSignIn, signedIn, getToken }: {
  onClose: () => void; onSignIn: () => void; signedIn: boolean;
  getToken: () => Promise<string>;
}) {
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [subtext, setSubtext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function pay() {
    if (busy) return;
    trackPromoIntent({
      intent_stage: 'submit_attempt',
      signed_in: signedIn,
      fields_filled: [link, title, subtext].filter((value) => value.trim()).length,
    });
    if (!signedIn) { onSignIn(); return; }
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/tools/promote', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link, title, subtext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open checkout');
      if (!data.checkoutUrl) throw new Error('Could not open checkout');
      trackPromoSubmitted({ domain: domainOf(link) });
      trackCheckoutClicked('tool_promo', { domain: domainOf(link) });
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <div className="promo-overlay" onClick={onClose}>
      <div className="promo-modal" role="dialog" aria-modal="true" aria-label="Promote your tool" onClick={(e) => e.stopPropagation()}>
        <div className="promo-head">
          <h2 className="promo-title">Promote your tool</h2>
          <button className="promo-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="promo-price">$19/month · live in Tools within minutes of payment</p>
        <label className="promo-label">Tool link
          <input className="promo-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://yourtool.com" inputMode="url" />
        </label>
        <label className="promo-label">Title
          <input className="promo-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mytool / my-tool" maxLength={80} />
        </label>
        <label className="promo-label">One-line description
          <input className="promo-input" value={subtext} onChange={(e) => setSubtext(e.target.value)} placeholder="What it does, in one line" maxLength={160} />
        </label>
        {error ? <p className="promo-error">{error}</p> : null}
        <button className="promo-pay" onClick={pay} disabled={busy}>
          {busy ? 'Opening checkout…' : signedIn ? 'Submit' : 'Sign in to continue'}
        </button>
        <p className="promo-support">Support throughout your month: <a href="mailto:tomartarun2001@gmail.com">tomartarun2001@gmail.com</a></p>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-item${active ? ' active' : ''}`} onClick={onClick}>
      <span className="nav-with-ic"><Icon size={22} /> {label}</span>
    </button>
  );
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Source logo for a pulse item: GitHub / Hacker News marks, else domain favicon. */
function RailLogo({ item }: { item: PulseItem }) {
  const u = (item.url || '').toLowerCase();
  const s = (item.source || '').toLowerCase();
  let src = '';
  if (u.includes('github.com')) {
    src = 'https://cdn.simpleicons.org/github/181815';
  } else if (s.includes('hacker') || s.includes('ycombinator') || s.replace(/\s+/g, '').includes('showhn') || u.includes('news.ycombinator.com')) {
    src = 'https://cdn.simpleicons.org/ycombinator/FF6600';
  } else {
    const d = domainOf(item.url);
    if (d) src = `https://www.google.com/s2/favicons?domain=${d}&sz=64`;
  }
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="rail-logo" src={src} alt="" loading="lazy" />
  );
}

function isGithubItem(item: PulseItem): boolean {
  return (item.url || '').toLowerCase().includes('github.com');
}

function starCount(item: PulseItem): number {
  const m = (item.signal || '').toLowerCase().replace(/,/g, '').match(/[\d.]+k?/);
  if (!m) return 0;
  const raw = m[0];
  return raw.endsWith('k') ? parseFloat(raw) * 1000 : parseFloat(raw) || 0;
}

// Tools rail mix: top-starred GitHub repo + top Product Hunt launch +
// top product from anywhere else. Blog/docs pages (github.blog etc.) are
// never tools, only last-resort backfill.
function isBlogPage(t: PulseItem): boolean {
  const u = (t.url || '').toLowerCase();
  return u.includes('github.blog') || u.includes('docs.github.com') || u.includes('github.com/blog');
}

function topTools(tools: PulseItem[]): PulseItem[] {
  const list = tools || [];
  const gh = list
    .filter((t) => isGithubItem(t) && !isBlogPage(t))
    .sort((a, b) => starCount(b) - starCount(a));
  const rest = list.filter((t) => !isGithubItem(t) && !isBlogPage(t));
  const ph = rest.find((t) => (t.url || '').toLowerCase().includes('producthunt.com'));
  const other = rest.find((t) => t !== ph);
  const picked: PulseItem[] = [];
  if (gh[0]) picked.push(gh[0]);
  if (ph) picked.push(ph);
  if (other) picked.push(other);
  for (const t of [...rest, ...gh, ...list]) {
    if (picked.length >= RAIL_TOOLS_CAP) break;
    if (!picked.includes(t)) picked.push(t);
  }
  return picked.slice(0, RAIL_TOOLS_CAP);
}

type RailToolSlot =
  | { kind: 'promoted'; item: PromotedTool }
  | { kind: 'house' }
  | { kind: 'pulse'; item: PulseItem };

function railToolSlots(promoted: PromotedTool[], tools: PulseItem[]): RailToolSlot[] {
  const slots: RailToolSlot[] = [];
  for (const p of promoted) {
    if (slots.length >= RAIL_TOOLS_CAP) break;
    slots.push({ kind: 'promoted', item: p });
  }
  if (slots.length < RAIL_TOOLS_CAP) slots.push({ kind: 'house' });
  for (const t of topTools(tools)) {
    if (slots.length >= RAIL_TOOLS_CAP) break;
    slots.push({ kind: 'pulse', item: t });
  }
  return slots;
}

function PromoSlot({ monthlyReach, placement, onOpen, compact = false }: { monthlyReach: number; placement: string; onOpen: () => void; compact?: boolean }) {
  const reach = monthlyReach > 0 ? fmtReach(monthlyReach) : null;
  return (
    <div className={`promo-slot${compact ? ' promo-slot-compact' : ''}`}>
      <div className="promo-slot-copy">
        <span className="promo-headline">{reach ? `Feature your tool to ${reach} monthly tech readers` : "Feature your tool to Trace's tech audience"}</span>
        <span className="promo-subline">$19/month · 30 days on Trace</span>
      </div>
      <div className="promo-slot-actions">
        <button className="promo-cta" type="button" onClick={() => {
          const props = { placement, cta: 'feature_my_tool' };
          trackPromoCtaClicked(props);
          trackPromoModalOpened(props);
          onOpen();
        }}>
          Feature my tool
        </button>
        <a
          className="promo-proof-link"
          href="https://us.posthog.com/shared/nvQIXZmOZ9ZJLv_WNXFS9sYW0nn52Q"
          target="_blank"
          rel="noreferrer"
          aria-label="View Trace’s public audience dashboard"
          onClick={() => trackPromoCtaClicked({ placement, cta: 'view_audience_proof' })}
        >
          View audience proof
        </a>
      </div>
    </div>
  );
}

function SourceStack({ sources }: { sources: string[] }) {
  const shown = sources.slice(0, 3);
  if (shown.length === 0) return <span className="post-spacer" />;
  return (
    <span className="stack" title={shown.join(', ')}>
      {shown.map((d) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={d} className="fav" src={`https://www.google.com/s2/favicons?domain=${d}&sz=64`} alt="" loading="lazy" />
      ))}
    </span>
  );
}

function StoryCard({ story, onClick, marked, onToggleMark, onShare, locked = false, lockedLabel, displayRank, burst = false, hideRank = false, showImage = true, threadFollowing = false, onToggleThreadFollow }: {
  story: FeedStory; onClick: () => void; marked: boolean;
  onToggleMark: (id: string) => void; onShare: (id: string) => void;
  locked?: boolean; lockedLabel?: string; displayRank?: number; burst?: boolean;
  hideRank?: boolean; showImage?: boolean; threadFollowing?: boolean; onToggleThreadFollow?: () => void;
}) {
  const rank = displayRank ?? story.rank;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  const dek = locked ? '' : storyDek(story);
  const thumb = showImage && story.img
    ? <FeedImage src={story.img} className={`post-thumb${locked ? ' locked-thumb' : ''}`} alt="" />
    : null;
  return (
    <article
      className={`post${locked ? ' locked' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={locked ? `Locked story: ${story.title}` : story.title}
      onClick={onClick}
      onKeyDown={onKey}
    >
      <div className="post-row">
        {thumb}
        <div className="post-copy">
          <h2 className={`post-title${locked ? ' locked-title' : ''}`}>{story.title}</h2>
          {locked ? (
            <p className="lock-note"><Lock size={13} /> {lockedLabel || 'Sign up to see full stories'}</p>
          ) : dek ? (
            <p className="post-dek">{dek}</p>
          ) : null}
          <div className="post-meta">
            <SourceStack sources={story.sources} />
            {locked ? null : <span className="post-src">{story.source}</span>}
            <span className="post-time">{story.time}</span>
            {story.sources.length > 1 && <span className="post-group">· {story.sources.length} sources</span>}
            {story.threadId && (
              <span className="post-group">
                · Ongoing story
                {!locked && onToggleThreadFollow ? (
                  <ThreadFollowButton threadId={story.threadId} following={threadFollowing} onToggle={onToggleThreadFollow} />
                ) : null}
              </span>
            )}
            {!hideRank && <><span className="post-spacer" /><span className="post-rank">#{rank}</span></>}
          </div>
          {locked ? null : (
            <Actions id={story.id} size={18} marked={marked} onToggleMark={onToggleMark} onShare={onShare} burst={burst} />
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyFeed({ title, sub, onRetry, retryLabel = 'Retry' }: {
  title: string; sub: string; onRetry: () => void; retryLabel?: string;
}) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      <p className="empty-sub">{sub}</p>
      <button className="empty-retry" onClick={onRetry}>{retryLabel}</button>
    </div>
  );
}

function HeadlineSection({ label, tone, children }: { label: string; tone: number; children: ReactNode }) {
  return (
    <section className={`headline tone-${tone}`} aria-label={label}>
      <header className="headline-head">
        <h2 className="headline-title">{label}</h2>
      </header>
      <div className="headline-stories">
        {children}
      </div>
    </section>
  );
}

/** Feed image: loads without a referer (many outlets 403 on hotlinks),
 * fades in when ready, and collapses entirely when the URL is dead so a
 * broken thumbnail never leaves an empty block in the card. */
function FeedImage({ src, className, alt = '' }: { src?: string | null; className: string; alt?: string }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'failed'>('loading');
  if (!src || status === 'failed') return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      data-status={status}
      onLoad={() => setStatus('ok')}
      onError={() => setStatus('failed')}
    />
  );
}

function Actions({ id, size = 18, marked, onToggleMark, onShare, shareKind = 'story', burst = false }: {
  id: string; size?: number; marked: boolean;
  onToggleMark: (id: string) => void; onShare: (id: string, kind?: 'story' | 'pulse') => void;
  shareKind?: 'story' | 'pulse'; burst?: boolean;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="actions" onClick={stop}>
      <button
        className={`act act-mark${marked ? ' on' : ''}`}
        onClick={() => onToggleMark(id)}
        aria-label={marked ? 'Remove bookmark' : 'Bookmark this item'}
        aria-pressed={marked}
        data-burst={burst ? 'true' : undefined}
      >
        <span className="act-ic"><Bookmark size={size} fill={marked ? 'currentColor' : 'none'} /></span>
      </button>
      <button
        className="act act-share"
        onClick={() => onShare(id, shareKind)}
        aria-label={shareKind === 'pulse' ? 'Share this pulse item' : 'Share this story'}
      >
        <span className="act-ic"><Share size={size} /></span>
      </button>
    </div>
  );
}

function PulseFeed({ items, title, mode, onOpen, marks, toggleMark, share, hideHeader = false }: {
  items: PulseItem[]; title: string; mode: 'inline' | 'detail'; onOpen?: (t: PulseItem) => void;
  marks: Set<string>; toggleMark: (id: string) => void; share: (id: string) => void;
  hideHeader?: boolean;
}) {
  return (
    <>
      {hideHeader ? null : (
        <header className="head">
          <h1 className="head-title">{title}</h1>
          <span className="head-meta">{items.length}</span>
        </header>
      )}
      <div className="feed">
        {items.map((t) => (
          <article
            key={t.id}
            className="post"
            role={mode === 'detail' && onOpen ? 'button' : undefined}
            tabIndex={mode === 'detail' && onOpen ? 0 : undefined}
            onKeyDown={
              mode === 'detail' && onOpen
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(t);
                    }
                  }
                : undefined
            }
            onClick={
              mode === 'detail' && onOpen
                ? () => onOpen(t)
                : mode === 'inline' && t.url
                  ? (e) => {
                      // The title link already opens a tab; don't open a second one.
                      if ((e.target as HTMLElement).closest('a')) return;
                      trackFeedItemClicked(t.id, 'discussion', t.source || '');
                      window.open(t.url, '_blank', 'noopener,noreferrer');
                    }
                  : undefined
            }
            style={
              (mode === 'detail' && onOpen) || (mode === 'inline' && t.url)
                ? { cursor: 'pointer' }
                : undefined
            }
          >
            <div className="post-row">
              {t.img ? <FeedImage src={t.img} className="post-thumb" alt="" /> : null}
              <div className="post-copy">
                <h2 className="post-title">
                  {mode === 'inline' ? (
                    <a
                      className="post-link"
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackFeedItemClicked(t.id, 'discussion', t.source || '')}
                    >{t.title}</a>
                  ) : (
                    t.title
                  )}
                </h2>
                <div className="post-meta">
                  {domainOf(t.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="fav-solo" src={`https://www.google.com/s2/favicons?domain=${domainOf(t.url)}&sz=64`} alt="" loading="lazy" />
                  ) : null}
                  <span className="post-src">{t.source}</span>
                  {t.signal && <span className="signal">{t.signal}</span>}
                  <span className="post-spacer" />
                </div>
                {t.sum || t.sub ? <p className="post-dek">{t.sum || t.sub}</p> : null}
                <Actions id={t.id} size={18} marked={marks.has(t.id)} onToggleMark={toggleMark} onShare={share} shareKind="pulse" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function PulseDetail({ item, onBack, onShare, marked, toggleMark }: { item: PulseItem; onBack: () => void; onShare: (id: string) => void; marked: boolean; toggleMark: (id: string) => void }) {
  return (
    <>
      <header className="head">
        <button className="back" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="head-title">Story</h1>
        <span className="head-spacer" />
      </header>
      <div className="detail">
        <div className="detail-byline">
          {domainOf(item.url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="fav-solo" src={`https://www.google.com/s2/favicons?domain=${domainOf(item.url)}&sz=64`} alt="" />
          ) : null}
          <span className="detail-src">{item.source}</span>
          {item.signal && <span className="signal">{item.signal}</span>}
          <span className="post-spacer" />
        </div>
        <h1 className="detail-title">{item.title}</h1>
        {bodyParagraphs(item.sum).map((para, pi) => (
          <p key={pi} className="detail-body" style={pi > 0 ? { marginTop: 14 } : undefined}>{renderBold(para)}</p>
        ))}
        {item.img ? <FeedImage src={item.img} className="detail-img detail-img-below" alt="" /> : null}
        <div className="detail-actions">
          <Actions id={item.id} size={20} marked={marked} onToggleMark={toggleMark} onShare={onShare} shareKind="pulse" />
        </div>
        <a className="detail-link" href={item.url} target="_blank" rel="noreferrer" onClick={() => trackFeedItemClicked(item.id, 'pulse', item.source || '')}>Open at {item.source} ›</a>
      </div>
    </>
  );
}

function Detail({ story, displayRank, onBack, onShare, marked, toggleMark }: { story: FeedStory; displayRank?: number; onBack: () => void; onShare: (id: string) => void; marked: boolean; toggleMark: (id: string) => void }) {
  return (
    <>
      <header className="head">
        <button className="back" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="head-title">Story</h1>
        <span className="head-spacer" />
      </header>
      <div className="detail">
        <div className="detail-byline">
          <SourceStack sources={story.sources} />
          <span className="detail-src">{story.source}</span>
          <span className="post-dot">·</span>
          <span className="post-time">{story.time}</span>
          {story.sources.length > 1 && <span className="post-group">· {story.sources.length} sources</span>}
          {story.threadId && <span className="post-group">· Ongoing story</span>}
          <span className="post-spacer" />
          <span className="post-rank">#{displayRank ?? story.rank}</span>
        </div>
        <h1 className="detail-title">{story.title}</h1>
        {bodyParagraphs(story.body).map((para, pi) => (
          <p key={pi} className="detail-body" style={pi > 0 ? { marginTop: 14 } : undefined}>{renderBold(para)}</p>
        ))}
        {story.takeaways.length > 0 && (
          <div className="detail-takeaways">
            <h2 className="section-label">What to know</h2>
            <ul className="takeaway-list">
              {story.takeaways.map((t, j) => (
                <li key={j}>{renderBold(t)}</li>
              ))}
            </ul>
          </div>
        )}
        {story.img ? <FeedImage src={story.img} className="detail-img detail-img-below" alt="" /> : null}
        <div className="detail-actions">
          <Actions id={story.id} size={20} marked={marked} onToggleMark={toggleMark} onShare={onShare} />
        </div>
        {story.coverage.length > 0 && (
          <div className="detail-coverage">
            <h2 className="section-label">Coverage · {story.coverage.length} sources</h2>
            <ol className="coverage-list">
              {story.coverage.map((c, j) => (
                <li key={`${c.url}-${j}`}>
                  <a className="coverage-row" href={c.url} target="_blank" rel="noreferrer" onClick={() => trackFeedItemClicked(story.id, 'story', c.source || '')}>
                    {domainOf(c.url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="fav-solo" src={`https://www.google.com/s2/favicons?domain=${domainOf(c.url)}&sz=64`} alt="" loading="lazy" />
                    ) : null}
                    <span className="coverage-main">
                      <span className="coverage-title">{c.title}</span>
                      <span className="coverage-meta">{c.source}{c.time ? ` · ${c.time}` : ''}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </>
  );
}

function PaywallPerks({ items }: { items: { emoji: string; text: string }[] }) {
  return (
    <ul className="paywall-perks">
      {items.map((item) => (
        <li key={item.text}>
          <span className="perk-ic" aria-hidden="true">{item.emoji}</span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

function PaywallPlate({ what, ask, onSignIn, signingIn = false, proLabel = 'Go Pro', compact = false }: {
  what: string;
  ask: 'signup' | 'daily' | 'pro';
  onSignIn?: () => void;
  signingIn?: boolean;
  proLabel?: string;
  compact?: boolean;
}) {
  const cls = compact ? 'paywall compact' : 'paywall';
  if (ask === 'signup') {
    return (
      <div className={cls}>
        <div className="paywall-badge"><Lock size={20} /></div>
        <h2 className="paywall-title">Sign up to see full stories</h2>
        <p className="paywall-sub">
          {what === 'the full ranked feed'
            ? 'Create a free account to keep reading.'
            : 'Create a free account to read this story.'}
        </p>
        <PaywallPerks items={[
          { emoji: '☀️', text: 'Daily morning brief in your inbox' },
          { emoji: '📌', text: 'Follow stories as they develop' },
          { emoji: '🔖', text: 'Save stories and pick up later' },
        ]} />
        <button className="paywall-btn" onClick={onSignIn} disabled={signingIn}>
          {signingIn ? 'Signing in…' : 'Sign up free with Google'}
        </button>
        <p className="paywall-foot">Free accounts get 5 stories a day. No card needed.</p>
      </div>
    );
  }

  if (ask === 'daily') {
    return (
      <div className={cls}>
        <div className="paywall-badge"><Lock size={20} /></div>
        <h2 className="paywall-title">Buy Pro to see full stories</h2>
        <p className="paywall-sub">
          Get the complete ranked feed with Pro.
        </p>
        <PaywallPerks items={[
          { emoji: '☀️', text: 'Daily morning brief in your inbox' },
          { emoji: '🤖', text: 'Agent access in Claude, Codex, or Cursor' },
          { emoji: '📌', text: 'Follow stories as they develop' },
        ]} />
        <ProCheckoutButton className="paywall-btn" label={proLabel} />
        <p className="paywall-foot">Cancel anytime. The free account stays free.</p>
      </div>
    );
  }

  return (
    <div className={cls}>
      <div className="paywall-badge"><Lock size={20} /></div>
      <h2 className="paywall-title">This one&rsquo;s for Pro</h2>
      <p className="paywall-sub">
        <>{what} is part of <b>Trace Pro</b> — the whole day, ranked and summarized, every morning.</>
      </p>
      <PaywallPerks items={[
        { emoji: '☀️', text: 'Daily morning brief in your inbox' },
        { emoji: '🤖', text: 'Agent access in Claude, Codex, or Cursor' },
        { emoji: '📌', text: 'Follow stories as they develop' },
      ]} />
      <ProCheckoutButton className="paywall-btn" label={proLabel} />
      <p className="paywall-foot">Cancel anytime. Daily brief by email, every morning.</p>
    </div>
  );
}

function CancelModal({ onClose, getToken, onDone }: {
  onClose: () => void; getToken: () => Promise<string>; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const miss = [
    'Back to 5 free stories a day',
    'Summaries shrink, key points go away',
    'Pulse locks: no Top HN',
    'Profile ranking and the daily email brief stop',
  ];
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAtPeriodEnd: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not cancel');
      trackSubscriptionCancelled('pro');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }
  return (
    <div className="promo-overlay" onClick={onClose}>
      <div className="promo-modal" role="dialog" aria-modal="true" aria-label="Cancel Pro" onClick={(e) => e.stopPropagation()}>
        <div className="promo-head">
          <h2 className="promo-title">Before you go</h2>
          <button className="promo-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="promo-price">Cancelling means giving these up at the end of your billing period.</p>
        <ul className="perk-list miss-list">
          {miss.map((m) => (
            <li key={m}><X size={16} /><span>{m}</span></li>
          ))}
        </ul>
        {error ? <p className="promo-error">{error}</p> : null}
        <button className="promo-pay" onClick={onClose}>Keep my Pro</button>
        <button className="cancel-confirm" onClick={confirm} disabled={busy}>
          {busy ? 'Cancelling…' : 'Yes, cancel Pro'}
        </button>
      </div>
    </div>
  );
}

function ProfileView({ profile, setProfile, storyCount, dirty, saving, onSave, pro, onBack, user, onSignOut, onSignIn, notify, getToken, onSubscriptionChanged, notice, signingIn = false, onEdit, dailyOn = false, onToggleDaily, streak = null, weeklyWrap = null }: {
  profile: Profile; setProfile: (p: Profile) => void; storyCount: number;
  dirty: boolean; saving: boolean; onSave: () => void; pro: boolean; onBack: () => void;
  user: { displayName: string | null; email: string | null; photoURL: string | null } | null;
  onSignOut: () => void; onSignIn: () => void;
  notify: (msg: string) => void; getToken: () => Promise<string>; onSubscriptionChanged: () => void;
  notice?: string | null; signingIn?: boolean; onEdit?: () => void;
  dailyOn?: boolean; onToggleDaily?: () => void;
  streak?: ReadingStreak | null;
  weeklyWrap?: WeeklyWrapSummary | null;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const bio = `Following ${profile.interests.length} topics. ${storyCount} stories ranked today.`;

  function update(next: Profile) {
    onEdit?.();
    setProfile(next);
  }

  function toggleInterest(t: string) {
    update({
      ...profile,
      interests: profile.interests.includes(t)
        ? profile.interests.filter((x) => x !== t)
        : [...profile.interests, t],
    });
  }

  return (
    <>
      <header className="head">
        <button className="back" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="head-title">Profile</h1>
          <p className="head-sub">{storyCount} stories ranked today</p>
        </div>
      </header>
      {notice && (
        <div className="save-note">
          <span className="save-note-ic"><Check size={14} /></span>
          <span className="save-note-text">{notice}</span>
          <button className="save-note-cta" onClick={onBack}>See feed</button>
        </div>
      )}
      <div className="detail profile">
        <div className="profile-hero">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="avatar" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/trace.webp" alt="" className="avatar" />
          )}
          <div className="profile-hero-main">
            <div className="profile-hero-top">
              <div className="profile-hero-id">
                <h1 className="profile-name">{user ? (user.displayName || profile.name) : 'Signed out'}</h1>
                <p className="profile-handle">
                  {user ? `@${(user.email || '').split('@')[0]}` : 'Sign in to personalize your feed'}
                  {user ? <span className={`profile-plan${pro ? ' pro' : ''}`}>{pro ? 'Pro member' : 'Free plan'}</span> : null}
                </p>
              </div>
              {user && (dirty || saving) && (
                <button className={`save-btn primary${dirty ? ' pulse' : ''}`} onClick={onSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              )}
            </div>
            <p className="profile-bio">{bio}</p>
            <div className="profile-stats">
              <span><b>{storyCount}</b> stories today</span>
              <span className="post-dot">·</span>
              <span><b>{profile.interests.length}</b> interests</span>
            </div>
          </div>
        </div>

        {user ? <ActivityHeatmapPanel streak={streak} /> : null}
        {user ? <WeeklyWrapPanel wrap={weeklyWrap} /> : null}

        <section className="p-group">
          <h2 className="p-group-title">Interests</h2>
          <p className="p-group-sub">We use these only to order your For You feed — nothing else, no emails and no hidden filtering.</p>
          <div className="p-checks">
            {ALL_INTERESTS.map((t) => {
              const on = profile.interests.includes(t);
              return (
                <button key={t} className={`p-check${on ? ' on' : ''}`} onClick={() => toggleInterest(t)} aria-pressed={on}>
                  <span className="p-check-label">{CAT_LABELS[t] || t[0].toUpperCase() + t.slice(1)}</span>
                  <span className="p-check-ic" aria-hidden="true">{on ? <Check size={14} strokeWidth={3} /> : null}</span>
                </button>
              );
            })}
          </div>
          {dirty ? <p className="p-footnote unsaved">Unsaved changes — tap Save changes.</p> : null}
        </section>

        <section className="p-group">
          <h2 className="p-group-title">Preferences</h2>
          <div className="p-card">
            <div className="p-row">
              <div className="p-row-main">
                <span className="p-row-title">Daily email brief</span>
                <span className="p-row-sub">One email at 10:30 Europe/Berlin. Turn it off anytime.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dailyOn}
                aria-label="Daily email brief"
                className={`p-switch${dailyOn ? ' on' : ''}`}
                onClick={onToggleDaily}
                disabled={!user}
              >
                <span className="p-switch-knob" />
              </button>
            </div>
          </div>
        </section>

        <section className="p-group">
          <h2 className="p-group-title">Membership</h2>
          <div className="p-card">
            <div className="p-row">
              <div className="p-row-main">
                <span className="p-row-title">{pro ? 'Pro member' : 'Free plan'}</span>
                <span className="p-row-sub">Pro unlocks the whole day, Pulse and your profile.</span>
              </div>
              {pro ? (
                <button className="p-link danger" onClick={() => setCancelOpen(true)}>Cancel plan</button>
              ) : (
                <a className="p-link" href="/subscribe">Go Pro — $2.99/mo</a>
              )}
            </div>
          </div>
        </section>

        <section className="p-group">
          <h2 className="p-group-title">Agent access</h2>
          <AgentRetentionCard pro={pro} />
        </section>

        <section className="p-group p-group-last">
          {user ? (
            <button className="p-signout" onClick={onSignOut}>Sign out</button>
          ) : (
            <button className="save-btn primary p-signin" onClick={onSignIn} disabled={signingIn}>
              {signingIn ? 'Signing in…' : 'Sign in with Google'}
            </button>
          )}
        </section>
      </div>

      {cancelOpen && (
        <CancelModal
          onClose={() => setCancelOpen(false)}
          getToken={getToken}
          onDone={() => {
            setCancelOpen(false);
            onSubscriptionChanged();
            notify('Cancelled. Pro stays active until the end of your billing period.');
          }}
        />
      )}
    </>
  );
}

const css = `
.xw {
  --bg: #ffffff;
  --ink: #0f1419;
  --text: #0f1419;
  --text-2: #536471;
  --text-3: #71767b;
  --line: #eff3f4;
  --hover: #f7f9f9;
  --blue: #1d9bf0;
  --green: #00ba7c;
  --pink: #f91880;
  --t-quick: 150ms;
  --t-fast: 250ms;
  --t-slow: 400ms;
  --t-very-slow: 500ms;
  --ease-smooth-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-bounce: cubic-bezier(0.34, 1.36, 0.64, 1);
  --blur-small: 2px;
  background: var(--bg);
  color: var(--text);
  height: 100vh; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 15px; line-height: 20px;
  display: flex; justify-content: center;
}

/* mobile bottom nav */
.xw .bottom-nav { display: none; }
.xw .cat-strip { display: none; }
@media (max-width: 1100px) {
  .xw .bottom-nav {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 300;
    min-height: 52px; background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
    border-top: 1px solid var(--line);
    justify-content: space-around; align-items: center;
    padding: 8px 0 calc(16px + env(safe-area-inset-bottom));
  }
  .xw .bn-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    border: none; background: transparent; cursor: pointer;
    color: var(--text-3); font-size: 10px; font-weight: 600; padding: 4px 12px;
  }
  .xw .bn-item.on { color: var(--text); }
  .xw .feed { padding-bottom: 104px; }
  .xw .cat-strip {
    display: block;
    position: sticky; top: 0; z-index: 40;
    border-bottom: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .xw .cat-strip-track {
    display: flex; gap: 8px; overflow-x: auto; padding: 10px 14px;
    scrollbar-width: none;
  }
  .xw .cat-strip-track::-webkit-scrollbar { display: none; }
  .xw .cat-chip {
    white-space: nowrap; padding: 8px 14px; border-radius: 9999px;
    border: 1px solid var(--line); background: var(--bg);
    font-size: 13.5px; font-weight: 600; font-family: inherit; cursor: pointer;
  }
  .xw .cat-chip.on { background: var(--line); font-weight: 700; }
}
@media (max-width: 687px) {
  .xw .main { width: 100%; max-width: 100%; border-left: none; border-right: none; }
  .xw .post { padding: 16px 14px 10px; }
  .xw .post-title { font-size: 18px; }
  .xw .post-thumb { width: 104px; height: 104px; flex-basis: 104px; border-radius: 12px; }
  .xw .post-dek { font-size: 14px; -webkit-line-clamp: 2; }
  .xw .headline-title { font-size: 18px; }
  .xw .headline { margin: 8px 8px 14px; }
  .xw .feed { padding-bottom: 104px; }
  .xw .detail { padding-bottom: calc(120px + env(safe-area-inset-bottom)); }
  .xw .head { padding: 0 14px; }
  .xw .detail-body { margin: 10px 14px 4px; }
  .xw .detail-title { margin: 8px 14px 4px; font-size: 21px; }
  .xw .detail-img { width: calc(100% - 28px); margin: 10px 14px 4px; }
  .xw .detail-actions { padding: 2px 14px; }
  .xw .detail-link { margin: 14px; }
  .xw .detail-byline { padding: 14px 14px 0; }
  .xw .detail-takeaways { margin: 16px 0 0; padding: 0 0 4px; }
  .xw .detail-takeaways .section-label { margin: 0 14px 8px; }
  .xw .takeaway-list { padding: 0 14px; }
  .xw .detail-img-below { margin: 14px 14px 8px; width: calc(100% - 28px); }
}

/* left sidebar */
.xw aside.side { width: 275px; flex-shrink: 0; height: 100vh; }
@media (max-width: 1100px) { .xw aside.side { display: none; } }
.xw .side-inner {
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
  scrollbar-width: none; padding: 8px; display: flex; flex-direction: column;
}
.xw .side-inner::-webkit-scrollbar { display: none; }
.xw .brand { display: flex; align-items: center; gap: 10px; padding: 10px 12px 14px; color: inherit; text-decoration: none; }
.xw button.brand { width: 100%; background: transparent; border: none; cursor: pointer; font: inherit; text-align: left; border-radius: 12px; }
.xw button.brand:hover { background: var(--hover); }
.xw .brand-logo { height: 30px; width: auto; }
.xw .wordmark { font-size: 21px; font-weight: 600; letter-spacing: -0.03em; }
.xw .nav { display: flex; flex-direction: column; gap: 2px; }
.xw .nav-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 18px; border-radius: 9999px; border: none; background: transparent;
  font-size: 19px; font-weight: 400; color: var(--text); cursor: pointer; text-align: left;
  transition: background-color 0.2s ease;
}
.xw .nav-item:hover { background-color: var(--line); }
.xw .nav-item.active { font-weight: 800; background-color: transparent; }
.xw .nav-with-ic { display: inline-flex; align-items: center; gap: 18px; }
.xw .nav-count {
  font-size: 12px; font-weight: 500; color: var(--text-2); background: var(--hover);
  padding: 2px 8px; border-radius: 9999px; font-variant-numeric: tabular-nums;
}
.xw .nav-div { height: 1px; background: var(--line); margin: 10px 12px; }
.xw .nav-group-label { padding: 12px 18px 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.xw .side-foot { padding: 20px 18px; font-size: 13px; line-height: 16px; color: var(--text-3); }
.xw .side-spacer { flex: 1; min-height: 24px; }
.xw .account { padding: 4px 0 10px; }
.xw .account-row {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 10px 14px; border-radius: 9999px; border: none; background: transparent;
  cursor: pointer; color: var(--text); text-align: left; transition: background-color 0.2s ease;
}
.xw .account-row:hover { background: var(--line); }
.xw .acct-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.xw .acct-fallback {
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--ink); color: #fff; font-weight: 700; font-size: 16px;
}
.xw .acct-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.xw .acct-main b { font-size: 15px; font-weight: 700; }
.xw .acct-main span { font-size: 12.5px; color: var(--text-3); }
.xw .signin-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 44px; border-radius: 9999px; border: none;
  background: var(--blue); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .signin-btn:hover { background: #1a8cd8; }
.xw .avatar-actions { display: flex; flex-direction: row; align-items: center; gap: 10px; }

/* center rail */
.xw .main {
  width: 660px; max-width: 660px; flex-shrink: 0; height: 100vh;
  overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none;
  border-left: 1px solid var(--line); border-right: 1px solid var(--line);
}
.xw .main::-webkit-scrollbar { display: none; }
.xw .right-space { flex: 1; max-width: 220px; }
@media (max-width: 1300px) { .xw .right-space { display: none; } }
@media (max-width: 1100px) { .xw .main { border-left: none; border-right: none; width: 100%; max-width: 100%; } }

.xw .head {
  display: flex; align-items: center; gap: 20px;
  padding: 0 16px; height: 53px; flex-shrink: 0;
  border-bottom: 1px solid var(--line);
}
.xw .head-title { margin: 0; font-size: 20px; font-weight: 700; }
.xw .head-sub { margin: 0; font-size: 12.5px; color: var(--text-3); }
.xw .head-meta { font-size: 13px; color: var(--text-3); margin-left: auto; }
.xw .sort-seg {
  position: relative;
  display: inline-flex; align-items: center; gap: 2px;
  border: 1px solid var(--line); border-radius: 9999px; padding: 2px;
  background: var(--hover); white-space: nowrap;
}
 .xw .sort-pill {
  position: absolute; top: 2px; left: 0; height: calc(100% - 4px);
  border-radius: 9999px; background: #fff;
  box-shadow: 0 1px 3px rgba(15,20,25,0.12);
  z-index: 0; pointer-events: none;
  transition: transform var(--t-fast) var(--ease-smooth-out), width var(--t-fast) var(--ease-smooth-out);
  will-change: transform;
}
.xw .sort-opt {
  position: relative; z-index: 1;
  display: inline-flex; align-items: center; gap: 4px;
  border: none; background: transparent; color: var(--text-2);
  font-size: 12.5px; font-weight: 700; font-family: inherit;
  border-radius: 9999px; padding: 5px 10px; cursor: pointer;
  transition: color var(--t-quick) ease;
}
.xw .sort-opt.on { background: transparent; color: var(--text); box-shadow: none; }
.xw .head-spacer { width: 34px; }
 .xw .back {
  width: 44px; height: 44px; border-radius: 9999px; border: none;
  background: transparent; color: var(--text); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background-color 0.2s ease; margin-left: -8px;
}
.xw .back:hover { background-color: var(--line); }

@media (max-width: 687px) {
  .xw .act-ic { width: 44px; height: 44px; }
  .xw .toast { bottom: 72px; }
  .xw .post { padding: 16px 14px 10px; }
  .xw .headline-head { padding: 14px 14px 8px; }
  .xw .headline-title { font-size: 18px; }
  .xw .post-title { font-size: 18px; }
  .xw .feed { padding-bottom: 104px; }
  .xw .detail { padding-bottom: calc(120px + env(safe-area-inset-bottom)); }
  .xw .head { padding: 0 14px; }
  .xw .detail-body { margin: 10px 14px 4px; }
  .xw .detail-title { margin: 8px 14px 4px; font-size: 21px; }
  .xw .detail-img { width: calc(100% - 28px); margin: 10px 14px 4px; }
  .xw .detail-sources { margin: 0 14px 4px; }
  .xw .detail-actions { padding: 2px 14px; }
  .xw .detail-link { margin: 14px; }
  .xw .detail-byline { padding: 14px 14px 0; }
  .xw .detail-takeaways { margin: 16px 0 0; padding: 0 0 4px; }
  .xw .detail-takeaways .section-label { margin: 0 14px 8px; }
  .xw .takeaway-list { padding: 0 14px; }
  .xw .detail-img-below { margin: 14px 14px 8px; width: calc(100% - 28px); }
  .xw .older-sep { margin: 20px 14px 2px; }
  .xw .load-older { width: 100%; margin: 0; padding: 16px 14px; }
}

/* post card */
.xw .post {
  padding: 18px 18px 10px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .post:hover { background-color: var(--hover); }
.xw .post:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.xw .post.locked { cursor: default; }
.xw .post.locked:hover { background: transparent; }
.xw .headline {
  margin: 10px 12px 18px;
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  background: #f6f8fa;
  box-shadow: 0 1px 0 rgba(15, 20, 25, 0.04);
}
.xw .headline.tone-0 { background: #f3f7fb; border-color: #d5e4f0; }
.xw .headline.tone-1 { background: #f7f5f1; border-color: #e3dccf; }
.xw .headline.tone-2 { background: #f3f7f4; border-color: #d3e4d8; }
.xw .headline.tone-3 { background: #f7f3f6; border-color: #e4d5df; }
.xw .headline-head {
  padding: 14px 14px 10px;
}
.xw .headline-title {
  margin: 0;
  font-size: 20px; font-weight: 800; letter-spacing: -0.03em;
  line-height: 1.28; color: var(--text);
}
.xw .headline-stories { padding: 0 0 6px; }
.xw .headline .post { border-bottom: none; background: transparent; padding: 12px 12px 10px; }
.xw .headline .post + .post { border-top: 1px solid rgba(15, 20, 25, 0.08); }
.xw .headline .post:hover { background: rgba(255, 255, 255, 0.55); }
.xw .headline-related .post-title { font-size: 16px; font-weight: 650; }
.xw .post-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; margin-bottom: 6px; }
.xw .post-src { font-size: 13px; font-weight: 700; color: var(--text-2); white-space: nowrap; }
.xw .post-time { font-size: 13px; color: var(--text-3); white-space: nowrap; }
.xw .post-spacer { flex: 1; }
.xw .post-rank { font-size: 13px; font-weight: 500; color: var(--text-3); font-variant-numeric: tabular-nums; }
.xw .post-group { font-size: 13px; color: var(--text-3); white-space: nowrap; }
.xw .detail-coverage { margin: 16px 18px 4px; }
.xw .detail-coverage .section-label { margin: 0 0 4px; }
.xw .coverage-list { margin: 0; padding: 0; list-style: none; }
.xw .coverage-list li { position: relative; padding: 10px 0 10px 20px; border-bottom: 1px solid var(--line); }
.xw .coverage-list li:last-child { border-bottom: none; }
.xw .coverage-list li::before { content: ''; position: absolute; left: 2px; top: 16px; width: 7px; height: 7px; border-radius: 50%; background: var(--blue); }
.xw .coverage-list li::after { content: ''; position: absolute; left: 5px; top: 27px; bottom: -2px; width: 1px; background: var(--line); }
.xw .coverage-list li:last-child::after { display: none; }
.xw .coverage-row { display: flex; gap: 10px; align-items: flex-start; text-decoration: none; color: inherit; }
.xw .coverage-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.xw .coverage-title { font-size: 14.5px; font-weight: 600; line-height: 20px; letter-spacing: -0.01em; }
.xw .coverage-row:hover .coverage-title { color: var(--blue); }
.xw .coverage-meta { font-size: 12.5px; color: var(--text-3); }
.xw .post-link { color: inherit; text-decoration: none; }
.xw .post-link:hover { text-decoration: underline; text-decoration-color: var(--text-3); text-underline-offset: 3px; }
.xw .post-desc { margin: 6px 0 0; font-size: 15px; line-height: 22px; color: var(--text); overflow-wrap: break-word; }
.xw .tools-carousel-wrap { display: none; }
@media (max-width: 687px) {
  .xw .tools-carousel-wrap { display: block; border-bottom: 1px solid var(--line); padding: 18px 0 14px; background: var(--bg); }
  .xw .tools-carousel-title { display: flex; align-items: baseline; justify-content: space-between; font-size: 17px; font-weight: 800; letter-spacing: -0.01em; padding: 0 14px 10px; }
  .xw .tools-carousel { overflow-x: auto; padding: 2px 14px 6px; scrollbar-width: none; }
  .xw .tools-carousel::-webkit-scrollbar { display: none; }
  .xw .tools-track { display: flex; width: max-content; }
  .xw .tools-group { display: flex; gap: 10px; padding-right: 10px; }
  .xw .tool-card {
    min-width: 218px; max-width: 218px;
    border: 1px solid var(--line); border-radius: 14px; background: #fff;
    padding: 12px; display: flex; flex-direction: column; gap: 6px;
    text-decoration: none; color: inherit;
  }
  .xw .promo-slot.promo-slot-compact {
    flex: 0 0 218px; min-width: 218px; max-width: 218px; width: 218px;
    padding: 12px; border: 1px solid var(--line); border-radius: 14px; gap: 8px;
    box-sizing: border-box;
  }
  .xw .promo-slot-compact .promo-headline {
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    font-size: 14px; line-height: 18px;
  }
  .xw .promo-slot-compact .promo-subline { font-size: 12px; line-height: 16px; }
  .xw .promo-slot-compact .promo-slot-actions { margin-top: auto; }
  .xw .promo-slot-compact .promo-cta { width: 100%; }
  .xw .tool-card-top { display: flex; align-items: center; gap: 6px; }
  .xw .tool-card-title { font-size: 14px; font-weight: 700; line-height: 18px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .xw .tool-card-sub { font-size: 12.5px; line-height: 17px; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .xw .tool-card-meta { display: none; }
}
.xw .post-title { margin: 0 0 8px; font-size: 22px; font-weight: 800; line-height: 1.22; letter-spacing: -0.03em; }
.xw .post-dek {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; margin: 0 0 10px;
  font-size: 15px; line-height: 1.45; color: var(--text-2);
}
.xw .post-row { display: flex; flex-direction: row; align-items: flex-start; gap: 16px; }
.xw .post-copy { flex: 1; min-width: 0; }
.xw .post-thumb {
  flex: 0 0 140px; width: 140px; height: 140px; object-fit: cover;
  object-position: center 30%;
  border-radius: 12px; display: block; background: var(--hover);
  box-shadow: 0 0 0 1px rgba(15, 20, 25, 0.06);
}
.xw .post-thumb-sm { flex-basis: 56px; width: 56px; height: 56px; border-radius: 10px; box-shadow: none; }
.xw .post-thumb.locked-thumb { opacity: 0.5; filter: grayscale(0.35); }
.xw .locked-title { filter: blur(4px); user-select: none; }
.xw .lock-note { display: flex; align-items: center; gap: 6px; margin: 8px 0 10px; font-size: 13px; font-weight: 650; color: var(--text-2); }
.xw .post-img {
  width: 100%; aspect-ratio: 16 / 10; max-height: 510px; object-fit: cover;
  border-radius: 16px; margin: 10px 0 6px; display: block;
  background: var(--hover);
}
.xw .post-img[data-status='loading'],
.xw .post-thumb[data-status='loading'],
.xw .headline-shot[data-status='loading'],
.xw .detail-img[data-status='loading'] {
  background: linear-gradient(100deg, var(--hover) 40%, #eef3f5 50%, var(--hover) 60%);
  background-size: 200% 100%;
  animation: img-shimmer 1.2s linear infinite;
}
.xw .post-img[data-status='ok'],
.xw .post-thumb[data-status='ok'],
.xw .headline-shot[data-status='ok'],
.xw .detail-img[data-status='ok'] { animation: img-in 260ms var(--ease-smooth-out); }
@keyframes img-shimmer { to { background-position: -200% 0; } }
@keyframes img-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .xw .post-img, .xw .post-thumb, .xw .headline-shot, .xw .detail-img { animation: none !important; }
}
.xw .post-sources { margin: 8px 0 0; font-size: 13px; line-height: 16px; color: var(--text-3); }
.xw .post-sum { margin: 6px 0 0; font-size: 14px; line-height: 20px; color: var(--text-2); }
@media (min-width: 688px) { .xw .feed { padding-bottom: 96px; } }

/* favicon stack */
.xw .stack { display: inline-flex; align-items: center; }
.xw .fav {
  width: 20px; height: 20px; border-radius: 50%;
  background: #fff; border: 2px solid #fff;
  box-shadow: 0 0 0 1px var(--line);
  object-fit: contain;
}
.xw .fav + .fav { margin-left: -8px; }
.xw .stack .fav { transition: transform var(--t-fast) var(--ease-smooth-out); }
.xw .stack:hover .fav { transform: translateY(-3px); }
.xw .stack:hover .fav:hover { transform: translateY(-5px) scale(1.12); position: relative; z-index: 2; }
.xw .act-mark[data-burst="true"] .act-ic { animation: t-like-pop 420ms var(--ease-bounce); }
@keyframes t-like-pop {
  0% { transform: scale(1); }
  30% { transform: scale(0.8); }
  65% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
.xw .nav-count { animation: t-count-pop 280ms var(--ease-smooth-out); }
@keyframes t-count-pop { from { transform: scale(0.7); opacity: 0.4; } to { transform: scale(1); opacity: 1; } }

/* actions */
.xw .actions { display: flex; justify-content: flex-end; gap: 4px; max-width: 100%; margin-top: 2px; }
.xw .act {
  display: inline-flex; align-items: center; gap: 2px;
  border: none; background: transparent; cursor: pointer;
  color: var(--text-3); font-size: 13px; padding: 0;
}
.xw .act-ic {
  width: 40px; height: 40px; border-radius: 9999px;
  display: flex; align-items: center; justify-content: center;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.xw .act-mark:hover .act-ic, .xw .act-share:hover .act-ic { background-color: rgba(29, 155, 240, 0.1); color: var(--blue); }
.xw .act-mark.on .act-ic { color: var(--blue); }

/* detail view */
@media (min-width: 688px) { .xw .detail { padding-bottom: 48px; } }
.xw .detail-byline { display: flex; align-items: center; gap: 8px; padding: 16px 18px 0; }
.xw .detail-src { font-size: 15px; font-weight: 700; }
.xw .detail-title { margin: 10px 18px 4px; font-size: 23px; font-weight: 700; line-height: 28px; }
.xw .detail-img { width: calc(100% - 36px); max-height: 510px; object-fit: cover; border-radius: 16px; margin: 12px 18px 4px; }
.xw .detail-sources { margin: 0 18px 4px; font-size: 13px; line-height: 16px; color: var(--text-3); }
.xw .detail-body { margin: 12px 18px 4px; font-size: 16px; line-height: 25px; color: var(--text); }
.xw .detail-takeaways { margin: 20px 0 0; padding: 0 0 4px; border: none; border-radius: 0; background: transparent; }
.xw .detail-img-below { margin: 16px 18px 8px; }
.xw .detail-takeaways .section-label {
  margin: 0 18px 8px; padding: 0;
  font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--text-3);
}
.xw .takeaway-list { margin: 0; padding: 0 18px; list-style: none; }
.xw .takeaway-list li { font-size: 15px; line-height: 22px; color: var(--text); padding: 4px 0 4px 18px; position: relative; }
.xw .takeaway-list li::before { content: ''; position: absolute; left: 2px; top: 12px; width: 6px; height: 6px; border-radius: 50%; background: var(--blue); }
.xw .detail-actions { padding: 2px 18px; border-bottom: 1px solid var(--line); }
.xw .detail-actions .actions { max-width: 100%; justify-content: flex-end; gap: 16px; padding: 4px 0; }
.xw .detail-link {
  display: inline-block; margin: 16px 18px;
  font-size: 15px; font-weight: 700; color: var(--blue); text-decoration: none;
}
.xw .detail-link:hover { text-decoration: underline; text-underline-offset: 3px; }

/* paywall */
.xw .paywall {
  margin: 3rem auto; max-width: 30rem; text-align: center; padding: 0 24px;
  animation: t-panel-in var(--t-slow) var(--ease-smooth-out);
}
.xw .paywall.compact { margin: 20px auto 28px; }
@keyframes t-panel-in {
  from { opacity: 0; transform: translateY(12px); filter: blur(var(--blur-small)); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
.xw .paywall-badge {
  width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 18px;
  background: rgba(29, 155, 240, 0.1); color: var(--blue);
  display: flex; align-items: center; justify-content: center;
}
.xw .paywall-title { margin: 0 0 8px; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
.xw .paywall-sub { margin: 0 auto 14px; font-size: 15px; line-height: 22px; color: var(--text-2); max-width: 42ch; }
.xw .paywall-sub b { color: var(--ink); }
.xw .paywall-perks {
  list-style: none; margin: 0 auto 20px; padding: 0;
  display: grid;
  grid-template-columns: auto auto;
  justify-content: center;
  column-gap: 10px;
  row-gap: 10px;
}
.xw .paywall-perks li { display: contents; }
.xw .paywall-perks .perk-ic { width: auto; flex-shrink: 0; text-align: center; line-height: 20px; }
.xw .paywall-perks li span:last-child {
  font-size: 14.5px; line-height: 20px; color: var(--text); text-align: left;
}
.xw .paywall.compact .paywall-perks { margin-bottom: 16px; }
.xw .paywall-btn {
  display: inline-block; height: 46px; line-height: 46px; padding: 0 28px;
  border: none; border-radius: 9999px; background: var(--blue); color: #fff;
  font-size: 15px; font-weight: 700; text-decoration: none; font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .paywall-btn:disabled { opacity: 0.7; cursor: wait; }
.xw .paywall-btn:hover { background: #1a8cd8; }
.xw .paywall-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.xw .paywall-alt {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 46px; padding: 0 24px; border-radius: 9999px;
  border: 1px solid var(--line); background: var(--bg); color: var(--text);
  font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .paywall-alt:hover:not(:disabled) { background: var(--hover); }
.xw .paywall-alt:disabled { cursor: default; }
.xw .paywall-alt.on { color: var(--green); border-color: rgba(0, 186, 124, 0.45); }
.xw .paywall-foot { margin: 14px 0 0; font-size: 12.5px; color: var(--text-3); }

/* signal — plain text */
.xw .signal { font-size: 12.5px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }

/* right rail */
.xw .right { width: 330px; flex-shrink: 0; height: 100vh; overflow-y: auto; scrollbar-width: none; padding: 8px 16px 3rem 8px; }
.xw .right::-webkit-scrollbar { display: none; }
@media (max-width: 1300px) { .xw .right { display: none; } }
.xw .rail { background: var(--bg); border-radius: 16px; padding: 0; border: 1px solid var(--line); overflow: hidden; }
.xw .rail + .rail { margin-top: 16px; }
.xw .rail-head { display: flex; align-items: center; gap: 8px; padding: 16px 16px 12px; border-bottom: 1px solid var(--line); }
.xw .rail-title { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.015em; flex: 1; }
.xw .rail-meta { font-size: 12px; color: var(--text-3); }
.xw .rail-items { display: flex; flex-direction: column; }
.xw .pulse-row {
  display: flex; flex-direction: row; gap: 10px; align-items: flex-start; text-align: left;
  padding: 12px 16px; border: none; background: transparent;
  cursor: pointer; color: inherit; width: 100%;
  transition: background-color 0.2s ease;
}
.xw .rail-logo { width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0; align-self: flex-start; margin-top: 2px; }
.xw .pulse-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; justify-content: center; }
.xw .rail-items { padding-bottom: 8px; }
.xw .fav-solo { width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; }
.xw .pulse-row:hover { background: var(--line); }
.xw .pulse-title { font-size: 15px; font-weight: 400; line-height: 20px; letter-spacing: -0.008em; }
.xw .rail-sub { display: block; font-size: 13px; font-weight: 400; line-height: 18px; color: var(--text-2); overflow-wrap: break-word; }
.xw .rail-ad { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: var(--blue); background: rgba(29,155,240,0.1); border: 1px solid rgba(29,155,240,0.35); border-radius: 4px; padding: 1px 4px; vertical-align: 1px; white-space: nowrap; }
.xw .promo-slot {
  display: flex; flex-direction: column; align-items: stretch; gap: 15px;
  margin: 0; padding: 18px 16px; width: 100%; min-height: 0;
  border-top: 1px solid var(--line);
  background: #fff; color: var(--text);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.xw .promo-slot:hover { border-top-color: #c3d0d8; }
.xw .promo-slot-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.xw .promo-slot-actions { display: flex; flex-direction: row; align-items: center; gap: 14px; flex-wrap: wrap; }
.xw .promo-cta:focus-visible,
.xw .promo-proof-link:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; border-radius: 10px; }
.xw .promo-headline { color: var(--text); font-size: 17px; font-weight: 700; line-height: 22px; letter-spacing: -0.01em; }
.xw .promo-subline { color: var(--text-2); font-size: 13px; line-height: 18px; }
.xw .promo-cta {
  min-height: 38px; width: auto; border: 0; border-radius: 9999px; padding: 9px 16px;
  background: var(--blue); color: #fff; cursor: pointer; font: inherit; font-size: 13px;
  font-weight: 700; line-height: 18px; white-space: nowrap;
  transition: background-color 0.15s ease, transform 0.15s ease;
}
.xw .promo-cta:hover { background: #0d8ed8; }
.xw .promo-cta:active { transform: translateY(1px); }
.xw .promo-proof-link {
  color: var(--text-3); font-size: 12px; font-weight: 600; line-height: 16px;
  text-decoration: none; white-space: nowrap;
}
.xw .promo-proof-link:hover { color: var(--text); text-decoration: underline; text-underline-offset: 3px; }
.xw .promo-overlay {
  position: fixed; inset: 0; z-index: 400; background: rgba(15,20,25,0.45);
  display: flex; align-items: center; justify-content: center; padding: 20px;
  animation: t-fade-in var(--t-quick) var(--ease-smooth-out);
}
@keyframes t-fade-in { from { opacity: 0; } to { opacity: 1; } }
.xw .promo-modal { animation: t-modal-in var(--t-fast) var(--ease-smooth-out); transform-origin: center; }
@keyframes t-modal-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.xw .promo-modal { width: 100%; max-width: 420px; background: #fff; border-radius: 20px; padding: 22px 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
.xw .promo-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.xw .promo-title { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
.xw .promo-x { border: none; background: transparent; cursor: pointer; color: var(--text-2); padding: 6px; border-radius: 50%; }
.xw .promo-x:hover { background: var(--hover); }
.xw .promo-price { margin: 0 0 16px; font-size: 13.5px; color: var(--text-2); }
.xw .promo-label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 12px; }
.xw .promo-input {
  display: block; width: 100%; box-sizing: border-box; margin-top: 6px;
  border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px;
  font-size: 15px; font-family: inherit; color: var(--text); background: #fff; outline: none;
}
.xw .promo-input:focus { border-color: var(--blue); }
.xw .promo-error { margin: 0 0 12px; font-size: 13px; color: #f91880; }
.xw .promo-pay {
  width: 100%; height: 46px; border: none; border-radius: 9999px;
  background: var(--blue); color: #fff; font-size: 15px; font-weight: 700; font-family: inherit;
  cursor: pointer;
}
.xw .promo-pay:disabled { opacity: 0.7; cursor: wait; }
.xw .promo-support { margin: 12px 0 0; font-size: 12.5px; color: var(--text-2); text-align: center; }
.xw .promo-support a { color: var(--blue); text-decoration: none; }
.xw .promo-support a:hover { text-decoration: underline; }
.xw .celebrate-modal { text-align: center; }
.xw .celebrate-badge {
  width: 56px; height: 56px; border-radius: 50%; margin: 4px auto 12px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,186,124,0.12); color: #00BA7C;
}
.xw .celebrate-title { text-align: center; }
.xw .celebrate-sub { text-align: center; }
.xw .perk-list { margin: 0 0 18px; padding: 0; list-style: none; text-align: left; }
.xw .perk-list li {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 9px 2px; border-bottom: 1px solid var(--line);
  font-size: 14.5px; font-weight: 600;
}
.xw .perk-list li:last-child { border-bottom: none; }
.xw .perk-list svg { flex-shrink: 0; margin-top: 2px; color: #00BA7C; }
.xw .miss-list svg { color: #F91880; }
.xw button.pick { font: inherit; cursor: pointer; }
.xw .pick-danger { color: #F91880; border-color: rgba(249,24,128,0.4); }
.xw .cancel-confirm {
  width: 100%; margin-top: 10px; height: 44px; border: none; background: transparent;
  color: var(--text-2); font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer;
}
.xw .cancel-confirm:hover { color: #F91880; }
.xw .cancel-confirm:disabled { opacity: 0.6; cursor: wait; }
.xw .rail-stars { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 12px; font-weight: 600; line-height: 16px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.xw .rail-stars svg { flex-shrink: 0; }
.xw .rail-sig { font-size: 12.5px; font-weight: 600; color: var(--text-3); font-variant-numeric: tabular-nums; }
.xw .rail-sum { font-size: 13px; line-height: 19px; color: var(--text-2); }

/* profile view */
.xw .avatar { width: 92px; height: 92px; border-radius: 50%; border: 4px solid #fff; background: #fff; object-fit: contain; }
.xw .save-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 38px; padding: 0 18px; border-radius: 9999px; border: 1px solid var(--line);
  background: var(--bg); color: var(--text-2); font-size: 15px; font-weight: 700; cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.xw .save-btn:hover:not(:disabled) { background: var(--hover); }
.xw .save-btn:disabled { opacity: 0.6; cursor: default; }
.xw .save-btn.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
.xw .save-btn.primary:hover { background: #1a8cd8; }
@keyframes save-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(29, 155, 240, 0.45); }
  50% { box-shadow: 0 0 0 7px rgba(29, 155, 240, 0); }
}
.xw .save-btn.pulse { animation: save-pulse 1.6s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .xw .save-btn.pulse { animation: none; } }
.xw .save-note {
  animation: t-panel-in var(--t-slow) var(--ease-smooth-out);
  display: flex; align-items: center; gap: 9px;
  margin: 10px 18px 0; padding: 10px 12px;
  border: 1px solid rgba(0, 186, 124, 0.35); background: rgba(0, 186, 124, 0.08);
  border-radius: 12px; font-size: 13.5px; font-weight: 600; color: var(--text);
}
.xw .save-note-ic {
  animation: t-check-in var(--t-very-slow) var(--ease-smooth-out);
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 9999px;
  background: var(--green); color: #fff; flex-shrink: 0;
}
.xw .save-note-text { flex: 1; min-width: 0; }
.xw .save-note-cta {
  border: none; background: transparent; color: var(--blue);
  font-size: 13.5px; font-weight: 700; font-family: inherit;
  cursor: pointer; white-space: nowrap; padding: 0;
}
.xw .save-note-cta:hover { text-decoration: underline; text-underline-offset: 3px; }
@keyframes t-check-in {
  0% { opacity: 0; transform: scale(0.5) rotate(-25deg); filter: blur(4px); }
  60% { opacity: 1; transform: scale(1.08) rotate(3deg); filter: blur(0); }
  100% { transform: scale(1) rotate(0); }
}
.xw .activating {
  display: flex; align-items: center; gap: 10px;
  margin: 12px 18px 0; padding: 10px 14px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--hover);
  font-size: 13.5px; font-weight: 600;
}
.xw .welcome-strip {
  display: flex; align-items: center; gap: 14px;
  margin: 0; padding: 10px 16px 12px;
  border: none; border-radius: 0; background: transparent;
  animation: t-panel-in var(--t-slow) var(--ease-smooth-out);
}
.xw .welcome-strip-main { flex: 1; min-width: 0; }
.xw .welcome-strip-title { margin: 0 0 2px; font-size: 14.5px; font-weight: 800; letter-spacing: -0.01em; }
.xw .welcome-strip-sub { margin: 0; font-size: 13px; color: var(--text-2); }
.xw .welcome-strip-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.xw .welcome-strip-cta {
  border: none; border-radius: 9999px; background: var(--blue); color: #fff;
  font-size: 13.5px; font-weight: 700; font-family: inherit;
  padding: 9px 16px; cursor: pointer; white-space: nowrap;
}
.xw .welcome-strip-cta:hover { background: #1a8cd8; }
.xw .welcome-strip-cta:disabled { opacity: 0.7; cursor: wait; }
.xw .welcome-strip-x {
  border: none; background: transparent; color: var(--text-3);
  padding: 8px; border-radius: 9999px; cursor: pointer; display: inline-flex;
}
.xw .welcome-strip-x:hover { background: var(--hover); color: var(--text); }
@media (max-width: 687px) {
  .xw .welcome-strip { flex-direction: column; align-items: stretch; margin: 0 -14px; padding: 10px 14px 12px; }
  .xw .welcome-strip-actions { justify-content: space-between; }
}
.xw .activating-spin {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid var(--line); border-top-color: var(--blue);
  animation: act-spin 0.8s linear infinite;
}
@keyframes act-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .xw .activating-spin { animation: none; } }
.xw .profile-hero { display: flex; gap: 16px; padding: 20px 18px 6px; }
.xw .profile-hero .avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.xw .profile-hero-main { flex: 1; min-width: 0; }
.xw .profile-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.xw .profile-hero-id { min-width: 0; }
.xw .profile-name { margin: 0; font-size: 24px; font-weight: 800; line-height: 29px; letter-spacing: -0.02em; }
.xw .profile-handle { margin: 2px 0 0; font-size: 14.5px; color: var(--text-3); }
.xw .profile-plan { margin-left: 8px; font-size: 13px; font-weight: 700; color: var(--text-3); }
.xw .profile-plan.pro { color: var(--blue); }
.xw .profile-bio { margin: 10px 0 8px; font-size: 15px; line-height: 20px; }
.xw .profile-stats { display: flex; gap: 6px; align-items: baseline; font-size: 14px; color: var(--text-3); }
.xw .profile-stats b { color: var(--text); font-weight: 700; }
.xw .p-group { padding: 20px 18px 0; }
.xw .p-group-last { padding-bottom: 32px; }
.xw .p-group-title { margin: 0 0 4px; font-size: 17px; font-weight: 800; letter-spacing: -0.01em; }
.xw .p-group-sub { margin: 0 0 12px; font-size: 13.5px; line-height: 1.5; color: var(--text-3); }
.xw .p-checks { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.xw .p-check {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  width: 100%; padding: 13px 16px; border: none; border-top: 1px solid var(--line);
  background: var(--bg); color: var(--text); font-family: inherit; font-size: 15px;
  font-weight: 500; text-align: left; cursor: pointer;
  transition: background-color 0.15s ease;
}
.xw .p-check:first-child { border-top: none; }
.xw .p-check:hover { background: var(--hover); }
.xw .p-check.on { font-weight: 700; }
.xw .p-check-ic {
  width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid #cfd9de;
  display: grid; place-items: center; color: #fff; flex-shrink: 0;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.xw .p-check.on .p-check-ic { background: var(--blue); border-color: var(--blue); }
.xw .p-footnote { margin: 10px 0 0; font-size: 13px; color: var(--text-3); }
.xw .p-footnote.unsaved { color: #c77700; font-weight: 600; }
.xw .p-card { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.xw .p-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; }
.xw .p-row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.xw .p-row-title { font-size: 15px; font-weight: 600; }
.xw .p-row-sub { font-size: 13px; line-height: 1.45; color: var(--text-3); }
.xw .p-link {
  border: none; background: none; padding: 0; color: var(--blue);
  font-family: inherit; font-size: 14px; font-weight: 700; text-decoration: none;
  cursor: pointer; white-space: nowrap;
}
.xw .p-link:hover { text-decoration: underline; }
.xw .p-link.danger { color: var(--pink); }
.xw .p-switch {
  position: relative; width: 46px; height: 28px; flex-shrink: 0; border: none;
  border-radius: 9999px; background: #cfd9de; cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .p-switch:disabled { opacity: 0.5; cursor: default; }
.xw .p-switch.on { background: var(--green); }
.xw .p-switch-knob {
  position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(15, 20, 25, 0.25);
  transition: transform 0.2s var(--ease-smooth-out);
}
.xw .p-switch.on .p-switch-knob { transform: translateX(18px); }
.xw .p-signout {
  width: 100%; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px;
  background: var(--bg); color: var(--pink); font-family: inherit; font-size: 15px;
  font-weight: 700; cursor: pointer; transition: background-color 0.15s ease;
}
.xw .p-signout:hover { background: rgba(249, 24, 128, 0.06); }
.xw .p-signin { width: 100%; }
@media (prefers-reduced-motion: reduce) {
  .xw .p-switch, .xw .p-switch-knob, .xw .p-check, .xw .p-check-ic { transition: none; }
}
@media (max-width: 687px) {
  .xw .profile-hero { padding: 16px 14px 4px; gap: 12px; }
  .xw .profile-hero .avatar { width: 60px; height: 60px; }
  .xw .profile-hero-top { flex-wrap: wrap; }
  .xw .profile-name { font-size: 21px; line-height: 26px; }
  .xw .p-group { padding: 18px 14px 0; }
  .xw .p-group-last { padding-bottom: 28px; }
}
.xw .bm-search {
  border: 1px solid var(--line); border-radius: 9999px; background: var(--hover);
  padding: 7px 14px; font-size: 13.5px; font-family: inherit; color: var(--text);
  outline: none; width: 160px;
}
.xw .bm-search:focus { border-color: var(--blue); background: #fff; }
@media (max-width: 687px) { .xw .bm-search { width: 110px; } }

/* empty state + toast */
.xw .empty { padding: 56px 24px; text-align: center; }
.xw .empty-title { margin: 0 0 6px; font-size: 21px; font-weight: 800; }
.xw .empty-sub { margin: 0; font-size: 15px; color: var(--text-2); }
.xw .empty-retry {
  margin-top: 16px; padding: 9px 20px; border-radius: 9999px;
  border: 1px solid var(--line); background: var(--bg); color: var(--text);
  font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .empty-retry:hover { background: var(--hover); }
.xw .caught-up { margin: 10px 0 30px; padding: 38px 24px; text-align: center; border: 1px solid var(--line); border-radius: 18px; background: var(--bg); }
.xw .caught-up-badge { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 9999px; background: var(--blue); color: #fff; margin-bottom: 12px; }
.xw .caught-up-title { margin: 0 0 6px; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
.xw .caught-up-sub { margin: 0; font-size: 14px; color: var(--text-2); }

/* older stories */
.xw .older-sep { display: flex; align-items: center; gap: 12px; margin: 22px 18px 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }
.xw .older-sep::before, .xw .older-sep::after { content: ''; height: 1px; background: var(--line); flex: 1; }
.xw .load-older {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; margin: 0; height: auto; padding: 18px;
  border: none; border-top: 1px solid var(--line); border-radius: 0;
  background: transparent; color: var(--text);
  font-size: 15px; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: background-color 0.2s ease;
}
.xw .load-older:hover:not(:disabled) { background: var(--hover); }
.xw .load-older:disabled { opacity: 0.7; cursor: wait; }
.xw .older-end { margin: 16px 18px 34px; text-align: center; font-size: 13.5px; color: var(--text-3); }
.xw .older-error { margin: 0 18px 24px; text-align: center; font-size: 13.5px; font-weight: 600; color: var(--pink); }
.xw .toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  max-width: calc(100vw - 32px); text-align: center;
  background: #0f1419; color: #fff; font-size: 14px; font-weight: 600;
  padding: 12px 20px; border-radius: 9999px; z-index: 900;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  animation: toast-in 0.2s ease-out; white-space: nowrap;
}
@keyframes toast-in { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .xw .toast,
  .xw .sort-pill,
  .xw .fav,
  .xw .act-mark[data-burst="true"] .act-ic,
  .xw .nav-count,
  .xw .promo-overlay,
  .xw .promo-modal,
  .xw .paywall,
  .xw .save-note,
  .xw .save-note-ic,
  .xw .welcome-strip { animation: none !important; transition: none !important; }
}
${retentionCss}
.xw .ret-sotd { padding: 22px 0 26px; }
.xw .ret-sotd-kicker { padding: 0 18px; margin-bottom: 16px; }
.xw .ret-sotd-shot,
.xw .ret-sotd.lead .ret-sotd-shot { width: 100%; max-width: none; height: 340px; margin: 0 0 22px; }
.xw .ret-sotd-copy { padding: 0 18px; }
@media (max-width: 687px) {
  .xw, .xw .main { height: 100dvh; }
  .xw .head {
    height: auto; min-height: 53px; flex-wrap: wrap;
    padding: 10px 14px 8px; gap: 8px 10px; align-items: center;
  }
  .xw .head-title { font-size: 18px; }
  .xw .head .sort-seg { margin-left: auto; }
  .xw .post { padding: 16px 14px 12px; }
  .xw .post-row {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr) auto;
    grid-template-areas:
      "thumb title title"
      "thumb dek dek"
      "meta meta actions";
    column-gap: 12px;
    row-gap: 8px;
    align-items: start;
  }
  .xw .post-row:not(:has(.post-thumb)) {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "title title" "dek dek" "meta actions";
  }
  .xw .post-row:has(.post-thumb-sm) { grid-template-columns: 56px minmax(0, 1fr) auto; }
  .xw .post-copy { display: contents; padding: 0; }
  .xw .post-thumb {
    grid-area: thumb;
    width: 88px; height: 88px; flex: none;
    max-width: none; border-radius: 10px;
    box-shadow: 0 0 0 1px rgba(15, 20, 25, 0.06);
  }
  .xw .post-thumb-sm { width: 56px; height: 56px; border-radius: 10px; }
  .xw .post-title {
    grid-area: title; align-self: start;
    font-size: 18px; margin: 0; line-height: 1.25;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .xw .post-dek, .xw .lock-note { grid-area: dek; margin: 0; font-size: 14px; }
  .xw .post-meta { grid-area: meta; margin: 0; min-width: 0; align-self: center; }
  .xw .post-copy > .actions { grid-area: actions; margin: 0; align-self: center; flex-shrink: 0; }
  .xw .post-rank { display: none; }
  .xw .headline {
    margin: 0; border: none; border-radius: 0; border-bottom: 1px solid var(--line);
    box-shadow: none; background: transparent;
  }
  .xw .headline-head { padding: 14px 14px 8px; }
  .xw .headline .post { padding: 14px 14px 12px; }
  .xw .ret-sotd { padding: 18px 0 22px; }
  .xw .ret-sotd-kicker { padding: 0 14px; margin-bottom: 14px; }
  .xw .ret-sotd-shot,
  .xw .ret-sotd.lead .ret-sotd-shot { height: 200px; margin: 0 0 16px; }
  .xw .ret-sotd-copy { padding: 0 14px; }
  .xw .ret-sotd-title { font-size: 22px; }
  .xw .ret-pulse-hook-head { padding: 12px 14px 10px; }
  .xw .ret-pulse-hook-item { flex-direction: column; padding: 14px 0 16px; gap: 12px; }
  .xw .ret-pulse-hook-copy { padding: 0 14px; }
  .xw .ret-pulse-hook-thumb {
    width: 100%; max-width: none; height: 180px; flex: none;
    border-radius: 0; box-shadow: none;
  }
  .xw .ret-pulse-hook-body strong { font-size: 18px; }
}
`;
