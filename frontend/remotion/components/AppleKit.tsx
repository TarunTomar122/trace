import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";

/**
 * Keynote-grade primitives: pure black stage with a soft vignette, one idea per
 * screen, SF-ish type with a gloss on the hero line, and real product pixels
 * instead of drawn placeholders.
 */

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Inter, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

export const INK = "#f5f5f7";
export const INK_DIM = "#86868b";
export const ACCENT = "#2997ff";
export const PANEL = "#0b0b0d";
export const HAIRLINE = "rgba(255,255,255,0.08)";

/** Fade + rise, the way a keynote builds a line. */
export const useReveal = (
  start: number,
  { duration = 24, y = 20, scale = 1.01 }: { duration?: number; y?: number; scale?: number } = {}
) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return {
    opacity: p,
    transform: `translateY(${interpolate(p, [0, 1], [y, 0])}px) scale(${interpolate(
      p,
      [0, 1],
      [scale, 1]
    )})`,
  } as React.CSSProperties;
};

export const useFadeOut = (at?: number, length = 18) => {
  const frame = useCurrentFrame();
  if (!at) return 1;
  return interpolate(frame, [at, at + length], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
};

export const Stage: React.FC<{ children: React.ReactNode; fadeOutAt?: number }> = ({
  children,
  fadeOutAt,
}) => {
  const opacity = useFadeOut(fadeOutAt);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        opacity,
      }}
    >
      {/* A gentle vignette lifts the centre off flat black without a colour cast. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 72% 56% at 50% 42%, rgba(255,255,255,0.055) 0%, rgba(0,0,0,0) 70%)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const Kicker: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = INK_DIM,
}) => (
  <span
    style={{
      fontFamily: MONO,
      fontSize: 18,
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      color,
    }}
  >
    {children}
  </span>
);

/** The hero line: 600 weight, tight tracking, light-to-grey vertical gloss. */
export const GlossHeadline: React.FC<{
  children: React.ReactNode;
  size?: number;
  align?: "center" | "left";
}> = ({ children, size = 96, align = "center" }) => (
  <span
    style={{
      fontFamily: FONT,
      fontSize: size,
      fontWeight: 600,
      letterSpacing: "-0.045em",
      // Descenders and currency glyphs spill a tight line box, and
      // background-clip: text clips that spill.
      lineHeight: 1.16,
      paddingBottom: 4,
      textAlign: align,
      backgroundImage: "linear-gradient(180deg, #ffffff 0%, #d8d8dc 62%, #a6a6ad 100%)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    }}
  >
    {children}
  </span>
);

export const Sub: React.FC<{ children: React.ReactNode; size?: number; maxWidth?: number }> = ({
  children,
  size = 30,
  maxWidth = 900,
}) => (
  <span
    style={{
      fontFamily: FONT,
      fontSize: size,
      fontWeight: 400,
      color: INK_DIM,
      letterSpacing: "-0.012em",
      lineHeight: 1.4,
      maxWidth,
      display: "inline-block",
    }}
  >
    {children}
  </span>
);

export const Mark: React.FC<{ opacity?: number; size?: number }> = ({ opacity = 1, size = 30 }) => (
  <div
    style={{
      position: "absolute",
      top: 56,
      left: 0,
      right: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 11,
      opacity,
    }}
  >
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size + 12,
        height: size + 12,
        borderRadius: 10,
        backgroundColor: INK,
      }}
    >
      <img
        src={staticFile("trace.webp")}
        alt=""
        style={{ height: size, width: "auto", display: "block" }}
      />
    </span>
    <span
      style={{ fontFamily: FONT, fontSize: 23, fontWeight: 600, letterSpacing: "-0.02em", color: INK }}
    >
      Trace
    </span>
  </div>
);

/** Monochrome icon set: crisp strokes beat emoji at keynote scale. */
const iconProps = {
  fill: "none",
  stroke: INK,
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const FeatureIcon: React.FC<{
  name: "bolt" | "grid" | "terminal" | "phone";
  size?: number;
}> = ({ name, size = 54 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    {name === "bolt" ? <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" /> : null}
    {name === "grid" ? (
      <>
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
      </>
    ) : null}
    {name === "terminal" ? (
      <>
        <rect x="2.5" y="4" width="19" height="16" rx="3" />
        <path d="m7 10 2.5 2.5L7 15" />
        <path d="M12.5 15.5h4.5" />
      </>
    ) : null}
    {name === "phone" ? (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="3" />
        <path d="M11 5.5h2" />
      </>
    ) : null}
  </svg>
);

/** A lit product surface: hairline border, top highlight, deep shadow. */
export const Surface: React.FC<{
  children: React.ReactNode;
  width?: number;
  height?: number;
  tone?: "dark" | "light";
  style?: React.CSSProperties;
}> = ({ children, width, height, tone = "dark", style }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 20,
      overflow: "hidden",
      position: "relative",
      backgroundColor: tone === "light" ? "#ffffff" : PANEL,
      border: `1px solid ${tone === "light" ? "rgba(0,0,0,0.08)" : HAIRLINE}`,
      boxShadow:
        tone === "light"
          ? "0 60px 140px rgba(0,0,0,0.85)"
          : "0 60px 140px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Browser chrome around real product pixels. */
export const BrowserShot: React.FC<{ src: string; tab?: string; height?: number }> = ({
  src,
  tab = "Trace",
  height = 560,
}) => (
  <div style={{ display: "flex", flexDirection: "column", height }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        backgroundColor: "#17171a",
        borderBottom: `1px solid ${HAIRLINE}`,
      }}
    >
      <div style={{ display: "flex", gap: 7 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
        ))}
      </div>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 14,
          color: INK_DIM,
          backgroundColor: "rgba(255,255,255,0.06)",
          padding: "4px 12px",
          borderRadius: 7,
        }}
      >
        {tab}
      </span>
    </div>
    <img
      src={staticFile(src)}
      alt=""
      style={{ width: "100%", flex: 1, objectFit: "cover", objectPosition: "top", display: "block" }}
    />
  </div>
);

/** Terminal surface for the agent screen. */
export const TerminalCard: React.FC<{ lines: { label?: string; text: string }[] }> = ({ lines }) => (
  <div style={{ padding: "26px 30px", fontFamily: MONO, fontSize: 17, lineHeight: 1.85 }}>
    {lines.map((line, index) => (
      <div key={index} style={{ display: "flex", gap: 12, opacity: index === 0 ? 0.55 : 1 }}>
        {line.label ? <span style={{ color: ACCENT }}>{line.label}</span> : null}
        <span style={{ color: INK }}>{line.text}</span>
      </div>
    ))}
  </div>
);
