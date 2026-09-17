'use client';

import { useEffect, useState } from 'react';
import {
  Bell, Check, Chrome, Clock, Flame, Share2, Sparkles, Star, X, Zap,
  MessageCircle, Bot, TrendingUp,
} from 'lucide-react';
import type { FeedStory, PulseItem } from '../FeedApp';
import {
  buildCaughtUpShareText,
  buildCaughtUpShareUrl,
  buildHeatmapDays,
  CAT_DISPLAY,
  CHROME_EXTENSION_URL,
  dismissExtensionCta,
  editionNumber,
  formatEditionCountdown,
  formatEditionDate,
  isExtensionCtaDismissed,
  isSunday,
  msUntilNextEdition,
  type ReadingStreak,
  type SinceLastVisitSummary,
  type WeeklyWrapSummary,
} from '@/lib/retention';

export const retentionCss = `
.xw .ret-edition-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 16px; margin: 0 0 8px; border: 1px solid var(--line); border-radius: 14px;
  background: linear-gradient(135deg, #f7fbff 0%, #fff 60%);
}
.xw .ret-edition-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.xw .ret-edition-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--blue); }
.xw .ret-edition-title { font-size: 15px; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
.xw .ret-edition-sub { font-size: 12.5px; color: var(--text-2); }
.xw .ret-countdown {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 9999px; background: #fff; border: 1px solid var(--line);
  font-size: 12px; font-weight: 700; color: var(--text-2);
}
.xw .ret-since {
  margin: 0 0 10px; padding: 12px 14px; border-radius: 14px;
  border: 1px solid rgba(29, 155, 240, 0.22); background: rgba(29, 155, 240, 0.06);
}
.xw .ret-since-title { margin: 0 0 4px; font-size: 14px; font-weight: 800; color: var(--text); }
.xw .ret-since-sub { margin: 0; font-size: 13px; line-height: 1.45; color: var(--text-2); }
.xw .ret-sotd {
  margin: 0 0 12px; padding: 14px 16px; border-radius: 16px;
  border: 1px solid rgba(249, 24, 128, 0.2); background: linear-gradient(135deg, #fff5fa 0%, #fff 55%);
  cursor: pointer; text-align: left; width: 100%;
  transition: border-color var(--t-quick), transform var(--t-quick);
}
.xw .ret-sotd:hover { border-color: rgba(249, 24, 128, 0.45); transform: translateY(-1px); }
.xw .ret-sotd-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pink); margin-bottom: 6px; }
.xw .ret-sotd-title { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; color: var(--text); }
.xw .ret-sotd-meta { margin: 6px 0 0; font-size: 12.5px; color: var(--text-2); }
.xw .ret-streak-pill {
  display: inline-flex; align-items: center; gap: 5px; margin-left: 8px;
  padding: 4px 10px; border-radius: 9999px; background: rgba(255, 122, 0, 0.1);
  color: #e65100; font-size: 12px; font-weight: 800;
}
.xw .ret-streak-pill.side { margin: 8px 0 0; margin-left: 0; width: fit-content; }
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
  margin: 0 0 20px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: #fafbfc;
}
.xw .ret-pulse-hook-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.xw .ret-pulse-hook-title { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-2); }
.xw .ret-pulse-hook-item {
  display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-top: 1px solid var(--line);
  text-decoration: none; color: inherit;
}
.xw .ret-pulse-hook-item:first-of-type { border-top: none; padding-top: 0; }
.xw .ret-pulse-hook-item strong { display: block; font-size: 14px; font-weight: 700; line-height: 1.3; }
.xw .ret-pulse-hook-item span { font-size: 12px; color: var(--text-2); }
.xw .ret-heatmap { margin-bottom: 16px; padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: #fafbfc; }
.xw .ret-heatmap-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.xw .ret-heatmap-streak { display: flex; align-items: center; gap: 6px; font-size: 22px; font-weight: 800; }
.xw .ret-heatmap-streak span { font-size: 13px; font-weight: 600; color: var(--text-2); }
.xw .ret-heatmap-best { font-size: 12px; color: var(--text-3); }
.xw .ret-heatmap-grid { display: flex; flex-wrap: wrap; gap: 4px; }
.xw .ret-heatmap-dot { width: 12px; height: 12px; border-radius: 3px; background: rgba(0,0,0,0.07); }
.xw .ret-heatmap-dot.on { background: #ff7a00; }
.xw .ret-weekly { margin-bottom: 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(0, 186, 124, 0.25); background: rgba(0, 186, 124, 0.06); }
.xw .ret-weekly-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--green); margin-bottom: 6px; }
.xw .ret-weekly-title { margin: 0 0 6px; font-size: 16px; font-weight: 800; letter-spacing: -0.02em; }
.xw .ret-weekly-sub { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-2); }
.xw .ret-agent-card { margin-bottom: 16px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: linear-gradient(135deg, #f8f5ff 0%, #fff 70%); }
.xw .ret-agent-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 800; margin-bottom: 4px; }
.xw .ret-agent-sub { margin: 0 0 10px; font-size: 13px; line-height: 1.45; color: var(--text-2); }
.xw .ret-email-banner {
  margin: 0 0 10px; padding: 12px 14px; border-radius: 14px;
  border: 1px solid rgba(0, 186, 124, 0.3); background: rgba(0, 186, 124, 0.07);
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
.xw .ret-email-banner p { margin: 0; font-size: 13px; line-height: 1.4; color: var(--text-2); }
.xw .ret-email-banner b { color: var(--text); }
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
.xw .ret-streak-pill.mobile-head { display: none; }
.xw .ret-stack { display: flex; flex-direction: column; gap: 8px; }
@media (max-width: 1100px) {
  .xw .ret-streak-pill.side { display: none; }
  .xw .ret-streak-pill.mobile-head { display: inline-flex; margin: 0; flex-shrink: 0; }
}
@media (max-width: 687px) {
  .xw .head { flex-wrap: wrap; height: auto; min-height: 53px; padding: 8px 14px; gap: 6px 10px; }
  .xw .head-meta { margin-left: 0; font-size: 12px; }
  .xw .head .sort-seg { margin-left: auto; }
  .xw .ret-stack { padding: 0 14px; gap: 10px; }
  .xw .feed .ret-launchpad,
  .xw .feed .ret-pulse-hook { margin-left: 14px; margin-right: 14px; width: calc(100% - 28px); box-sizing: border-box; }
  .xw .ret-edition-bar {
    flex-direction: column; align-items: stretch; gap: 10px;
    margin: 0; padding: 12px 14px;
  }
  .xw .ret-countdown { width: 100%; justify-content: center; box-sizing: border-box; }
  .xw .ret-edition-title { font-size: 14px; line-height: 1.3; }
  .xw .ret-edition-sub { font-size: 12px; }
  .xw .ret-since, .xw .ret-email-banner, .xw .ret-sotd, .xw .ret-pulse-hook, .xw .ret-launchpad { margin: 0; }
  .xw .ret-sotd { padding: 12px 14px; }
  .xw .ret-sotd-title { font-size: 16px; }
  .xw .ret-launchpad { padding: 20px 16px; margin-bottom: 20px; }
  .xw .ret-launchpad-actions { max-width: none; width: 100%; }
  .xw .ret-btn { width: 100%; min-height: 44px; box-sizing: border-box; }
  .xw .ret-email-banner { flex-direction: column; align-items: stretch; }
  .xw .ret-thread-btn { min-height: 28px; padding: 4px 10px; }
  .xw .ret-heatmap, .xw .ret-weekly, .xw .ret-agent-card { margin-left: 0; margin-right: 0; }
  .xw .ret-milestone-overlay {
    padding: 16px; padding-bottom: calc(16px + env(safe-area-inset-bottom));
    align-items: flex-end;
  }
  .xw .ret-milestone-card { border-radius: 20px 20px 0 0; width: 100%; max-width: none; }
}
`;

