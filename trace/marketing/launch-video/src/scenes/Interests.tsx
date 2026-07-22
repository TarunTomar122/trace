import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { sans } from "../fonts";

const BG = "#F8F6F2";
const ACCENT = "#C8622A";
const PAD = 360;

export const Interests: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mk = (delay: number) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
    return {
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(s, [0, 1], [22, 0])}px)`,
    };
  };

  const imgS = spring({ frame: frame - 10, fps, config: { damping: 200 } });

  return (
    <div style={{ width: "100%", height: "100%", background: BG, display: "flex", flexDirection: "row", alignItems: "center", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: interpolate(imgS,[0,1],[0,1]), transform: `translateY(${interpolate(imgS,[0,1],[50,0])}px)` }}>
        <Img src={staticFile("Group 122.png")} style={{ height: 860, width: "auto", objectFit: "contain" }} />
      </div>

      <div style={{ flex: "0 0 860px", display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: PAD, gap: 0 }}>
        <div style={{ ...mk(0),  fontFamily: sans, fontWeight: 800, fontSize: 128, lineHeight: 0.93, letterSpacing: -5, color: "#1a1a1a" }}>Your role.</div>
        <div style={{ ...mk(12), fontFamily: sans, fontWeight: 800, fontSize: 128, lineHeight: 0.93, letterSpacing: -5, color: "#1a1a1a" }}>Your topics.</div>
        <div style={{ ...mk(24), fontFamily: sans, fontWeight: 800, fontSize: 128, lineHeight: 0.93, letterSpacing: -5, color: ACCENT   }}>Your interests.</div>
      </div>
    </div>
  );
};
