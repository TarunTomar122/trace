import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const BrowserFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animation for browser opening - faster
  const scale = spring({
    frame,
    fps,
    from: 0.85,
    to: 1,
    durationInFrames: 40,
    config: {
      damping: 10,
      mass: 0.4,
    },
  });

  const opacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 40,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fafafa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "90%",
          height: "85%",
          backgroundColor: "white",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.1)",
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        {/* Chrome header with traffic lights */}
        <div
          style={{
            height: "48px",
            backgroundColor: "#f1f3f4",
            borderBottom: "1px solid #dadce0",
            display: "flex",
            alignItems: "center",
            paddingLeft: "16px",
            paddingRight: "16px",
          }}
        >
          {/* Traffic lights (macOS style) */}
          <div style={{ display: "flex", gap: "8px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "#ff5f57",
              }}
            />
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "#febc2e",
              }}
            />
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "#28c840",
              }}
            />
          </div>
        </div>

        {/* Content area */}
        <div
          style={{
            height: "calc(100% - 48px)",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};
