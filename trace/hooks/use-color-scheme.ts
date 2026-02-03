import { useColorScheme as useRNColorScheme } from 'react-native';

// Force light mode as default for Trace
export function useColorScheme(): 'light' | 'dark' {
  // Always return 'light' for now - Trace uses light mode
  return 'light';
  
  // If you want to support dark mode later, uncomment:
  // const scheme = useRNColorScheme();
  // return scheme ?? 'light';
}
