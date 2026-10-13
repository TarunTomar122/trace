'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight, Bell, Check, Chrome, Flame, Share2, Sparkles, Star, Zap,
  Bot, TrendingUp,
} from 'lucide-react';
import type { FeedStory, PulseItem } from '../FeedApp';
import {
  buildCaughtUpShareText,
  buildCaughtUpShareUrl,
  buildHeatmapDays,
  CHROME_EXTENSION_URL,
  dismissExtensionCta,
  isExtensionCtaDismissed,
  isSunday,
  type ReadingStreak,
  type WeeklyWrapSummary,
} from '@/lib/retention';

export const retentionCss = `
.xw .ret-sotd {
  margin: 0; padding: 22px 0 26px;
  border: none; border-bottom: 1px solid var(--line); border-radius: 0;
  background: transparent; font-family: inherit; color: inherit;
  cursor: pointer; text-align: left; width: 100%;
  box-sizing: border-box;
  transition: background-color 0.2s ease;
}
.xw .ret-sotd:hover { background: var(--hover); }
.xw .ret-sotd:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.xw .ret-sotd-kicker {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0 18px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--pink); margin: 0 0 16px;
}
.xw .ret-sotd-shot {
  display: block; width: 100%; max-width: none; height: 340px;
  margin: 0 0 22px; object-fit: cover; object-position: center 28%;
  border-radius: 0; background: var(--hover);
}
.xw .ret-sotd-copy { min-width: 0; padding: 0 18px; }
.xw .ret-sotd-title {
  display: block; margin: 0;
  font-size: 28px; font-weight: 800; letter-spacing: -0.035em;
  line-height: 1.16; color: var(--text);
}
.xw .ret-sotd-dek {
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden; margin: 10px 0 0;
  font-size: 16px; line-height: 1.45; color: var(--text-2);
}
.xw .ret-sotd-meta {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px;
  margin: 12px 0 0; font-size: 13px; font-weight: 600; color: var(--text-2);
}
.xw .ret-sotd-faves { display: inline-flex; align-items: center; }
.xw .ret-sotd-faves img {
  width: 16px; height: 16px; border-radius: 9999px; background: #fff;
  box-shadow: 0 0 0 1px var(--line);
}
.xw .ret-sotd-faves img + img { margin-left: -5px; }
.xw .ret-sotd.lead .ret-sotd-title { font-size: 28px; letter-spacing: -0.035em; }
.xw .ret-sotd.lead .ret-sotd-dek { font-size: 16px; -webkit-line-clamp: 3; }
.xw .ret-streak-slot {
  padding: 0 12px 8px; flex-shrink: 0;
}
.xw .ret-streak-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 9999px; background: rgba(255, 122, 0, 0.1);
  color: #e65100; font-size: 12px; font-weight: 800; line-height: 1;
  width: max-content; max-width: 100%; box-sizing: border-box; white-space: nowrap;
}
.xw aside.side .ret-streak-slot { display: block; }
.xw header.head .ret-streak-pill { display: none; }
.xw .ret-thread-btn {
  display: inline-flex; align-items: center; gap: 4px; margin-left: 6px;
  padding: 2px 8px; border-radius: 9999px; border: 1px solid var(--line);
  background: #fff; font-size: 11px; font-weight: 700; color: var(--text-2); cursor: pointer;
}
.xw .ret-thread-btn.on { border-color: rgba(29, 155, 240, 0.45); color: var(--blue); background: rgba(29, 155, 240, 0.08); }
.xw .ret-launchpad {
  margin: 10px 0 30px; padding: 24px 20px; text-align: center;
  border: 1px solid var(--line); border-radius: 18px; background: var(--bg);
}
.xw .ret-launchpad-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 9999px; background: var(--green); color: #fff; margin-bottom: 12px;
}
.xw .ret-launchpad-title { margin: 0 0 6px; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
.xw .ret-launchpad-sub { margin: 0 0 18px; font-size: 14px; color: var(--text-2); }
.xw .ret-launchpad-actions { display: flex; flex-direction: column; gap: 10px; max-width: 320px; margin: 0 auto; }
.xw .ret-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 16px; border-radius: 9999px; border: none; font-size: 14px; font-weight: 800;
  cursor: pointer; text-decoration: none; transition: opacity var(--t-quick);
}
.xw .ret-btn.primary { background: var(--blue); color: #fff; }
.xw .ret-btn.primary:hover { background: #1a8cd8; }
.xw .ret-btn.secondary { background: #fff; color: var(--text); border: 1px solid var(--line); }
.xw .ret-btn.secondary:hover { background: var(--hover); }
.xw .ret-btn.ghost { background: transparent; color: var(--text-2); border: 1px dashed var(--line); }
.xw .ret-btn:disabled { opacity: 0.65; cursor: wait; }
.xw .ret-pulse-hook {
  margin: 0; padding: 0;
  border: none; border-radius: 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: transparent; overflow: visible;
}
.xw .ret-pulse-hook-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--line);
}
.xw .ret-pulse-hook-kicker {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pink);
}
.xw .ret-pulse-hook-tagline { font-size: 12px; font-weight: 600; color: var(--text-3); letter-spacing: 0; text-transform: none; }
.xw .ret-pulse-hook-link {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 0; border: none; background: transparent;
  font-size: 13px; font-weight: 700; color: var(--blue); cursor: pointer;
  font-family: inherit; white-space: nowrap;
}
.xw .ret-pulse-hook-link:hover { text-decoration: underline; }
.xw .ret-pulse-hook-item {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 16px 18px;
  border-top: 1px solid var(--line);
  text-decoration: none; color: inherit;
  transition: background var(--t-quick);
}
.xw .ret-pulse-hook-item:first-of-type { border-top: none; }
.xw .ret-pulse-hook-item:hover { background: var(--hover); }
.xw .ret-pulse-hook-item:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.xw .ret-pulse-hook-thumb {
  flex: 0 0 88px; width: 88px; height: 88px; object-fit: cover;
  object-position: center 30%;
  border-radius: 14px; display: block; background: var(--hover);
  box-shadow: 0 0 0 1px rgba(15, 20, 25, 0.06);
}
.xw .ret-pulse-hook-thumb-fallback {
  display: flex; align-items: center; justify-content: center;
  background: #fff4ee;
}
.xw .ret-pulse-hook-fav { width: 28px; height: 28px; border-radius: 8px; }
.xw .ret-pulse-hook-copy { flex: 1; min-width: 0; }
.xw .ret-pulse-hook-rank {
  margin-left: auto; padding-left: 12px;
  font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums;
  color: var(--text-3);
}
.xw .ret-pulse-hook-body strong {
  display: block; font-size: 16px; font-weight: 800; letter-spacing: -0.02em;
  line-height: 1.35; color: var(--text);
}
.xw .ret-pulse-hook-dek {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; margin-top: 6px;
  font-size: 13.5px; font-weight: 500; line-height: 1.45; color: var(--text-2);
}
.xw .ret-pulse-hook-meta {
  display: flex; align-items: center; gap: 8px;
  margin-top: 8px; font-size: 13px; font-weight: 600; color: var(--text-2);
}
.xw .ret-heatmap {
  margin: 0; padding: 14px 18px 16px;
  border: none; border-radius: 0;
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  background: transparent;
}
.xw .ret-heatmap-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  margin-bottom: 10px;
}
.xw .ret-heatmap-kicker {
  font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: #e65100;
}
.xw .ret-heatmap-streak {
  display: flex; align-items: center; gap: 6px;
  margin: 0 0 10px; padding: 0;
  font-size: 15px; font-weight: 800; letter-spacing: -0.02em; color: var(--text);
}
.xw .ret-heatmap-streak strong { font-size: 16px; font-weight: 800; }
.xw .ret-heatmap-streak span { font-size: 14px; font-weight: 600; color: var(--text-2); }
.xw .ret-heatmap-best { font-size: 12px; font-weight: 600; color: var(--text-3); }
.xw .ret-heatmap-grid {
  display: grid; grid-template-columns: repeat(15, 1fr); gap: 3px;
  max-width: 280px;
}
.xw .ret-heatmap-dot {
  width: 100%; aspect-ratio: 1; border-radius: 0;
  background: var(--line);
}
.xw .ret-heatmap-dot.on { background: #ff7a00; }
.xw .ret-weekly { margin-bottom: 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(0, 186, 124, 0.25); background: rgba(0, 186, 124, 0.06); }
.xw .ret-weekly-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--green); margin-bottom: 6px; }
.xw .ret-weekly-title { margin: 0 0 6px; font-size: 16px; font-weight: 800; letter-spacing: -0.02em; }
.xw .ret-weekly-sub { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-2); }
.xw .ret-agent-card { margin-bottom: 16px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: linear-gradient(135deg, #f8f5ff 0%, #fff 70%); }
.xw .ret-agent-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 800; margin-bottom: 4px; }
.xw .ret-agent-sub { margin: 0 0 10px; font-size: 13px; line-height: 1.45; color: var(--text-2); }
.xw .ret-milestone-overlay {
  position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center;
  background: rgba(15, 20, 25, 0.55); padding: 20px;
}
.xw .ret-milestone-card {
  width: min(360px, 100%); padding: 28px 24px; border-radius: 20px; background: #fff; text-align: center;
  box-shadow: 0 24px 60px rgba(0,0,0,0.18);
}
.xw .ret-milestone-flame { font-size: 48px; line-height: 1; margin-bottom: 8px; }
.xw .ret-milestone-title { margin: 0 0 6px; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.xw .ret-milestone-sub { margin: 0 0 18px; font-size: 14px; color: var(--text-2); line-height: 1.45; }
@media (max-width: 1100px) {
  .xw aside.side .ret-streak-slot { display: none; }
  .xw header.head .ret-streak-pill { display: inline-flex; margin: 0; flex-shrink: 0; }
}
@media (max-width: 687px) {
  .xw .head { flex-wrap: wrap; height: auto; min-height: 53px; padding: 8px 14px; gap: 6px 10px; }
  .xw .head-meta { margin-left: 0; font-size: 12px; }
  .xw .head .sort-seg { margin-left: auto; }
  .xw .feed .ret-launchpad { margin-left: 14px; margin-right: 14px; width: calc(100% - 28px); box-sizing: border-box; }
  .xw .ret-pulse-hook { margin: 0; }
  .xw .ret-pulse-hook-head { padding: 12px 14px 10px; }
  .xw .ret-pulse-hook-item { padding: 14px; gap: 12px; }
  .xw .ret-pulse-hook-thumb { flex-basis: 76px; width: 76px; height: 76px; border-radius: 12px; }
  .xw .ret-sotd { margin: 0; padding: 18px 0 22px; width: 100%; }
  .xw .ret-sotd, .xw .ret-launchpad { margin-top: 0; }
  .xw .ret-sotd-kicker { padding: 0 14px; margin-bottom: 14px; }
  .xw .ret-sotd-shot { width: 100%; max-width: none; height: 240px; margin: 0 0 18px; }
  .xw .ret-sotd-copy { padding: 0 14px; }
  .xw .ret-sotd-title { font-size: 22px; }
  .xw .ret-sotd-dek { font-size: 14.5px; -webkit-line-clamp: 2; }
  .xw .ret-sotd.lead .ret-sotd-title { font-size: 22px; }
  .xw .ret-launchpad { padding: 20px 16px; margin-bottom: 20px; }
  .xw .ret-launchpad-actions { max-width: none; width: 100%; }
  .xw .ret-btn { width: 100%; min-height: 44px; box-sizing: border-box; }
  .xw .ret-thread-btn { min-height: 28px; padding: 4px 10px; }
  .xw .ret-heatmap { padding: 12px 14px 14px; }
  .xw .ret-heatmap-grid { max-width: none; gap: 2px; }
  .xw .ret-weekly, .xw .ret-agent-card { margin-left: 0; margin-right: 0; }
  .xw .ret-milestone-overlay {
    padding: 16px; padding-bottom: calc(16px + env(safe-area-inset-bottom));
    align-items: flex-end;
  }
  .xw .ret-milestone-card { border-radius: 20px 20px 0 0; width: 100%; max-width: none; }
}
@media (prefers-reduced-motion: reduce) {
  .xw .ret-sotd { transition: none; }
}
`;

