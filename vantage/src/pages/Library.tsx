import { useState } from 'react';
import { Search, Check } from 'lucide-react';
import { MOCK_EPISODES, fmtDate, fmtDuration } from '../lib/mock';
import { AudioPlayer } from '../components/AudioPlayer';

export default function Library() {
  const [q, setQ] = useState('');
  const eps = MOCK_EPISODES.filter(
    (e) =>
      !q ||
      e.title.toLowerCase().includes(q.toLowerCase()) ||
      e.topics.join(' ').toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="h-display text-[1.8rem] leading-tight sm:text-4xl">Your briefs</h1>
          <p className="mt-1.5 text-[14.5px] text-muted">Every morning, kept. Search or scroll back.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-10"
            placeholder="Search briefs & topics"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {eps.map((e) => (
          <article key={e.id} className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-muted">{fmtDate(e.date)}</p>
              <div className="flex items-center gap-2">
                {e.listened && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Check size={13} className="text-accent" /> Played
                  </span>
                )}
                <span className="pill-quiet">{fmtDuration(e.durationSec)}</span>
              </div>
            </div>
            <h2 className="h-display mt-1.5 text-xl leading-snug">{e.title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{e.blurb}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {e.topics.map((t) => (
                <span key={t} className="pill-quiet">{t}</span>
              ))}
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <AudioPlayer episode={e} variant="row" />
            </div>
          </article>
        ))}
        {eps.length === 0 && (
          <div className="card py-16 text-center text-muted">No briefs match “{q}”.</div>
        )}
      </div>
    </div>
  );
}
