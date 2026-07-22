import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { display, sans } from "../../fonts";
import { ROLES, TOPICS } from "../../components/mock-stories";
import { REEL_BG } from "../../components/trace-theme";
import { useSpringIn } from "../../components/reel-helpers";

export const ProScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headline = useSpringIn(0, 28);

  const streak = Math.min(
    14,
    Math.floor(
      interpolate(frame, [fps * 1.2, fps * 3.5], [0, 14], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: REEL_BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 48px",
        gap: 48,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            ...headline,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 80,
            letterSpacing: -3,
            color: "#1a1a1a",
          }}
        >
          Built for
        </div>
        <div
          style={{
            ...headline,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 80,
            letterSpacing: -3,
            color: "#C8622A",
          }}
        >
          professionals.
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", maxWidth: 900 }}>
        {ROLES.map((role, i) => {
          const s = spring({ frame: frame - 20 - i * 5, fps, config: { damping: 200 } });
          const selected = role === "Developer";
          return (
            <div
              key={role}
              style={{
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(s, [0, 1], [16, 0])}px)`,
                padding: "16px 28px",
                borderRadius: 28,
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 24,
                background: selected ? "#1a1a1a" : "#fff",
                color: selected ? "#fff" : "#1a1a1a",
                border: selected ? "none" : "2px solid #e0dcd6",
                boxShadow: selected ? "0 8px 28px rgba(0,0,0,0.15)" : "none",
              }}
            >
              {role}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", maxWidth: 820 }}>
        {TOPICS.map((topic, i) => {
          const s = spring({ frame: frame - 50 - i * 4, fps, config: { damping: 200 } });
          return (
            <div
              key={topic}
              style={{
                opacity: interpolate(s, [0, 1], [0, 1]),
                padding: "12px 22px",
                borderRadius: 22,
                fontFamily: sans,
                fontWeight: 500,
                fontSize: 20,
                background: "rgba(200,98,42,0.12)",
                color: "#C8622A",
              }}
            >
              {topic}
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: "40px 56px",
          borderRadius: 28,
          background: "#fff",
          boxShadow: "0 16px 48px rgba(0,0,0,0.08)",
          textAlign: "center",
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 88, color: "#C8622A", lineHeight: 1 }}>
          {streak}🔥
        </div>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 24, color: "#6b6460", marginTop: 10 }}>
          day reading streak
        </div>
      </div>
    </div>
  );
};