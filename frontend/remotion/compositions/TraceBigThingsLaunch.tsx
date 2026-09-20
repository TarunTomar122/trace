import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { BigThingsHookScene } from "../scenes/BigThingsHookScene";
import { FeatureReelScene } from "../scenes/FeatureReelScene";
import { PriceScene } from "../scenes/PriceScene";
import { LaunchEndScene } from "../scenes/LaunchEndScene";

/**
 * Trace launch video: ten big things, the five ways to read them, $5, the URL.
 *
 * Timeline (30fps, 780 frames = 26s) with 20-frame crossfades:
 *   Hook      0 → 140
 *   Features  120 → 560
 *   Price     540 → 700
 *   End       680 → 780
 */
export const TraceBigThingsLaunch: React.FC<{ vertical?: boolean }> = ({ vertical }) => {
  const { width, height } = useVideoConfig();
  const isVertical = vertical ?? height > width;

  return (
    <AbsoluteFill style={{ backgroundColor: "#f4efe7" }}>
      <Sequence from={0} durationInFrames={140} premountFor={20}>
        <BigThingsHookScene vertical={isVertical} />
      </Sequence>

      <Sequence from={120} durationInFrames={440} premountFor={40}>
        <FeatureReelScene vertical={isVertical} />
      </Sequence>

      <Sequence from={540} durationInFrames={160} premountFor={40}>
        <PriceScene vertical={isVertical} />
      </Sequence>

      <Sequence from={680} durationInFrames={100} premountFor={40}>
        <LaunchEndScene vertical={isVertical} />
      </Sequence>
    </AbsoluteFill>
  );
};
