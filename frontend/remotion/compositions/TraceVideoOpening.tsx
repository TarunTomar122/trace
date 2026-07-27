import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const BLUE = "#3559d9";
const PAPER = "#faf9f5";
const INK = "#191816";

export const TraceVideoOpening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const label = spring({
    frame: frame - 4,
    fps,
    config: { damping: 22, stiffness: 180, mass: 0.65 },
    durationInFrames: 16,
  });
  const title = spring({
    frame: frame - 12,
    fps,
    config: { damping: 18, stiffness: 150, mass: 0.8 },
    durationInFrames: 20,
  });
  const sublineOpacity = interpolate(frame, [26, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, color: INK, fontFamily: "Georgia, serif" }}>
      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", inset: 0, justifyContent: "center", position: "absolute", textAlign: "center" }}>
        <div
          style={{
            color: BLUE,
            fontFamily: "monospace",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.24em",
            opacity: label,
            transform: `translateY(${interpolate(label, [0, 1], [16, 0])}px)`,
          }}
        >
          INTRODUCING
        </div>
        <div
          style={{
            fontSize: 172,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            marginTop: 26,
            opacity: title,
            transform: `translateY(${interpolate(title, [0, 1], [44, 0])}px)`,
          }}
        >
          Trace
        </div>
        <div
          style={{
            color: "#777369",
            fontFamily: "monospace",
            borderTop: `2px solid ${BLUE}`,
            fontSize: 19,
            letterSpacing: "0.1em",
            marginTop: 30,
            opacity: sublineOpacity,
            paddingTop: 24,
          }}
        >
          A DAILY TECH REFERENCE
        </div>
      </div>
    </AbsoluteFill>
  );
};
