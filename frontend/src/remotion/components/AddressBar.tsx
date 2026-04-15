import { interpolate, useCurrentFrame } from "remotion";

export const AddressBar: React.FC = () => {
  const frame = useCurrentFrame();

  // URL typing animation - faster (frames 40-90)
  const url = "yourtrace.online/feed";
  const typingStartFrame = 40;
  const typingEndFrame = 90;
  const typingDuration = typingEndFrame - typingStartFrame;

  // Calculate how many characters to show
  const progress = interpolate(
    frame,
    [typingStartFrame, typingEndFrame],
    [0, url.length],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const visibleText = url.substring(0, Math.floor(progress));

  // Blinking cursor (blinks every 30 frames / 1 second)
  const showCursor = frame >= typingStartFrame && Math.floor(frame / 15) % 2 === 0;

  // Show address bar starting from frame 30 (faster)
  const addressBarOpacity = interpolate(
    frame,
    [30, 40],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <div
      style={{
        padding: "16px",
        opacity: addressBarOpacity,
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          backgroundColor: "white",
          border: "1px solid #dadce0",
          borderRadius: "24px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          boxShadow: "0 1px 6px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Lock icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5f6368"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>

        {/* URL text */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "16px",
            color: "#202124",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span>{visibleText}</span>
          {showCursor && (
            <span
              style={{
                width: "2px",
                height: "18px",
                backgroundColor: "#1a73e8",
                marginLeft: "1px",
                display: "inline-block",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
