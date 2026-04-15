import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const sliders = [
  { key: "youtube", label: "📹 YouTube Videos", value: 5 },
  { key: "articles", label: "📰 Articles & Blogs", value: 7 },
  { key: "papers", label: "📄 Research Papers", value: 2 },
  { key: "repos", label: "💻 GitHub Repos", value: 3 },
];

export const OnboardingSliders: React.FC = () => {
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

  // Sliders animate in staggered (frames 20-60, 10 frames apart)
  const getSliderValue = (index: number, targetValue: number) => {
    const startFrame = 20 + index * 10;
    return spring({
      frame: frame - startFrame,
      fps,
      from: 0,
      to: targetValue,
      durationInFrames: 25,
      config: {
        damping: 12,
      },
    });
  };

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
            → SELECT YOUR PREFERENCES
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
            CONTENT <span style={{ color: "rgba(59, 58, 58, 0.4)" }}>MIX</span>
          </h1>

          <p
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: "22px",
              color: "#3b3a3a",
              margin: 0,
            }}
          >
            Fine-tune your content sources
          </p>
        </div>

        <div style={{ marginBottom: "50px" }}>
          <p
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: "21px",
              color: "rgba(59, 58, 58, 0.8)",
              textAlign: "center",
            }}
          >
            🎚️ Rate your preference for each content type (0 = skip, 10 = love it)
          </p>
        </div>

        {/* Sliders */}
        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          {sliders.map((slider, index) => {
            const animatedValue = getSliderValue(index, slider.value);
            const displayValue = Math.round(animatedValue);
            const percentage = (animatedValue / 10) * 100;

            return (
              <div key={slider.key}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                  }}
                >
                  <label
                    style={{
                      fontFamily: "Geist Mono, monospace",
                      fontSize: "22px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "rgba(10, 10, 10, 0.8)",
                      fontWeight: 600,
                    }}
                  >
                    {slider.label}
                  </label>
                  <span
                    style={{
                      fontFamily: "Geist Mono, monospace",
                      fontSize: "24px",
                      color: "#0a0a0a",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span style={{ fontSize: "18px", color: "rgba(59, 58, 58, 0.5)" }}>
                      Preference:
                    </span>
                    {displayValue}/10
                  </span>
                </div>

                {/* Slider track */}
                <div
                  style={{
                    width: "100%",
                    height: "16px",
                    backgroundColor: "#b0b0b0",
                    borderRadius: "8px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Slider fill */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${percentage}%`,
                      backgroundColor: "#0a0a0a",
                      borderRadius: "4px",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "6px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "Geist Mono, monospace",
                      fontSize: "9px",
                      color: "rgba(59, 58, 58, 0.4)",
                    }}
                  >
                    Skip
                  </span>
                  <span
                    style={{
                      fontFamily: "Geist Mono, monospace",
                      fontSize: "9px",
                      color: "rgba(59, 58, 58, 0.4)",
                    }}
                  >
                    Some
                  </span>
                  <span
                    style={{
                      fontFamily: "Geist Mono, monospace",
                      fontSize: "9px",
                      color: "rgba(59, 58, 58, 0.4)",
                    }}
                  >
                    Love it
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