export function storyDek(story: FeedStory): string {
  const raw = String(story.body || story.takeaways.find(Boolean) || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Feed cards are previews: the full story opens on click.
  if (!raw) return '';
  if (raw.length <= 220) return raw;
  const cut = raw.slice(0, 220);
  const at = cut.lastIndexOf(' ');
  return `${(at > 140 ? cut.slice(0, at) : cut).trim()}…`;
}

export function StoryOfDayCard({
  story,
  onOpen,
  kicker = 'Story of the day',
  size = 'hero',
  following = false,
  onToggleFollow,
}: {
  story: FeedStory;
  onOpen: () => void;
  kicker?: string;
  size?: 'hero' | 'lead';
  following?: boolean;
  onToggleFollow?: () => void;
}) {
  const dek = storyDek(story);
  const favs = story.sources.slice(0, 4);
  return (
    <button type="button" className={`ret-sotd${size === 'lead' ? ' lead' : ''}`} onClick={onOpen}>
      <div className="ret-sotd-kicker"><Star size={12} fill="currentColor" /> {kicker}</div>
      {story.img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="ret-sotd-shot"
          src={story.img}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      ) : null}
      <div className="ret-sotd-copy">
        <span className="ret-sotd-title">{story.title}</span>
        {dek ? (
          <span className="ret-sotd-dek">{dek}</span>
        ) : null}
        <span className="ret-sotd-meta">
          {favs.length > 0 ? (
            <span className="ret-sotd-faves" aria-hidden="true">
              {favs.map((domain) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={domain} src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" />
              ))}
            </span>
          ) : null}
          {story.source ? <span>{story.source}</span> : null}
          {story.time ? <span>· {story.time}</span> : null}
          {story.sources.length > 1 ? <span>· {story.sources.length} sources</span> : null}
          {story.threadId ? (
            <>
              <span>· Ongoing</span>
              {onToggleFollow ? (
                <ThreadFollowButton
                  threadId={story.threadId}
                  following={following}
                  onToggle={onToggleFollow}
                />
              ) : null}
            </>
          ) : null}
        </span>
      </div>
    </button>
  );
}

