import { TransitionSeries } from "@remotion/transitions";
import { ClutterReveal } from "./scenes/ClutterReveal";
import { Sources } from "./scenes/Sources";
import { TwoFeeds } from "./scenes/TwoFeeds";
import { Interests } from "./scenes/Interests";
import { Streaks } from "./scenes/Streaks";
import { Outro } from "./scenes/Outro";
import { SceneShell } from "./components/SceneShell";

export const TRACE_PROMO_DURATION = 285 + 80 + 80 + 80 + 80 + 90;

export const TracePromo: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={285}>
      <SceneShell durationInFrames={285}>
        <ClutterReveal />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={80}>
      <SceneShell durationInFrames={80}>
        <Sources />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={80}>
      <SceneShell durationInFrames={80}>
        <TwoFeeds />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={80}>
      <SceneShell durationInFrames={80}>
        <Interests />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={80}>
      <SceneShell durationInFrames={80}>
        <Streaks />
      </SceneShell>
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={90}>
      <SceneShell durationInFrames={90} background="#F59E0B">
        <Outro />
      </SceneShell>
    </TransitionSeries.Sequence>
  </TransitionSeries>
);