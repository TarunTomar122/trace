'use client';

import { CONTACT_EMAIL } from '@/lib/site-links';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { emailEnabled, prefsFromProfile, topicLabel } from '@/lib/newsletter-prefs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { hasPaidSubscription } from '@/lib/subscription-access';
import FeedSkeleton from './FeedSkeleton';
import NewsletterPromptToast from './NewsletterPromptToast';
import { isNewsletterSubscribed, markNewsletterSubscribed } from '@/lib/newsletter-local';
import {
  trackCheckoutClicked,
  trackFeedFilterChanged,
  trackFeedItemBookmarked,
  trackFeedItemClicked,
  trackSponsoredToolClicked,
  trackFeedViewed,
  trackFeedOlderLoaded,
  trackBlogFeedWelcomeShown,
  trackBlogFeedWelcomeCta,
  trackDailyBriefPreferenceChanged,
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
  trackNewsletterPrompt,
} from '@/lib/posthog';
import { bodyParagraphs } from '@/lib/body-text';
import { HOME_FONT_VARS } from '@/lib/home-fonts';
import { canonicalUrlKey } from '@/lib/feed-dedupe';
import { selectBigThings } from '@/lib/big-things';
import { isFreshRelease, rankStoriesForProfile } from '@/lib/feed-ranking';
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
  Bookmark, Share, ArrowLeft, ArrowUpRight, User, Check, X, Clock,
  Home, Sparkles, TrendingUp, Rocket, Bot, Cpu, PenTool, MessageCircle, Mail,
  type LucideIcon,
} from 'lucide-react';
import { BriefArt } from '@/components/feed-v2/home-art';
import { recordSponsorClick, sponsorBlurb, sponsorHref, SPONSOR_SLOTS } from '@/lib/sponsor-link';

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
  /** Jev verdict from the pipeline: 0 = no reader value (kept out of Home). */
  sendWorthy?: number | null;
  /** The thin lane a story was folded out of (THIN_LANE_FOLD in build_trending). */
  laneDetail?: string;
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
  robotics: 'Robotics',
  tech: 'Tech',
  startups: 'Startups',
};

const CAT_ICONS: Record<string, LucideIcon> = {
  ai: Sparkles,
  markets: TrendingUp,
  'ux-design': PenTool,
  robotics: Bot,
  tech: Cpu,
  startups: Rocket,
};

