import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  FeatureIcon,
  FONT,
  GlossHeadline,
  HAIRLINE,
  INK,
  INK_DIM,
  MONO,
  Sub,
  useFadeOut,
  useReveal,
} from "../components/AppleKit";
import { APPLE_FEATURES } from "./AppleFeatureScene";

/** Price: one number, five products, presented as a spec row. */
export const ApplePriceScene: React.FC<{ fadeOutAt?: number }> = ({ fadeOutAt }) => {
  const price = useReveal(2, { y: 24, scale: 1.025 });
  const row = useReveal(14, { y: 16 });
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 72% 56% at 50% 45%, rgba(255,255,255,0.055) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      <div style={{ ...price, display: "flex", alignItems: "center", gap: 24, padding: "0 40px" }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 188,
            fontWeight: 600,
            letterSpacing: "-0.055em",
            lineHeight: 1.24,
            paddingBottom: 6,
            backgroundImage: "linear-gradient(180deg, #ffffff 0%, #d8d8dc 60%, #a6a6ad 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          $5
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 50,
            fontWeight: 400,
            color: INK_DIM,
            letterSpacing: "-0.03em",
          }}
        >
          a month
        </span>
      </div>

      <div style={{ ...row, marginTop: 56, width: 1180 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${HAIRLINE}`,
            paddingTop: 30,
          }}
        >
          {APPLE_FEATURES.map((feature) => (
            <div
              key={feature.title}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                width: 220,
              }}
            >
              <FeatureIcon name={feature.icon} size={30} />
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 19,
                  fontWeight: 500,
                  color: INK,
                  textAlign: "center",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.3,
                }}
              >
                {feature.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...row, marginTop: 40 }}>
        <Sub size={25}>One ranked edition behind all five.</Sub>
      </div>
    </AbsoluteFill>
  );
};

/** Close: the line, the URL, the mark. */
export const AppleEndScene: React.FC = () => {
  const frame = useCurrentFrame();

  const line = useReveal(2, { y: 20 });
  const url = useReveal(20, { y: 14 });

  const typed = interpolate(frame, [24, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const showCursor = frame >= 24 && frame < 56;
  const target = "yourtrace.online";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 52% at 50% 52%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      <div style={{ ...line, textAlign: "center", marginBottom: 40 }}>
        <GlossHeadline size={108}>Don&rsquo;t miss another update.</GlossHeadline>
      </div>

      <div
        style={{
          ...url,
          display: "flex",
          alignItems: "center",
          borderTop: `1px solid ${HAIRLINE}`,
          paddingTop: 30,
          minWidth: 420,
          justifyContent: "center",
        }}
      >
        <span
          style={{ fontFamily: MONO, fontSize: 28, letterSpacing: "0.1em", color: INK }}
        >
          {target.slice(0, Math.floor(typed * target.length))}
        </span>
        {showCursor && Math.floor(frame / 12) % 2 === 0 ? (
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: "1.05em",
              marginLeft: 3,
              backgroundColor: "rgba(245,245,247,0.6)",
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
