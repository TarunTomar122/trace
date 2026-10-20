import { OG_LOGO_DATA_URL } from './og-assets';
import { OG_FONT_BOLD_B64, OG_FONT_REGULAR_B64 } from './og-fonts';
import { OG_SERIF_500_B64, OG_SERIF_700_B64 } from './og-serif';

/**
 * Shared look for the share images (next/og): the site's palette, its display
 * serif for headings, Inter for text, and the wordmark ("Trace", then the logo).
 */
export const OG = {
  ink: '#0A0A0A',
  text: '#323232',
  muted: '#767676',
  line: '#E5E5E5',
  blue: '#1634CC',
  highlight: '#FFEF5F',
  serif: 'Trace Serif',
  sans: 'Inter',
} as const;

function fontFromB64(b64: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function ogFonts() {
  return [
    { name: OG.sans, data: fontFromB64(OG_FONT_REGULAR_B64), weight: 400 as const, style: 'normal' as const },
    { name: OG.sans, data: fontFromB64(OG_FONT_BOLD_B64), weight: 700 as const, style: 'normal' as const },
    { name: OG.serif, data: fontFromB64(OG_SERIF_500_B64), weight: 500 as const, style: 'normal' as const },
    { name: OG.serif, data: fontFromB64(OG_SERIF_700_B64), weight: 700 as const, style: 'normal' as const },
  ];
}

export function clip(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** "Trace" in the display serif, then the logo, as in the site header. */
export function OgWordmark({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span style={{ fontFamily: OG.serif, fontSize: size, fontWeight: 700, lineHeight: 1, color: OG.ink }}>Trace</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={OG_LOGO_DATA_URL} alt="" width={Math.round(size * 0.9)} height={Math.round(size * 0.9)} style={{ marginLeft: 10 }} />
    </div>
  );
}

/** A section label as the site draws it: the display serif on a highlighter mark. */
export function OgMark({ children, size = 22 }: { children: string; size?: number }) {
  return (
    <div style={{ display: 'flex' }}>
      <span style={{
        fontFamily: OG.serif, fontSize: size, fontWeight: 500, lineHeight: 1.3, color: OG.ink,
        backgroundColor: OG.highlight, padding: '0 6px',
      }}>
        {children}
      </span>
    </div>
  );
}
