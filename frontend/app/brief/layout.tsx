import type { CSSProperties, ReactNode } from 'react';

// The homepage's palette (lib/home-css.ts, after join1440.com), so /brief reads
// as the same site. The site-wide theme tokens are re-pointed here, which
// restyles every Tailwind utility inside without touching the rest of the site.
const BRIEF_THEME = {
  '--background': '#ffffff',
  '--foreground': '#0a0a0a',
  '--primary': '#0a0a0a',
  '--primary-foreground': '#ffffff',
  '--secondary': '#606060',
  '--border': '#e5e5e5',
  '--surface': '#ffffff',
  '--surface-secondary': '#f7f7f8',
  '--accent': '#1634cc',
  '--accent-foreground': '#ffffff',
  '--footer-bg': '#ffffff',
  '--footer-line': '#e5e5e5',
  backgroundColor: '#ffffff',
  color: '#0a0a0a',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as CSSProperties;

export default function BriefLayout({ children }: { children: ReactNode }) {
  return <div style={BRIEF_THEME}>{children}</div>;
}
