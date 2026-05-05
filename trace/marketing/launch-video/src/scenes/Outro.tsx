import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { sans } from "../fonts";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mk = (delay: number) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
    return {
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(s, [0, 1], [16, 0])}px)`,
    };
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#F59E0B",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(255,255,255,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ ...mk(0), width: 110, height: 110, borderRadius: 26, overflow: "hidden", boxShadow: "0 14px 44px rgba(0,0,0,0.22)" }}>
        <Img src={staticFile("signin.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <div style={{ ...mk(10), fontFamily: sans, fontWeight: 800, fontSize: 110, letterSpacing: -5, color: "#fff", lineHeight: 1 }}>
        trace
      </div>

      <div style={{
        ...mk(22),
        fontFamily: sans,
        fontWeight: 300,
        fontSize: 26,
        color: "rgba(255,255,255,0.85)",
        letterSpacing: 0.5,
        textAlign: "center",
        maxWidth: 700,
      }}>
        Stay informed. In your time, on your terms.
      </div>

      <div
        style={{
          ...mk(40),
          marginTop: 16,
          background: "#fff",
          borderRadius: 14,
          padding: "18px 56px",
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 19,
          color: "#1a1a1a",
          letterSpacing: 0.2,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        Download on Google Play — Free
      </div>
    </div>
  );
};
