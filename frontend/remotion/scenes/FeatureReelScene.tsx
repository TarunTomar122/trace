import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontGrotesk, fontMono } from "../fonts";
import { Reveal, kickerStyle } from "../components/LaunchKit";

export type Feature = {
  emoji: string;
  label: string;
  line: string;
};

export const FEATURES: Feature[] = [
  { emoji: "✉️", label: "Daily email", line: "ten big things, every morning" },
  { emoji: "⚡️", label: "Live feed", line: "the same edition, refreshed all day" },
  { emoji: "🧩", label: "Chrome extension", line: "the feed in every new tab" },
  { emoji: "🤖", label: "Agent MCP", line: "your agent reads the same stories" },
  { emoji: "📱", label: "Android app", line: "catch up from your phone" },
];

const ROW_START = 26;
const ROW_STEP = 34;

/** The five ways to read the same edition, introduced one row at a time. */
export const FeatureReelScene: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exit = interpolate(frame, [400, 420], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4efe7",
        flexDirection: "column",
        justifyContent: "center",
        padding: vertical ? "0 70px" : "0 180px",
        opacity: exit,
      }}
    >
      <Reveal startFrame={0} style={{ marginBottom: 40 }}>
        <span style={{ ...kickerStyle }}>Choose your product. Or take all five.</span>
      </Reveal>

      <div style={{ display: "flex", flexDirection: "column", gap: vertical ? 26 : 30 }}>
        {FEATURES.map((feature, index) => {
          const start = ROW_START + index * ROW_STEP;
          const p = spring({
            frame: frame - start,
            fps,
            config: { damping: 200 },
            durationInFrames: 26,
          });
          const active = frame >= start && frame < start + ROW_STEP + 18;

          return (
            <div
              key={feature.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: vertical ? 22 : 30,
                backgroundColor: active ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.38)",
                border: "1.5px solid rgba(0,0,0,0.08)",
                borderRadius: 24,
                padding: vertical ? "22px 26px" : "26px 34px",
                opacity: interpolate(p, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(p, [0, 1], [56, 0])}px) scale(${interpolate(
                  p,
                  [0, 1],
                  [0.98, 1]
                )})`,
                boxShadow: active ? "0 18px 50px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: vertical ? 40 : 46,
                  width: vertical ? 74 : 86,
                  height: vertical ? 74 : 86,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.05)",
                  borderRadius: 22,
                  flexShrink: 0,
                }}
              >
                {feature.emoji}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  style={{
                    fontFamily: fontGrotesk,
                    fontSize: vertical ? 44 : 48,
                    fontWeight: 700,
                    color: "#1a1a1a",
                    letterSpacing: "-0.035em",
                    lineHeight: 1,
                  }}
                >
                  {feature.label}
                </span>
                <span
                  style={{
                    fontFamily: fontGrotesk,
                    fontSize: vertical ? 27 : 28,
                    fontWeight: 500,
                    color: "rgba(0,0,0,0.45)",
                    letterSpacing: "-0.015em",
                  }}
                >
                  {feature.line}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Reveal startFrame={226} y={16} style={{ marginTop: 44 }}>
        <span
          style={{
            fontFamily: fontMono,
            fontSize: 20,
            letterSpacing: "0.1em",
            color: "rgba(0,0,0,0.4)",
            textTransform: "uppercase",
          }}
        >
          one ranked edition behind all of it
        </span>
      </Reveal>
    </AbsoluteFill>
  );
};