// The lanes Trace actually publishes. Extras from older profiles (engineering,
// security, open-source, policy) are ignored and dropped on the next save.
export const ALL_INTERESTS = ['ai', 'markets', 'tech', 'ux-design', 'startups', 'robotics'];
// Home is the day's big things, picked like the email (selectBigThings) but
// fifteen deep; the email itself stays at ten by default.
const HOME_CAP = 15;
const PER_TAB_STORY_CAP = 15;


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
  stories, headlines = [], pulse, promoted = [], monthlyReach = 0, feedDate = '',
  feedError = false, initialStory = null, initialStoryId = null,
}: {
  stories: FeedStory[];
  headlines?: HeadlineRef[];
  pulse: { tools: PulseItem[]; discussions: PulseItem[]; blogs: PulseItem[] };
  promoted?: PromotedTool[];
  monthlyReach?: number;
  generated: string | null;
  /** Date id of today's feed doc — cursor start for older stories. */
  feedDate?: string;
  /** Global feed load failed server-side — show a retry state, not a blank page. */
  feedError?: boolean;
  /** Archived story resolved server-side for a shared link (not in today's feed). */
  initialStory?: FeedStory | null;
  /** Pre-open a story (shared article page). Falls back to ?story= when present. */
  initialStoryId?: string | null;
}) {
  const { user, profile: authProfile, loading: authLoading, profileResolved, signInWithGoogle, signOut, refreshProfile } = useAuth();
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
  // Signed-out readers get one gentle email ask per fortnight: 30 seconds in, or
  // sooner once they come back to the list from a story or scroll past the first
  // few (never on top of a story they've just opened); never once subscribed.
  const [nlPrompt, setNlPrompt] = useState(false);
  const [nlEngaged, setNlEngaged] = useState(false);
  const nlPromptArmed = useRef(false);
  useEffect(() => {
    if (user || authLoading || nlPrompt || nlPromptArmed.current) return;
    try {
      if (isNewsletterSubscribed()) return;
      const seen = Number(window.localStorage.getItem('trace_nl_prompt_at') || 0);
      if (Date.now() - seen < 14 * 24 * 60 * 60 * 1000) return;
    } catch {
      return;
    }
    nlPromptArmed.current = true;
    const timer = window.setTimeout(() => {
      // They may have signed up some other way while we waited.
      if (isNewsletterSubscribed()) return;
      // Stamp it as seen when it appears: the card doesn't block anything, so most readers
      // simply ignore it, and it must not come back on every visit.
      try {
        window.localStorage.setItem('trace_nl_prompt_at', String(Date.now()));
      } catch {
        /* private mode: the card simply reappears next visit */
      }
      trackNewsletterPrompt('shown');
      setNlPrompt(true);
    }, nlEngaged ? 1500 : 30_000);
    return () => {
      window.clearTimeout(timer);
      nlPromptArmed.current = false;
    };
  }, [user, authLoading, nlPrompt, nlEngaged]);

  function dismissNewsletterPrompt(reason: 'dismissed' | 'subscribed') {
    try {
      window.localStorage.setItem('trace_nl_prompt_at', String(Date.now()));
    } catch {
      /* private mode: the card simply reappears next visit */
    }
    if (reason === 'dismissed') trackNewsletterPrompt('dismissed');
    nlPromptArmed.current = true;
    setNlPrompt(false);
  }
  const [toast, setToast] = useState<string | null>(null);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [campaignWelcome, setCampaignWelcome] = useState<{ source: string; campaign: string; subscribed: boolean } | null>(null);
  const sortSegRef = useRef<HTMLDivElement | null>(null);
  const [sortPill, setSortPill] = useState<{ left: number; width: number } | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Older stories are fetched on demand (24-ish per click) for everyone,
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

  // The email ask comes sooner once the third story has scrolled out of view.
  useEffect(() => {
    const main = mainRef.current;
    if (!main || user || authLoading || nlEngaged) return;
    const onScroll = () => {
      const third = main.querySelectorAll('.ret-sotd, .post')[2];
      if (third && third.getBoundingClientRect().bottom < main.getBoundingClientRect().top) setNlEngaged(true);
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, [user, authLoading, nlEngaged]);

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

  // Sponsored-tool purchase return (?tool_promo=success): clean the URL,
  // refresh the profile and celebrate. Old ?subscription=success links are
  // just cleaned.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const promoDone = q.get('tool_promo') === 'success';
    if (!promoDone && q.get('subscription') !== 'success') return;
    window.history.replaceState(null, '', base());
    if (!promoDone) return;
    refreshProfile().catch(() => null);
    trackPurchaseCompleted('tool_promo');
    setCelebrate('promo');
    void fireConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profile, setProfile] = useState<Profile>({ name: '', email: '', interests: [] });
  const [savedProfile, setSavedProfile] = useState<Profile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [celebrate, setCelebrate] = useState<null | 'promo'>(null);
  const [dailyOn, setDailyOn] = useState(false);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [streak, setStreak] = useState<ReadingStreak | null>(null);
  const [weeklyWrap, setWeeklyWrap] = useState<WeeklyWrapSummary | null>(null);
  const [followedThreads, setFollowedThreads] = useState<Set<string>>(() => new Set());
  const [milestoneDays, setMilestoneDays] = useState<number | null>(null);
  const [showExtensionCta, setShowExtensionCta] = useState(true);
  const streakRecorded = useRef(false);

  // Reflect the profile's daily-brief preference in the profile toggle.
  useEffect(() => {
    if (!authProfile) return;
    // Same rule as the sender: on unless explicitly turned off. The old check
    // showed "off" to readers who were in fact getting the email.
    setDailyOn(emailEnabled(authProfile as unknown as Record<string, unknown>));
  }, [authProfile]);

  useEffect(() => {
    setFollowedThreads(readFollowedThreads(user?.uid));
    setShowExtensionCta(shouldShowExtensionCta(user?.uid));
    streakRecorded.current = false;
  }, [user?.uid]);

  useEffect(() => {
    const from = params.get('from');
    // Arriving from the daily email means they already get it: never ask them to sign up.
    if (from === 'email') markNewsletterSubscribed();
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
          const q = bookmarkQuery.trim() ? `&q=${encodeURIComponent(bookmarkQuery.trim())}` : '';
          const res = await fetch(`/api/bookmarks?limit=100${q}`, { headers: { Authorization: `Bearer ${token}` } });
          if (cancelled) return;
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
  }, [user, bookmarkQuery]);

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

  // First-touch framing for campaign traffic (blog etc.): show a short sign-in
  // nudge once. Dismissal lasts the session.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('trace_campaign_welcome_dismissed') === '1') return;
      const q = new URLSearchParams(window.location.search);
      const source = q.get('utm_source');
      if (!source) return;
      setCampaignWelcome({ source, campaign: q.get('utm_campaign') || '', subscribed: isNewsletterSubscribed() });
    } catch { /* private mode etc. */ }
  }, []);

  // Show/event only once auth has resolved, and never for signed-in readers.
  const campaignWelcomeVisible = Boolean(campaignWelcome && !user && !authLoading);
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
  function openStory(s: FeedStory, opts: { fromDetail?: boolean } = {}) {
    // From another story's "Keep reading": keep the feed's saved position for Back.
    if (mainRef.current && !opts.fromDetail) savedScroll.current = mainRef.current.scrollTop;
    setView({ story: s.id, pulse: null });
    setReadIds((cur) => {
      if (cur.has(s.id)) return cur;
      const next = new Set(cur);
      next.add(s.id);
      storeReads(user?.uid, next);
      return next;
    });
    // Story to story replaces the entry, so the browser's Back still lands on the feed.
    const url = `${base()}?story=${encodeURIComponent(s.id)}`;
    if (opts.fromDetail) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    trackFeedItemClicked(s.id, 'story', s.source || '');
    trackSummaryOpened(s.id, false, {
      surface: 'feed_v2', item_type: 'story', source: s.source,
      position: s.rank, sources_count: s.sources.length,
      ...(opts.fromDetail ? { from: 'keep_reading' } : {}),
    });
  }
  function openPulseItem(t: PulseItem) {
    if (mainRef.current) savedScroll.current = mainRef.current.scrollTop;
    setView({ story: null, pulse: t.id });
    window.history.pushState(null, '', `${base()}?pulse=${encodeURIComponent(t.id)}`);
    trackFeedItemClicked(t.id, 'pulse', t.source || '');
    trackSummaryOpened(t.id, false, {
      surface: 'feed_v2', item_type: 'pulse', source: t.source,
    });
  }
  function goBack() {
    setView({ story: null, pulse: null });
    setNlEngaged(true); // back on the list after a story: a good moment for the email ask
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
    if (olderLoading || olderDone) return;
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
  // sort: Top by default on every tab (first-time visitors land on the ranked
  // view, not the chronological one). The toggle is a persisted preference
  // (localStorage) that wins over that default, across tabs + sessions.
  const [sortOverride, setSortOverride] = useState<null | 'for_you' | 'recent'>(() => readStoredSort());
  const sortMode = sortOverride ?? 'for_you';
  const byRecent = (a: FeedStory, b: FeedStory) => (b.ts || 0) - (a.ts || 0);
  const storyCap = tab === 'all'
    ? HOME_CAP
    : PER_TAB_STORY_CAP;
  const rankedForTab = useMemo(() => {
    const list = tab === 'all'
      ? homeStories
      : stories.filter((s) => s.cat === tab);
    if (sortMode === 'recent') return [...list].sort(byRecent);
    // Home is the daily edition itself: verdict gate, launches first, lane
    // quotas. Category tabs keep the per-lane ranking.
    if (tab === 'all') {
      return selectBigThings(list, { count: storyCap, lanes: myCats });
    }
    return rankStoriesForProfile(
      list,
      { interests: savedProfile.interests, role: authProfile?.role },
    );
  }, [tab, sortMode, storyCap, homeStories, stories, savedProfile.interests, authProfile?.role, myCats]);
  const pulsePool = useMemo(
    () => pulse.discussions.filter((item) => item.id && item.title),
    [pulse.discussions],
  );
  const tabHeadlines = useMemo(
    () => resolveHeadlines(rankedForTab, headlines, pulsePool),
    [rankedForTab, headlines, pulsePool],
  );
  const feedRows = useMemo(
    () => takeFeedRows(layoutFeed(rankedForTab, tabHeadlines, pulsePool), storyCap),
    [rankedForTab, tabHeadlines, pulsePool, storyCap],
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

  // `?story=` accepts a story id or an article URL. Emails link by URL
  // because topic ids are recomputed on every trending rebuild.
  const open = storyParam
    ? allStories.find((s) => s.id === storyParam)
      || findStoryByUrl(allStories, storyParam)
      || (initialStory && initialStory.id === storyParam ? initialStory : null)
    : null;
  const allPulse = [...pulse.tools, ...pulse.discussions, ...pulse.blogs];
  const openPulse = pulseParam ? allPulse.find((t) => t.id === pulseParam) || null : null;
  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);

  const viewRank = new Map(visible.map((s, i) => [s.id, i + 1]));
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

  // "caught up" only after the reader has opened every story they can see,
  // including the archive.
  const caughtUp = visible.length > 0
    && visible.every((s) => readIds.has(s.id))
    && (olderStories.length === 0 || olderStories.every((s) => readIds.has(s.id)))
    && olderDone;

  // feed viewed (once per mount).
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackFeedViewed(stories.length, false, 'edition', 'free', user ? 'authenticated' : 'guest');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // detail view open? (URL-driven)
  const detailOpen = !!open || !!openPulse;

  const canFeature = !detailOpen
    && tab !== 'bookmarks' && tab !== 'profile'
    && tab !== 'conversations' && tab !== 'reading';
  const featuredPool = rankedForTab;
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
  // Launches lead the feed, so they get their own tinted panel with everything
  // else under a "More stories today" divider. Boundaries are story ids
  // because the rendered rows are not 1:1 with the stories (headline blocks
  // group several). Built from the listed rows, so a pinned launch (Story of
  // the day) neither hides the panel nor shows twice. A launch older than
  // FRESH_STORY_HOURS is listed as an ordinary story.
  const listedStories = flattenRows(listRows);
  const releaseHeadings = (() => {
    const now = Date.now();
    const isRelease = (story: FeedStory) => isFreshRelease(story, now);
    const firstIndex = listedStories.findIndex(isRelease);
    if (firstIndex === -1) return { firstId: null, afterId: null, ids: new Set<string>() };
    const firstOther = listedStories.slice(firstIndex + 1).find((story) => !isRelease(story));
    return {
      firstId: listedStories[firstIndex].id,
      afterId: firstOther ? firstOther.id : null,
      ids: new Set(listedStories.filter(isRelease).map((story) => story.id)),
    };
  })();
  const pulseAfternoonItems = [...pulse.discussions, ...pulse.tools].slice(0, 3);
  const homeSponsors = promoted.slice(0, SPONSOR_SLOTS);

  // Viewing a story counts as reading it — covers shared links and
  // back-button restores too, not just taps in the list.
  const openStoryId = open ? open.id : null;
  useEffect(() => {
    if (!openStoryId) return;
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
  }, [openStoryId, user?.uid, user]);

  // Reads are per-account: switching users must not inherit read marks.
  useEffect(() => {
    setReadIds(readStoredReads(user?.uid || null));
  }, [user?.uid]);

  if (authLoading && !mounted) {
    return <FeedSkeleton />;
  }

  return (
    <div className={`${nlPrompt && !user ? 'xw nl-open' : 'xw'} ${HOME_FONT_VARS}`} data-feed-ui="editorial">
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
              <span className="wordmark">Trace</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/trace.webp" alt="" className="brand-logo" />
            </button>
          ) : (
            <a className="brand" href="/" aria-label="Trace home">
              <span className="wordmark">Trace</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/trace.webp" alt="" className="brand-logo" />
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
        {openPulse ? (
          <PulseDetail item={openPulse} onBack={goBack} onShare={share} marked={marks.has(openPulse.id)} toggleMark={toggleMark} />
        ) : open ? (
          <Detail
            // A fresh Detail per story (from Keep reading too), so image state doesn't carry over.
            key={open.id}
            story={open}
            displayRank={viewRank.get(open.id)}
            onBack={goBack}
            onShare={share}
            marked={marks.has(open.id)}
            marks={marks}
            toggleMark={toggleMark}
            more={storiesAfter(open, visible.length ? visible : allStories, readIds)}
            moreRank={viewRank}
            onOpenMore={(next) => openStory(next, { fromDetail: true })}
          />
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
            canCancel={Boolean(user) && hasPaidSubscription(authProfile) && !authProfile?.cancelledAt} onBack={() => go('all')}
            notice={profileNotice}
            signingIn={signingIn}
            onEdit={() => setProfileNotice(null)}
            notify={showToast}
            dailyOn={dailyOn}
            onToggleDaily={() => toggleDailyEmails('profile')}
            briefSummary={briefSummary(authProfile as unknown as Record<string, unknown> | null)}
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
              {user ? (
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
            {/* Phones: the sponsored tool alone, full width, in place of the tools carousel. */}
            {homeSponsors.length > 0 && (
              <div className="tools-carousel-wrap tools-sponsor-wrap">
                {homeSponsors.map((sponsor, sponsorIndex) => (
                  <SponsoredToolLink
                    key={sponsor.id}
                    sponsor={sponsor}
                    placement="pulse_mobile"
                    position={sponsorIndex + 1}
                    feedDate={feedDate}
                    variant="mobile"
                  />
                ))}
              </div>
            )}
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
              <span className="head-meta">{visible.length}</span>
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
              />
            ))}
            {campaignWelcomeVisible && campaignWelcome && (
              <div className="welcome-strip">
                <div className="welcome-strip-art" aria-hidden="true"><BriefArt /></div>
                <div className="welcome-strip-main" role="status">
                  <p className="welcome-strip-title">Make Trace yours</p>
                  <p className="welcome-strip-sub">
                    {/* already on the email (say, from a blog post): don't pitch it twice */}
                    {campaignWelcome.subscribed
                      ? 'Sign in with Google and the feed puts your topics first.'
                      : 'Sign in with Google and the feed puts your topics first. The morning email is optional.'}
                  </p>
                  <ul className="welcome-strip-points">
                    <li><Sparkles size={14} strokeWidth={2.2} aria-hidden="true" /> Your topics first</li>
                    <li><Bookmark size={14} strokeWidth={2.2} aria-hidden="true" /> Bookmarks that sync</li>
                    {!campaignWelcome.subscribed && <li><Mail size={14} strokeWidth={2.2} aria-hidden="true" /> A 5-minute morning email</li>}
                  </ul>
                  <button
                    className="welcome-strip-cta"
                    onClick={() => {
                      trackBlogFeedWelcomeCta(campaignWelcome.source, campaignWelcome.campaign);
                      void handleSignIn();
                    }}
                    disabled={signingIn}
                  >
                    {signingIn ? 'Signing in…' : 'Sign in, it’s free'}
                  </button>
                </div>
                <button
                  className="welcome-strip-x"
                  aria-label="Dismiss notice"
                  onClick={() => {
                    try { sessionStorage.setItem('trace_campaign_welcome_dismissed', '1'); } catch {}
                    setCampaignWelcome(null);
                  }}
                >
                  <X size={16} />
                </button>
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
                    return (
                      <StoryCard
                        key={s.id}
                        story={s}
                        displayRank={viewRank.get(s.id)}
                        hideRank={grouped}
                        showImage={showImage}
                        burst={burstId === s.id}
                        fullDek={tab === 'conversations'}
                        onClick={() => openStory(s)}
                        marked={marks.has(s.id)}
                        onToggleMark={toggleMark}
                        onShare={share}
                        threadFollowing={s.threadId ? followedThreads.has(s.threadId) : false}
                        onToggleThreadFollow={s.threadId ? () => toggleThreadFollow(s) : undefined}
                      />
                    );
                  };
                  // The launch run renders once, as a tinted panel, where its
                  // first story would have been.
                  const releasePanel = () => (
                    <HeadlineSection key="model-releases" label="Model releases" tone={0}>
                      {listedStories
                        .filter((s) => releaseHeadings.ids.has(s.id))
                        .map((s) => renderCard(s, true, true))}
                    </HeadlineSection>
                  );
                  const divider = (
                    <div className="older-sep"><span>More stories today</span></div>
                  );
                  if (row.kind === 'story') {
                    const story = row.story;
                    if (releaseHeadings.ids.has(story.id)) {
                      return story.id === releaseHeadings.firstId ? releasePanel() : null;
                    }
                    return (
                      <Fragment key={story.id}>
                        {story.id === releaseHeadings.afterId && divider}
                        {renderCard(story, false)}
                      </Fragment>
                    );
                  }
                  const members = row.stories.filter((s) => !releaseHeadings.ids.has(s.id));
                  const panelHere = row.stories.some((s) => s.id === releaseHeadings.firstId);
                  const dividerHere = members.some((s) => s.id === releaseHeadings.afterId);
                  if (members.length < 2) {
                    return (
                      <Fragment key={row.id}>
                        {panelHere && releasePanel()}
                        {dividerHere && divider}
                        {members.map((s) => renderCard(s, false))}
                      </Fragment>
                    );
                  }
                  const tone = listRows.slice(0, rowIndex).filter((entry) => entry.kind === 'headline').length % 4;
                  return (
                    <Fragment key={row.id}>
                    {panelHere && releasePanel()}
                    {dividerHere && divider}
                    <HeadlineSection label={row.label} tone={tone}>
                      {members.map((s) => renderCard(s, true, true))}
                      {row.related.map((item) => {
                        const pulseItem = pulsePool.find((entry) => entry.id === item.id);
                        if (!pulseItem) return null;
                        // HN/Lobsters items are discussions; curated links (design etc.) are reads
                        const kind = /hacker news|show hn|lobsters/i.test(pulseItem.source) ? 'Conversation' : 'Related read';
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
                    </Fragment>
                  );
                })
              )}

              {!feedError && tab === 'all' && visible.length > 0 && homeSponsors.map((sponsor, sponsorIndex) => (
                <SponsoredToolLink
                  key={sponsor.id}
                  sponsor={sponsor}
                  placement="home_feed_end"
                  position={visible.length + sponsorIndex + 1}
                  feedDate={feedDate}
                  variant="feed"
                />
              ))}

              {!feedError && !caughtUp && tab === 'all' && visible.length > 0 && readIds.size > 0 && pulseAfternoonItems.length > 0 && (
                <PulseAfternoonHook
                  items={pulseAfternoonItems}
                  onOpen={() => go('conversations')}
                  onOpenItem={(item) => openPulseItem(item)}
                />
              )}

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

      {/* right rail: tools */}
      <aside className="right">
        <div className="rail">
          <div className="rail-head">
            <h2 className="rail-title">Tools</h2>
            {/* Every tool here is a sponsor: one label for the group, not one per row. */}
            {homeSponsors.length > 0 && <span className="sponsor-label rail-sponsored">Sponsored</span>}
          </div>
          <div className="rail-items">
            {homeSponsors.map((sponsor, sponsorIndex) => (
              <SponsoredToolLink
                key={sponsor.id}
                sponsor={sponsor}
                placement="desktop_tools"
                position={sponsorIndex + 1}
                feedDate={feedDate}
                variant="tools"
                showLabel={false}
              />
            ))}
          </div>
          {homeSponsors.length < SPONSOR_SLOTS && (
            <PromoSlot
              monthlyReach={monthlyReach}
              placement="tools_rail"
              compact={homeSponsors.length > 0}
              onOpen={() => setPromoOpen(true)}
            />
          )}
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

      {nlPrompt && !user && <NewsletterPromptToast onClose={dismissNewsletterPrompt} />}
    </div>
  );
}

function WelcomeModal({ onClose }: { kind: 'promo'; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const perks = [
    'A sponsored spot in Tools on desktop, at the top of Top articles on phones, at the end of Home and on the daily brief pages, for 30 days',
    'Clicks tagged utm_source=trace for your analytics, plus a private stats page with our own count (link coming by email)',
    `Support anytime: ${CONTACT_EMAIL}`,
  ];
  return (
    <div className="promo-overlay" onClick={onClose}>
      <div className="promo-modal celebrate-modal" role="dialog" aria-modal="true" aria-label="Your tool is live" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-badge"><Check size={26} /></div>
        <h2 className="promo-title celebrate-title">
          Your tool is live
        </h2>
        <p className="promo-price celebrate-sub">
          Payment confirmed. Thanks for backing Trace, your promo is now running.
        </p>
        <ul className="perk-list">
          {perks.map((p) => (
            <li key={p}><Check size={16} /><span>{p}</span></li>
          ))}
        </ul>
        <button className="promo-pay" onClick={onClose} autoFocus>
          Nice
        </button>
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
        <p className="promo-support">
          <a
            href={AUDIENCE_PROOF_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackPromoCtaClicked({ placement: 'promote_modal', cta: 'view_audience_proof' })}
          >
            See our audience numbers
          </a>
        </p>
        <p className="promo-support">Support throughout your month: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
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

function SponsoredToolLink({
  sponsor,
  placement,
  position,
  feedDate,
  variant,
  showLabel = true,
}: {
  sponsor: PromotedTool;
  placement: 'desktop_tools' | 'home_feed_end' | 'pulse_mobile';
  position: number;
  feedDate: string;
  variant: 'feed' | 'tools' | 'mobile';
  /** Off where a group label covers it; on wherever the row sits among stories. */
  showLabel?: boolean;
}) {
  return (
    <a
      className={`sponsored-tool-row sponsored-tool-row--${variant}`}
      href={sponsorHref(sponsor.url, placement)}
      target="_blank"
      rel="noopener sponsored"
      referrerPolicy="origin"
      aria-label={`Sponsored: ${sponsor.title}. Visit website`}
      onClick={() => {
        trackFeedItemClicked(sponsor.id, 'promo', '');
        recordSponsorClick(sponsor.id, placement);
        trackSponsoredToolClicked({
          sponsorId: sponsor.id,
          title: sponsor.title,
          domain: domainOf(sponsor.url),
          placement,
          position,
          feedDate,
        });
      }}
    >
      {showLabel && <span className="sponsor-label">Sponsored</span>}
      <span className="sponsored-tool-heading">
        <RailLogo item={{ url: sponsor.url, source: '' } as PulseItem} />
        <span className="sponsor-title" title={sponsor.title} style={{ display: 'block', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sponsor.title}</span>
      </span>
      {sponsor.sub ? <span className="sponsor-desc">{sponsorBlurb(sponsor.sub)}</span> : null}
      <span className="sponsor-visit">Visit website <ArrowUpRight size={13} aria-hidden="true" /></span>
    </a>
  );
}


/**
 * The open sponsor slot. With no sponsors it's a Trace ticket (stamp, serif
 * line, button) so the rail isn't empty; under paying sponsors it's one quiet
 * row, so it doesn't outshine them.
 */
function PromoSlot({ monthlyReach, placement, compact, onOpen }: { monthlyReach: number; placement: string; compact: boolean; onOpen: () => void }) {
  const reach = monthlyReach > 0 ? fmtReach(monthlyReach) : null;
  if (compact) {
    return (
      <button
        className="promo-row"
        type="button"
        onClick={() => {
          const props = { placement, cta: 'feature_my_tool_compact' };
          trackPromoCtaClicked(props);
          trackPromoModalOpened(props);
          onOpen();
        }}
      >
        Your tool here · $19/mo <ArrowUpRight size={13} aria-hidden="true" />
      </button>
    );
  }
  return (
    <div className="promo-slot">
      <div className="promo-ticket">
        <span className="promo-stamp">Open slot</span>
        <p className="promo-ticket-line">Your tool here</p>
        <p className="promo-ticket-sub">
          {reach ? `In front of ${reach} tech readers a month` : 'In front of Trace’s tech readers'} · 30 days
        </p>
        <button
          className="promo-cta"
          type="button"
          onClick={() => {
            const props = { placement, cta: 'feature_my_tool' };
            trackPromoCtaClicked(props);
            trackPromoModalOpened(props);
            onOpen();
          }}
        >
          Feature it for $19/mo
        </button>
      </div>
      <a
        className="promo-proof-link"
        href={AUDIENCE_PROOF_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="View Trace’s public audience dashboard"
        onClick={() => trackPromoCtaClicked({ placement, cta: 'view_audience_proof' })}
      >
        View audience proof
      </a>
    </div>
  );
}

const AUDIENCE_PROOF_URL = 'https://us.posthog.com/shared/nvQIXZmOZ9ZJLv_WNXFS9sYW0nn52Q';

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

function StoryCard({ story, onClick, marked, onToggleMark, onShare, displayRank, burst = false, hideRank = false, showImage = true, fullDek = false, threadFollowing = false, onToggleThreadFollow, titleAs: Title = 'h2' }: {
  story: FeedStory; onClick: () => void; marked: boolean;
  onToggleMark: (id: string) => void; onShare: (id: string) => void;
  displayRank?: number; burst?: boolean;
  hideRank?: boolean; showImage?: boolean; fullDek?: boolean; threadFollowing?: boolean; onToggleThreadFollow?: () => void;
  /** h3 under a section heading (Keep reading); h2 in the feed list. */
  titleAs?: 'h2' | 'h3';
}) {
  const rank = displayRank ?? story.rank;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  const dek = storyDek(story);
  const thumb = showImage && story.img
    ? <FeedImage src={story.img} className="post-thumb" alt="" />
    : null;
  return (
    <article
      className="post"
      role="button"
      tabIndex={0}
      aria-label={story.title}
      onClick={onClick}
      onKeyDown={onKey}
    >
      <div className="post-row">
        {thumb}
        <div className="post-copy">
          <Title className="post-title">{story.title}</Title>
          {dek ? (
            <p className={`post-dek${fullDek ? ' full' : ''}`}>{dek}</p>
          ) : null}
          <div className="post-meta">
            <SourceStack sources={story.sources} />
            <span className="post-src">{story.source}</span>
            <span className="post-time">{story.time}</span>
            {story.sources.length > 1 && <span className="post-group">· {story.sources.length} sources</span>}
            {story.threadId && (
              <span className="post-group">
                · Ongoing story
                {onToggleThreadFollow ? (
                  <ThreadFollowButton threadId={story.threadId} following={threadFollowing} onToggle={onToggleThreadFollow} />
                ) : null}
              </span>
            )}
            {!hideRank && <><span className="post-spacer" /><span className="post-rank">#{rank}</span></>}
          </div>
          <Actions id={story.id} size={18} marked={marked} onToggleMark={onToggleMark} onShare={onShare} burst={burst} />
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

/** Resolve a deep link that carries an article URL instead of a story id. */
function findStoryByUrl(stories: FeedStory[], raw: string): FeedStory | null {
  const key = canonicalUrlKey(raw);
  if (!key) return null;
  for (const story of stories) {
    if (canonicalUrlKey(story.url) === key) return story;
    if (story.coverage.some((link) => canonicalUrlKey(link.url) === key)) return story;
  }
  return null;
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
                {t.sum || t.sub ? <p className="post-dek full">{t.sum || t.sub}</p> : null}
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

const KEEP_READING = 6;

/** The next stories after `open` in feed order (wrapping round), unread first. */
function storiesAfter(open: FeedStory, list: FeedStory[], read: Set<string>): FeedStory[] {
  const at = list.findIndex((s) => s.id === open.id);
  const ordered = (at >= 0 ? [...list.slice(at + 1), ...list.slice(0, at)] : list).filter((s) => s.id !== open.id);
  return [...ordered.filter((s) => !read.has(s.id)), ...ordered.filter((s) => read.has(s.id))].slice(0, KEEP_READING);
}

function Detail({ story, displayRank, onBack, onShare, marked, marks, toggleMark, more, moreRank, onOpenMore }: {
  story: FeedStory; displayRank?: number; onBack: () => void; onShare: (id: string) => void; marked: boolean;
  marks: Set<string>; toggleMark: (id: string) => void;
  more: FeedStory[]; moreRank: Map<string, number>; onOpenMore: (story: FeedStory) => void;
}) {
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
            <h2 className="section-label">Coverage · {story.coverage.length} {story.coverage.length === 1 ? 'source' : 'sources'}</h2>
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
      {/* The next stories, so finishing one doesn't mean going back to the list. */}
      {more.length > 0 && (
        <section className="detail-more" aria-labelledby="keep-reading">
          <h2 className="detail-more-title" id="keep-reading">Keep reading</h2>
          {more.map((next) => (
            <StoryCard
              key={next.id}
              story={next}
              onClick={() => onOpenMore(next)}
              marked={marks.has(next.id)}
              onToggleMark={toggleMark}
              onShare={onShare}
              displayRank={moreRank.get(next.id)}
              titleAs="h3"
            />
          ))}
        </section>
      )}
    </>
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
      <div className="promo-modal" role="dialog" aria-modal="true" aria-label="Cancel plan" onClick={(e) => e.stopPropagation()}>
        <div className="promo-head">
          <h2 className="promo-title">Cancel your plan</h2>
          <button className="promo-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="promo-price">Everything in Trace is included for everyone, so you keep full access. Cancelling stops future charges at the end of your billing period.</p>
        {error ? <p className="promo-error">{error}</p> : null}
        <button className="promo-pay" onClick={onClose}>Keep my plan</button>
        <button className="cancel-confirm" onClick={confirm} disabled={busy}>
          {busy ? 'Cancelling…' : 'Yes, cancel plan'}
        </button>
      </div>
    </div>
  );
}

/** "10 stories · AI, Markets · summaries" — what the reader's email holds. */
function briefSummary(profile: Record<string, unknown> | null): string {
  if (!profile) return '';
  const prefs = prefsFromProfile(profile);
  const topics = prefs.topics.length ? prefs.topics.map(topicLabel).join(', ') : 'All topics';
  const format = { summaries: 'with summaries', headlines: 'headlines only', images: 'with summaries and images' }[prefs.format];
  return `${prefs.count} stories · ${topics} · ${format}`;
}

function ProfileView({ profile, setProfile, storyCount, dirty, saving, onSave, canCancel, onBack, user, onSignOut, onSignIn, notify, getToken, onSubscriptionChanged, notice, signingIn = false, onEdit, dailyOn = false, onToggleDaily, briefSummary = '', streak = null, weeklyWrap = null }: {
  profile: Profile; setProfile: (p: Profile) => void; storyCount: number;
  dirty: boolean; saving: boolean; onSave: () => void; canCancel: boolean; onBack: () => void;
  user: { displayName: string | null; email: string | null; photoURL: string | null } | null;
  onSignOut: () => void; onSignIn: () => void;
  notify: (msg: string) => void; getToken: () => Promise<string>; onSubscriptionChanged: () => void;
  notice?: string | null; signingIn?: boolean; onEdit?: () => void;
  dailyOn?: boolean; onToggleDaily?: () => void;
  briefSummary?: string;
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
                <h1 className="profile-name">
                  {user ? (user.displayName || profile.name) : 'Signed out'}
                  {user && <span className="pro-badge" title="Every Trace account is Pro">Pro</span>}
                </h1>
                <p className="profile-handle">
                  {user ? `@${(user.email || '').split('@')[0]}` : 'Sign in to personalize your feed'}
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
          <p className="p-group-sub">These order your For You feed, and your daily email until you give it its own topics below. No hidden filtering.</p>
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
                <span className="p-row-sub">One email around 8:30am UK time. Turn it off anytime.</span>
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
            <div className="p-row">
              <div className="p-row-main">
                <span className="p-row-title">Your daily brief</span>
                <span className="p-row-sub">{briefSummary || 'Ten stories across all topics, with summaries.'}</span>
              </div>
              <Link className="p-link" href="/brief/customize">Customize</Link>
            </div>
          </div>
        </section>

        {canCancel && (
          <section className="p-group">
            <h2 className="p-group-title">Membership</h2>
            <div className="p-card">
              <div className="p-row">
                <div className="p-row-main">
                  <span className="p-row-title">Paid plan</span>
                  <span className="p-row-sub">Everything in Trace is included for everyone. You can cancel your old plan here.</span>
                </div>
                <button className="p-link danger" onClick={() => setCancelOpen(true)}>Cancel plan</button>
              </div>
            </div>
          </section>
        )}

        <section className="p-group">
          <h2 className="p-group-title">Agent access</h2>
          <AgentRetentionCard />
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
            notify('Cancelled. You won’t be charged again.');
          }}
        />
      )}
    </>
  );
}

const css = `
.xw {
  --bg: #ffffff;
  --ink: #0a0a0a;
  --text: #0a0a0a;
  --text-2: #323232;
  --text-3: #767676;
  --line: #e5e5e5;
  --hover: #f7f7f8;
  --blue: #1634cc;
  --blue-hover: #102798;
  --lav: #edeffd;
  --green: #00ba7c;
  --pink: #cd149d;
  --highlight: #ffef5f;
  --serif: var(--font-hp-serif), "Times New Roman", serif;
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
    white-space: nowrap; padding: 8px 14px; border-radius: 4px;
    border: 1px solid var(--line); background: var(--bg); color: var(--text);
    font-size: 13.5px; font-weight: 600; font-family: inherit; cursor: pointer;
  }
  .xw .cat-chip.on { background: var(--lav); border-color: var(--lav); color: var(--blue); font-weight: 700; }
}
@media (max-width: 687px) {
  .xw .main { width: 100%; max-width: 100%; border-left: none; border-right: none; }
  .xw .post { padding: 16px 14px 10px; }
  .xw .post-title { font-size: 22px; }
  .xw .post-thumb { width: 104px; height: 104px; flex-basis: 104px; border-radius: 8px; }
  .xw .post-dek { font-size: 14px; -webkit-line-clamp: 2; }
  .xw .headline-title { font-size: 22px; }
  .xw .headline { margin: 8px 8px 14px; }
  .xw .feed { padding-bottom: 104px; }
  .xw .detail { padding-bottom: calc(120px + env(safe-area-inset-bottom)); }
  .xw .head { padding: 0 14px; }
  .xw .detail-body { margin: 10px 14px 4px; }
  .xw .detail-title { margin: 8px 14px 4px; font-size: 27px; }
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
.xw button.brand { width: 100%; background: transparent; border: none; cursor: pointer; font: inherit; text-align: left; border-radius: 6px; }
.xw button.brand:hover { background: var(--hover); }
.xw .brand-logo { height: 30px; width: auto; }
.xw .wordmark { font-family: var(--serif); font-size: 30px; font-weight: 700; line-height: 1; letter-spacing: -0.005em; }
.xw .nav { display: flex; flex-direction: column; gap: 2px; }
.xw .nav-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 18px; border-radius: 6px; border: none; background: transparent;
  font-size: 19px; font-weight: 400; color: var(--text); cursor: pointer; text-align: left;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.xw .nav-item:hover { background-color: var(--hover); }
.xw .nav-item.active { font-weight: 700; background-color: var(--lav); color: var(--blue); }
.xw .nav-item.active .nav-count { background: #fff; color: var(--blue); }
.xw .nav-with-ic { display: inline-flex; align-items: center; gap: 18px; }
.xw .nav-count {
  font-size: 12px; font-weight: 500; color: var(--text-2); background: var(--hover);
  padding: 2px 8px; border-radius: 4px; font-variant-numeric: tabular-nums;
}
.xw .nav-div { height: 1px; background: var(--line); margin: 10px 12px; }
.xw .nav-group-label { padding: 12px 18px 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.xw .side-foot { padding: 20px 18px; font-size: 13px; line-height: 16px; color: var(--text-3); }
.xw .side-spacer { flex: 1; min-height: 24px; }
.xw .account { padding: 4px 0 10px; }
.xw .account-row {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 10px 14px; border-radius: 6px; border: none; background: transparent;
  cursor: pointer; color: var(--text); text-align: left; transition: background-color 0.2s ease;
}
.xw .account-row:hover { background: var(--hover); }
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
  width: 100%; height: 44px; border-radius: 4px; border: none;
  background: var(--blue); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .signin-btn:hover { background: var(--blue-hover); }
.xw .avatar-actions { display: flex; flex-direction: row; align-items: center; gap: 10px; }

/* center rail */
.xw .main {
  width: 726px; max-width: 726px; flex-shrink: 0; height: 100vh;
  overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none;
  border-left: 1px solid var(--line); border-right: 1px solid var(--line);
}
.xw .main::-webkit-scrollbar { display: none; }
.xw .right-space { flex: 1; max-width: 220px; }
@media (max-width: 1340px) { .xw .right-space { display: none; } }
@media (max-width: 1100px) { .xw .main { border-left: none; border-right: none; width: 100%; max-width: 100%; } }

.xw .head {
  display: flex; align-items: center; gap: 20px;
  padding: 0 16px; height: 53px; flex-shrink: 0;
  border-bottom: 1px solid var(--line);
}
.xw .head-title { margin: 0; font-family: var(--serif); font-size: 26px; font-weight: 500; line-height: 1.05; letter-spacing: -0.005em; }
.xw .head-sub { margin: 0; font-size: 12.5px; color: var(--text-3); }
.xw .head-meta { font-size: 13px; color: var(--text-3); margin-left: auto; }
.xw .sort-seg {
  position: relative;
  display: inline-flex; align-items: center; gap: 2px;
  border: 1px solid var(--line); border-radius: 6px; padding: 2px;
  background: var(--hover); white-space: nowrap;
}
 .xw .sort-pill {
  position: absolute; top: 2px; left: 0; height: calc(100% - 4px);
  border-radius: 4px; background: var(--lav);
  box-shadow: none;
  z-index: 0; pointer-events: none;
  transition: transform var(--t-fast) var(--ease-smooth-out), width var(--t-fast) var(--ease-smooth-out);
  will-change: transform;
}
.xw .sort-opt {
  position: relative; z-index: 1;
  display: inline-flex; align-items: center; gap: 4px;
  border: none; background: transparent; color: var(--text-2);
  font-size: 12.5px; font-weight: 700; font-family: inherit;
  border-radius: 4px; padding: 5px 10px; cursor: pointer;
  transition: color var(--t-quick) ease;
}
.xw .sort-opt.on { background: transparent; color: var(--blue); box-shadow: none; }
.xw .head-spacer { width: 34px; }
 .xw .back {
  width: 44px; height: 44px; border-radius: 6px; border: none;
  background: transparent; color: var(--text); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background-color 0.2s ease; margin-left: -8px;
}
.xw .back:hover { background-color: var(--hover); }

@media (max-width: 687px) {
  .xw .act-ic { width: 44px; height: 44px; }
  .xw .toast { bottom: 72px; }
  .xw .post { padding: 16px 14px 10px; }
  .xw .headline-head { padding: 14px 14px 8px; }
  .xw .headline-title { font-size: 22px; }
  .xw .post-title { font-size: 22px; }
  .xw .feed { padding-bottom: 104px; }
  .xw .detail { padding-bottom: calc(120px + env(safe-area-inset-bottom)); }
  .xw .head { padding: 0 14px; }
  .xw .detail-body { margin: 10px 14px 4px; }
  .xw .detail-title { margin: 8px 14px 4px; font-size: 27px; }
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
.xw .headline {
  margin: 10px 12px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--hover);
  box-shadow: none;
}
.xw .headline.tone-0 { background: #f1fbfd; border-color: #c3eff9; }
.xw .headline.tone-1 { background: #fefdeb; border-color: #f4ea9c; }
.xw .headline.tone-2 { background: #f0fde8; border-color: #c6eeac; }
.xw .headline.tone-3 { background: #fef4fb; border-color: #f6cbe9; }
.xw .headline-head {
  padding: 14px 14px 10px;
}
.xw .headline-title {
  margin: 0;
  font-family: var(--serif); font-size: 24px; font-weight: 500; letter-spacing: -0.005em;
  line-height: 1.12; color: var(--text);
}
.xw .headline-stories { padding: 0 0 6px; }
.xw .headline .post { border-bottom: none; background: transparent; padding: 12px 12px 10px; }
.xw .headline .post + .post { border-top: 1px solid rgba(10, 10, 10, 0.08); }
.xw .headline .post:hover { background: rgba(255, 255, 255, 0.6); }
.xw .headline-related .post-title { font-size: 16px; font-weight: 650; }
.xw .post-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; margin-bottom: 6px; }
.xw .post-src { font-size: 13px; font-weight: 700; color: var(--text-2); white-space: nowrap; }
.xw .post-time { font-size: 13px; color: var(--text-3); white-space: nowrap; }
.xw .post-spacer { flex: 1; }
.xw .post-rank { font-size: 13px; font-weight: 500; color: var(--text-3); font-variant-numeric: tabular-nums; }
.xw .post-group { font-size: 13px; color: var(--text-3); white-space: nowrap; }
.xw .detail-coverage { margin: 16px 18px 4px; }
.xw .detail-more { margin-top: 18px; border-top: 1px solid var(--line); }
.xw .detail-more-title { margin: 0; padding: 18px 18px 6px; font-family: var(--serif); font-size: 28px; font-weight: 500; line-height: 1.05; letter-spacing: -0.005em; }
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
  .xw .tools-carousel-title { display: flex; align-items: baseline; justify-content: space-between; font-family: var(--serif); font-size: 24px; font-weight: 500; line-height: 1.05; letter-spacing: -0.005em; padding: 0 14px 10px; }
  .xw .tools-carousel { overflow-x: auto; padding: 2px 14px 6px; scrollbar-width: none; }
  .xw .tools-carousel::-webkit-scrollbar { display: none; }
  .xw .tools-track { display: flex; width: max-content; }
  .xw .tools-group { display: flex; gap: 10px; padding-right: 10px; }
  .xw .tool-card {
    min-width: 218px; max-width: 218px;
    border: 1px solid var(--line); border-radius: 8px; background: #fff;
    padding: 12px; display: flex; flex-direction: column; gap: 6px;
    text-decoration: none; color: inherit;
  }
  .xw .tool-card-top { display: flex; align-items: center; gap: 6px; }
  .xw .tool-card-title { font-size: 14px; font-weight: 700; line-height: 18px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .xw .tool-card-sub { font-size: 12.5px; line-height: 17px; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .xw .tool-card-meta { display: none; }
}
.xw .post-title { margin: 0 0 8px; font-family: var(--serif); font-size: 26px; font-weight: 500; line-height: 1.1; letter-spacing: -0.005em; }
.xw .post-dek {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; margin: 0 0 10px;
  font-size: 15px; line-height: 1.45; color: var(--text-2);
}
/* Discussion cards (Top articles): the description is the story, so let
   it run instead of cutting it at two lines. */
.xw .post-dek.full { display: block; -webkit-line-clamp: unset; overflow: visible; }
.xw .post-row { display: flex; flex-direction: row; align-items: flex-start; gap: 16px; }
.xw .post-copy { flex: 1; min-width: 0; }
.xw .post-thumb {
  flex: 0 0 140px; width: 140px; height: 140px; object-fit: cover;
  object-position: center 30%;
  border-radius: 8px; display: block; background: var(--hover);
  box-shadow: 0 0 0 1px rgba(10, 10, 10, 0.06);
}
.xw .post-thumb-sm { flex-basis: 56px; width: 56px; height: 56px; border-radius: 10px; box-shadow: none; }
.xw .post-img {
  width: 100%; aspect-ratio: 16 / 10; max-height: 510px; object-fit: cover;
  border-radius: 10px; margin: 10px 0 6px; display: block;
  background: var(--hover);
}
.xw .post-img[data-status='loading'],
.xw .post-thumb[data-status='loading'],
.xw .headline-shot[data-status='loading'],
.xw .detail-img[data-status='loading'] {
  background: linear-gradient(100deg, var(--hover) 40%, #eeeef0 50%, var(--hover) 60%);
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
  width: 40px; height: 40px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.xw .act-mark:hover .act-ic, .xw .act-share:hover .act-ic { background-color: var(--lav); color: var(--blue); }
.xw .act-mark.on .act-ic { color: var(--blue); }

/* detail view */
@media (min-width: 688px) { .xw .detail { padding-bottom: 48px; } }
/* Whatever ends the story view clears the fixed bottom nav (<=1100px): the story
   itself, or "Keep reading" after it. */
@media (max-width: 1100px) { .xw .detail { padding-bottom: calc(104px + env(safe-area-inset-bottom)); } }
.xw .detail:has(+ .detail-more) { padding-bottom: 0; }
.xw .detail-more { padding-bottom: 48px; }
@media (max-width: 1100px) { .xw .detail-more { padding-bottom: calc(104px + env(safe-area-inset-bottom)); } }
.xw .detail-byline { display: flex; align-items: center; gap: 8px; padding: 16px 18px 0; }
.xw .detail-src { font-size: 15px; font-weight: 700; }
.xw .detail-title { margin: 10px 18px 4px; font-family: var(--serif); font-size: 32px; font-weight: 500; line-height: 1.08; letter-spacing: -0.005em; }
.xw .detail-img { width: calc(100% - 36px); max-height: 510px; object-fit: cover; border-radius: 10px; margin: 12px 18px 4px; }
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


/* signal — plain text */
.xw .signal { font-size: 12.5px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }

/* right rail */
.xw .right { width: 330px; flex-shrink: 0; height: 100vh; overflow-y: auto; scrollbar-width: none; padding: 8px 16px 3rem 8px; }
.xw .right::-webkit-scrollbar { display: none; }
/* side 275 + main 726 + rail 330 = 1331px: below that the rail would overflow */
@media (max-width: 1340px) { .xw .right { display: none; } }
.xw .rail { background: var(--bg); border-radius: 12px; padding: 0; border: 1px solid var(--line); overflow: hidden; }
.xw .rail + .rail { margin-top: 16px; }
.xw .rail-head { display: flex; align-items: center; gap: 8px; padding: 16px 16px 12px; border-bottom: 1px solid var(--line); }
.xw .rail-title { margin: 0; font-family: var(--serif); font-size: 26px; font-weight: 500; line-height: 1.05; letter-spacing: -0.005em; flex: 1; }
.xw .rail-items { display: flex; flex-direction: column; }
.xw .pulse-row {
  display: grid; grid-template-columns: 20px minmax(0, 1fr); column-gap: 10px; row-gap: 3px;
  align-items: flex-start; text-align: left;
  padding: 12px 16px; border: none; background: transparent;
  cursor: pointer; color: inherit; width: 100%;
  transition: background-color 0.2s ease;
}
.xw .pulse-row .pulse-title { grid-column: 2; min-width: 0; }
.xw .pulse-row .rail-sub { grid-column: 1 / -1; }
.xw .sponsored-tool-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 12px;
  padding: 12px 16px; border: 0; border-bottom: 1px solid var(--line);
  background: transparent; text-decoration: none; color: inherit; box-sizing: border-box;
  transition: background-color 0.15s ease;
}
.xw .sponsored-tool-row--feed { display: none !important; }
@media (max-width: 1340px) { .xw .sponsored-tool-row--feed { display: grid !important; } }
.xw .sponsored-tool-row--feed { border-top: 1px solid var(--line); }
.xw .tools-sponsor-wrap { padding: 0; }
.xw .tools-sponsor-wrap .sponsored-tool-row { width: 100%; box-sizing: border-box; }
.xw .sponsored-tool-row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.xw .sponsored-tool-row .sponsor-label { grid-column: 1 / -1; }
.xw .sponsored-tool-heading { display: flex; align-items: center; gap: 8px; min-width: 0; }
.xw .sponsored-tool-row .sponsor-desc { grid-column: 1 / -1; }
.xw .sponsored-tool-row .sponsor-visit { grid-column: 1 / -1; }
.xw .sponsor-label { color: var(--text-3); font-size: 9.5px; font-weight: 700; line-height: 12px; letter-spacing: 0.055em; text-transform: uppercase; }
.xw .sponsor-title { min-width: 0; overflow: hidden; color: var(--text); font-size: 15px; font-weight: 650; line-height: 20px; letter-spacing: -0.01em; text-overflow: ellipsis; white-space: nowrap; }
.xw .sponsor-desc { color: var(--text-2); font-size: 13px; line-height: 18px; overflow-wrap: break-word; }
.xw .sponsor-visit { display: inline-flex; align-items: center; gap: 3px; width: fit-content; color: var(--blue); font-size: 11.5px; font-weight: 600; line-height: 14px; }
.xw .rail-logo { width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0; align-self: flex-start; margin-top: 2px; }
.xw .rail-items { padding-bottom: 8px; }
.xw .fav-solo { width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; }
.xw .pulse-row:hover { background: var(--hover); }
.xw .sponsored-tool-row:hover { background: var(--hover); }
.xw .sponsored-tool-row:hover .sponsor-visit { color: var(--blue-hover); }
.xw .pulse-title { min-width: 0; overflow: hidden; font-size: 15px; font-weight: 400; line-height: 20px; letter-spacing: -0.008em; text-overflow: ellipsis; white-space: nowrap; }
.xw .rail-sub { display: block; font-size: 13px; font-weight: 400; line-height: 18px; color: var(--text-2); overflow-wrap: break-word; }
.xw .rail-sponsored { flex: none; }
.xw .promo-row {
  display: inline-flex; align-items: center; gap: 4px; width: 100%; padding: 12px 16px; border: 0; border-top: 1px solid var(--line);
  background: transparent; color: var(--text-3); cursor: pointer; font-family: inherit; font-size: 12.5px; font-weight: 600; line-height: 16px;
  text-align: left; transition: color 0.15s ease;
}
.xw .promo-row:hover { color: var(--text); }
.xw .promo-row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.xw .promo-slot { display: flex; flex-direction: column; gap: 10px; padding: 16px; border-top: 1px solid var(--line); }
/* a Trace ticket, quiet on the white rail: dashed edge, ink stamp, outlined button */
.xw .promo-ticket {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  padding: 16px 16px 18px; border: 1px dashed #c7c7c7; border-radius: 10px;
  background: #fff; color: var(--text);
}
.xw .promo-stamp {
  display: inline-block; padding: 2px 8px; border: 1.5px solid var(--text); border-radius: 4px;
  background: #fff; color: var(--text); font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
  transform: rotate(-3deg);
}
.xw .promo-ticket-line { margin: 4px 0 0; font-family: var(--serif); font-size: 26px; font-weight: 500; line-height: 1.05; letter-spacing: -0.005em; }
.xw .promo-ticket-sub { margin: 0; font-size: 13px; line-height: 18px; color: var(--text-2); }
.xw .promo-cta {
  width: 100%; height: 42px; margin-top: 6px; border: 1px solid #c7c7c7; border-radius: 4px;
  background: #fff; color: var(--text); cursor: pointer;
  font-family: inherit; font-size: 14.5px; font-weight: 600;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.xw .promo-cta:hover { border-color: var(--text); }
.xw .promo-cta:active { transform: translateY(1px); }
.xw .promo-cta:focus-visible,
.xw .promo-proof-link:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; border-radius: 4px; }
.xw .promo-proof-link {
  align-self: center; margin-top: 4px; color: var(--text-3); font-size: 12px; font-weight: 600; line-height: 16px;
  text-decoration: none; white-space: nowrap;
}
.xw .promo-proof-link:hover { color: var(--text); text-decoration: underline; text-underline-offset: 3px; }
.xw .promo-overlay {
  position: fixed; inset: 0; z-index: 400; background: rgba(10,10,10,0.45);
  display: flex; align-items: center; justify-content: center; padding: 20px;
  animation: t-fade-in var(--t-quick) var(--ease-smooth-out);
}
@keyframes t-fade-in { from { opacity: 0; } to { opacity: 1; } }
.xw .promo-modal { animation: t-modal-in var(--t-fast) var(--ease-smooth-out); transform-origin: center; }
@keyframes t-modal-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.xw .promo-modal { width: 100%; max-width: 420px; background: #fff; border-radius: 12px; padding: 22px 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
.xw .promo-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.xw .promo-title { margin: 0; font-family: var(--serif); font-size: 26px; font-weight: 500; line-height: 1.08; letter-spacing: -0.005em; }
.xw .promo-x { border: none; background: transparent; cursor: pointer; color: var(--text-2); padding: 6px; border-radius: 4px; }
.xw .promo-x:hover { background: var(--hover); }
.xw .promo-price { margin: 0 0 16px; font-size: 13.5px; color: var(--text-2); }
.xw .promo-label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 12px; }
.xw .promo-input {
  display: block; width: 100%; box-sizing: border-box; margin-top: 6px;
  border: 1px solid #8f8f8f; border-radius: 3px; padding: 11px 12px;
  font-size: 15px; font-family: inherit; color: var(--text); background: #fff; outline: none;
}
.xw .promo-input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(22, 52, 204, 0.18); }
.xw .promo-error { margin: 0 0 12px; font-size: 13px; color: #d31717; }
.xw .promo-pay {
  width: 100%; height: 46px; border: none; border-radius: 4px;
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
.xw .miss-list svg { color: #d31717; }
.xw button.pick { font: inherit; cursor: pointer; }
.xw .pick-danger { color: #d31717; border-color: rgba(211,23,23,0.4); }
.xw .cancel-confirm {
  width: 100%; margin-top: 10px; height: 44px; border: none; background: transparent;
  color: var(--text-2); font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer;
}
.xw .cancel-confirm:hover { color: #d31717; }
.xw .cancel-confirm:disabled { opacity: 0.6; cursor: wait; }
.xw .rail-sig { font-size: 12.5px; font-weight: 600; color: var(--text-3); font-variant-numeric: tabular-nums; }
.xw .rail-sum { font-size: 13px; line-height: 19px; color: var(--text-2); }

/* profile view */
.xw .avatar { width: 92px; height: 92px; border-radius: 50%; border: 4px solid #fff; background: #fff; object-fit: contain; }
.xw .save-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 38px; padding: 0 18px; border-radius: 4px; border: 1px solid #c7c7c7;
  background: var(--bg); color: var(--text-2); font-size: 15px; font-weight: 700; cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.xw .save-btn:hover:not(:disabled) { background: var(--hover); }
.xw .save-btn:disabled { opacity: 0.6; cursor: default; }
.xw .save-btn.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
.xw .save-btn.primary:hover { background: var(--blue-hover); }
@keyframes save-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(22, 52, 204, 0.4); }
  50% { box-shadow: 0 0 0 7px rgba(22, 52, 204, 0); }
}
.xw .save-btn.pulse { animation: save-pulse 1.6s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .xw .save-btn.pulse { animation: none; } }
.xw .save-note {
  animation: t-panel-in var(--t-slow) var(--ease-smooth-out);
  display: flex; align-items: center; gap: 9px;
  margin: 10px 18px 0; padding: 10px 12px;
  border: 1px solid rgba(0, 186, 124, 0.35); background: rgba(0, 186, 124, 0.08);
  border-radius: 6px; font-size: 13.5px; font-weight: 600; color: var(--text);
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
/* "Make Trace yours": a lavender card, 1440-style (art, serif title, three points) */
.xw .welcome-strip {
  position: relative; display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 18px; align-items: center;
  margin: 14px 16px; padding: 18px 44px 18px 18px; border-radius: 12px; background: var(--lav);
  animation: t-panel-in var(--t-slow) var(--ease-smooth-out);
}
.xw .welcome-strip-art { width: 104px; }
.xw .welcome-strip-art svg { display: block; width: 100%; height: auto; }
.xw .welcome-strip-main { min-width: 0; }
.xw .welcome-strip-title { margin: 0 0 4px; font-family: var(--serif); font-size: 28px; font-weight: 500; line-height: 1.05; letter-spacing: -0.005em; }
.xw .welcome-strip-sub { margin: 0; font-size: 14px; line-height: 1.45; color: var(--text-2); }
.xw .welcome-strip-points { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 10px 0 14px; padding: 0; list-style: none; font-size: 13.5px; font-weight: 600; color: var(--text); }
.xw .welcome-strip-points li { display: inline-flex; align-items: center; gap: 6px; }
.xw .welcome-strip-points svg { color: var(--blue); }
.xw .welcome-strip-cta {
  border: none; border-radius: 4px; background: var(--blue); color: #fff;
  font-size: 15px; font-weight: 600; font-family: inherit;
  height: 40px; padding: 0 18px; cursor: pointer; white-space: nowrap;
  transition: background-color 0.15s ease;
}
.xw .welcome-strip-cta:hover { background: var(--blue-hover); }
.xw .welcome-strip-cta:disabled { opacity: 0.7; cursor: wait; }
.xw .welcome-strip-x {
  position: absolute; top: 8px; right: 8px;
  border: none; background: transparent; color: var(--text-2);
  padding: 8px; border-radius: 4px; cursor: pointer; display: inline-flex;
}
.xw .welcome-strip-x:hover { background: rgba(10, 10, 10, 0.06); color: var(--text); }
@media (max-width: 687px) {
  .xw .welcome-strip { grid-template-columns: 72px minmax(0, 1fr); gap: 14px; align-items: start; margin: 12px 14px; padding: 16px 40px 16px 14px; }
  .xw .welcome-strip-art { width: 72px; margin-top: 4px; }
  .xw .welcome-strip-title { font-size: 24px; }
  .xw .welcome-strip-cta { width: 100%; }
}
.xw .profile-hero { display: flex; gap: 16px; padding: 20px 18px 6px; }
.xw .profile-hero .avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.xw .profile-hero-main { flex: 1; min-width: 0; }
.xw .profile-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.xw .profile-hero-id { min-width: 0; }
.xw .pro-badge { display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 9px; border-radius: 4px; background: var(--blue); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; vertical-align: middle; }
.xw .profile-name { margin: 0; font-family: var(--serif); font-size: 30px; font-weight: 500; line-height: 1.08; letter-spacing: -0.005em; }
.xw .profile-handle { margin: 2px 0 0; font-size: 14.5px; color: var(--text-3); }
.xw .profile-bio { margin: 10px 0 8px; font-size: 15px; line-height: 20px; }
.xw .profile-stats { display: flex; gap: 6px; align-items: baseline; font-size: 14px; color: var(--text-3); }
.xw .profile-stats b { color: var(--text); font-weight: 700; }
.xw .p-group { padding: 20px 18px 0; }
.xw .p-group-last { padding-bottom: 32px; }
.xw .p-group-title { margin: 0 0 4px; font-family: var(--serif); font-size: 22px; font-weight: 500; line-height: 1.1; letter-spacing: -0.005em; }
.xw .p-group-sub { margin: 0 0 12px; font-size: 13.5px; line-height: 1.5; color: var(--text-3); }
.xw .p-checks { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
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
  width: 22px; height: 22px; border-radius: 4px; border: 1.5px solid #8f8f8f;
  display: grid; place-items: center; color: #fff; flex-shrink: 0;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.xw .p-check.on .p-check-ic { background: var(--blue); border-color: var(--blue); }
.xw .p-footnote { margin: 10px 0 0; font-size: 13px; color: var(--text-3); }
.xw .p-footnote.unsaved { color: #c77700; font-weight: 600; }
.xw .p-card { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
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
.xw .p-link.danger { color: #d31717; }
.xw .p-switch {
  position: relative; width: 46px; height: 28px; flex-shrink: 0; border: none;
  border-radius: 9999px; background: #c7c7c7; cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .p-switch:disabled { opacity: 0.5; cursor: default; }
.xw .p-switch.on { background: var(--green); }
.xw .p-switch-knob {
  position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(10, 10, 10, 0.25);
  transition: transform 0.2s var(--ease-smooth-out);
}
.xw .p-switch.on .p-switch-knob { transform: translateX(18px); }
.xw .p-signout {
  width: 100%; padding: 14px 16px; border: 1px solid #c7c7c7; border-radius: 4px;
  background: var(--bg); color: #d31717; font-family: inherit; font-size: 15px;
  font-weight: 700; cursor: pointer; transition: background-color 0.15s ease;
}
.xw .p-signout:hover { background: rgba(211, 23, 23, 0.05); }
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
  border: 1px solid var(--line); border-radius: 4px; background: var(--hover);
  padding: 7px 14px; font-size: 13.5px; font-family: inherit; color: var(--text);
  outline: none; width: 160px;
}
.xw .bm-search:focus { border-color: var(--blue); background: #fff; }
@media (max-width: 687px) { .xw .bm-search { width: 110px; } }

/* empty state + toast */
.xw .empty { padding: 56px 24px; text-align: center; }
.xw .empty-title { margin: 0 0 6px; font-family: var(--serif); font-size: 28px; font-weight: 500; line-height: 1.08; }
.xw .empty-sub { margin: 0; font-size: 15px; color: var(--text-2); }
.xw .empty-retry {
  margin-top: 16px; padding: 9px 20px; border-radius: 4px;
  border: 1px solid #c7c7c7; background: var(--bg); color: var(--text);
  font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .empty-retry:hover { background: var(--hover); }
.xw .caught-up { margin: 10px 0 30px; padding: 38px 24px; text-align: center; border: 1px solid var(--line); border-radius: 12px; background: var(--bg); }
.xw .caught-up-badge { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 9999px; background: var(--blue); color: #fff; margin-bottom: 12px; }
.xw .caught-up-title { margin: 0 0 6px; font-family: var(--serif); font-size: 28px; font-weight: 500; line-height: 1.08; letter-spacing: -0.005em; color: var(--text); }
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
.xw .older-error { margin: 0 18px 24px; text-align: center; font-size: 13.5px; font-weight: 600; color: #d31717; }
.xw .toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  max-width: calc(100vw - 32px); text-align: center;
  background: #0a0a0a; color: #fff; font-size: 14px; font-weight: 600;
  padding: 12px 20px; border-radius: 6px; z-index: 900;
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
/* The feed is a full-screen shell; behind it, the page is white, not the site's cream. */
body:has(> .xw) { background: #ffffff; }
@media (max-width: 687px) {
  .xw, .xw .main { height: 100dvh; }
  /* Pinned to the visible screen: in-app browsers (X's link preview) can size or
     offset the page differently, which left a cream band above the topic chips. */
  .xw { position: fixed; inset: 0; height: auto; }
  .xw .main { height: 100%; }
  .xw .head {
    height: auto; min-height: 53px; flex-wrap: wrap;
    padding: 10px 14px 8px; gap: 8px 10px; align-items: center;
  }
  .xw .head-title { font-size: 24px; }
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
    max-width: none; border-radius: 8px;
    box-shadow: 0 0 0 1px rgba(10, 10, 10, 0.06);
  }
  .xw .post-thumb-sm { width: 56px; height: 56px; border-radius: 8px; }
  .xw .post-title {
    grid-area: title; align-self: start;
    font-size: 22px; margin: 0; line-height: 1.1;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .xw .post-dek { grid-area: dek; margin: 0; font-size: 14px; }
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
  .xw .ret-sotd-title { font-size: 28px; }
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
