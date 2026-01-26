import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in animation
  const opacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 30,
  });

  const scale = spring({
    frame,
    fps,
    from: 0.9,
    to: 1,
    durationInFrames: 30,
    config: {
      damping: 12,
    },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "48px",
        opacity,
      }}
    >
      {/* Main message */}
      <div
        style={{
          transform: `scale(${scale})`,
          textAlign: "center",
          maxWidth: "900px",
          padding: "0 40px",
        }}
      >
        <h1
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: "84px",
            fontWeight: "bold",
            color: "#fafafa",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: "1.2",
          }}
        >
          fuck the algorithms.
        </h1>
      </div>

      {/* Build your own feed */}
      <div
        style={{
          transform: `scale(${scale})`,
        }}
      >
        <p
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: "42px",
            color: "#fafafa",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          build your own feed
        </p>
      </div>

      {/* URL */}
      <div
        style={{
          transform: `scale(${scale})`,
        }}
      >
        <p
          style={{
            fontFamily: "Geist Mono, monospace",
            fontSize: "26px",
            color: "#b0b0b0",
            margin: 0,
            letterSpacing: "0.05em",
          }}
        >
          yourtrace.online
        </p>
      </div>
    </AbsoluteFill>
  );
};
