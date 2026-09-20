import React from "react";
import { interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontGrotesk, fontMono } from "../fonts";

/** Shared reveal for a single word or chip. */
export const Reveal: React.FC<{
  children: React.ReactNode;
  startFrame: number;
  y?: number;
  damping?: number;
  style?: React.CSSProperties;
}> = ({ children, startFrame, y = 28, damping = 200, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - startFrame,
    fps,
    config: { damping },
    durationInFrames: 26,
  });

  return (
    <span
      style={{
        display: "inline-block",
        opacity: interpolate(p, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(p, [0, 1], [y, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** The Trace mark + wordmark, used on the hook and the end card. */
export const TraceWordmark: React.FC<{ size?: number; opacity?: number }> = ({
  size = 1,
  opacity = 1,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 * size, opacity }}>
    <img
      src={staticFile("trace.webp")}
      alt=""
      style={{ height: 40 * size, width: "auto", display: "block" }}
    />
    <span
      style={{
        fontFamily: fontGrotesk,
        fontSize: 34 * size,
        fontWeight: 700,
        letterSpacing: "-0.03em",
        color: "#1a1a1a",
      }}
    >
      Trace
    </span>
  </div>
);

export const kickerStyle: React.CSSProperties = {
  fontFamily: fontMono,
  fontSize: 18,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "rgba(0,0,0,0.42)",
};

export const bodyStyle: React.CSSProperties = {
  fontFamily: fontGrotesk,
  fontSize: 30,
  fontWeight: 500,
  color: "rgba(0,0,0,0.55)",
  letterSpacing: "-0.02em",
  margin: 0,
};
