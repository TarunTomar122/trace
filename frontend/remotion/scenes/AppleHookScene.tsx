import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { FONT, MONO, useFadeOut, useReveal } from "../components/AppleKit";

/**
 * Hook: "10 big things" strobes between opposite black and white stages, then
 * settles. Seven 7-frame beats (~4.3 Hz) — fast enough to read as a deliberate
 * cut, slow enough to stay clear of flicker risk.
 */
const BEAT = 7;
const BEATS = 7;
const STROBE_END = BEAT * BEATS;

export const AppleHookScene: React.FC<{ fadeOutAt?: number }> = ({ fadeOutAt }) => {
  const frame = useCurrentFrame();

  const strobing = frame < STROBE_END;
  const inverted = strobing && Math.floor(frame / BEAT) % 2 === 1;

  const stage = inverted ? "#f5f5f7" : "#000000";
  const ink = inverted ? "#0a0a0a" : "#f5f5f7";
  const dim = inverted ? "rgba(10,10,10,0.5)" : "rgba(245,245,247,0.55)";

  // A punch on every beat: the type kicks out and is still settling when the
  // stage flips, which is what makes the cut read as intentional.
  const withinBeat = (frame % BEAT) / BEAT;
  const strobePunch = strobing ? 1 + 0.07 * (1 - withinBeat) : 1;
  const settle = strobing
    ? 1
    : 1 +
      0.07 *
        Math.max(
          0,
          1 -
            interpolate(frame, [STROBE_END, STROBE_END + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            })
        );

  // Tracking tightens as it lands, the way a keynote title settles.
  const tracking = interpolate(frame, [0, 34], [-0.095, -0.062], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const sub = useReveal(STROBE_END + 10, { y: 18 });
  const kicker = useReveal(STROBE_END + 22, { y: 14 });
  const opacity = useFadeOut(fadeOutAt);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: stage,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        opacity,
      }}
    >
      <div style={{ ...kicker, marginBottom: 56 }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 18,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: dim,
          }}
        >
          Trace Daily
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 34,
          transform: `scale(${strobePunch * settle})`,
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: 268,
            fontWeight: 600,
            color: ink,
            letterSpacing: `${tracking}em`,
            lineHeight: 0.86,
          }}
        >
          10
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 176,
            fontWeight: 600,
            color: ink,
            letterSpacing: `${tracking}em`,
            lineHeight: 1,
          }}
        >
          big things
        </span>
      </div>

      <div style={{ ...sub, marginTop: 36 }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 64,
            fontWeight: 400,
            color: dim,
            letterSpacing: "-0.035em",
          }}
        >
          in tech and AI
        </span>
      </div>
    </AbsoluteFill>
  );
};
