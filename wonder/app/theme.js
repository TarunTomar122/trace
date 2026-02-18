/**
 * App color palettes.
 *
 * Light (active)
 *   Pearl White   #FFFFFF  — background
 *   Cloud Grey    #F5F5F5  — cards / surfaces
 *   Ink Black     #0A0A0A  — primary text
 *   Acid Green    #CCFF00  — accent
 *
 * Dark (future)
 *   Void Black    #050505  — deep charcoal background
 *   Slate Grey    #1E1E1E  — cards / surfaces
 *   Text White    #F2F2F2  — primary readable text
 *   Acid Green    #CCFF00  — accent
 */

export const ACCENT = '#A8D400';

export const lightColors = {
  accent: ACCENT,

  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceBorder: 'rgba(0, 0, 0, 0.08)',

  floatingBg: 'rgba(255, 255, 255, 0.92)',
  floatingBorder: 'rgba(0, 0, 0, 0.08)',

  textPrimary: '#0A0A0A',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textMuted: '#C8C8C8',

  coverPlaceholder: '#E8E8E8',

  shadowColor: '#000',
  shadowOpacity: 0.08,
  coverShadowOpacity: 0.12,

  dividerBase: 'rgba(0, 0, 0, 0.08)',

  statusBarStyle: 'dark',
};

export const darkColors = {
  accent: ACCENT,

  background: '#050505',
  surface: '#1E1E1E',
  surfaceBorder: 'rgba(255, 255, 255, 0.06)',

  floatingBg: 'rgba(30, 30, 30, 0.88)',
  floatingBorder: 'rgba(255, 255, 255, 0.06)',

  textPrimary: '#F2F2F2',
  textSecondary: '#999999',
  textTertiary: '#666666',
  textMuted: '#3A3A3A',

  coverPlaceholder: '#1E1E1E',

  shadowColor: '#000',
  shadowOpacity: 0.6,
  coverShadowOpacity: 0.6,

  dividerBase: 'rgba(255, 255, 255, 0.06)',

  statusBarStyle: 'light',
};

/** Returns the color palette for a given scheme. */
export function getColors(scheme) {
  return scheme === 'dark' ? darkColors : lightColors;
}

export default lightColors;
