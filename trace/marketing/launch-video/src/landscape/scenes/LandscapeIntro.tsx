import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { display, sans } from "../../fonts";
import { LAND_BG, LAND_PAD_LEFT, LAND_PAD_RIGHT } from "../landscape-layout";
import { useSpringIn } from "../../components/reel-helpers";

export const LandscapeIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const icon = useSpringIn(0, 24);
  const brand = useSpringIn(10, 20);
  const tag = useSpringIn(22, 16);
  const sub = useSpringIn(34, 14);

  const glow = interpolate(frame, [fps * 0.5, fps * 2], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: LAND_BG,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingLeft: LAND_PAD_LEFT,
        paddingRight: LAND_PAD_RIGHT,
        gap: 64,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(200,98,42,${0.08 * glow}) 0%, transparent 70%)`,
          right: 200,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", zIndex: 2 }}>
        <div
          style={{
            ...icon,
            width: 100,
            height: 100,
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: "0 14px 40px rgba(0,0,0,0.14)",
            marginBottom: 28,
          }}
        >
          <Img src={staticFile("signin.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div
          style={{
            ...brand,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 140,
            letterSpacing: -6,
            color: "#1a1a1a",
            lineHeight: 0.95,
          }}
        >
          trace.
        </div>
        <div
          style={{
            ...tag,
            fontFamily: display,
            fontWeight: 700,
            fontSize: 42,
            color: "#C8622A",
            marginTop: 16,
            letterSpacing: -1,
          }}
        >
          Inshorts for tech news
        </div>
        <div
          style={{
            ...sub,
            fontFamily: sans,
            fontWeight: 400,
            fontSize: 26,
            color: "#6b6460",
            marginTop: 12,
            maxWidth: 520,
          }}
        >
          No celeb gossip. No fluff. Just what matters.
        </div>
      </div>

      <div
        style={{
          opacity: spring({ frame: frame - 20, fps, config: { damping: 200 } }),
          transform: `translateY(${interpolate(
            spring({ frame: frame - 20, fps, config: { damping: 200 } }),
            [0, 1],
            [40, 0],
          )}px)`,
        }}
      >
        <Img
          src={staticFile("Group 124.png")}
          style={{ height: 780, width: "auto", objectFit: "contain" }}
        />
      </div>
    </div>
  );
};