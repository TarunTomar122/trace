import { TransitionSeries } from "@remotion/transitions";
import { ProScene } from "./scenes/ProScene";
import { CardDemoScene } from "./scenes/CardDemoScene";
import { ReelOutro } from "../components/ReelOutro";
import { MOCK_STORIES } from "../components/mock-stories";
import { ReelSceneShell } from "../components/SceneShell";

export const PRO_BRIEF_DURATION = 120 + 198 + 85;

export const ProBriefReel: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={120}>
      <ReelSceneShell durationInFrames={120}>
        <ProScene />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={198}>
      <ReelSceneShell durationInFrames={198}>
        <CardDemoScene caption="Your daily brief. Done." stories={MOCK_STORIES.slice(1, 4)} />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={85}>
      <ReelSceneShell durationInFrames={85}>
        <ReelOutro headline="trace" subline="Built for devs, founders & PMs." />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
  </TransitionSeries>
);