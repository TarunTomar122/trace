import { useTheme } from '@/contexts/ThemeContext';

export function useColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useTheme();
  return colorScheme;
}
