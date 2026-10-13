'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';
import DailySignup from '../DailySignup';
import { selectFromGroups, type PoolStory } from '@/lib/newsletter-select';
import { faviconUrl, topicIcon } from '@/lib/topic-icons';
import {
  DEFAULT_STORY_COUNT,
  NEWSLETTER_TOPICS,
  prefsFromProfile,
  STORY_COUNTS,
  STORY_FORMATS,
  laneKicker,
  type NewsletterPrefs,
  type NewsletterTopic,
  type StoryCount,
  type StoryFormat,
} from '@/lib/newsletter-prefs';

const COUNT_COPY: Record<StoryCount, string> = {
  5: 'The essentials',
  10: 'The full picture',
  15: 'Everything that moved',
};

const FORMAT_COPY: Record<StoryFormat, { label: string; sub: string }> = {
  summaries: { label: 'Summaries', sub: 'What happened and why it matters' },
  headlines: { label: 'Headlines only', sub: 'Scan it in under a minute' },
  images: { label: 'With images', sub: 'Summaries plus a picture for each story' },
};

const DEFAULT_PREFS: NewsletterPrefs = {
  enabled: true,
  topics: [],
  count: DEFAULT_STORY_COUNT,
  format: 'summaries',
};

// Prefs chosen before signing in, saved once the reader is back.
const PENDING_KEY = 'trace:pending-newsletter-prefs';

function readingMinutes(count: number, format: StoryFormat): number {
  return Math.max(1, Math.round(count * (format === 'headlines' ? 0.15 : 0.5)));
}

