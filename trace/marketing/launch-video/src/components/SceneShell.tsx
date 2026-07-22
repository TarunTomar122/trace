import { interpolate, useCurrentFrame } from "remotion";
import { LAND_BG } from "../landscape/landscape-layout";
import { REEL_BG } from "./trace-theme";

const FADE_FRAMES = 12;
const ENTER_HOLD = 12;
const EXIT_HOLD = 12;

type SceneShellProps = {
  children: React.ReactNode;
  /** Must match the parent TransitionSeries.Sequence duration. */
  durationInFrames: number;
  background?: string;
};

/**
 * Sequential scene gate: hold → fade in → hold → fade out → hold.
 * The exit/enter holds keep a solid background on screen so the next
 * scene never appears while the previous one is still visible.
 */
export const SceneShell: React.FC<SceneShellProps> = ({
  children,
  durationInFrames,
  background = LAND_BG,
}) => {
  const frame = useCurrentFrame();

  const fadeInStart = ENTER_HOLD;
  const fadeInEnd = ENTER_HOLD + FADE_FRAMES;
  const fadeOutEnd = durationInFrames - EXIT_HOLD;
  const fadeOutStart = fadeOutEnd - FADE_FRAMES;

  const contentOpacity = (() => {
    if (frame < fadeInStart) return 0;
    if (frame < fadeInEnd) {
      return interpolate(frame, [fadeInStart, fadeInEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    if (frame >= fadeOutEnd) return 0;
    if (frame >= fadeOutStart) {
      return interpolate(frame, [fadeOutStart, fadeOutEnd], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    return 1;
  })();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ width: "100%", height: "100%", opacity: contentOpacity }}>{children}</div>
    </div>
  );
};

type ReelSceneShellProps = {
  children: React.ReactNode;
  durationInFrames: number;
};

export const ReelSceneShell: React.FC<ReelSceneShellProps> = ({ children, durationInFrames }) => (
  <SceneShell durationInFrames={durationInFrames} background={REEL_BG}>
    {children}
  </SceneShell>
);