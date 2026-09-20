import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontGrotesk, fontMono } from "../fonts";
import { Reveal, kickerStyle } from "../components/LaunchKit";
import { FEATURES } from "./FeatureReelScene";

/** Price: all five, one number. */
export const PriceScene: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const price = spring({
    frame: frame - 26,
    fps,
    from: 0.8,
    to: 1,
    durationInFrames: 32,
    config: { damping: 13 },
  });

  const exit = interpolate(frame, [196, 216], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4efe7",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: vertical ? "0 80px" : "0 140px",
        opacity: exit,
      }}
    >
      <Reveal startFrame={0} style={{ marginBottom: 34 }}>
        <span style={{ ...kickerStyle }}>All five products</span>
      </Reveal>

      <div style={{ display: "flex", alignItems: "baseline", gap: 18, transform: `scale(${price})` }}>
        <span
          style={{
            fontFamily: fontGrotesk,
            fontSize: vertical ? 260 : 280,
            fontWeight: 700,
            color: "#1a1a1a",
            letterSpacing: "-0.06em",
            lineHeight: 0.9,
          }}
        >
          $5
        </span>
        <span
          style={{
            fontFamily: fontGrotesk,
            fontSize: vertical ? 48 : 54,
            fontWeight: 600,
            color: "rgba(0,0,0,0.4)",
            letterSpacing: "-0.03em",
          }}
        >
          a month
        </span>
      </div>

      <Reveal startFrame={56} y={18} style={{ marginTop: 46 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", maxWidth: vertical ? 900 : 1100 }}>
          {FEATURES.map((feature) => (
            <span
              key={feature.label}
              style={{
                fontFamily: fontMono,
                fontSize: 18,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(0,0,0,0.6)",
                border: "1.5px solid rgba(0,0,0,0.12)",
                borderRadius: 999,
                padding: "11px 20px",
                backgroundColor: "rgba(255,255,255,0.6)",
              }}
            >
              {feature.label}
            </span>
          ))}
        </div>
      </Reveal>

    </AbsoluteFill>
  );
};
