import { Img, staticFile } from "remotion";
import { display, sans } from "../../fonts";
import { useSpringIn } from "../../components/reel-helpers";

type LandscapeOutroProps = {
  subline?: string;
  compact?: boolean;
};

export const LandscapeOutro: React.FC<LandscapeOutroProps> = ({
  subline = "Stay informed. In your time, on your terms.",
  compact = false,
}) => {
  const icon = useSpringIn(0, 16);
  const title = useSpringIn(8, 14);
  const sub = useSpringIn(18, 12);
  const cta = useSpringIn(30, 10);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#1a1a1a",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 48 : 64,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 50% 60% at 30% 50%, rgba(200,98,42,0.25) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          ...icon,
          width: compact ? 100 : 120,
          height: compact ? 100 : 120,
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
        }}
      >
        <Img src={staticFile("playstore.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            ...title,
            fontFamily: display,
            fontWeight: 800,
            fontSize: compact ? 96 : 120,
            letterSpacing: -5,
            color: "#fff",
            lineHeight: 1,
          }}
        >
          trace
        </div>
        <div
          style={{
            ...sub,
            fontFamily: sans,
            fontWeight: 400,
            fontSize: compact ? 22 : 28,
            color: "rgba(255,255,255,0.82)",
            maxWidth: 560,
          }}
        >
          {subline}
        </div>
        <div
          style={{
            ...cta,
            alignSelf: "flex-start",
            background: "#C8622A",
            borderRadius: 14,
            padding: compact ? "14px 40px" : "18px 48px",
            fontFamily: sans,
            fontWeight: 600,
            fontSize: compact ? 17 : 20,
            color: "#fff",
            boxShadow: "0 8px 28px rgba(200,98,42,0.4)",
          }}
        >
          Download on Google Play — Free
        </div>
      </div>
    </div>
  );
};