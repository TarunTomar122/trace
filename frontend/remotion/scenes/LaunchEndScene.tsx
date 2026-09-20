import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontGrotesk, fontMono } from "../fonts";
import { Reveal, TraceWordmark } from "../components/LaunchKit";

const LINE = ["Don't", "miss", "another", "update."];

/** Close: the line, the URL, the mark. */
export const LaunchEndScene: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const url = "yourtrace.online";
  const typed = interpolate(frame, [70, 108], [0, url.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showCursor = frame >= 70 && frame < 132;

  const badge = spring({
    frame: frame - 118,
    fps,
    config: { damping: 200 },
    durationInFrames: 26,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4efe7",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: vertical ? "0 80px" : "0 140px",
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: vertical ? "0 26px" : "0 30px",
          marginBottom: 44,
        }}
      >
        {LINE.map((word, index) => (
          <Reveal key={word} startFrame={6 + index * 9} y={30}>
            <span
              style={{
                fontFamily: fontGrotesk,
                fontSize: vertical ? 96 : 104,
                fontWeight: 700,
                color: "#1a1a1a",
                letterSpacing: "-0.045em",
                lineHeight: 1.05,
              }}
            >
              {word}
            </span>
          </Reveal>
        ))}
      </div>

      <div
        style={{
          fontFamily: fontMono,
          fontSize: vertical ? 30 : 28,
          color: "rgba(0,0,0,0.4)",
          letterSpacing: "0.1em",
          marginBottom: 54,
          minHeight: 42,
        }}
      >
        {url.slice(0, Math.floor(typed))}
        {showCursor && Math.floor(frame / 12) % 2 === 0 ? (
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: "1.05em",
              backgroundColor: "rgba(0,0,0,0.35)",
              marginLeft: 3,
              verticalAlign: "text-bottom",
            }}
          />
        ) : null}
      </div>

      <Reveal startFrame={96} y={16} style={{ marginBottom: 40 }}>
        <TraceWordmark size={vertical ? 1.15 : 1.25} opacity={0.9} />
      </Reveal>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          backgroundColor: "rgba(0,0,0,0.06)",
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: 100,
          padding: "12px 24px",
          opacity: interpolate(badge, [0, 1], [0, 1]),
          transform: `scale(${interpolate(badge, [0, 1], [0.92, 1])})`,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#1d9bf0" }} />
        <span
          style={{
            fontFamily: fontGrotesk,
            fontSize: 17,
            fontWeight: 600,
            color: "rgba(0,0,0,0.55)",
          }}
        >
          10 big things today 👀
        </span>
      </div>
    </AbsoluteFill>
  );
};