export function EditionBar({ feedDate, storyCount }: { feedDate: string; storyCount: number }) {
  const [countdown, setCountdown] = useState(() => formatEditionCountdown(msUntilNextEdition()));

  useEffect(() => {
    const tick = () => setCountdown(formatEditionCountdown(msUntilNextEdition()));
    const id = window.setInterval(tick, 30000);
    tick();
    return () => window.clearInterval(id);
  }, []);

  const num = editionNumber(feedDate);
  const label = formatEditionDate(feedDate);

  return (
    <div className="ret-edition-bar">
      <div className="ret-edition-main">
        <span className="ret-edition-kicker">Today&apos;s edition</span>
        <span className="ret-edition-title">Edition #{num} · {label}</span>
        <span className="ret-edition-sub">{storyCount} stories ranked across outlets</span>
      </div>
      <span className="ret-countdown" title="Next edition drops at 10:30 Europe/Berlin">
        <Clock size={14} /> {countdown}
      </span>
    </div>
  );
}

export function SinceLastVisitBanner({ summary }: { summary: SinceLastVisitSummary }) {
  if (summary.isFirstVisit) {
    return (
      <div className="ret-since">
        <p className="ret-since-title">Welcome to today&apos;s edition</p>
        <p className="ret-since-sub">
          {summary.totalNew > 0
            ? `${summary.totalNew} stories ranked for you — start with Story of the day below.`
            : 'Your ranked briefing is ready.'}
        </p>
      </div>
    );
  }
  if (summary.totalNew <= 0 && summary.updatedThreads <= 0) return null;

  const catLine = summary.byCategory
    .slice(0, 3)
    .map(({ cat, count }) => `${count} in ${CAT_DISPLAY[cat] || cat}`)
    .join(' · ');

  return (
    <div className="ret-since">
      <p className="ret-since-title">Since your last visit</p>
      <p className="ret-since-sub">
        {summary.totalNew > 0 ? (
          <><b>{summary.totalNew} new</b>{catLine ? ` — ${catLine}` : ''}</>
        ) : (
          'Your followed threads have updates'
        )}
        {summary.updatedThreads > 0 ? ` · ${summary.updatedThreads} ongoing ${summary.updatedThreads === 1 ? 'story' : 'stories'}` : ''}
      </p>
    </div>
  );
}

