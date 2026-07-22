import { Img, staticFile } from "remotion";
import { display } from "../fonts";
import { useSpringIn } from "./reel-helpers";

type ReelOutroProps = {
  headline?: string;
  subline?: string;
  accent?: string;
};

export const ReelOutro: React.FC<ReelOutroProps> = ({
  headline = "trace",
  subline = "Download free on Google Play",
  accent = "#F59E0B",
}) => {
  const icon = useSpringIn(0, 24);
  const title = useSpringIn(10, 20);
  const sub = useSpringIn(22, 18);
  const cta = useSpringIn(36, 16);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: accent,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,255,255,0.2) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          ...icon,
          width: 140,
          height: 140,
          borderRadius: 32,
          overflow: "hidden",
          boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
        }}
      >
        <Img src={staticFile("playstore.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <div
        style={{
          ...title,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 120,
          letterSpacing: -5,
          color: "#fff",
          lineHeight: 1,
        }}
      >
        {headline}
      </div>

      <div
        style={{
          ...sub,
          fontFamily: display,
          fontWeight: 300,
          fontSize: 36,
          color: "rgba(255,255,255,0.9)",
          textAlign: "center",
          maxWidth: 720,
          lineHeight: 1.35,
        }}
      >
        {subline}
      </div>

      <div
        style={{
          ...cta,
          marginTop: 12,
          background: accent === "#1a1a1a" ? "#C8622A" : "#fff",
          borderRadius: 18,
          padding: "22px 56px",
          fontFamily: display,
          fontWeight: 600,
          fontSize: 28,
          color: accent === "#1a1a1a" ? "#fff" : "#1a1a1a",
          boxShadow: "0 10px 36px rgba(0,0,0,0.18)",
        }}
      >
        Get Trace — it's free
      </div>
    </div>
  );
};