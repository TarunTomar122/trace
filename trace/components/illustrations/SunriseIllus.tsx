import Svg, { Circle, Line, Path } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
};

export default function SunriseIllus({ width = 96, height = 96, color = '#0a0a0a' }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 96 96" fill="none">
      {/* Horizon line */}
      <Line x1="12" y1="64" x2="84" y2="64" stroke={color} strokeWidth="2" strokeLinecap="round" />

      {/* Sun — upper semicircle */}
      <Path
        d="M 28 64 A 20 20 0 0 1 68 64"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Sun rays */}
      <Line x1="48" y1="40" x2="48" y2="31" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="60" y1="43" x2="65" y2="35" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="36" y1="43" x2="31" y2="35" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="70" y1="52" x2="78" y2="48" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="26" y1="52" x2="18" y2="48" stroke={color} strokeWidth="2" strokeLinecap="round" />

      {/* Sparkle dots scattered in the sky */}
      <Circle cx="20" cy="24" r="2" stroke={color} strokeWidth="1.5" fill="none" />
      <Circle cx="75" cy="20" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
      <Circle cx="84" cy="40" r="1.5" stroke={color} strokeWidth="1.5" fill="none" />

      {/* Reading lines below horizon — morning article */}
      <Line x1="28" y1="73" x2="68" y2="73" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="28" y1="80" x2="56" y2="80" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="28" y1="87" x2="44" y2="87" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
