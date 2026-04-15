import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { fontGrotesk, fontMono } from "../fonts";

const BG = "#f4efe7";

const LINE1_WORDS = ["Stop", "checking", "10", "apps", "every", "morning."];
const LINE2_WORDS = ["fuck", "the", "algorithms."];

function WordReveal({ word, startFrame, fontSize, color, weight }: {
  word: string; startFrame: number; fontSize: number; color: string; weight: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ frame: frame - startFrame, fps, config: { damping: 200 }, durationInFrames: 22 });

  return (
    <span style={{
      fontFamily: fontGrotesk, fontSize, fontWeight: weight, color,
      letterSpacing: "-0.04em",
      opacity: interpolate(p, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)`,
      display: "inline-block",
      marginRight: fontSize * 0.28,
    }}>
      {word}
    </span>
  );
}

export const EndCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Line 3
  const line3Opacity = interpolate(frame, [155, 182], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // URL typing
  const urlText = "yourtrace.online";
  const urlProgress = interpolate(frame, [205, 248], [0, urlText.length], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const showCursor = frame >= 205 && frame < 268;

  // Badge
  const badgeP = spring({ frame: frame - 252, fps, config: { damping: 200 }, durationInFrames: 28 });

  return (
    <AbsoluteFill style={{
      backgroundColor: BG,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      opacity: fadeIn,
    }}>
      {/* Line 1 */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, justifyContent: "center", marginBottom: 8, lineHeight: 1 }}>
        {LINE1_WORDS.map((word, i) => (
          <WordReveal key={i} word={word} startFrame={20 + i * 8} fontSize={48} color="rgba(0,0,0,0.3)" weight={700} />
        ))}
      </div>

      {/* Line 2 — the star */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, justifyContent: "center", marginBottom: 44, lineHeight: 1 }}>
        {LINE2_WORDS.map((word, i) => (
          <WordReveal key={i} word={word} startFrame={80 + i * 16} fontSize={88} color="#1a1a1a" weight={700} />
        ))}
      </div>

      {/* Line 3 */}
      <div style={{
        fontFamily: fontGrotesk, fontSize: 38, fontWeight: 600,
        color: "rgba(0,0,0,0.45)", letterSpacing: "-0.025em",
        marginBottom: 40,
        opacity: line3Opacity,
        transform: `translateY(${interpolate(line3Opacity, [0, 1], [20, 0])}px)`,
      }}>
        build your own feed.
      </div>

      {/* URL */}
      <div style={{
        fontFamily: fontMono, fontSize: 22, color: "rgba(0,0,0,0.28)",
        letterSpacing: "0.08em", marginBottom: 48,
      }}>
        {urlText.substring(0, Math.floor(urlProgress))}
        {showCursor && Math.floor(frame / 14) % 2 === 0 && (
          <span style={{ display: "inline-block", width: 2, height: "1.1em", backgroundColor: "rgba(0,0,0,0.28)", marginLeft: 2, verticalAlign: "text-bottom" }} />
        )}
      </div>

      {/* Badge */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        backgroundColor: "rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 100, padding: "10px 20px",
        opacity: interpolate(badgeP, [0, 1], [0, 1]),
        transform: `scale(${interpolate(badgeP, [0, 1], [0.9, 1])})`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#34d399" }} />
        <span style={{ fontFamily: fontGrotesk, fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,0.55)" }}>
          Start free — 3 days, no card needed
        </span>
      </div>
    </AbsoluteFill>
  );
};
