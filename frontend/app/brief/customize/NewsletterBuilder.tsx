'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { Check, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LandingHeroSignup from '@/components/feed-v2/LandingHeroSignup';
import { selectFromGroups, type PoolStory } from '@/lib/newsletter-select';
import { faviconUrl, topicIcon } from '@/lib/topic-icons';
import { bodyParagraphs } from '@/lib/body-text';
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

  return (
    <div className="cz-grid">
      <div>
        {user && (
          <div className="cz-switch-card">
            <div>
              <p className="cz-switch-title">Daily email</p>
              <p className="cz-switch-sub">
                {prefs.enabled ? 'On. It lands every morning.' : 'Off. You can turn it back on anytime.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.enabled}
              aria-label="Daily email"
              onClick={() => update({ enabled: !prefs.enabled })}
              className="cz-switch"
            >
              <span />
            </button>
          </div>
        )}

        <fieldset className="cz-set">
          <legend className="cz-legend">Topics</legend>
          <p className="cz-hint">
            Pick what you care about, in any order. Pick none and you get the biggest stories across all of them.
          </p>
          <div className="cz-tiles cz-tiles-topics">
            {NEWSLETTER_TOPICS.map((topic) => {
              const on = chosen.has(topic.id);
              return (
                <button key={topic.id} type="button" aria-pressed={on} onClick={() => toggleTopic(topic.id)} className="cz-tile">
                  <span className="cz-tile-row">
                    <span className="cz-tile-name">
                      {(() => { const Icon = topicIcon(topic.id); return <Icon size={18} strokeWidth={2} aria-hidden="true" />; })()}
                      {topic.label}
                    </span>
                    <span aria-hidden="true" className="cz-check">
                      {on && <Check size={14} strokeWidth={3} />}
                    </span>
                  </span>
                  <span className="cz-tile-sub">{topic.blurb}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="cz-set">
          <legend className="cz-legend">How many stories</legend>
          <div className="cz-tiles cz-tiles-3">
            {STORY_COUNTS.map((count) => (
              <button key={count} type="button" aria-pressed={prefs.count === count} onClick={() => update({ count })} className="cz-tile">
                <span className="cz-num">{count}</span>
                <span className="cz-tile-sub">{COUNT_COPY[count]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="cz-set">
          <legend className="cz-legend">How you read it</legend>
          <div className="cz-tiles cz-tiles-3 cz-tiles-format">
            {STORY_FORMATS.map((format) => (
              <button key={format} type="button" aria-pressed={prefs.format === format} onClick={() => update({ format })} className="cz-tile">
                <span className="cz-fmt">{FORMAT_COPY[format].label}</span>
                <span className="cz-tile-sub">{FORMAT_COPY[format].sub}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="cz-actions">
          <button
            type="button"
            onClick={handleSave}
            disabled={save === 'saving' || authLoading || (Boolean(user) && !dirty)}
            className="hp-btn hp-btn-dark"
          >
            {save === 'saving'
              ? 'Saving…'
              : user
                ? (dirty ? 'Save my brief' : 'Saved')
                : 'Sign in to save my brief'}
          </button>
          {save === 'saved' && !dirty && (
            <p role="status" className="cz-ok">Saved. Tomorrow&rsquo;s email follows this setup.</p>
          )}
          {save === 'error' && <p role="status" className="cz-err">{error}</p>}
          {user && (
            <Link href="/feed?tab=profile" className="cz-link">
              Back to profile
            </Link>
          )}
        </div>

        {!user && !authLoading && (
          <div className="cz-alt">
            <p className="cz-alt-title">Rather not sign in?</p>
            <p className="cz-alt-sub">
              Get the standard ten-story brief by email. You can make it yours later.
            </p>
            <LandingHeroSignup placement="box" source="daily_page" />
          </div>
        )}
      </div>

      {/* Live preview: the sender's own allocation over today's stories. */}
      <div className="cz-preview">
        <div className="cz-preview-bar">
          <p className="cz-preview-label">
            <Eye size={17} strokeWidth={2} aria-hidden="true" />
            Preview{poolDate ? ` · with ${displayDate(poolDate)}’s stories` : ''}
          </p>
          <p className="cz-read">≈ {readingMinutes(storyCount || prefs.count, prefs.format)} min read</p>
        </div>
        <div className="cz-panel">
          <div className="hp-mail-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/trace.webp" alt="" className="hp-mail-logo" />
            <div>
              <p className="hp-mail-name">Trace Daily Brief</p>
              <p className="hp-mail-promise">100% free <i>·</i> Every morning <i>·</i> Unsubscribe anytime</p>
            </div>
          </div>
          <div className="cz-paper">
            <div className="cz-paper-head">
              <p>{storyCount || prefs.count} big things today</p>
            </div>
            <div className="cz-paper-body">
              {pool === null && <p className="cz-empty">Loading today&rsquo;s stories…</p>}
              {pool !== null && sections.length === 0 && (
                <p className="cz-empty">
                  Today&rsquo;s stories are not in yet. Your setup still saves; the preview fills in after the morning run.
                </p>
              )}
              {sections.map(([lane, stories], index) => {
                const first = sections.slice(0, index).reduce((sum, [, group]) => sum + group.length, 0);
                const hide = !showAll ? 'cz-hide-sm' : '';
                return (
                  <section key={`${lane}-${index}`} className={`cz-section ${first >= PHONE_PREVIEW ? hide : ''}`}>
                    <p className="cz-kicker"><span>{laneKicker(lane)}</span></p>
                    {stories.map((story, i) => (
                      <article key={story.topic_id} className={`cz-story ${first + i >= PHONE_PREVIEW ? hide : ''}`}>
                        <p className="cz-meta">
                          <span className="cz-favs" aria-hidden="true">
                            {(story.sources ?? []).slice(0, 3).map((domain) => (
                              // eslint-disable-next-line @next/next/no-img-element -- publisher favicons
                              <img key={domain} src={faviconUrl(domain, 32)} alt="" width={18} height={18} loading="lazy" />
                            ))}
                          </span>
                          <a href={story.url} target="_blank" rel="noopener noreferrer">
                            {story.source_name}
                          </a>
                          {story.source_count > 1 && <span>· {story.source_count} sources</span>}
                        </p>
                        <p className="cz-title">
                          <a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}</a>
                        </p>
                        {prefs.format !== 'headlines' && bodyParagraphs(story.summary).map((para, i) => (
                          <p key={i} className="cz-sum">{para}</p>
                        ))}
                        {prefs.format === 'images' && story.image && (
                          // eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails, as in the email
                          <img
                            src={story.image}
                            alt=""
                            loading="lazy"
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                            className="cz-img"
                          />
                        )}
                      </article>
                    ))}
                  </section>
                );
              })}
              {!showAll && storyCount > PHONE_PREVIEW && (
                <button type="button" onClick={() => setShowAll(true)} className="cz-more">
                  Show all {storyCount} stories
                </button>
              )}
            </div>
          </div>
        </div>
        {backfilled && (
          <p className="cz-note">
            Not enough news in your topics today, so the rest comes from the biggest stories elsewhere.
          </p>
        )}
      </div>
    </div>
  );
}
