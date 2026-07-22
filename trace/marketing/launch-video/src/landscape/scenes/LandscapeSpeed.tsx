import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { display, sans } from "../../fonts";
import { DeckStoryCard } from "../../components/DeckStoryCard";
import { SwipeStack } from "../../components/SwipeStack";
import { MOCK_STORIES } from "../../components/mock-stories";
import { LAND_ACCENT, LAND_BG, LAND_CARD_H, LAND_CARD_W, LAND_PAD_LEFT, LAND_PAD_RIGHT } from "../landscape-layout";
import { useSpringIn } from "../../components/reel-helpers";

export const LandscapeSpeed: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = useSpringIn(0, 22);
  const cards = useSpringIn(12, 36);

  const progress = interpolate(frame, [fps * 0.4, fps * 2.4], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        gap: 64,
      }}
    >
      <div style={{ flex: "0 0 640px", ...text }}>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: 120,
            lineHeight: 0.92,
            letterSpacing: -5,
            color: "#1a1a1a",
          }}
        >
          News in
        </div>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: 120,
            lineHeight: 0.92,
            letterSpacing: -5,
            color: LAND_ACCENT,
          }}
        >
          30 seconds.
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 400,
            fontSize: 28,
            color: "#6b6460",
            marginTop: 24,
            maxWidth: 480,
            lineHeight: 1.4,
          }}
        >
          AI summaries from 100+ trusted sources. Swipe, read, done.
        </div>
        <div
          style={{
            marginTop: 32,
            width: 280,
            height: 6,
            borderRadius: 3,
            background: "rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              background: LAND_ACCENT,
              borderRadius: 3,
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", ...cards }}>
        <SwipeStack
          stories={MOCK_STORIES.slice(0, 3)}
          cardWidth={LAND_CARD_W}
          cardHeight={LAND_CARD_H}
          swipeStart={15}
          swipeInterval={48}
          swipeDuration={16}
        />
      </div>
    </div>
  );
};