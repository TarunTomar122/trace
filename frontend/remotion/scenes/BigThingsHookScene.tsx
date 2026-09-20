import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontGrotesk, fontMono } from "../fonts";
import { Reveal, kickerStyle, bodyStyle } from "../components/LaunchKit";

/**
 * Hook: the promise in four beats — "10 big things", "in tech and AI",
 * "every morning", and the email framing underneath.
 */
export const BigThingsHookScene: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exit = interpolate(frame, [118, 138], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ten = spring({
    frame,
    fps,
    from: 0.7,
    to: 1,
    durationInFrames: 34,
    config: { damping: 14 },
  });

  const chips = ["AI releases", "market moves", "what changed"];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4efe7",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: vertical ? "0 90px" : "0 120px",
        opacity: exit,
      }}
    >
      <Reveal startFrame={2} style={{ marginBottom: 28 }}>
        <span style={{ ...kickerStyle }}>The daily email</span>
      </Reveal>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: vertical ? 26 : 34,
          transform: `scale(${ten})`,
        }}
      >
        <span
          style={{
            fontFamily: fontGrotesk,
            fontSize: vertical ? 300 : 320,
            fontWeight: 700,
            color: "#1a1a1a",
            letterSpacing: "-0.06em",
            lineHeight: 0.86,
          }}
        >
          10
        </span>
        <span
          style={{
            fontFamily: fontGrotesk,
            fontSize: vertical ? 104 : 118,
            fontWeight: 700,
            color: "#1a1a1a",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          big things
        </span>
      </div>

      <Reveal startFrame={34} y={22} style={{ marginTop: 10 }}>
        <span
          style={{
            fontFamily: fontGrotesk,
            fontSize: vertical ? 62 : 68,
            fontWeight: 500,
            color: "rgba(0,0,0,0.45)",
            letterSpacing: "-0.035em",
          }}
        >
          in tech and AI
        </span>
      </Reveal>

      <Reveal startFrame={52} y={18} style={{ marginTop: 54 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {chips.map((chip, index) => {
            const p = spring({
              frame: frame - (56 + index * 7),
              fps,
              config: { damping: 200 },
              durationInFrames: 24,
            });
            return (
              <span
                key={chip}
                style={{
                  fontFamily: fontMono,
                  fontSize: 19,
                  letterSpacing: "0.06em",
                  color: "rgba(0,0,0,0.55)",
                  border: "1.5px solid rgba(0,0,0,0.12)",
                  borderRadius: 999,
                  padding: "12px 22px",
                  backgroundColor: "rgba(255,255,255,0.6)",
                  opacity: interpolate(p, [0, 1], [0, 1]),
                  transform: `translateY(${interpolate(p, [0, 1], [16, 0])}px)`,
                }}
              >
                {chip}
              </span>
            );
          })}
        </div>
      </Reveal>

    </AbsoluteFill>
  );
};
