import { display, sans } from "../../fonts";
import { SwipeStack } from "../../components/SwipeStack";
import { MOCK_STORIES } from "../../components/mock-stories";
import { REEL_CARD_HEIGHT, REEL_CARD_WIDTH } from "../../components/reel-layout";
import { REEL_BG, TraceColors } from "../../components/trace-theme";
import { useSpringIn } from "../../components/reel-helpers";

type CardDemoSceneProps = {
  caption?: string;
  stories?: typeof MOCK_STORIES;
};

export const CardDemoScene: React.FC<CardDemoSceneProps> = ({
  caption = "Swipe. Read. Done.",
  stories = MOCK_STORIES.slice(0, 3),
}) => {
  const header = useSpringIn(0, 24);
  const stack = useSpringIn(8, 32);
  const cap = useSpringIn(20, 20);

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
        gap: 28,
        padding: "48px 40px",
      }}
    >
      <div
        style={{
          ...header,
          display: "flex",
          justifyContent: "center",
          gap: 40,
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 28,
        }}
      >
        <span style={{ color: "#1a1a1a", borderBottom: "3px solid #C8622A", paddingBottom: 6 }}>
          Trending
        </span>
        <span style={{ color: "#9a9a9a" }}>For You</span>
      </div>

      <div
        style={{
          ...stack,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          background: TraceColors.light.background,
          borderRadius: 24,
          padding: "24px 0",
        }}
      >
        <SwipeStack
          stories={stories}
          cardWidth={REEL_CARD_WIDTH}
          cardHeight={REEL_CARD_HEIGHT}
          swipeStart={20}
          swipeInterval={58}
        />
      </div>

      <div
        style={{
          ...cap,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 56,
          letterSpacing: -2,
          color: "#1a1a1a",
          textAlign: "center",
        }}
      >
        {caption}
      </div>
    </div>
  );
};