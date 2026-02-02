/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a0a0a';
const tintColorDark = '#fafafa';

export const Colors = {
  light: {
    text: '#0a0a0a',
    background: '#fafafa',
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

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
