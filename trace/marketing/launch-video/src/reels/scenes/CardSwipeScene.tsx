import { display, sans } from "../../fonts";
import { SwipeStack } from "../../components/SwipeStack";
import { MOCK_STORIES } from "../../components/mock-stories";
import { REEL_CARD_HEIGHT, REEL_CARD_WIDTH } from "../../components/reel-layout";
import { REEL_BG } from "../../components/trace-theme";
import { useSpringIn } from "../../components/reel-helpers";

/** Quick swipe demo — middle beat of ThirtySecondReel. */
export const CardSwipeScene: React.FC = () => {
  const header = useSpringIn(0, 20);
  const stack = useSpringIn(10, 32);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: REEL_BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "72px 44px 56px",
        gap: 32,
      }}
    >
      <div style={{ textAlign: "center", ...header }}>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: 56,
            letterSpacing: -2,
            color: "#1a1a1a",
            lineHeight: 1.1,
          }}
        >
          Swipe your feed.
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 400,
            fontSize: 26,
            color: "#6b6460",
            marginTop: 10,
          }}
        >
          Done before your coffee gets cold.
        </div>
      </div>

      <div
        style={{
          ...stack,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SwipeStack
          stories={MOCK_STORIES.slice(0, 3)}
          cardWidth={REEL_CARD_WIDTH}
          cardHeight={REEL_CARD_HEIGHT}
          swipeStart={15}
          swipeInterval={48}
          swipeDuration={16}
        />
      </div>
    </div>
  );
};