import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { FeedLayout } from "../components/FeedLayout";
import { FeedCard } from "../components/FeedCard";
import { EndCard } from "../components/EndCard";
import { OnboardingInterests } from "../components/OnboardingInterests";
import { OnboardingSliders } from "../components/OnboardingSliders";
import { sampleArticles } from "../data/sampleArticles";

export const ProductLaunchVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "Get Your Feed" text animation (frames 200-230)
  const getFeedOpacity = spring({
    frame: frame - 200,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 15,
  });

  const getFeedFadeOut = interpolate(
    frame,
    [220, 235],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Subtle 3D rotation effect - faster
  const rotateY = interpolate(
    frame,
    [235, 260, 280],
    [3, -2, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const rotateX = interpolate(
    frame,
    [235, 260, 280],
    [-2, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Dynamic zoom - zoom in on feed cards
  const feedScale = interpolate(
    frame,
    [235, 295, 340, 410, 490],
    [0.85, 1.15, 1.15, 1.2, 1.15],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Scroll animation - quick and minimal
  const scrollProgress = interpolate(
    frame,
    [340, 390],
    [0, -100],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Comment button highlight - faster
  const commentButtonScale = interpolate(
    frame,
    [410, 417, 424],
    [1, 1.15, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Comment input appears - faster
  const commentOpacity = interpolate(
    frame,
    [424, 440],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const commentTranslateY = interpolate(
    frame,
    [424, 440],
    [20, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Typing animation - faster
  const commentText = "I love this topic";
  const typingProgress = interpolate(
    frame,
    [440, 490],
    [0, commentText.length],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const visibleComment = commentText.substring(0, Math.floor(typingProgress));

  // Feed opacity (fade out before end card)
  const feedOpacity = interpolate(
    frame,
    [490, 510],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        perspective: "2500px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Sequence 1: Onboarding - Interests (frames 0-100) */}
      <Sequence from={0} durationInFrames={100}>
        <OnboardingInterests />
      </Sequence>

      {/* Sequence 2: Onboarding - Sliders (frames 100-200) */}
      <Sequence from={100} durationInFrames={100}>
        <OnboardingSliders />
      </Sequence>

      {/* "Get Your Feed" transition text (frames 200-235) */}
      <Sequence from={200} durationInFrames={35}>
        <AbsoluteFill
          style={{
            backgroundColor: "#fafafa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: getFeedOpacity * getFeedFadeOut,
          }}
        >
          <div
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: "42px",
              color: "#0a0a0a",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontWeight: 700,
            }}
          >
            → GET YOUR FEED
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Feed section (frames 235-510) - 9.2 seconds */}
      <Sequence from={235} durationInFrames={275}>
        <div
          style={{
            opacity: feedOpacity,
            transform: `perspective(2500px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${feedScale})`,
            transformStyle: "preserve-3d",
            width: "100%",
            height: "100%",
          }}
        >
          <BrowserFrame>
            <FeedLayout>
              <div
                style={{
                  transform: `translateY(${scrollProgress}px)`,
                }}
              >
                {/* Feed cards appear staggered - faster (8 frames apart) */}
                {sampleArticles.map((article, index) => {
                  const cardDelay = 60 + index * 8; // Relative to sequence start
                  const isSecondCard = index === 1;

                  return (
                    <div
                      key={article.id}
                      style={{
                        position: "relative",
                      }}
                    >
                      <FeedCard
                        item={article}
                        delay={cardDelay}
                        showCommentHighlight={isSecondCard && frame >= 410 && frame < 424}
                        commentButtonScale={isSecondCard ? commentButtonScale : 1}
                      />

                      {/* Comment input on second card */}
                      {isSecondCard && frame >= 424 && frame < 490 && (
                        <div
                          style={{
                            marginTop: "20px",
                            paddingLeft: "80px",
                            paddingRight: "24px",
                            opacity: commentOpacity,
                            transform: `translateY(${commentTranslateY}px)`,
                          }}
                        >
                          <div
                            style={{
                              backgroundColor: "white",
                              border: "2px solid #0a0a0a",
                              padding: "16px 20px",
                              fontFamily: "Geist Mono, monospace",
                              fontSize: "18px",
                              color: "#0a0a0a",
                            }}
                          >
                            {visibleComment}
                            {frame >= 440 && frame < 490 && Math.floor(frame / 15) % 2 === 0 && (
                              <span
                                style={{
                                  width: "3px",
                                  height: "22px",
                                  backgroundColor: "#0a0a0a",
                                  marginLeft: "2px",
                                  display: "inline-block",
                                }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </FeedLayout>
          </BrowserFrame>
        </div>
      </Sequence>

      {/* End card (frames 510-630) */}
      <Sequence from={510} durationInFrames={120}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
