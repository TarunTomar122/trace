import { Easing, interpolate, useCurrentFrame } from "remotion";
import { DeckStoryCard } from "./DeckStoryCard";
import type { MockStory } from "./mock-stories";

type SwipeStackProps = {
  stories: MockStory[];
  cardWidth: number;
  cardHeight: number;
  swipeStart?: number;
  swipeInterval?: number;
  swipeDuration?: number;
};

export const SwipeStack: React.FC<SwipeStackProps> = ({
  stories,
  cardWidth,
  cardHeight,
  swipeStart = 30,
  swipeInterval = 75,
  swipeDuration = 22,
}) => {
  const frame = useCurrentFrame();

  const activeIndex = Math.min(
    stories.length - 1,
    Math.max(0, Math.floor((frame - swipeStart) / swipeInterval)),
  );

  const swipeFrame = frame - swipeStart - activeIndex * swipeInterval;
  const swipeProgress =
    activeIndex >= stories.length - 1
      ? 0
      : interpolate(swipeFrame, [0, swipeDuration], [0, 1], {
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return (
    <div style={{ position: "relative", width: cardWidth, height: cardHeight }}>
      {stories.map((story, index) => {
        const offset = index - activeIndex;
        if (offset < 0) return null;

        const y =
          offset === 0
            ? interpolate(swipeProgress, [0, 1], [0, -cardHeight - 48])
            : offset * 14;

        const scale = 1 - offset * 0.02;
        const opacity =
          offset === 0
            ? 1
            : offset === 1
              ? interpolate(swipeProgress, [0.82, 1], [0, 0.92], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0;

        return (
          <div
            key={story.id}
            style={{
              position: "absolute",
              inset: 0,
              transform: `translateY(${y}px) scale(${scale})`,
              opacity,
              zIndex: stories.length - offset,
            }}
          >
            <DeckStoryCard story={story} width={cardWidth} height={cardHeight} />
          </div>
        );
      })}
    </div>
  );
};