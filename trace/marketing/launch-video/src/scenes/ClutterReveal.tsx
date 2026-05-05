import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { sans } from "../fonts";

const BG = "#F8F6F2";

const NAMES: Array<{ label: string; x: number; y: number; rot: number; size: number; delay: number }> = [
  { label: "Medium",       x: 180,  y: 120,  rot: -3,  size: 72,  delay: 0  },
  { label: "X",            x: 920,  y: 80,   rot: 2,   size: 100, delay: 8  },
  { label: "Instagram",    x: 1380, y: 140,  rot: -2,  size: 68,  delay: 16 },
  { label: "TechCrunch",   x: 100,  y: 380,  rot: 4,   size: 80,  delay: 24 },
  { label: "Wired",        x: 760,  y: 310,  rot: -5,  size: 90,  delay: 30 },
  { label: "Reddit",       x: 1480, y: 360,  rot: 3,   size: 74,  delay: 38 },
  { label: "LinkedIn",     x: 260,  y: 620,  rot: -2,  size: 78,  delay: 44 },
  { label: "Substack",     x: 1100, y: 560,  rot: 4,   size: 70,  delay: 52 },
  { label: "Hacker News",  x: 580,  y: 180,  rot: -4,  size: 66,  delay: 58 },
  { label: "Bloomberg",    x: 900,  y: 700,  rot: 2,   size: 84,  delay: 64 },
  { label: "The Verge",    x: 1540, y: 620,  rot: -3,  size: 72,  delay: 70 },
  { label: "YouTube",      x: 420,  y: 820,  rot: 3,   size: 76,  delay: 76 },
  { label: "Ars Technica", x: 1200, y: 860,  rot: -2,  size: 66,  delay: 82 },
  { label: "BBC",          x: 700,  y: 500,  rot: 5,   size: 96,  delay: 88 },
  { label: "NYT",          x: 1360, y: 500,  rot: -4,  size: 88,  delay: 94 },
];

const DROP_START = 150;
const DROP_END = 178;
const REVEAL_START = 195;
const SUB_START = 240;

const FloatingName: React.FC<typeof NAMES[number]> = ({ label, x, y, rot, size, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 220 } });
  const enterScale = interpolate(enter, [0, 1], [0.6, 1]);
  const enterOpacity = interpolate(enter, [0, 1], [0, 1]);

  const drop = interpolate(frame, [DROP_START, DROP_END], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dropY = interpolate(drop, [0, 1], [0, 200]);
  const dropOp = interpolate(drop, [0, 1], [1, 0]);

  if (frame < delay) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontFamily: sans,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: -2,
        color: "#1a1a1a",
        opacity: enterOpacity * dropOp,
        transform: `scale(${enterScale}) rotate(${rot}deg) translateY(${dropY}px)`,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {label}
    </div>
  );
};

export const ClutterReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const moreOpacity =
    interpolate(frame, [115, 135], [0, 1], { extrapolateRight: "clamp" }) *
    interpolate(frame, [DROP_START, DROP_END], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const moreDrop = interpolate(frame, [DROP_START, DROP_END], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Reveal animations
  const iconS = spring({ frame: frame - REVEAL_START, fps, config: { damping: 200 } });
  const iconOpacity = interpolate(iconS, [0, 1], [0, 1]);
  const iconScale = interpolate(iconS, [0, 1], [0.7, 1]);

  const traceS = spring({ frame: frame - REVEAL_START, fps, config: { damping: 200 } });
  const traceOpacity = interpolate(traceS, [0, 1], [0, 1]);
  const traceY = interpolate(traceS, [0, 1], [22, 0]);

  const subS = spring({ frame: frame - SUB_START, fps, config: { damping: 200 } });
  const subOpacity = interpolate(subS, [0, 1], [0, 1]);
  const subY = interpolate(subS, [0, 1], [16, 0]);

  const showReveal = frame >= REVEAL_START - 10;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BG,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {NAMES.map((n) => (
        <FloatingName key={n.label} {...n} />
      ))}

      <div
        style={{
          position: "absolute",
          left: 680,
          top: 940,
          fontFamily: sans,
          fontWeight: 400,
          fontSize: 48,
          color: "#9a8e84",
          opacity: moreOpacity,
          transform: `translateY(${moreDrop}px)`,
          whiteSpace: "nowrap",
        }}
      >
        and many more...
      </div>

      {showReveal && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              opacity: iconOpacity,
              transform: `scale(${iconScale})`,
              width: 110,
              height: 110,
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 12px 40px rgba(0,0,0,0.16)",
            }}
          >
            <Img src={staticFile("signin.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>

          <div
            style={{
              opacity: traceOpacity,
              transform: `translateY(${traceY}px)`,
              fontFamily: sans,
              fontWeight: 800,
              fontSize: 180,
              letterSpacing: -8,
              color: "#1a1a1a",
              lineHeight: 1,
            }}
          >
            trace.
          </div>

          <div
            style={{
              opacity: subOpacity,
              transform: `translateY(${subY}px)`,
              fontFamily: sans,
              fontWeight: 300,
              fontSize: 38,
              color: "#6b6460",
              letterSpacing: -0.5,
              maxWidth: 900,
              textAlign: "center",
            }}
          >
            Your shortcut to staying informed.
          </div>
        </div>
      )}
    </div>
  );
};