export function EmailEditionBanner({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className="ret-email-banner">
      <p><b>From your morning brief</b> — today&apos;s ranked edition is ready.</p>
      {onDismiss ? (
        <button className="ret-thread-btn" onClick={onDismiss} aria-label="Dismiss">
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}

export function StoryOfDayCard({ story, onOpen }: { story: FeedStory; onOpen: () => void }) {
  return (
    <button type="button" className="ret-sotd" onClick={onOpen}>
      <div className="ret-sotd-kicker"><Star size={12} fill="currentColor" /> Story of the day</div>
      <p className="ret-sotd-title">{story.title}</p>
      <p className="ret-sotd-meta">
        #{story.rank}
        {story.sources.length > 1 ? ` · ${story.sources.length} sources` : ''}
        {story.threadId ? ' · Ongoing' : ''}
      </p>
    </button>
  );
}

export function StreakPill({ streak, className = '' }: { streak: number; className?: string }) {
  if (streak <= 0) return null;
  return (
    <span className={`ret-streak-pill${className ? ` ${className}` : ''}`}>
      <Flame size={14} fill="currentColor" /> {streak}-day streak
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
  return (
    <div className="ret-pulse-hook">
      <div className="ret-pulse-hook-head">
        <span className="ret-pulse-hook-title"><Zap size={13} /> Afternoon pulse</span>
        <button type="button" className="ret-thread-btn on" onClick={onOpen}>See all</button>
      </div>
      {items.slice(0, 2).map((item) => (
        <a
          key={item.id}
          className="ret-pulse-hook-item"
          href={item.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => { e.preventDefault(); onOpenItem(item); }}
        >
          <MessageCircle size={14} style={{ marginTop: 2, flexShrink: 0, color: '#1d9bf0' }} />
          <span>
            <strong>{item.title}</strong>
            <span>{item.signal || item.source}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

export function ActivityHeatmapPanel({ streak }: { streak: ReadingStreak | null }) {
  if (!streak) return null;
  const days = buildHeatmapDays(streak.streak_history || []);
  return (
    <div className="ret-heatmap">
      <div className="ret-heatmap-head">
        <div className="ret-heatmap-streak">
          <Flame size={18} color="#ff7a00" fill="#ff7a00" />
          {streak.current_streak}
          <span>day streak</span>
        </div>
        {streak.longest_streak > 0 ? (
          <span className="ret-heatmap-best">best {streak.longest_streak}</span>
        ) : null}
      </div>
      <div className="ret-heatmap-grid">
        {days.map((d) => (
          <span key={d.date} className={`ret-heatmap-dot${d.active ? ' on' : ''}`} title={d.date} />
        ))}
      </div>
    </div>
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

export function AgentRetentionCard({ pro }: { pro: boolean }) {
  return (
    <div className="ret-agent-card">
      <div className="ret-agent-title"><Bot size={16} /> Morning briefings in your agent</div>
      <p className="ret-agent-sub">
        {pro
          ? 'Connect Claude, Codex, or Cursor to the same ranked feed — one read-only MCP call for your standup.'
          : 'Pro connects your AI agent to the ranked edition, Pulse, and archive over MCP.'}
      </p>
      <a className="ret-btn secondary" href="/agents" style={{ display: 'inline-flex', width: 'auto' }}>
        <Sparkles size={14} /> {pro ? 'Agent setup' : 'See how it works'}
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
