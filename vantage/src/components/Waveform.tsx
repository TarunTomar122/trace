// Signature animated equalizer. Deterministic bar pattern so it looks intentional, not random.
const HEIGHTS = [0.4, 0.7, 1, 0.55, 0.85, 0.35, 0.95, 0.6, 0.75, 0.45, 1, 0.5, 0.8, 0.4, 0.65];

export function Waveform({
  playing = true,
  bars = 15,
  className = '',
  color = 'bg-accent',
}: {
  playing?: boolean;
  bars?: number;
  className?: string;
  color?: string;
}) {
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${color} ${playing ? 'eqbar' : ''}`}
          style={{
            height: `${HEIGHTS[i % HEIGHTS.length] * 100}%`,
            animationDelay: `${(i % HEIGHTS.length) * 90}ms`,
            opacity: playing ? 1 : 0.35,
          }}
        />
      ))}
    </div>
  );
}
