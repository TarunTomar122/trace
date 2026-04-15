import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const OnboardingInterests: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in
  const opacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  // Typing animation for interests (frames 20-80)
  const interests = [
    "React performance",
    "fintech APIs",
    "product teardowns",
    "typography"
  ];

  const typingProgress = interpolate(
    frame,
    [20, 80],
    [0, interests.join(", ").length],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const fullText = interests.join(", ");
  const visibleText = fullText.substring(0, Math.floor(typingProgress));

  // Cursor blink
  const showCursor = frame >= 20 && frame < 80 && Math.floor(frame / 15) % 2 === 0;

  // Zoom in effect - much bigger!
  const scale = spring({
    frame,
    fps,
    from: 1.0,
    to: 1.3,
    durationInFrames: 40,
    config: {
      damping: 14,
    },
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#fafafa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        padding: "40px",
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ maxWidth: "1100px", width: "100%" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "70px" }}>
          <div
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: "20px",
              color: "#0a0a0a",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              fontWeight: "bold",
              marginBottom: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            TRACE
          </div>

          {/* Step indicator */}
          <div
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: "16px",
              color: "#0a0a0a",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              marginBottom: "40px",
              fontWeight: 600,
            }}
          >
            → CHOOSE YOUR INTERESTS
          </div>

          <h1
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: "80px",
              fontWeight: 300,
              textTransform: "uppercase",
              color: "#0a0a0a",
              margin: "0 0 24px 0",
              letterSpacing: "-0.02em",
            }}
          >
            INTERESTS <span style={{ color: "rgba(59, 58, 58, 0.4)" }}>&</span> HOBBIES
          </h1>

          <p
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: "22px",
              color: "#3b3a3a",
              margin: 0,
            }}
          >
            Help us curate content you'll love
          </p>
        </div>

        {/* Input field */}
        <div>
          <label
            style={{
              display: "block",
              fontFamily: "Geist Mono, monospace",
              fontSize: "20px",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "rgba(10, 10, 10, 0.8)",
              fontWeight: 500,
              marginBottom: "16px",
            }}
          >
            What are you interested in? <span style={{ color: "#0a0a0a" }}>(minimum 4)</span>
          </label>

          <p
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: "19px",
              color: "rgba(59, 58, 58, 0.7)",
              margin: "0 0 24px 0",
            }}
          >
            💡 These drive 70% of your feed content
          </p>

          <div
            style={{
              border: "4px solid #b0b0b0",
              padding: "32px",
              backgroundColor: "transparent",
              minHeight: "150px",
              fontFamily: "Geist Mono, monospace",
              fontSize: "28px",
              color: "#0a0a0a",
              display: "flex",
              alignItems: "flex-start",
            }}
          >
            <span>{visibleText}</span>
            {showCursor && (
              <span
                style={{
                  width: "4px",
                  height: "32px",
                  backgroundColor: "#0a0a0a",
                  marginLeft: "3px",
                  display: "inline-block",
                }}
              />
            )}
          </div>

          <p
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: "16px",
              color: "rgba(59, 58, 58, 0.6)",
              margin: "12px 0 0 0",
            }}
          >
            Separate with commas • {interests.length}/8 added
          </p>
        </div>
      </div>
    </div>
  );
};
