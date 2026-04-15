import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
  Easing,
} from "remotion";
import { fontGrotesk } from "../fonts";

// 160 frames = 5.3s
const TAGLINE_1 = ["Trace", "reads", "the", "internet."];
const TAGLINE_2 = "You read what matters.";

export const ReliefScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const fadeOut = interpolate(frame, [135, 160], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Logo entrance — quick spring
  const logoProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 200 },
    durationInFrames: 25,
  });
  const logoScale = interpolate(logoProgress, [0, 1], [0.78, 1]);
  const logoOpacity = interpolate(logoProgress, [0, 1], [0, 1]);

  const wordmarkOpacity = interpolate(frame, [30, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Line 1 words — stagger every 9 frames
  const tagline1Words = TAGLINE_1.map((_, i) => {
    return spring({
      frame: frame - (50 + i * 9),
      fps,
      config: { damping: 200 },
      durationInFrames: 16,
    });
  });

  // Line 2
  const line2Progress = interpolate(frame, [95, 118], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#080808",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn * fadeOut,
      }}
    >
      {/* Logo + wordmark */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          marginBottom: 56,
        }}
      >
        <Img
          src={staticFile("trace.webp")}
          style={{ width: 64, height: 64, objectFit: "contain" }}
        />
        <span
          style={{
            fontFamily: fontGrotesk,
            fontSize: 15,
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            opacity: wordmarkOpacity,
          }}
        >
          TRACE
        </span>
      </div>

      {/* Line 1 */}
      <div style={{ display: "flex", gap: 18, marginBottom: 18 }}>
        {TAGLINE_1.map((word, i) => {
          const p = tagline1Words[i];
          return (
            <span
              key={word}
              style={{
                fontFamily: fontGrotesk,
                fontSize: 60,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.03em",
                opacity: interpolate(p, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px)`,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Line 2 */}
      <div
        style={{
          fontFamily: fontGrotesk,
          fontSize: 60,
          fontWeight: 700,
          color: "rgba(255,255,255,0.32)",
          letterSpacing: "-0.03em",
          opacity: line2Progress,
          transform: `translateY(${interpolate(line2Progress, [0, 1], [16, 0])}px)`,
        }}
      >
        {TAGLINE_2}
      </div>
    </AbsoluteFill>
  );
};
