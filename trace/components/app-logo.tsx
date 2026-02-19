import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

const LIGHT_LOGO = require('@/assets/images/trace-logo.png');
const DARK_LOGO = require('@/assets/images/dark-icon.png');

export function AppLogo({ style }: { style?: StyleProp<ImageStyle> }) {
  const colorScheme = useColorScheme();
  return (
    <Image
      source={colorScheme === 'dark' ? DARK_LOGO : LIGHT_LOGO}
      style={style}
      resizeMode="contain"
    />
  );
}
