import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { ClutterReveal } from "./scenes/ClutterReveal";
import { Sources } from "./scenes/Sources";
import { TwoFeeds } from "./scenes/TwoFeeds";
import { Interests } from "./scenes/Interests";
import { Streaks } from "./scenes/Streaks";
import { Outro } from "./scenes/Outro";

const T = 25;

export const TracePromo: React.FC = () => (
  <TransitionSeries>
    {/* Welcome: clutter → drop → "trace. Your shortcut to staying informed." (10s) */}
    <TransitionSeries.Sequence durationInFrames={300} premountFor={T}>
      <ClutterReveal />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

    {/* "100+ sources. Every angle. One story." (8s) */}
    <TransitionSeries.Sequence durationInFrames={240} premountFor={T}>
      <Sources />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

    {/* "News in 30 seconds. Two modes." (8s) */}
    <TransitionSeries.Sequence durationInFrames={240} premountFor={T}>
      <TwoFeeds />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

    {/* "Your role. Your topics. Your interests." (7s) */}
    <TransitionSeries.Sequence durationInFrames={210} premountFor={T}>
      <Interests />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

    {/* "A few minutes. Every day. Stay sharp." (6s) */}
    <TransitionSeries.Sequence durationInFrames={180} premountFor={T}>
      <Streaks />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

    {/* CTA: "Stay informed. In your time, on your terms." (5s) */}
    <TransitionSeries.Sequence durationInFrames={150} premountFor={T}>
      <Outro />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
