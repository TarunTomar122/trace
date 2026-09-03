/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a0a0a';
const tintColorDark = '#fafafa';

export const Colors = {
  light: {
    text: '#0a0a0a',
    background: '#f0f0f0',
    tint: tintColorLight,
    icon: '#3b3a3a',
    tabIconDefault: '#3b3a3a',
    tabIconSelected: tintColorLight,
    foreground: '#0a0a0a',
    secondary: '#3b3a3a',
    border: '#b0b0b0',
    muted: '#6f6f6f',
    card: '#ffffff',
  },
  dark: {
    text: '#fafafa',
    background: '#0a0a0a',
    tint: tintColorDark,
    icon: '#b0b0b0',
    tabIconDefault: '#b0b0b0',
    tabIconSelected: tintColorDark,
    foreground: '#fafafa',
    secondary: '#c4c4c4',
    border: '#2c2c2c',
    muted: '#9a9a9a',
    card: '#151515',
  },
};

// IBM Plex Sans font family names (as registered by expo-google-fonts)
export const FontFamily = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semiBold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
};

// IBM Plex Serif font family names (for titles/headlines)
export const FontFamilySerif = {
  regular: 'IBMPlexSerif_400Regular',
  medium: 'IBMPlexSerif_500Medium',
  semiBold: 'IBMPlexSerif_600SemiBold',
  bold: 'IBMPlexSerif_700Bold',
};

// Typography presets based on design system
export const Typography = {
  // Serif styles for titles/headlines
  h1: {
    fontFamily: FontFamilySerif.bold,
    fontSize: 25,
    lineHeight: 30,
  },
  h2: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 19,
    lineHeight: 24,
  },
  h3: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  // Sans-serif styles for body/UI
  subHeading: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  body1: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  body2: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    lineHeight: 14,
  },
} as const;
