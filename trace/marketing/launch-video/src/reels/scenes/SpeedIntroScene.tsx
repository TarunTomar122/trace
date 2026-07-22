import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { display, sans } from "../../fonts";
import { DeckStoryCard } from "../../components/DeckStoryCard";
import { MOCK_STORIES } from "../../components/mock-stories";
import { REEL_CARD_HEIGHT, REEL_CARD_WIDTH } from "../../components/reel-layout";
import { REEL_BG } from "../../components/trace-theme";
import { useSpringIn } from "../../components/reel-helpers";

/** Opening beat for ThirtySecondReel — typographic hook + one card, no floating timer badge. */
export const SpeedIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const num = useSpringIn(0, 30);
  const label = useSpringIn(8, 24);
  const card = useSpringIn(16, 36);

  const readProgress = interpolate(frame, [fps * 0.5, fps * 2.5], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        padding: "56px 48px",
        gap: 28,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            ...num,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 200,
            lineHeight: 0.9,
            letterSpacing: -8,
            color: "#C8622A",
          }}
        >
          30
        </div>
        <div
          style={{
            ...label,
            fontFamily: display,
            fontWeight: 700,
            fontSize: 52,
            letterSpacing: -1,
            color: "#1a1a1a",
            marginTop: 4,
          }}
        >
          second reads
        </div>
      </div>

      <div style={{ position: "relative", width: REEL_CARD_WIDTH, ...card }}>
        <DeckStoryCard
          story={MOCK_STORIES[0]}
          width={REEL_CARD_WIDTH}
          height={REEL_CARD_HEIGHT}
          swipeHint=""
        />
        <div
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            top: REEL_CARD_HEIGHT * 0.44 - 6,
            height: 5,
            borderRadius: 3,
            background: "rgba(255,255,255,0.35)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${readProgress * 100}%`,
              background: "#fff",
              borderRadius: 3,
            }}
          />
        </div>
      </div>

      <div
        style={{
          fontFamily: sans,
          fontWeight: 500,
          fontSize: 26,
          color: "#6b6460",
          textAlign: "center",
          opacity: interpolate(frame, [fps * 1.2, fps * 1.8], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        100+ sources · zero noise
      </div>
    </div>
  );
};