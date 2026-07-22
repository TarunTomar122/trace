import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const useSpringIn = (delay = 0, y = 22) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return {
    opacity: interpolate(s, [0, 1], [0, 1]),
    transform: `translateY(${interpolate(s, [0, 1], [y, 0])}px)`,
  };
};