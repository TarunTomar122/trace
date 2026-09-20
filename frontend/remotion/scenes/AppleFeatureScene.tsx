import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { LandingDemoFrame } from "../components/LandingDemoFrame";
import {
  FONT,
  FeatureIcon,
  HAIRLINE,
  INK,
  MONO,
  Stage,
  Sub,
  Surface,
  useFadeOut,
  useReveal,
} from "../components/AppleKit";

type Visual =
  | { kind: "demo"; demo: "feed" | "extension" | "agents" }
  | { kind: "android" };

export type AppleFeature = {
  icon: "bolt" | "grid" | "terminal" | "phone";
  title: string;
  line: string;
  visual: Visual;
};

export const APPLE_FEATURES: AppleFeature[] = [
  {
    icon: "bolt",
    title: "A feed that updates hourly",
    line: "New coverage lands through the day. Related stories are grouped, ranked, and waiting when you open Trace, not after you refresh ten tabs.",
    visual: { kind: "demo", demo: "feed" },
  },
  {
    icon: "grid",
    title: "The feed in every new tab",
    line: "Open a new tab and the ranked feed is already there. Top stories, your topics, zero effort.",
    visual: { kind: "demo", demo: "extension" },
  },
  {
    icon: "terminal",
    title: "MCP access for OpenClaw and Hermes",
    line: "Drop Trace into OpenClaw on Discord, or Hermes, Claude, Codex, Cursor. Read-only.",
    visual: { kind: "demo", demo: "agents" },
  },
  {
    icon: "phone",
    title: "Catch up from your phone",
    line: "Trace for Android, ranked the same way.",
    visual: { kind: "android" },
  },
];

const Action: React.FC<{
  icon: AppleFeature["icon"];
  title: string;
  line: string;
}> = ({ icon, title, line }) => (
  <>
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 84,
        height: 84,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.05)",
        border: `1px solid ${HAIRLINE}`,
        marginBottom: 40,
      }}
    >
      <FeatureIcon name={icon} size={40} />
    </div>
    <span
      style={{
        fontFamily: FONT,
        fontSize: 72,
        fontWeight: 600,
        color: INK,
        letterSpacing: "-0.04em",
        lineHeight: 1.1,
        marginBottom: 22,
      }}
    >
      {title}
    </span>
    <Sub size={28} maxWidth={620}>
      {line}
    </Sub>
  </>
);

/** One idea per screen, with real product pixels beside the copy. */
export const AppleFeatureScene: React.FC<{
  feature: AppleFeature;
  fadeOutAt?: number;
  index?: number;
}> = ({ feature, fadeOutAt, index = 0 }) => {
  const frame = useCurrentFrame();

  const copy = useReveal(1, { y: 20 });
  const shot = useReveal(5, { y: 26, duration: 32 });
  const opacity = useFadeOut(fadeOutAt);

  const drift = interpolate(frame, [0, 150], [0, -16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <Stage fadeOutAt={fadeOutAt}>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 96,
          padding: "0 140px",
          width: "100%",
        }}
      >
        <div
          style={{
            ...copy,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            flex: "0 0 520px",
          }}
        >
          <Action icon={feature.icon} title={feature.title} line={feature.line} />
        </div>

        <div style={{ ...shot, transform: `${shot.transform} translateY(${drift}px)` }}>
          {feature.visual.kind === "demo" ? (
            <LandingDemoFrame
              kind={feature.visual.demo}
              width={700}
              height={520}
              scale={1.18}
              radius={24}
            />
          ) : null}

          {feature.visual.kind === "android" ? (
            <Surface width={826} height={614} tone="dark">
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 26,
                }}
              >
                <img
                  src={staticFile("trace-app-icon-v1-192.png")}
                  alt=""
                  style={{ width: 132, height: 132, borderRadius: 30, display: "block" }}
                />
                <span style={{ fontFamily: FONT, fontSize: 30, fontWeight: 600, color: INK }}>
                  Trace for Android
                </span>
                <span style={{ fontFamily: MONO, fontSize: 15, color: "#86868b" }}>
                  Google Play · free
                </span>
              </div>
            </Surface>
          ) : null}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 52,
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "rgba(245,245,247,0.32)",
        }}
      >
        {index + 1} / {APPLE_FEATURES.length}
      </div>
    </Stage>
  );
};
