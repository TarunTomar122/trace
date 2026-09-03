'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { resolveFeedAccess } from '@/lib/subscription-access';
import { updateUserProfile } from '@/lib/firestore';
import ProCheckoutButton from './ProCheckoutButton';
import { bodyParagraphs } from '@/lib/body-text';
import {
  Bookmark, Share, ArrowLeft, User, Check, Star,
  Home, Sparkles, TrendingUp, Rocket, Code2, Cpu, PenTool, MessageCircle, BookOpen, Lock,
  type LucideIcon,
} from 'lucide-react';

export interface CoverageLink {
  title: string;
  source: string;
  url: string;
  time: string;
}

export interface FeedStory {
  id: string;
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
  cat: string;
  url: string;
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
  role: string;
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

const ROLE_LABELS: Record<string, string> = {
  engineer: 'Engineer',
  designer: 'Designer',
  founder: 'Founder',
  pm: 'Product',
  investor: 'Investor',
  student: 'Student',
};

const ALL_INTERESTS = ['ai', 'markets', 'ux-design', 'engineering', 'tech', 'startups', 'security', 'open-source', 'policy'];
const FREE_LIMIT = 5;

function mapRole(r?: string | null): string {
  const s = (r || '').toLowerCase();
  if (s.includes('founder')) return 'founder';
  if (s.includes('design')) return 'designer';
  if (s.includes('product')) return 'pm';
  if (s.includes('invest')) return 'investor';
  if (s.includes('student') || s.includes('learn')) return 'student';
  return 'engineer';
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split('**');
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>));
}

