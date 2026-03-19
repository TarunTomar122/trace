import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontGrotesk } from "../fonts";

export const CalloutTag: React.FC<{
  text: string;
  startFrame: number;
  endFrame: number;
  side?: "left" | "right";
  accent?: string;
}> = ({ text, startFrame, endFrame, side = "right", accent = "#059669" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 200 },
    durationInFrames: 30,
  });

  const exitOpacity = interpolate(frame, [endFrame - 20, endFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(enterProgress, [0, 1], [0, 1]) * exitOpacity;
  const translateX = interpolate(
    enterProgress,
    [0, 1],
    [side === "right" ? 40 : -40, 0]
  );

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(255,255,255,0.96)",
        border: `1.5px solid ${accent}33`,
        borderRadius: 100,
        padding: "10px 18px",
        opacity,
        transform: `translateX(${translateX}px)`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: accent,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: fontGrotesk,
          fontSize: 16,
          fontWeight: 600,
          color: "#1a1a1a",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
};
