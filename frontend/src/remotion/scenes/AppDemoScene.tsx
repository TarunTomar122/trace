import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { AppMockup } from "../components/AppMockup";
import { fontGrotesk, fontMono } from "../fonts";

// ── Value prop card ────────────────────────────────────────────────────────────
function ValueProp({
  headline,
  sub,
  startFrame,
  endFrame,
  side,
  accent,
}: {
  headline: string;
  sub: string;
  startFrame: number;
  endFrame: number;
  side: "left" | "right";
  accent: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterP = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 200 },
    durationInFrames: 24,
  });
  const exitOp = interpolate(frame, [endFrame - 20, endFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dx = side === "right" ? 40 : -40;
  const opacity = interpolate(enterP, [0, 1], [0, 1]) * exitOp;
  const tx = interpolate(enterP, [0, 1], [dx, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${tx}px)`,
        maxWidth: 800,
        backgroundColor: "#f4efe7",
        borderRadius: 24,
        padding: "36px 48px",
        boxShadow: "0 2px 40px rgba(0,0,0,0.06)",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: 88,
          height: 6,
          borderRadius: 3,
          backgroundColor: accent,
          marginBottom: 28,
          marginLeft: side === "right" ? 0 : "auto",
        }}
      />
      <div
        style={{
          fontFamily: fontGrotesk,
          fontSize: 96,
          fontWeight: 700,
          color: "#1a1a1a",
          letterSpacing: "-0.04em",
          lineHeight: 1.0,
          marginBottom: 20,
          textAlign: side === "right" ? "left" : "right",
          whiteSpace: "pre-line",
        }}
      >
        {headline}
      </div>
      <div
        style={{
          fontFamily: fontMono,
          fontSize: 22,
          color: "rgba(0,0,0,0.4)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          lineHeight: 1.5,
          textAlign: side === "right" ? "left" : "right",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

// ── Main scene ────────────────────────────────────────────────────────────────

// Timing mirrors AppMockup constants
const T_FILTER_SWITCH = 185; // AI pill click
const T_STORY2        = 320; // sidebar story 2 click

export const AppDemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background fade in
  const bgOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Fade out at end
  const sceneOpacity = interpolate(frame, [530, 580], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Mockup entrance — cinematic 3D spring in from below
  const revealProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 200 },
    durationInFrames: 60,
  });
  const mockupScale = interpolate(revealProgress, [0, 1], [0.78, 1]);
  const rotateX     = interpolate(revealProgress, [0, 1], [10, 0]);
  const rotateY     = interpolate(revealProgress, [0, 1], [-5, 0]);
  const translateY  = interpolate(revealProgress, [0, 1], [80, 0]);

  // ── Camera choreography ───────────────────────────────────────────────────
  // Base gentle drift
  const baseScale = interpolate(frame, [60, 500], [1.0, 1.035], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  // Phase A — zoom into filter pills ("Personalized to your interests")
  // Camera in at frame 130, click fires at T_FILTER_SWITCH=185, out at 250
  const zA_In  = spring({ frame: frame - 130, fps, config: { damping: 200 }, durationInFrames: 28 });
  const zA_Out = spring({ frame: frame - 248, fps, config: { damping: 200 }, durationInFrames: 32 });
  const zA     = Math.max(0, zA_In - zA_Out);

  // Phase B — zoom into sidebar ("Grouped into one story")
  // Camera in at frame 285, click fires at T_STORY2=320, out at 390
  const zB_In  = spring({ frame: frame - 282, fps, config: { damping: 200 }, durationInFrames: 28 });
  const zB_Out = spring({ frame: frame - 388, fps, config: { damping: 200 }, durationInFrames: 32 });
  const zB     = Math.max(0, zB_In - zB_Out);

  // Phase C — zoom into main panel content ("Easy to consume summaries")
  // Camera in at frame 415, stays until fade out
  const zC_In  = spring({ frame: frame - 415, fps, config: { damping: 200 }, durationInFrames: 28 });
  const zC_Out = spring({ frame: frame - 500, fps, config: { damping: 200 }, durationInFrames: 32 });
  const zC     = Math.max(0, zC_In - zC_Out);

  const cameraScale = baseScale + zA * 0.32 + zB * 0.28 + zC * 0.28;

  // Pan directions:
  //   zA → filter pills are near TOP of mockup → translateY positive (push content down, top comes to center)
  //   zB → sidebar is on LEFT → translateX positive (push content right, left comes to center)
  //   zC → main panel is right-center → translateX slightly negative, translateY slightly positive
  const cameraTY =
    interpolate(zA, [0, 1], [0, 170]) +
    interpolate(zB, [0, 1], [0, 60]) +
    interpolate(zC, [0, 1], [0, 120]);

  const cameraTX =
    interpolate(zA, [0, 1], [0, 0]) +
    interpolate(zB, [0, 1], [0, 320]) +
    interpolate(zC, [0, 1], [0, -220]);

  // Ambient radial gradient pulse
  const gradientPulse = interpolate(frame, [0, 400, 810], [0.6, 1.0, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Bottom label
  const labelOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: bgOpacity * sceneOpacity }}>
      {/* Background */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 40%, rgba(255,248,235,${gradientPulse}) 0%, #f4efe7 100%)`,
        }}
      />

      {/* Subtle grain overlay */}
      <AbsoluteFill
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
          opacity: 0.4,
        }}
      />

      {/* Main content — camera-controlled */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          perspective: "2000px",
          transform: `scale(${cameraScale}) translateX(${cameraTX}px) translateY(${cameraTY}px)`,
        }}
      >
        {/* Mockup with 3D reveal */}
        <div
          style={{
            transform: `
              perspective(2000px)
              rotateX(${rotateX}deg)
              rotateY(${rotateY}deg)
              scale(${mockupScale})
              translateY(${translateY}px)
            `,
            transformStyle: "preserve-3d",
          }}
        >
          <AppMockup buildFrame={frame} />
        </div>

        {/* Bottom label */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: labelOpacity,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#34d399",
            }}
          />
          <span
            style={{
              fontFamily: fontMono,
              fontSize: 12,
              color: "rgba(0,0,0,0.3)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            yourtrace.online
          </span>
        </div>
      </AbsoluteFill>

      {/* ── Value prop callouts — outside camera transform ── */}

      {/* Value prop A: Personalized to your interests — appears during pill zoom */}
      <div
        style={{
          position: "absolute",
          right: 72,
          top: "22%",
        }}
      >
        <ValueProp
          headline={"Personalized\nto your interests"}
          sub={"your topics. your feed."}
          startFrame={148}
          endFrame={265}
          side="right"
          accent="#059669"
        />
      </div>

      {/* Value prop B: Grouped into one story — appears during sidebar zoom */}
      <div
        style={{
          position: "absolute",
          left: 72,
          top: "32%",
        }}
      >
        <ValueProp
          headline={"5 sources,\none story"}
          sub={"no duplicate, no noise"}
          startFrame={298}
          endFrame={410}
          side="left"
          accent="#3b82f6"
        />
      </div>

      {/* Value prop C: Easy summaries — appears during content zoom */}
      <div
        style={{
          position: "absolute",
          right: 72,
          bottom: "22%",
        }}
      >
        <ValueProp
          headline={"2-minute\nbriefing"}
          sub={"ready every morning"}
          startFrame={430}
          endFrame={540}
          side="right"
          accent="#8b5cf6"
        />
      </div>
    </AbsoluteFill>
  );
};
