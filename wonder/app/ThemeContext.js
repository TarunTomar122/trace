import React, { createContext, useContext, useState } from 'react';
import { getColors } from './theme';

const ThemeContext = createContext(null);

/**
 * Currently locked to 'light'. When dark mode support is added:
 *   1. Change DEFAULT_SCHEME to useColorScheme() from react-native, or
 *   2. Persist user preference and expose setColorScheme below.
 */
const DEFAULT_SCHEME = 'light';

export function ThemeProvider({ children }) {
  const [colorScheme] = useState(DEFAULT_SCHEME);
  const colors = getColors(colorScheme);

  return (
    <ThemeContext.Provider value={{ colors, colorScheme, isDark: colorScheme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook for consuming theme colors and scheme in any component. */
export function useTheme() {
  return useContext(ThemeContext);
}