function displayDate(date: string | null): string {
  if (!date) return '';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' });
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const PHONE_PREVIEW = 3;

export default function NewsletterBuilder() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [prefs, setPrefs] = useState<NewsletterPrefs>(DEFAULT_PREFS);
  const [savedPrefs, setSavedPrefs] = useState<NewsletterPrefs | null>(null);
  const [pool, setPool] = useState<PoolStory[] | null>(null);
  const [poolDate, setPoolDate] = useState<string | null>(null);
  // Phones show the first few preview stories; the rest is one tap away.
  const [showAll, setShowAll] = useState(false);
  const [save, setSave] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const loadedFor = useRef<string | null>(null);
  // Choices carried over from the landing's mini builder (?topics=&count=&format=).
  const fromLink = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('topics') && !params.has('count') && !params.has('format')) return;
    const linked = prefsFromProfile({
      newsletterTopics: (params.get('topics') || '').split(',').filter(Boolean),
      newsletterStoryCount: Number(params.get('count')),
      newsletterFormat: params.get('format'),
    });
    fromLink.current = true;
    setPrefs((current) => ({ ...current, topics: linked.topics, count: linked.count, format: linked.format }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/newsletter/pool')
      .then((res) => res.json())
      .then((data: { date: string | null; pool: PoolStory[] }) => {
        if (cancelled) return;
        setPool(data.pool || []);
        setPoolDate(data.date);
      })
      .catch(() => !cancelled && setPool([]));
    return () => { cancelled = true; };
  }, []);

  async function authHeaders(): Promise<Record<string, string>> {
    const token = user ? await user.getIdToken() : '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function persist(next: NewsletterPrefs) {
    setSave('saving');
    setError('');
    try {
      const res = await fetch('/api/newsletter/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setPrefs(data.prefs);
      setSavedPrefs(data.prefs);
      setSave('saved');
      posthog.capture('newsletter_preferences_saved', {
        count: next.count, format: next.format, topics: next.topics, enabled: next.enabled,
      });
    } catch (err) {
      setSave('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  // Signed in: load the saved setup, or save the one picked before sign-in.
  useEffect(() => {
    if (!user || loadedFor.current === user.uid) return;
    loadedFor.current = user.uid;
    (async () => {
      const pending = window.sessionStorage.getItem(PENDING_KEY);
      if (pending) {
        window.sessionStorage.removeItem(PENDING_KEY);
        try {
          await persist(JSON.parse(pending) as NewsletterPrefs);
          return;
        } catch {
          /* fall through to loading */
        }
      }
      try {
        const res = await fetch('/api/newsletter/preferences', { headers: await authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setSavedPrefs(data.prefs);
        // Keep what they just picked on the landing; Save makes it stick.
        setPrefs((current) => (fromLink.current ? { ...data.prefs, topics: current.topics, count: current.count, format: current.format } : data.prefs));
      } catch {
        /* keep defaults */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const sections = useMemo(
    () => (pool ? selectFromGroups(pool, prefs.topics, prefs.count, 'member') : []),
    [pool, prefs.topics, prefs.count],
  );
  const storyCount = sections.reduce((sum, [, stories]) => sum + stories.length, 0);
  const chosen = new Set<string>(prefs.topics);
  const backfilled = prefs.topics.length > 0
    && sections.some(([lane]) => lane !== 'model-releases' && !chosen.has(lane));
  const dirty = !savedPrefs || JSON.stringify(savedPrefs) !== JSON.stringify(prefs);

  function update(patch: Partial<NewsletterPrefs>) {
    setPrefs((current) => ({ ...current, ...patch }));
    if (save !== 'saving') setSave('idle');
  }

  function toggleTopic(id: NewsletterTopic) {
    const next = chosen.has(id) ? prefs.topics.filter((t) => t !== id) : [...prefs.topics, id];
    update({ topics: next });
  }

  async function handleSave() {
    if (user) return persist(prefs);
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(prefs));
    const result = await signInWithGoogle('read', { rememberIntent: false });
    if (result.status !== 'success' && result.status !== 'redirecting') {
      window.sessionStorage.removeItem(PENDING_KEY);
    }
  }

  const chip = (on: boolean) =>
    `rounded-xl border px-4 py-3 text-left transition ${on
      ? 'border-accent bg-accent/10 text-foreground'
      : 'border-border bg-surface text-foreground hover:border-foreground/30'}`;
  const segment = (on: boolean) =>
    `flex-1 rounded-xl border px-3 py-3 text-left transition ${on
      ? 'border-accent bg-accent/10'
      : 'border-border bg-surface hover:border-foreground/30'}`;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
      <div>
        {user && (
          <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4">
            <div>
              <p className="font-semibold text-foreground">Daily email</p>
              <p className="text-sm text-secondary">
                {prefs.enabled ? 'On — lands every morning.' : 'Off — you can turn it back on anytime.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.enabled}
              aria-label="Daily email"
              onClick={() => update({ enabled: !prefs.enabled })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${prefs.enabled ? 'bg-accent' : 'bg-border'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${prefs.enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        )}

        <fieldset>
          <legend className="text-lg font-semibold tracking-[-0.02em] text-foreground">Topics</legend>
          <p className="mt-1 text-sm text-secondary">
            Pick what you care about, in any order. Pick none and you get the biggest stories across all of them.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {NEWSLETTER_TOPICS.map((topic) => {
              const on = chosen.has(topic.id);
              return (
                <button key={topic.id} type="button" aria-pressed={on} onClick={() => toggleTopic(topic.id)} className={chip(on)}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      {(() => { const Icon = topicIcon(topic.id); return <Icon size={17} strokeWidth={2.2} className="text-[#1d9bf0]" aria-hidden="true" />; })()}
                      {topic.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${on ? 'border-accent bg-accent text-white' : 'border-border'}`}
                    >
                      {on ? '✓' : ''}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-secondary">{topic.blurb}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-9">
          <legend className="text-lg font-semibold tracking-[-0.02em] text-foreground">How many stories</legend>
          <div className="mt-4 flex gap-2.5">
            {STORY_COUNTS.map((count) => (
              <button key={count} type="button" aria-pressed={prefs.count === count} onClick={() => update({ count })} className={segment(prefs.count === count)}>
                <span className="block text-xl font-semibold text-foreground">{count}</span>
                <span className="block text-[13px] text-secondary">{COUNT_COPY[count]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-9">
          <legend className="text-lg font-semibold tracking-[-0.02em] text-foreground">How you read it</legend>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {STORY_FORMATS.map((format) => (
              <button key={format} type="button" aria-pressed={prefs.format === format} onClick={() => update({ format })} className={segment(prefs.format === format)}>
                <span className="block font-semibold text-foreground">{FORMAT_COPY[format].label}</span>
                <span className="block text-[13px] text-secondary">{FORMAT_COPY[format].sub}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={save === 'saving' || authLoading || (Boolean(user) && !dirty)}
            className="h-12 rounded-full bg-[#1d9bf0] px-7 text-[15px] font-bold text-white transition hover:bg-[#1a8cd8] disabled:opacity-50"
          >
            {save === 'saving'
              ? 'Saving…'
              : user
                ? (dirty ? 'Save my brief' : 'Saved')
                : 'Sign in to save my brief'}
          </button>
          {save === 'saved' && !dirty && (
            <p role="status" className="text-sm text-emerald-600">Saved. Tomorrow&rsquo;s email follows this setup.</p>
          )}
          {save === 'error' && <p role="status" className="text-sm text-red-600">{error}</p>}
          {user && (
            <Link href="/feed?tab=profile" className="text-sm font-medium text-secondary hover:text-foreground">
              Back to profile
            </Link>
          )}
        </div>

        {!user && !authLoading && (
          <div className="mt-10 border-t border-border pt-8">
            <p className="text-sm font-semibold text-foreground">Rather not sign in?</p>
            <p className="mt-1 text-sm text-secondary">
              Get the standard ten-story brief by email. You can make it yours later.
            </p>
            <div className="mt-4">
              <DailySignup compact />
            </div>
          </div>
        )}
      </div>

      {/* Live preview: the sender's own allocation over today's stories. */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
            Preview{poolDate ? ` · with ${displayDate(poolDate)}'s stories` : ''}
          </p>
          <p className="text-xs text-secondary">≈ {readingMinutes(storyCount || prefs.count, prefs.format)} min read</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-white text-[#0f1419] shadow-[0_20px_50px_rgba(26,39,76,0.08)]">
          <div className="border-b border-[#eff3f4] px-6 py-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1d9bf0]">Trace</p>
            <p className="mt-1.5 text-[22px] font-extrabold tracking-[-0.02em]">
              {storyCount || prefs.count} big things today
            </p>
          </div>
          <div className="pb-3 lg:h-[560px] lg:overflow-y-auto lg:overscroll-contain">
            {pool === null && <p className="py-10 text-center text-sm text-[#536471]">Loading today&rsquo;s stories…</p>}
            {pool !== null && sections.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-[#536471]">
                Today&rsquo;s stories are not in yet. Your setup still saves; the preview fills in after the morning run.
              </p>
            )}
            {sections.map(([lane, stories], index) => {
              const first = sections.slice(0, index).reduce((sum, [, group]) => sum + group.length, 0);
              const hide = !showAll ? ' max-lg:hidden' : '';
              return (
              <section key={`${lane}-${index}`} className={first >= PHONE_PREVIEW ? hide : ''}>
                <p className="px-[18px] pt-[18px] text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#f91880]">
                  ★ {laneKicker(lane)}
                </p>
                {stories.map((story, i) => (
                  <article key={story.topic_id} className={`border-b border-[#eff3f4] px-[18px] pt-3.5 pb-4${first + i >= PHONE_PREVIEW ? hide : ''}`}>
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] text-[#71767b]">
                      <span className="inline-flex items-center" aria-hidden="true">
                        {(story.sources ?? []).slice(0, 3).map((domain, i) => (
                          // eslint-disable-next-line @next/next/no-img-element -- publisher favicons
                          <img key={domain} src={faviconUrl(domain, 32)} alt="" width={18} height={18} loading="lazy"
                            className={`h-[18px] w-[18px] rounded-full border-2 border-white bg-white object-contain shadow-[0_0_0_1px_#eff3f4] ${i ? '-ml-2' : ''}`} />
                        ))}
                      </span>
                      <a href={story.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0f1419] hover:underline">
                        {story.source_name}
                      </a>
                      {story.source_count > 1 && <span>· {story.source_count} sources</span>}
                    </p>
                    <p className="mt-2 text-[19px] font-bold leading-[25px] tracking-[-0.01em]">
                      <a href={story.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{story.title}</a>
                    </p>
                    {prefs.format !== 'headlines' && story.summary && (
                      <p className="mt-2 text-[15px] leading-[23px] text-[#0f1419]">{story.summary}</p>
                    )}
                    {prefs.format === 'images' && story.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails, as in the email
                      <img
                        src={story.image}
                        alt=""
                        loading="lazy"
                        onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        className="mt-3 max-h-[320px] w-full rounded-2xl bg-[#eff3f4] object-cover"
                      />
                    )}
                  </article>
                ))}
              </section>
              );
            })}
            {!showAll && storyCount > PHONE_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mx-[18px] mt-3.5 mb-1 h-11 w-[calc(100%-36px)] rounded-full border border-[#cfd9de] bg-white text-[15px] font-bold lg:hidden"
              >
                Show all {storyCount} stories
              </button>
            )}
          </div>
        </div>
        {backfilled && (
          <p className="mt-3 text-xs text-secondary">
            Not enough news in your topics today, so the rest comes from the biggest stories elsewhere.
          </p>
        )}
      </div>
    </div>
  );
}
