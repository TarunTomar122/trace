import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';
type ColorScheme = 'light' | 'dark';

const THEME_MODE_KEY = 'trace_theme_mode_v1';

type ThemeContextType = {
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    void AsyncStorage.getItem(THEME_MODE_KEY)
      .then((savedMode) => {
        if (savedMode === 'light' || savedMode === 'dark') setThemeModeState(savedMode);
      })
      .catch(() => {});
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(THEME_MODE_KEY, mode).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        colorScheme: themeMode,
        setThemeMode,
        toggleTheme: () => setThemeMode(themeMode === 'dark' ? 'light' : 'dark'),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
