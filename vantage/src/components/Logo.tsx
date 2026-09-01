import { Link } from 'react-router-dom';
import { BRAND } from '../lib/brand';

export function Mark({ size = 32, className = '' }: { size?: number; className?: string }) {
  const bars = [
    { x: 8, y: 13, h: 6 },
    { x: 12.5, y: 9, h: 14 },
    { x: 17, y: 6, h: 20 },
    { x: 21.5, y: 11, h: 10 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#17140f" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width="2.6" height={b.h} rx="1.3" fill="#e8542a" />
      ))}
    </svg>
  );
}

export function Logo({ dark = false, to = '/' }: { dark?: boolean; to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5">
      <Mark />
      <span
        className={`font-display text-[1.35rem] font-semibold tracking-tight ${dark ? 'text-bg' : 'text-ink'}`}
      >
        {BRAND.wordmark}
      </span>
    </Link>
  );
}
