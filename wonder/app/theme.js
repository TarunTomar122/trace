/**
 * App color palette — dark only.
 *
 *   Void Black  #050505  — deep charcoal background
 *   Slate Grey  #1E1E1E  — cards / surfaces
 *   Text White  #F2F2F2  — primary readable text
 *   Acid Green  #CCFF00  — accent / dopamine hits
 */

export const ACCENT = '#CCFF00';

const colors = {
  accent: ACCENT,

  // Backgrounds — Void Black
  background: '#050505',
  // Cards / surfaces — Slate Grey
  surface: '#1E1E1E',
  surfaceBorder: 'rgba(255, 255, 255, 0.06)',

  // Floating UI (header pills, back buttons)
  floatingBg: 'rgba(30, 30, 30, 0.88)',
  floatingBorder: 'rgba(255, 255, 255, 0.06)',

  // Text — Text White + derived tones
  textPrimary: '#F2F2F2',
  textSecondary: '#999999',
  textTertiary: '#666666',
  textMuted: '#3A3A3A',

  // Covers / placeholders
  coverPlaceholder: '#1E1E1E',

  // Shadows
  shadowColor: '#000',
  shadowOpacity: 0.6,
  coverShadowOpacity: 0.6,

  // Divider
  dividerBase: 'rgba(255, 255, 255, 0.06)',

  // StatusBar
  statusBarStyle: 'light',
};

export default colors;
