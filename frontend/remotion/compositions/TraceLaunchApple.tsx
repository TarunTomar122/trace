import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { AppleHookScene } from "../scenes/AppleHookScene";
import { AppleEmailScene } from "../scenes/AppleEmailScene";
import { APPLE_FEATURES, AppleFeatureScene } from "../scenes/AppleFeatureScene";
import { AppleEndScene, ApplePriceScene } from "../scenes/AppleOfferScene";

/**
 * Trace launch video, keynote style. Landscape 1920x1080 @ 30fps, 27s.
 *
 *   Hook       0 → 110   "10 big things" strobes black/white, then settles
 *   Email     96 → 200   the homepage's own email demo
 *   Features 186 → 506   four screens, one idea each (80 frames apiece)
 *   Price    490 → 560   "$5 a month"
 *   Close    546 → 600   "Don't miss another update." + yourtrace.online
 */
const FEATURE_START = 186;
const FEATURE_LENGTH = 80;

export const TraceLaunchApple: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Synthesised lofi bed: quiet enough to sit under the cuts. */}
      <Audio src={staticFile("audio/lofi-beat.mp3")} volume={0.42} />

      <Sequence from={0} durationInFrames={110} premountFor={20}>
        <AppleHookScene fadeOutAt={92} />
      </Sequence>

      <Sequence from={96} durationInFrames={104} premountFor={30}>
        <AppleEmailScene fadeOutAt={88} />
      </Sequence>

      {APPLE_FEATURES.map((feature, index) => (
        <Sequence
          key={feature.title}
          from={FEATURE_START + index * FEATURE_LENGTH}
          durationInFrames={FEATURE_LENGTH}
          premountFor={30}
        >
          <AppleFeatureScene
            feature={feature}
            index={index}
            fadeOutAt={index === APPLE_FEATURES.length - 1 ? 58 : 62}
          />
        </Sequence>
      ))}

      <Sequence from={490} durationInFrames={70} premountFor={30}>
        <ApplePriceScene fadeOutAt={58} />
      </Sequence>

      <Sequence from={546} durationInFrames={54} premountFor={30}>
        <AppleEndScene />
      </Sequence>
    </AbsoluteFill>
  );
};
