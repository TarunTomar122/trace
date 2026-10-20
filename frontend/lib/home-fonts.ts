import localFont from 'next/font/local';
import { Caveat } from 'next/font/google';

/**
 * The site's display serif, after join1440.com's Freight Display Compressed:
 * Roboto Serif (OFL) at its narrowest width and display optical size. Two
 * static instances from Google Fonts (opsz 144, wdth 50) at ~28 KB each; the
 * variable file is ~380 KB.
 */
export const displaySerif = localFont({
  src: [
    { path: './fonts/roboto-serif-display-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/roboto-serif-display-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-hp-serif',
  display: 'swap',
  fallback: ['Times New Roman', 'serif'],
});

/** Handwritten notes ("How we do it"). Not preloaded: it is decoration. */
export const handFont = Caveat({ subsets: ['latin'], weight: '600', variable: '--font-hp-hand', display: 'swap', preload: false });

/** Class names that define --font-hp-serif and --font-hp-hand on an element. */
export const HOME_FONT_VARS = `${displaySerif.variable} ${handFont.variable}`;
