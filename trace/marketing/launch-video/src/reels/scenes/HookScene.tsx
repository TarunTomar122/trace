import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { display } from "../../fonts";
import { REEL_BG } from "../../components/trace-theme";
import { useSpringIn } from "../../components/reel-helpers";

const GOSSIP = ["Celeb drama", "Viral reels", "Influencer tea", "Clickbait", "Hot takes", "Doomscroll"];

type HookSceneProps = {
  line1: string;
  line2: string;
  line2Accent?: boolean;
};

export const HookScene: React.FC<HookSceneProps> = ({ line1, line2, line2Accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l1 = useSpringIn(0, 36);
  const l2 = useSpringIn(14, 36);

  const drop = interpolate(frame, [70, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: REEL_BG,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 56px",
        gap: 16,
      }}
    >
      {GOSSIP.map((label, i) => {
        const enter = spring({
          frame: frame - i * 6,
          fps,
          config: { damping: 18, stiffness: 220 },
        });
        const x = 40 + (i % 2) * 420;
        const y = 160 + Math.floor(i / 2) * 280;
        const dropY = interpolate(drop, [0, 1], [0, 320]);
        const opacity =
          interpolate(enter, [0, 1], [0, 1]) * interpolate(drop, [0, 1], [1, 0]);

        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontFamily: display,
              fontWeight: 700,
              fontSize: 56,
              color: "#c4bdb5",
              opacity,
              transform: `translateY(${dropY}px) rotate(${(i % 2 === 0 ? -1 : 1) * 3}deg)`,
            }}
          >
            {label}
          </div>
        );
      })}

      <div
        style={{
          ...l1,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 92,
          lineHeight: 1.05,
          letterSpacing: -3,
          color: "#1a1a1a",
          textAlign: "center",
          zIndex: 2,
        }}
      >
        {line1}
      </div>
      <div
        style={{
          ...l2,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 92,
          lineHeight: 1.05,
          letterSpacing: -3,
          color: line2Accent ? "#C8622A" : "#1a1a1a",
          textAlign: "center",
          zIndex: 2,
        }}
      >
        {line2}
      </div>
    </div>
  );
};