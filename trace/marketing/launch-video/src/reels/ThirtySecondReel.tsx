import { TransitionSeries } from "@remotion/transitions";
import { SpeedIntroScene } from "./scenes/SpeedIntroScene";
import { CardSwipeScene } from "./scenes/CardSwipeScene";
import { TimelineScene } from "./scenes/TimelineScene";
import { ReelOutro } from "../components/ReelOutro";
import { ReelSceneShell } from "../components/SceneShell";

export const THIRTY_SECOND_DURATION = 115 + 168 + 108 + 85;

export const ThirtySecondReel: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={115}>
      <ReelSceneShell durationInFrames={115}>
        <SpeedIntroScene />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={168}>
      <ReelSceneShell durationInFrames={168}>
        <CardSwipeScene />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={108}>
      <ReelSceneShell durationInFrames={108}>
        <TimelineScene />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={85}>
      <ReelSceneShell durationInFrames={85}>
        <ReelOutro headline="trace" subline="Stay informed. In 30 seconds." accent="#1a1a1a" />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
  </TransitionSeries>
);