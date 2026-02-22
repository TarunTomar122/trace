import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
};

export default function BookmarkIllus({ width = 96, height = 96, color = '#0a0a0a' }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 96 96" fill="none">
      {/* Left bookmark — smaller, flanking */}
      <Path
        d="M 8 18 H 30 V 70 L 19 62 L 8 70 Z"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Right bookmark — smaller, flanking */}
      <Path
        d="M 66 18 H 88 V 70 L 77 62 L 66 70 Z"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Center bookmark — taller, prominent */}
      <Path
        d="M 30 10 H 66 V 82 L 48 72 L 30 82 Z"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Sparkle accents */}
      <Circle cx="80" cy="10" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
      <Circle cx="14" cy="10" r="1.5" stroke={color} strokeWidth="1.5" fill="none" />
    </Svg>
  );
}
