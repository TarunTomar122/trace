import Svg, { Circle, Line, Rect } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
};

export default function DigestIllus({ width = 96, height = 96, color = '#0a0a0a' }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 96 96" fill="none">
      {/* Back card */}
      <Rect x="24" y="12" width="56" height="42" rx="8" stroke={color} strokeWidth="1.5" fill="none" />

      {/* Middle card */}
      <Rect x="16" y="20" width="56" height="42" rx="8" stroke={color} strokeWidth="1.5" fill="none" />

      {/* Front card */}
      <Rect x="8" y="28" width="56" height="42" rx="8" stroke={color} strokeWidth="1.5" fill="none" />

      {/* Front card — title line */}
      <Line x1="17" y1="48" x2="43" y2="48" stroke={color} strokeWidth="2" strokeLinecap="round" />

      {/* Front card — body lines */}
      <Line x1="17" y1="55" x2="54" y2="55" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="17" y1="61" x2="46" y2="61" stroke={color} strokeWidth="1.5" strokeLinecap="round" />

      {/* Clock badge — top-right of front card */}
      <Circle cx="52" cy="38" r="7" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Hour hand (12 o'clock) */}
      <Line x1="52" y1="38" x2="52" y2="33" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Minute hand (3 o'clock) */}
      <Line x1="52" y1="38" x2="57" y2="38" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}
