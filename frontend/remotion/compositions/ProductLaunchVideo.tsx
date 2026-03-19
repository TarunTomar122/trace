import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ProblemScene } from "../scenes/ProblemScene";
import { AppDemoScene } from "../scenes/AppDemoScene";
import { EndCardScene } from "../scenes/EndCardScene";

// Total: 1110 frames = 37s @ 30fps
//
//   ProblemScene  :   0 →  460 (15.3s) — stats + notifications + fall + "Introducing Trace"
//   AppDemoScene  : 430 → 1010 (19.3s) — 30f crossfade overlap
//   EndCardScene  : 980 → 1110  (4.3s) — 30f crossfade overlap

export const ProductLaunchVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#f4efe7" }}>
      <Sequence from={0} durationInFrames={460} premountFor={20}>
        <ProblemScene />
      </Sequence>

      <Sequence from={430} durationInFrames={580} premountFor={40}>
        <AppDemoScene />
      </Sequence>

      <Sequence from={980} durationInFrames={130} premountFor={20}>
        <EndCardScene />
      </Sequence>
    </AbsoluteFill>
  );
};
