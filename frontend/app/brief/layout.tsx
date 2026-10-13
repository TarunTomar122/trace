import type { CSSProperties, ReactNode } from 'react';

// The feed's palette and type (FeedApp .xw), so /brief reads as the same app.
// The site-wide theme tokens are re-pointed here, which restyles every
// Tailwind utility inside without touching the rest of the site.
const FEED_THEME = {
  '--background': '#ffffff',
  '--foreground': '#0f1419',
  '--primary': '#0f1419',
  '--primary-foreground': '#ffffff',
  '--secondary': '#536471',
  '--border': '#eff3f4',
  '--surface': '#ffffff',
  '--surface-secondary': '#f7f9f9',
  '--accent': '#1d9bf0',
  '--accent-foreground': '#ffffff',
  '--footer-bg': '#ffffff',
  '--footer-line': '#eff3f4',
  backgroundColor: '#ffffff',
  color: '#0f1419',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as CSSProperties;

export default function BriefLayout({ children }: { children: ReactNode }) {
  return <div style={FEED_THEME}>{children}</div>;
}