export default function FeedApp({
  stories, pulse, generated, serverPro = false,
}: {
  stories: FeedStory[];
  pulse: { tools: PulseItem[]; discussions: PulseItem[]; blogs: PulseItem[] };
  generated: string | null;
  serverPro?: boolean;
}) {
  const { user, profile: authProfile, loading: authLoading, profileResolved, profileFresh, profileRefreshFailed, signInWithGoogle, signOut, refreshProfile } = useAuth();
  const access = resolveFeedAccess({
    serverHasAccess: false,
    clientProfile: authProfile,
    clientProfileFresh: profileFresh,
    clientProfileRefreshFailed: profileRefreshFailed,
    authLoading,
    signedIn: !!user,
  });
  const pro = serverPro || access.hasAccess;
  const accessPending = access.pending;
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const storyParam = params.get('story');
  const pulseParam = params.get('pulse');

  const [tab, setTab] = useState<string>('all');
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const savedScroll = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profile, setProfile] = useState<Profile>({ name: '', email: '', role: 'engineer', interests: [] });
  const [savedProfile, setSavedProfile] = useState<Profile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);

  // hydrate bookmarks from the real store when signed in (same store the app uses)
  useEffect(() => {
    if (!user) { setMarks(new Set()); return; }
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/bookmarks?limit=100', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const ids = (data.bookmarks || []).map((b: { item_id?: string }) => b.item_id).filter(Boolean);
        setMarks(new Set(ids));
      } catch { /* offline is fine, local state still works */ }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const hydrated = {
      name: user.displayName || authProfile?.name || 'Reader',
      email: user.email || '',
      role: mapRole(authProfile?.role),
      interests: (authProfile?.interests as string[]) || [],
    };
    setProfile(hydrated);
    setSavedProfile(hydrated);
  }, [user, authProfile]);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') goBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (authLoading) {
    return (
      <div className="xw">
        <style>{css}</style>
        <div style={{ margin: 'auto', color: 'var(--text-3)', fontSize: 14 }}>Checking your membership…</div>
      </div>
    );
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
    if (mainRef.current) savedScroll.current = mainRef.current.scrollTop;
    router.push(`${base()}?story=${encodeURIComponent(s.id)}`, { scroll: false });
  }
  function openPulseItem(t: PulseItem) {
    if (mainRef.current) savedScroll.current = mainRef.current.scrollTop;
    router.push(`${base()}?pulse=${encodeURIComponent(t.id)}`, { scroll: false });
  }
  function goBack() {
    router.push(base(), { scroll: false });
  }
  function go(t: string) {
    setTab(t);
    router.push(base(), { scroll: false });
  }

  function share(id: string) {
    const url = `${window.location.origin}/story/${id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => showToast('Link copied — anyone can open this story'),
        () => showToast(url),
      );
    } else showToast(url);
  }

  async function saveProfile() {
    if (!user || savingProfile) return;
    setSavingProfile(true);
    try {
      // store the human-readable role label so mapRole() round-trips on reload
      await updateUserProfile(user.uid, {
        role: ROLE_LABELS[profile.role] || profile.role,
        interests: profile.interests,
      } as Parameters<typeof updateUserProfile>[1]);
      await refreshProfile().catch(() => null);
      setSavedProfile(profile);
      showToast('Profile saved — tomorrow’s feed uses it');
    } catch {
      showToast('Could not save profile — try again');
    } finally {
      setSavingProfile(false);
    }
  }

  async function toggleMark(id: string) {
    const isMarked = marks.has(id);
    setMarks((cur) => {
      const next = new Set(cur);
      if (isMarked) next.delete(id); else next.add(id);
      return next;
    });
    showToast(isMarked ? 'Removed from Bookmarks' : 'Added to Bookmarks');
    if (!user) return; // signed out: local only
    const meta = stories.find((s) => s.id === id) || allPulse.find((t) => t.id === id);
    try {
      const token = await user.getIdToken();
      if (isMarked) {
        await fetch(`/api/bookmarks?item_ids=${encodeURIComponent(id)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: id,
            item_metadata: {
              title: meta?.title || id,
              type: 'article',
              url: meta?.url || '',
              thumbnail: meta?.img || undefined,
              source: meta?.source || '',
              description: ('sum' in (meta ?? {}) ? (meta as PulseItem).sum : (meta as FeedStory | undefined)?.body || '').slice(0, 500),
            },
          }),
        });
      }
    } catch { showToast('Could not sync bookmark'); }
  }

  const counts: Record<string, number> = {};
  for (const s of stories) counts[s.cat] = (counts[s.cat] || 0) + 1;
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const isProfile = tab === 'profile';
  const visible = tab === 'all' ? stories : stories.filter((s) => s.cat === tab);
  const open = storyParam ? stories.find((s) => s.id === storyParam) || null : null;
  const allPulse = [...pulse.tools, ...pulse.discussions, ...pulse.blogs];
  const openPulse = pulseParam ? allPulse.find((t) => t.id === pulseParam) || null : null;
  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);

  const isFree = !pro;
  const full = isFree ? visible.slice(0, FREE_LIMIT) : visible;
  const locked = isFree ? visible.slice(FREE_LIMIT) : [];
  const teasers = locked.slice(0, 4);

  const markedStories = stories.filter((s) => marks.has(s.id));
  const markedPulse = allPulse.filter((t) => marks.has(t.id));

  // detail view open? (URL-driven)
  const detailOpen = !!open || !!openPulse;

  return (
    <div className="xw">
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
          <nav className="nav">
            <NavItem icon={Home} label="Home" active={tab === 'all'} onClick={() => go('all')} />
            {cats.map((c) => {
              const Icon = CAT_ICONS[c] || Sparkles;
              return <NavItem key={c} icon={Icon} label={CAT_LABELS[c] || c} active={tab === c} onClick={() => go(c)} />;
            })}
            <NavItem icon={MessageCircle} label="Conversations" active={tab === 'conversations'} onClick={() => go('conversations')} />
            <NavItem icon={BookOpen} label="Worth reading" active={tab === 'reading'} onClick={() => go('reading')} />
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
              <button className="signin-btn" onClick={() => signInWithGoogle()}>
                <User size={18} /> Sign in
              </button>
            )}
          </div>
          <p className="side-foot">{stories.length} stories · ranked</p>
        </div>
      </aside>

      {/* center rail */}
      <main className="main" ref={mainRef}>
        {openPulse ? (
          !pro && !pulse.blogs.some((b) => b.id === openPulse.id) ? <PaywallPlate what="Pulse — the builders' radar" lockedCount={0} /> : (
            <PulseDetail item={openPulse} onBack={goBack} onShare={share} marked={marks.has(openPulse.id)} toggleMark={toggleMark} />
          )
        ) : open ? (
          !pro && open.rank > FREE_LIMIT ? (
            <PaywallPlate what="This story" lockedCount={0} />
          ) : (
            <Detail story={open} onBack={goBack} onShare={share} marked={marks.has(open.id)} toggleMark={toggleMark} />
          )
        ) : isProfile ? (
          <ProfileView
            profile={profile} setProfile={setProfile} storyCount={stories.length}
            dirty={dirty} saving={savingProfile} onSave={saveProfile}
            pro={pro} onBack={() => go('all')}
            user={user ? { displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null}
            authProfile={authProfile}
            onSignOut={() => { signOut(); go('all'); }}
            onSignIn={() => signInWithGoogle()}
          />
        ) : tab === 'bookmarks' ? (
          <>
            <header className="head">
              <h1 className="head-title">Bookmarks</h1>
              <span className="head-meta">{markedStories.length + markedPulse.length}</span>
            </header>
            <div className="feed">
              {markedStories.length === 0 && markedPulse.length === 0 && (
                <div className="empty">
                  <p className="empty-title">Nothing saved yet</p>
                  <p className="empty-sub">Tap the bookmark on any story and it lands here.</p>
                </div>
              )}
              {markedStories.map((s) => (
                <article key={s.id} className="post" onClick={() => openStory(s)}>
                  <div className="post-meta">
                    <SourceStack sources={s.sources} />
                    <span className="post-src">{s.source}</span>
                    <span className="post-time">{s.time}</span>
                    {s.sources.length > 1 && <span className="post-group">· {s.sources.length} sources</span>}
                    <span className="post-spacer" />
                    <span className="post-rank">#{s.rank}</span>
                  </div>
                  <h2 className="post-title">{s.title}</h2>
                  {s.img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="post-img" src={s.img} alt="" loading="lazy" decoding="async" />
                  )}
                  <Actions id={s.id} size={18} marked={marks.has(s.id)} onToggleMark={toggleMark} onShare={share} />
                </article>
              ))}
              {markedPulse.map((t) => (
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
            </div>
          </>
        ) : tab === 'conversations' ? (
          <>
            <PulseFeed
              items={pulse.discussions}
              title="Conversations"
              mode="inline"
              marks={marks} toggleMark={toggleMark} share={share}
            />
            {/* mobile only: Worth reading lives inside the Pulse tab */}
            <div className="pulse-mobile-extra">
              <PulseFeed
                items={pulse.blogs}
                title="Worth reading"
                mode="detail"
                onOpen={openPulseItem}
                marks={marks} toggleMark={toggleMark} share={share}
              />
            </div>
          </>
        ) : tab === 'reading' ? (
          <PulseFeed
            items={pulse.blogs}
            title="Worth reading"
            mode="detail"
            onOpen={openPulseItem}
            marks={marks} toggleMark={toggleMark} share={share}
          />
        ) : (
          <>
            <header className="head">
              <h1 className="head-title">{tab === 'all' ? 'Home' : CAT_LABELS[tab] || tab}</h1>
              <span className="head-meta">{isFree ? `5 of ${visible.length}` : visible.length}</span>
            </header>
            <div className="feed">
              {full.map((s) => (
                <article key={s.id} className="post" onClick={() => openStory(s)}>
                  <div className="post-meta">
                    <SourceStack sources={s.sources} />
                    <span className="post-src">{s.source}</span>
                    <span className="post-time">{s.time}</span>
                    {s.sources.length > 1 && <span className="post-group">· {s.sources.length} sources</span>}
                    <span className="post-spacer" />
                    <span className="post-rank">#{s.rank}</span>
                  </div>
                  <h2 className="post-title">{s.title}</h2>
                  {s.img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="post-img" src={s.img} alt="" loading="lazy" decoding="async" />
                  )}
                  <Actions id={s.id} size={18} marked={marks.has(s.id)} onToggleMark={toggleMark} onShare={share} />
                </article>
              ))}

              {isFree && locked.length > 0 && (
                <>
                  {teasers.map((s) => (
                    <div key={s.id} className="post locked">
                    <div className="post-meta">
                      <SourceStack sources={s.sources} />
                      <span className="post-time">{s.time}</span>
                      {s.sources.length > 1 && <span className="post-group">· {s.sources.length} sources</span>}
                      <span className="post-spacer" />
                      <span className="post-rank">#{s.rank}</span>
                    </div>
                      <h2 className="post-title locked-title">{s.title}</h2>
                      <p className="lock-note"><Lock size={13} /> Unlock with Pro</p>
                    </div>
                  ))}
                  <PaywallPlate what="the full ranked feed" lockedCount={locked.length} />
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* right rail: two pulse cards */}
      <aside className="right">
        <div className="rail">
          <div className="rail-head">
            <h2 className="rail-title">Tools</h2>
            <span className="rail-meta">{generated ? `upd ${generated}` : 'hourly'}</span>
          </div>
          <RailSection items={pulse.tools} />
        </div>
      </aside>

      {/* mobile bottom nav */}
      <nav className="bottom-nav">
        <button className={`bn-item${tab === 'all' ? ' on' : ''}`} onClick={() => go('all')}><Home size={24} /><span>Home</span></button>
        <button className={`bn-item${tab === 'conversations' ? ' on' : ''}`} onClick={() => go('conversations')}><MessageCircle size={24} /><span>Pulse</span></button>
        <button className={`bn-item${tab === 'bookmarks' ? ' on' : ''}`} onClick={() => go('bookmarks')}><Bookmark size={24} /><span>Saved</span></button>
        <button className={`bn-item${isProfile ? ' on' : ''}`} onClick={() => go('profile')}><User size={24} /><span>Profile</span></button>
      </nav>

      {toast && <div className="toast">{toast}</div>}
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

function RailSection({ items }: { items: PulseItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="rail-items">
      {items.map((t) => (
        <a key={t.id} className="pulse-row" href={t.url} target="_blank" rel="noreferrer">
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
      ))}
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

function Actions({ id, size = 18, marked, onToggleMark, onShare }: {
  id: string; size?: number; marked: boolean;
  onToggleMark: (id: string) => void; onShare: (id: string) => void;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="actions" onClick={stop}>
      <button
        className={`act act-mark${marked ? ' on' : ''}`}
        onClick={() => onToggleMark(id)}
        aria-label={marked ? 'Remove bookmark' : 'Bookmark this story'}
        aria-pressed={marked}
      >
        <span className="act-ic"><Bookmark size={size} fill={marked ? 'currentColor' : 'none'} /></span>
      </button>
      <button className="act act-share" onClick={() => onShare(id)} aria-label="Share this story">
        <span className="act-ic"><Share size={size} /></span>
      </button>
    </div>
  );
}

function PulseFeed({ items, title, mode, onOpen, marks, toggleMark, share }: {
  items: PulseItem[]; title: string; mode: 'inline' | 'detail'; onOpen?: (t: PulseItem) => void;
  marks: Set<string>; toggleMark: (id: string) => void; share: (id: string) => void;
}) {
  return (
    <>
      <header className="head">
        <h1 className="head-title">{title}</h1>
        <span className="head-meta">{items.length}</span>
      </header>
      <div className="feed">
        {items.map((t) => (
          <article
            key={t.id}
            className="post"
            onClick={mode === 'detail' && onOpen ? () => onOpen(t) : undefined}
            style={mode === 'detail' && onOpen ? { cursor: 'pointer' } : undefined}
          >
            <div className="post-meta">
              {domainOf(t.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="fav-solo" src={`https://www.google.com/s2/favicons?domain=${domainOf(t.url)}&sz=64`} alt="" loading="lazy" />
              ) : null}
              <span className="post-src">{t.source}</span>
              {t.signal && <span className="signal">{t.signal}</span>}
              <span className="post-spacer" />
            </div>
            <h2 className="post-title">
              {mode === 'inline' ? (
                <a className="post-link" href={t.url} target="_blank" rel="noreferrer">{t.title}</a>
              ) : (
                t.title
              )}
            </h2>
            {mode === 'inline' && (t.sum || t.sub) ? <p className="post-desc">{t.sum || t.sub}</p> : null}
            {t.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="post-img" src={t.img} alt="" loading="lazy" decoding="async" />
            )}
            <Actions id={t.id} size={18} marked={marks.has(t.id)} onToggleMark={toggleMark} onShare={share} />
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
        {item.img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="detail-img" src={item.img} alt="" />
        )}
        <h1 className="detail-title">{item.title}</h1>
        {bodyParagraphs(item.sum).map((para, pi) => (
          <p key={pi} className="detail-body" style={pi > 0 ? { marginTop: 14 } : undefined}>{renderBold(para)}</p>
        ))}
        <div className="detail-actions">
          <Actions id={item.id} size={20} marked={marked} onToggleMark={toggleMark} onShare={onShare} />
        </div>
        <a className="detail-link" href={item.url} target="_blank" rel="noreferrer">Open at {item.source} ›</a>
      </div>
    </>
  );
}

function Detail({ story, onBack, onShare, marked, toggleMark }: { story: FeedStory; onBack: () => void; onShare: (id: string) => void; marked: boolean; toggleMark: (id: string) => void }) {
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
          <span className="post-spacer" />
          <span className="post-rank">#{story.rank}</span>
        </div>
        <h1 className="detail-title">{story.title}</h1>
        {story.img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="detail-img" src={story.img} alt="" />
        )}
        {bodyParagraphs(story.body).map((para, pi) => (
          <p key={pi} className="detail-body" style={pi > 0 ? { marginTop: 14 } : undefined}>{renderBold(para)}</p>
        ))}
        {story.takeaways.length > 0 && (
          <div className="detail-takeaways">
            <h2 className="section-label">Key points</h2>
            <ul className="takeaway-list">
              {story.takeaways.map((t, j) => (
                <li key={j}>{renderBold(t)}</li>
              ))}
            </ul>
          </div>
        )}
        {story.coverage.length > 0 && (
          <div className="detail-coverage">
            <h2 className="section-label">Coverage · {story.coverage.length} sources</h2>
            <ol className="coverage-list">
              {story.coverage.map((c, j) => (
                <li key={`${c.url}-${j}`}>
                  <a className="coverage-row" href={c.url} target="_blank" rel="noreferrer">
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
        <div className="detail-actions">
          <Actions id={story.id} size={20} marked={marked} onToggleMark={toggleMark} onShare={onShare} />
        </div>
      </div>
    </>
  );
}

function PaywallPlate({ what, lockedCount }: { what: string; lockedCount: number }) {
  return (
    <div className="paywall">
      <div className="paywall-badge"><Lock size={20} /></div>
      <h2 className="paywall-title">This one&rsquo;s for Pro</h2>
      <p className="paywall-sub">
        {what === "the full ranked feed"
          ? <>You&rsquo;ve read the 5 free stories for today. <b>More ranked stories</b> are waiting, plus full summaries, Pulse and your profile.</>
          : <>{what} is part of <b>Trace Pro</b> — the whole day, ranked and summarized, every morning.</>}
      </p>
      <ProCheckoutButton className="paywall-btn" />
      <p className="paywall-foot">Cancel anytime. Daily brief by email, every morning.</p>
    </div>
  );
}

function ProfileView({ profile, setProfile, storyCount, dirty, saving, onSave, pro, onBack, user, authProfile, onSignOut, onSignIn }: {
  profile: Profile; setProfile: (p: Profile) => void; storyCount: number;
  dirty: boolean; saving: boolean; onSave: () => void; pro: boolean; onBack: () => void;
  user: { displayName: string | null; email: string | null; photoURL: string | null } | null;
  authProfile: any; onSignOut: () => void; onSignIn: () => void;
}) {
  const bio = `${ROLE_LABELS[profile.role] || 'Builder'} following ${profile.interests.length} topics. ${storyCount} stories ranked today.`;

  function toggleInterest(t: string) {
    setProfile({
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
          <h1 className="head-title">{profile.name}</h1>
          <p className="head-sub">{storyCount} stories today</p>
        </div>
      </header>
      <div className="detail profile">
        <div className="banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://picsum.photos/seed/${encodeURIComponent(user?.email || 'trace')}/1200/320`}
            alt=""
            loading="lazy"
          />
        </div>
        <div className="avatar-row">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="avatar" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/trace.webp" alt="" className="avatar" />
          )}
          <div className="avatar-actions">
            {user ? (
              <button className="save-btn" onClick={onSignOut}>Sign out</button>
            ) : (
              <button className="save-btn primary" onClick={onSignIn}>Sign in with Google</button>
            )}
            {user && (dirty || saving) && (
              <button className="save-btn primary" onClick={onSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
        </div>
        <div className="profile-id">
          <h1 className="profile-name">{user ? (user.displayName || profile.name) : 'Signed out'}</h1>
          <p className="profile-handle">{user ? `@${(user.email || '').split('@')[0]}` : 'Sign in to personalize your feed'}</p>
          <p className="profile-bio">{bio}</p>
          <div className="profile-stats">
            <span><b>{storyCount}</b> stories today</span>
            <span className="post-dot">·</span>
            <span><b>{profile.interests.length}</b> interests</span>
            <span className="post-dot">·</span>
            <span><b>7</b> sources followed</span>
          </div>
        </div>

        <div className="profile-section">
          <h2 className="section-label">Your role</h2>
          <div className="chip-row">
            {Object.entries(ROLE_LABELS).map(([id, label]) => (
              <button key={id} className={`pick${profile.role === id ? ' on' : ''}`} onClick={() => setProfile({ ...profile, role: id })}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <h2 className="section-label">Your interests</h2>
          <div className="chip-row">
            {ALL_INTERESTS.map((t) => (
              <button key={t} className={`pick${profile.interests.includes(t) ? ' on' : ''}`} onClick={() => toggleInterest(t)}>
                {CAT_LABELS[t] || t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <p className="section-hint">Tomorrow&rsquo;s feed is ranked around these.</p>
        </div>

        <div className="profile-section">
          <h2 className="section-label">Membership</h2>
            <div className="chip-row">
              <span className="pick on">{pro ? "Pro member" : "Free plan"}</span>
              {!pro && <a className="pick" href="https://www.yourtrace.online/subscribe" target="_blank" rel="noreferrer">Go Pro — $3/mo</a>}
            </div>
            <p className="section-hint">Pro unlocks the whole day, Pulse and your profile.</p>
          </div>
      </div>
    </>
  );
}

const css = `
.xw {
  --bg: #ffffff;
  --text: #0f1419;
  --text-2: #536471;
  --text-3: #71767b;
  --line: #eff3f4;
  --hover: #f7f9f9;
  --blue: #1d9bf0;
  --green: #00ba7c;
  --pink: #f91880;
  background: var(--bg);
  color: var(--text);
  height: 100vh; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 15px; line-height: 20px;
  display: flex; justify-content: center;
}

/* mobile bottom nav */
.xw .bottom-nav { display: none; }
@media (max-width: 687px) {
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
  .xw .main { width: 100%; max-width: 100%; border-left: none; border-right: none; }
  .xw .post { padding: 14px 14px 4px; }
  .xw .post-title { font-size: 17px; }
  .xw .post-img { border-radius: 12px; margin-top: 8px; }
  .xw .feed { padding-bottom: 104px; }
  .xw .detail { padding-bottom: 112px; }
  .xw .head { padding: 0 14px; }
  .xw .detail-body { margin: 10px 14px 4px; }
  .xw .detail-title { margin: 8px 14px 4px; font-size: 21px; }
  .xw .detail-img { width: calc(100% - 28px); margin: 10px 14px 4px; }
  .xw .detail-actions { padding: 2px 14px; }
  .xw .detail-link { margin: 14px; }
  .xw .detail-byline { padding: 14px 14px 0; }
  .xw .detail-takeaways { margin: 12px 14px 4px; }
}

/* left sidebar */
.xw .side { width: 275px; flex-shrink: 0; height: 100vh; }
@media (max-width: 1100px) { .xw .side { display: none; } }
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
.xw .nav-div { height: 1px; background: var(--line); margin: 10px 12px; }
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
.xw .head-spacer { width: 34px; }
.xw .back {
  width: 34px; height: 34px; border-radius: 9999px; border: none;
  background: transparent; color: var(--text); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background-color 0.2s ease; margin-left: -8px;
}
.xw .back:hover { background-color: var(--line); }

@media (max-width: 687px) {
  .xw .post { padding: 14px 14px 4px; }
  .xw .post-title { font-size: 17px; }
  .xw .post-img { border-radius: 12px; margin-top: 8px; }
  .xw .feed { padding-bottom: 104px; }
  .xw .detail { padding-bottom: 112px; }
  .xw .head { padding: 0 14px; }
  .xw .detail-body { margin: 10px 14px 4px; }
  .xw .detail-title { margin: 8px 14px 4px; font-size: 21px; }
  .xw .detail-img { width: calc(100% - 28px); margin: 10px 14px 4px; }
  .xw .detail-sources { margin: 0 14px 4px; }
  .xw .detail-actions { padding: 2px 14px; }
  .xw .detail-link { margin: 14px; }
  .xw .detail-byline { padding: 14px 14px 0; }
  .xw .detail-takeaways { margin: 12px 14px 4px; }
}

/* post card */
.xw .post {
  padding: 14px 18px 6px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .post:hover { background-color: var(--hover); }
.xw .post.locked { cursor: default; }
.xw .post.locked:hover { background: transparent; }
.xw .post-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.xw .post-src { font-size: 13px; font-weight: 700; color: var(--text-2); }
.xw .post-time { font-size: 13px; color: var(--text-3); }
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
.xw .pulse-mobile-extra { display: none; }
@media (max-width: 687px) { .xw .pulse-mobile-extra { display: block; } }
.xw .post-title { margin: 0 0 4px; font-size: 18px; font-weight: 700; line-height: 23px; }
.xw .locked-title { filter: blur(4px); user-select: none; }
.xw .lock-note { display: flex; align-items: center; gap: 6px; margin: 8px 0 10px; font-size: 13px; font-weight: 650; color: var(--text-2); }
.xw .post-img {
  width: 100%; max-height: 510px; object-fit: cover;
  border-radius: 16px; margin: 10px 0 6px; display: block;
}
.xw .post-sources { margin: 8px 0 0; font-size: 13px; line-height: 16px; color: var(--text-3); }
.xw .post-sum { margin: 6px 0 0; font-size: 14px; line-height: 20px; color: var(--text-2); }
.xw .feed { padding-bottom: 96px; }

/* favicon stack */
.xw .stack { display: inline-flex; align-items: center; }
.xw .fav {
  width: 20px; height: 20px; border-radius: 50%;
  background: #fff; border: 2px solid #fff;
  box-shadow: 0 0 0 1px var(--line);
  object-fit: contain;
}
.xw .fav + .fav { margin-left: -8px; }

/* actions */
.xw .actions { display: flex; justify-content: flex-end; gap: 4px; max-width: 100%; margin-top: 2px; }
.xw .act {
  display: inline-flex; align-items: center; gap: 2px;
  border: none; background: transparent; cursor: pointer;
  color: var(--text-3); font-size: 13px; padding: 0;
}
.xw .act-ic {
  width: 34.75px; height: 34.75px; border-radius: 9999px;
  display: flex; align-items: center; justify-content: center;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.xw .act-mark:hover .act-ic, .xw .act-share:hover .act-ic { background-color: rgba(29, 155, 240, 0.1); color: var(--blue); }
.xw .act-mark.on .act-ic { color: var(--blue); }

/* detail view */
.xw .detail { padding-bottom: 48px; }
.xw .detail-byline { display: flex; align-items: center; gap: 8px; padding: 16px 18px 0; }
.xw .detail-src { font-size: 15px; font-weight: 700; }
.xw .detail-title { margin: 10px 18px 4px; font-size: 23px; font-weight: 700; line-height: 28px; }
.xw .detail-img { width: calc(100% - 36px); max-height: 510px; object-fit: cover; border-radius: 16px; margin: 12px 18px 4px; }
.xw .detail-sources { margin: 0 18px 4px; font-size: 13px; line-height: 16px; color: var(--text-3); }
.xw .detail-body { margin: 12px 18px 4px; font-size: 16px; line-height: 25px; color: var(--text); }
.xw .detail-takeaways { margin: 14px 18px 14px; border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px 18px; background: var(--hover); }
.xw .detail-takeaways .section-label { margin-left: 2px; }
.xw .detail-takeaways .section-label { margin: 0 0 8px; }
.xw .takeaway-list { margin: 0; padding: 0; list-style: none; }
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
.xw .paywall { margin: 3rem auto; max-width: 30rem; text-align: center; padding: 0 24px; }
.xw .paywall-badge {
  width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 18px;
  background: rgba(29, 155, 240, 0.1); color: var(--blue);
  display: flex; align-items: center; justify-content: center;
}
.xw .paywall-title { margin: 0 0 8px; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
.xw .paywall-sub { margin: 0 auto 20px; font-size: 15px; line-height: 22px; color: var(--text-2); max-width: 42ch; }
.xw .paywall-sub b { color: var(--ink); }
.xw .paywall-btn {
  display: inline-block; height: 46px; line-height: 46px; padding: 0 28px;
  border: none; border-radius: 9999px; background: var(--blue); color: #fff;
  font-size: 15px; font-weight: 700; text-decoration: none; font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.xw .paywall-btn:disabled { opacity: 0.7; cursor: wait; }
.xw .paywall-btn:hover { background: #1a8cd8; }
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
.xw .rail-stars { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 12px; font-weight: 600; line-height: 16px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.xw .rail-stars svg { flex-shrink: 0; }
.xw .rail-sig { font-size: 12.5px; font-weight: 600; color: var(--text-3); font-variant-numeric: tabular-nums; }
.xw .rail-sum { font-size: 13px; line-height: 19px; color: var(--text-2); }

/* profile view */
.xw .banner { height: 130px; overflow: hidden; background: var(--hover); border-bottom: 1px solid var(--line); }
.xw .banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
.xw .avatar-row { display: flex; align-items: flex-end; justify-content: space-between; padding: 0 18px; margin-top: -44px; }
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
.xw .profile-id { padding: 10px 18px 4px; }
.xw .profile-name { margin: 0; font-size: 23px; font-weight: 800; line-height: 28px; }
.xw .profile-handle { margin: 0 0 10px; font-size: 15px; color: var(--text-3); }
.xw .profile-bio { margin: 0 0 10px; font-size: 15px; line-height: 20px; }
.xw .profile-stats { display: flex; gap: 6px; align-items: baseline; font-size: 14px; color: var(--text-3); }
.xw .profile-stats b { color: var(--text); font-weight: 700; }
.xw .profile-section { padding: 16px 18px 4px; border-bottom: 1px solid var(--line); }
.xw .profile-section:last-child { border-bottom: none; }
.xw .section-label { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-2); }
.xw .chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 12px; }
.xw .pick {
  padding: 8px 16px; border-radius: 9999px; border: 1px solid var(--line);
  background: var(--bg); color: var(--text); font-size: 14px; font-weight: 600; cursor: pointer;
  transition: background-color 0.2s ease; text-decoration: none; display: inline-block;
}
.xw .pick:hover { background: var(--hover); }
.xw .pick.on { background: var(--line); border-color: var(--line); font-weight: 700; }
.xw .section-hint { margin: 0; padding: 0 0 14px; font-size: 13px; color: var(--text-3); }

/* empty state + toast */
.xw .empty { padding: 56px 24px; text-align: center; }
.xw .empty-title { margin: 0 0 6px; font-size: 21px; font-weight: 800; }
.xw .empty-sub { margin: 0; font-size: 15px; color: var(--text-2); }
.xw .toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  background: #0f1419; color: #fff; font-size: 14px; font-weight: 600;
  padding: 12px 20px; border-radius: 9999px; z-index: 900;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  animation: toast-in 0.2s ease-out; white-space: nowrap;
}
@keyframes toast-in { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
@media (prefers-reduced-motion: reduce) { .xw .toast { animation: none; } }
`;
