import { TransitionSeries } from "@remotion/transitions";
import { LandscapeIntro } from "./scenes/LandscapeIntro";
import { LandscapeSpeed } from "./scenes/LandscapeSpeed";
import { LandscapeTimeline } from "./scenes/LandscapeTimeline";
import { LandscapePersonalize } from "./scenes/LandscapePersonalize";
import { LandscapeStreaks } from "./scenes/LandscapeStreaks";
import { LandscapeOutro } from "./components/LandscapeOutro";
import { SceneShell } from "../components/SceneShell";

export const TRACE_LAUNCH_DURATION = 95 + 168 + 95 + 100 + 105 + 90;

export const TraceLaunch: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={95}>
      <SceneShell durationInFrames={95}>
        <LandscapeIntro />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={168}>
      <SceneShell durationInFrames={168}>
        <LandscapeSpeed />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={95}>
      <SceneShell durationInFrames={95}>
        <LandscapeTimeline />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={100}>
      <SceneShell durationInFrames={100}>
        <LandscapePersonalize />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={105}>
      <SceneShell durationInFrames={105}>
        <LandscapeStreaks />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={90}>
      <SceneShell durationInFrames={90} background="#1a1a1a">
        <LandscapeOutro subline="The AI news app that respects your time." />
      </SceneShell>
    </TransitionSeries.Sequence>
  </TransitionSeries>
);