export function StreakPill({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <span className="ret-streak-pill">
      <Flame size={14} fill="currentColor" aria-hidden="true" />
      {streak}-day streak
    </span>
  );
}

export function ThreadFollowButton({
  threadId,
  following,
  onToggle,
}: {
  threadId: string;
  following: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`ret-thread-btn${following ? ' on' : ''}`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={following}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}

export function CaughtUpLaunchpad({
  streak,
  storiesRead,
  dailyOn,
  dailyBusy,
  onToggleDaily,
  onShare,
  onOpenPulse,
  showExtension,
  onDismissExtension,
  pulsePreview,
}: {
  streak: number;
  storiesRead: number;
  dailyOn: boolean;
  dailyBusy?: boolean;
  onToggleDaily: () => void;
  onShare: () => void;
  onOpenPulse: () => void;
  showExtension: boolean;
  onDismissExtension: () => void;
  pulsePreview: PulseItem[];
}) {
  return (
    <div className="ret-launchpad">
      <span className="ret-launchpad-badge"><Check size={18} /></span>
      <p className="ret-launchpad-title">You&apos;re all caught up</p>
      <p className="ret-launchpad-sub">
        {streak > 1
          ? `${streak}-day reading streak — keep it going tomorrow morning.`
          : 'A fresh edition lands every morning at 10:30 Europe/Berlin.'}
      </p>
      <div className="ret-launchpad-actions">
        {!dailyOn ? (
          <button type="button" className="ret-btn primary" onClick={onToggleDaily} disabled={dailyBusy}>
            <Bell size={16} /> Get tomorrow&apos;s brief by email
          </button>
        ) : (
          <span className="ret-btn ghost" style={{ cursor: 'default' }}>
            <Check size={16} /> Daily brief is on — see you tomorrow
          </span>
        )}
        {showExtension ? (
          <a
            className="ret-btn secondary"
            href={CHROME_EXTENSION_URL}
            target="_blank"
            rel="noreferrer"
            onClick={onDismissExtension}
          >
            <Chrome size={16} /> Trace in every new tab
          </a>
        ) : null}
        <button type="button" className="ret-btn secondary" onClick={onShare}>
          <Share2 size={16} /> Share your catch-up
        </button>
        {pulsePreview.length > 0 ? (
          <button type="button" className="ret-btn secondary" onClick={onOpenPulse}>
            <TrendingUp size={16} /> Browse Pulse while you wait
          </button>
        ) : null}
      </div>
    </div>
  );
}

function pulseHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function PulseHookThumb({ item }: { item: PulseItem }) {
  const [failed, setFailed] = useState(false);
  if (item.img && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="ret-pulse-hook-thumb"
        src={item.img}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  const host = pulseHost(item.url);
  return (
    <span className="ret-pulse-hook-thumb ret-pulse-hook-thumb-fallback" aria-hidden="true">
      {host ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ret-pulse-hook-fav" src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" />
      ) : null}
    </span>
  );
}

export function PulseAfternoonHook({
  items,
  onOpen,
  onOpenItem,
}: {
  items: PulseItem[];
  onOpen: () => void;
  onOpenItem: (item: PulseItem) => void;
}) {
  if (!items.length) return null;
  const preview = items.slice(0, 2);
  return (
    <section className="ret-pulse-hook" aria-label="Pulse trending">
      <div className="ret-pulse-hook-head">
        <span className="ret-pulse-hook-kicker">
          <Zap size={12} fill="currentColor" />
          Pulse
          <span className="ret-pulse-hook-tagline">· trending now</span>
        </span>
        <button type="button" className="ret-pulse-hook-link" onClick={onOpen}>
          See all <ArrowRight size={14} />
        </button>
      </div>
      {preview.map((item, i) => (
        <a
          key={item.id}
          className="ret-pulse-hook-item"
          href={item.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => { e.preventDefault(); onOpenItem(item); }}
        >
          <PulseHookThumb item={item} />
          <span className="ret-pulse-hook-copy">
            <span className="ret-pulse-hook-body">
              <strong>{item.title}</strong>
              {item.sum || item.sub ? (
                <span className="ret-pulse-hook-dek">{item.sum || item.sub}</span>
              ) : null}
              <span className="ret-pulse-hook-meta">
                {item.signal || item.source}
                <span className="ret-pulse-hook-rank">#{i + 1}</span>
              </span>
            </span>
          </span>
        </a>
      ))}
    </section>
  );
}

export function ActivityHeatmapPanel({ streak }: { streak: ReadingStreak | null }) {
  if (!streak) return null;
  const days = buildHeatmapDays(streak.streak_history || []);
  const count = streak.current_streak;
  return (
    <section className="ret-heatmap" aria-label="Reading streak">
      <div className="ret-heatmap-head">
        <span className="ret-heatmap-kicker">Last 30 days</span>
        {streak.longest_streak > 0 ? (
          <span className="ret-heatmap-best">Best {streak.longest_streak}</span>
        ) : null}
      </div>
      <p className="ret-heatmap-streak">
        <Flame size={15} color="#ff7a00" fill="#ff7a00" aria-hidden="true" />
        <strong>{count}</strong>
        <span>day streak</span>
      </p>
      <div className="ret-heatmap-grid" role="img" aria-label={`${days.filter((d) => d.active).length} active days in the last 30`}>
        {days.map((d) => (
          <span key={d.date} className={`ret-heatmap-dot${d.active ? ' on' : ''}`} title={d.date} />
        ))}
      </div>
    </section>
  );
}

export function WeeklyWrapPanel({ wrap }: { wrap: WeeklyWrapSummary | null }) {
  if (!wrap || !wrap.headline) return null;
  if (!isSunday() && !wrap.summary) return null;
  return (
    <div className="ret-weekly">
      <div className="ret-weekly-kicker">Your week in tech</div>
      <p className="ret-weekly-title">{wrap.headline}</p>
      <p className="ret-weekly-sub">
        {wrap.summary || `${wrap.total_articles} stories across ${wrap.top_topics.slice(0, 3).join(', ') || 'your topics'}.`}
        {wrap.fun_stat ? ` ${wrap.fun_stat}` : ''}
      </p>
    </div>
  );
}

export function AgentRetentionCard() {
  return (
    <div className="ret-agent-card">
      <div className="ret-agent-title"><Bot size={16} /> Morning briefings in your agent</div>
      <p className="ret-agent-sub">
        Connect Claude, Codex, or Cursor to the same ranked feed — one read-only MCP call for your standup. Free.
      </p>
      <a className="ret-btn secondary" href="/agents" style={{ display: 'inline-flex', width: 'auto' }}>
        <Sparkles size={14} /> Agent setup
      </a>
    </div>
  );
}

export function MilestoneModal({ days, onClose }: { days: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ret-milestone-overlay" onClick={onClose}>
      <div className="ret-milestone-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ret-milestone-flame">🔥</div>
        <p className="ret-milestone-title">{days}-day streak!</p>
        <p className="ret-milestone-sub">
          You&apos;ve caught up on tech {days} mornings in a row. That&apos;s the habit.
        </p>
        <button type="button" className="ret-btn primary" onClick={onClose} style={{ width: '100%' }}>
          Keep it going
        </button>
      </div>
    </div>
  );
}

export function useCaughtUpShare(streak: number, storiesRead: number): () => void {
  return () => {
    const text = buildCaughtUpShareText(streak, storiesRead);
    const url = buildCaughtUpShareUrl();
    if (navigator.share) {
      void navigator.share({ title: 'Trace', text, url }).catch(() => {
        void navigator.clipboard?.writeText(`${text}\n${url}`);
      });
      return;
    }
    void navigator.clipboard?.writeText(`${text}\n${url}`);
  };
}

export function shouldShowExtensionCta(uid?: string | null): boolean {
  return !isExtensionCtaDismissed(uid);
}

export { dismissExtensionCta };
