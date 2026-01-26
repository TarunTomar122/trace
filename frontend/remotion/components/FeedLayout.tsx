import { interpolate, useCurrentFrame } from "remotion";
import { AddressBar } from "./AddressBar";

export const FeedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();

  // Page load animation - faster (frames 90-120)
  const pageLoadOpacity = interpolate(
    frame,
    [90, 115],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const pageLoadTranslateY = interpolate(
    frame,
    [90, 115],
    [20, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#fafafa",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Address bar - fixed at top with solid background */}
      <div
        style={{
          backgroundColor: "#f1f3f4",
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        <AddressBar />
      </div>

      {/* Page content - scrollable area */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          opacity: pageLoadOpacity,
          transform: `translateY(${pageLoadTranslateY}px)`,
          backgroundColor: "#fafafa",
        }}
      >
        {/* Header - sticky with solid background */}
        <header
          style={{
            position: "sticky",
            top: 0,
            padding: "24px 32px",
            borderBottom: "1px solid #b0b0b0",
            backgroundColor: "#fafafa",
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: "768px",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Logo */}
            <h1
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: "32px",
                fontWeight: "bold",
                color: "#0a0a0a",
                margin: 0,
              }}
            >
              Trace
            </h1>

            {/* Navigation items */}
            <div style={{ display: "flex", gap: "32px" }}>
              <span
                style={{
                  fontFamily: "Geist Mono, monospace",
                  fontSize: "14px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#3b3a3a",
                }}
              >
                Feed
              </span>
              <span
                style={{
                  fontFamily: "Geist Mono, monospace",
                  fontSize: "14px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#b0b0b0",
                }}
              >
                Profile
              </span>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main
          style={{
            maxWidth: "768px",
            margin: "0 auto",
            padding: "32px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
