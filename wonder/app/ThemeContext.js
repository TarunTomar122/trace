import React, { createContext, useContext } from 'react';
import colors from './theme';

const ThemeContext = createContext(colors);

export function ThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value={{ colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook for consuming theme colors in any component */
export function useTheme() {
  return useContext(ThemeContext);
}
