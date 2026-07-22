import { TransitionSeries } from "@remotion/transitions";
import { LandscapeHook } from "./scenes/LandscapeHook";
import { LandscapeSpeed } from "./scenes/LandscapeSpeed";
import { LandscapeTimeline } from "./scenes/LandscapeTimeline";
import { LandscapeOutro } from "./components/LandscapeOutro";
import { SceneShell } from "../components/SceneShell";

export const TRACE_HIGHLIGHT_DURATION = 75 + 168 + 95 + 80;

export const TraceHighlight: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={75}>
      <SceneShell durationInFrames={75}>
        <LandscapeHook />
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
    <TransitionSeries.Sequence durationInFrames={80}>
      <SceneShell durationInFrames={80} background="#1a1a1a">
        <LandscapeOutro compact subline="Inshorts for tech news. Download free." />
      </SceneShell>
    </TransitionSeries.Sequence>
  </TransitionSeries>
);