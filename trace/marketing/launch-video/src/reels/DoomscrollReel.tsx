import { TransitionSeries } from "@remotion/transitions";
import { HookScene } from "./scenes/HookScene";
import { CardDemoScene } from "./scenes/CardDemoScene";
import { ReelOutro } from "../components/ReelOutro";
import { ReelSceneShell } from "../components/SceneShell";

export const DOOMSCROLL_DURATION = 108 + 198 + 85;

export const DoomscrollReel: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={108}>
      <ReelSceneShell durationInFrames={108}>
        <HookScene line1="Tired of celeb gossip?" line2="Trace filters it out." line2Accent />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={198}>
      <ReelSceneShell durationInFrames={198}>
        <CardDemoScene caption="Tech news. 30 seconds." />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={85}>
      <ReelSceneShell durationInFrames={85}>
        <ReelOutro headline="trace" subline="Inshorts for tech news. No fluff." />
      </ReelSceneShell>
    </TransitionSeries.Sequence>
  </TransitionSeries>
);