import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { display, sans } from "../../fonts";
import { ROLES, TOPICS } from "../../components/mock-stories";
import { LAND_ACCENT, LAND_BG, LAND_PAD_LEFT, LAND_PAD_RIGHT } from "../landscape-layout";
import { useSpringIn } from "../../components/reel-helpers";

export const LandscapePersonalize: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = useSpringIn(0, 20);
  const img = useSpringIn(10, 32);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: LAND_BG,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: LAND_PAD_LEFT,
        paddingRight: LAND_PAD_RIGHT,
        gap: 56,
      }}
    >
      <div style={{ flex: 1, display: "flex", justifyContent: "center", ...img }}>
        <Img src={staticFile("Group 122.png")} style={{ height: 820, width: "auto", objectFit: "contain" }} />
      </div>

      <div style={{ flex: "0 0 680px", ...text }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, letterSpacing: -4, color: "#1a1a1a", lineHeight: 0.95 }}>
          Your role.
        </div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, letterSpacing: -4, color: "#1a1a1a", lineHeight: 0.95 }}>
          Your topics.
        </div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, letterSpacing: -4, color: LAND_ACCENT, lineHeight: 0.95 }}>
          Your feed.
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 32 }}>
          {ROLES.map((role, i) => {
            const s = spring({ frame: frame - 30 - i * 4, fps, config: { damping: 200 } });
            const on = role === "Developer";
            return (
              <div
                key={role}
                style={{
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  padding: "10px 18px",
                  borderRadius: 20,
                  fontFamily: sans,
                  fontWeight: 600,
                  fontSize: 16,
                  background: on ? "#1a1a1a" : "#fff",
                  color: on ? "#fff" : "#1a1a1a",
                  border: on ? "none" : "1px solid #e0dcd6",
                }}
              >
                {role}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {TOPICS.map((topic, i) => {
            const s = spring({ frame: frame - 48 - i * 3, fps, config: { damping: 200 } });
            return (
              <div
                key={topic}
                style={{
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  padding: "8px 14px",
                  borderRadius: 14,
                  fontFamily: sans,
                  fontSize: 14,
                  fontWeight: 500,
                  background: "rgba(200,98,42,0.12)",
                  color: LAND_ACCENT,
                }}
              >
                {topic}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};