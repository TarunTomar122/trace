/**
 * Homepage card art: a black-and-white object on graph paper with bright
 * cut-out shapes, drawn in SVG so it scales and costs no image requests.
 * Each card's palette comes from its colour (see lib/home-css.ts).
 */

const INK = '#181818';

function burst(cx: number, cy: number, outer: number, inner: number, points: number): string {
  return Array.from({ length: points * 2 }, (_, i) => {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 ? inner : outer;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

function sparkle(x: number, y: number, s: number): string {
  return `M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`;
}

function Paper({ id, line, rotate }: { id: string; line: string; rotate: number }) {
  return (
    <>
      <defs>
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" fill="none" stroke={line} strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="44" y="22" width="156" height="150" fill={`url(#${id})`} transform={`rotate(${rotate} 122 97)`} />
    </>
  );
}

export function BriefArt() {
  return (
    <svg viewBox="0 0 240 200" className="hp-art" aria-hidden="true">
      <Paper id="hp-paper-brief" line="#e6dd8a" rotate={-4} />
      <polygon points={burst(62, 150, 36, 14, 11)} fill="#ffe602" />
      <polygon points="186,26 216,72 194,66" fill="#ffe602" />
      <polygon points="34,44 66,62 46,70" fill="#ffe602" />
      <g transform="rotate(-6 124 110)" strokeLinejoin="round">
        <rect x="62" y="72" width="124" height="84" rx="6" fill="#d9d9d9" stroke={INK} strokeWidth="3" />
        <rect x="76" y="44" width="96" height="74" rx="3" fill="#fff" stroke={INK} strokeWidth="3" />
        <rect x="86" y="56" width="58" height="8" fill={INK} />
        <rect x="86" y="71" width="76" height="4" fill="#929292" />
        <rect x="86" y="81" width="64" height="4" fill="#929292" />
        <rect x="86" y="91" width="70" height="4" fill="#929292" />
        <path d="M62 94 L124 130 L186 94 V156 H62 Z" fill="#f4f4f4" stroke={INK} strokeWidth="3" />
        <path d="M62 156 L108 122 M186 156 L140 122" stroke={INK} strokeWidth="2.5" fill="none" />
      </g>
    </svg>
  );
}

export function FeedArt() {
  return (
    <svg viewBox="0 0 240 200" className="hp-art" aria-hidden="true">
      <Paper id="hp-paper-feed" line="#a9dfec" rotate={3} />
      <circle cx="176" cy="66" r="50" fill="#7edcf2" />
      <polygon points="30,62 82,98 26,116" fill="#2fc6ea" />
      <g strokeLinejoin="round">
        <rect x="68" y="58" width="128" height="112" rx="4" fill="#d9d9d9" stroke={INK} strokeWidth="3" transform="rotate(4 132 114)" />
        <rect x="56" y="48" width="128" height="112" rx="4" fill="#fff" stroke={INK} strokeWidth="3" />
        <rect x="68" y="60" width="104" height="10" fill={INK} />
        <rect x="68" y="78" width="50" height="38" fill="#c7c7c7" stroke={INK} strokeWidth="2" />
        <rect x="126" y="80" width="46" height="5" fill="#606060" />
        <rect x="126" y="91" width="38" height="5" fill="#606060" />
        <rect x="126" y="102" width="44" height="5" fill="#606060" />
        <rect x="68" y="124" width="104" height="5" fill="#929292" />
        <rect x="68" y="135" width="92" height="5" fill="#929292" />
        <rect x="68" y="146" width="98" height="5" fill="#929292" />
      </g>
    </svg>
  );
}

export function TabArt() {
  return (
    <svg viewBox="0 0 240 200" className="hp-art" aria-hidden="true">
      <Paper id="hp-paper-tab" line="#f2bde3" rotate={-3} />
      <polygon points="24,74 112,58 118,80 30,96" fill="#f48cd9" />
      <g strokeLinejoin="round">
        <rect x="46" y="50" width="152" height="114" rx="8" fill="#fff" stroke={INK} strokeWidth="3" />
        <path d="M46 72 H198 V58 a8 8 0 0 0 -8 -8 H54 a8 8 0 0 0 -8 8 Z" fill="#e5e5e5" stroke={INK} strokeWidth="3" />
        <circle cx="60" cy="61" r="3.5" fill={INK} />
        <circle cx="72" cy="61" r="3.5" fill={INK} />
        <circle cx="84" cy="61" r="3.5" fill={INK} />
        {[58, 103, 148].map((x) => (
          <g key={x}>
            <rect x={x} y="84" width="38" height="32" rx="3" fill="#c7c7c7" stroke={INK} strokeWidth="2" />
            <rect x={x} y="123" width="38" height="5" fill="#606060" />
            <rect x={x} y="133" width="28" height="5" fill="#929292" />
          </g>
        ))}
      </g>
      <path d={sparkle(200, 150, 22)} fill="#f48cd9" />
      <path d={sparkle(176, 176, 13)} fill="#eb2eba" />
    </svg>
  );
}

export function AgentArt() {
  return (
    <svg viewBox="0 0 240 200" className="hp-art" aria-hidden="true">
      <Paper id="hp-paper-agent" line="#b8eb98" rotate={4} />
      <polygon points="194,30 224,88 176,82" fill="#5ce308" />
      <g transform="translate(46 150)">
        {[0, 45, 90, 135].map((angle) => (
          <ellipse key={angle} cx="0" cy="0" rx="8" ry="24" fill="#4cbb07" transform={`rotate(${angle})`} />
        ))}
      </g>
      <g strokeLinejoin="round">
        <rect x="74" y="40" width="118" height="42" rx="14" fill="#fff" stroke={INK} strokeWidth="3" />
        <path d="M168 81 L180 94 L178 81" fill="#fff" stroke={INK} strokeWidth="3" />
        <rect x="88" y="54" width="72" height="5" fill="#606060" />
        <rect x="88" y="65" width="50" height="5" fill="#929292" />
        <rect x="56" y="96" width="132" height="64" rx="14" fill={INK} />
        <rect x="70" y="110" width="94" height="5" fill="#e5e5e5" />
        <rect x="70" y="121" width="82" height="5" fill="#bdbdbd" />
        <rect x="70" y="132" width="100" height="5" fill="#bdbdbd" />
        <rect x="70" y="143" width="62" height="5" fill="#bdbdbd" />
      </g>
      <path d={sparkle(58, 96, 12)} fill="#fff" stroke={INK} strokeWidth="2" />
    </svg>
  );
}

/** The two hand-drawn arrows around "How we do it". */
export function HandArrow({ variant }: { variant: 'in' | 'down' }) {
  return variant === 'in' ? (
    <svg viewBox="0 0 70 50" className="hp-hand-arrow hp-hand-arrow-in" aria-hidden="true">
      <path d="M6 8 C 12 30, 32 40, 60 34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M50 26 L61 34 L49 41" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 50 60" className="hp-hand-arrow hp-hand-arrow-down" aria-hidden="true">
      <path d="M8 6 C 34 6, 44 28, 26 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22 40 L25 53 L37 47" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
