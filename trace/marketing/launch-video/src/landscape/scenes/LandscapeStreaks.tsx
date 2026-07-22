import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { display, sans } from "../../fonts";
import { LAND_ACCENT, LAND_BG, LAND_PAD_LEFT, LAND_PAD_RIGHT } from "../landscape-layout";
import { useSpringIn } from "../../components/reel-helpers";

export const LandscapeStreaks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = useSpringIn(0, 20);
  const img = useSpringIn(10, 32);

  const streak = Math.min(
    14,
    Math.floor(
      interpolate(frame, [fps, fps * 2.5], [0, 14], {
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
        <Img src={staticFile("Group 126.png")} style={{ height: 820, width: "auto", objectFit: "contain" }} />
      </div>

      <div style={{ flex: "0 0 640px", ...text }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, letterSpacing: -4, color: "#1a1a1a", lineHeight: 0.95 }}>
          A few minutes.
        </div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, letterSpacing: -4, color: "#1a1a1a", lineHeight: 0.95 }}>
          Every day.
        </div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, letterSpacing: -4, color: LAND_ACCENT, lineHeight: 0.95 }}>
          Stay sharp.
        </div>

        <div
          style={{
            marginTop: 36,
            display: "inline-flex",
            alignItems: "baseline",
            gap: 12,
            padding: "20px 36px",
            background: "#fff",
            borderRadius: 20,
            boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
            opacity: interpolate(frame, [fps * 1.5, fps * 2], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 64, color: LAND_ACCENT }}>{streak}</span>
          <span style={{ fontFamily: sans, fontWeight: 500, fontSize: 20, color: "#6b6460" }}>day reading streak</span>
        </div>
      </div>
    </div>
  );
};