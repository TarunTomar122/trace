import { ReactNode } from 'react';

interface Props {
  colorScheme: 'light' | 'dark';
  isEarlyAdopter: boolean;
  isSubscribed: boolean;
  onPress?: () => void;
}

export function EarlyAdopterBanner(_props: Props): ReactNode {
  return null;
}
