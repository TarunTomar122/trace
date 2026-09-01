import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Waveform } from './Waveform';
import { fmtDuration } from '../lib/mock';
import type { Episode } from '../lib/types';

export function AudioPlayer({ episode, variant = 'hero' }: { episode: Episode; variant?: 'hero' | 'row' }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(episode.durationSec);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => setDur(a.duration || episode.durationSec);
    const onEnd = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [episode.durationSec]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    a.currentTime = pct * dur;
    setCur(a.currentTime);
  };

  const pct = dur ? (cur / dur) * 100 : 0;

  if (variant === 'row') {
    return (
      <div className="flex items-center gap-3">
        <audio ref={ref} src={episode.audioUrl} preload="none" />
        <button
          onClick={toggle}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-bg transition hover:bg-accent active:scale-95"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" onClick={seek} role="progressbar">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtDuration(dur - cur)}</span>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      <audio ref={ref} src={episode.audioUrl} preload="metadata" />
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent text-white shadow-soft transition hover:bg-accent-dark active:scale-95"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-1" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[15px] font-semibold text-ink">{episode.title}</p>
            <Waveform playing={playing} bars={9} className="h-4 shrink-0" />
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            Today’s brief · {fmtDuration(dur)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="font-mono text-xs text-muted tabular-nums">{fmtDuration(cur)}</span>
        <div
          className="group h-2 flex-1 cursor-pointer overflow-hidden rounded-full bg-line"
          onClick={seek}
          role="progressbar"
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-xs text-muted tabular-nums">-{fmtDuration(dur - cur)}</span>
        <button
          onClick={() => {
            if (ref.current) ref.current.currentTime = 0;
          }}
          className="text-muted transition hover:text-ink"
          aria-label="Restart"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
