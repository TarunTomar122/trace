import { Composition, Folder } from "remotion";
import { TracePromo, TRACE_PROMO_DURATION } from "./TracePromo";
import { DoomscrollReel, DOOMSCROLL_DURATION } from "./reels/DoomscrollReel";
import { ThirtySecondReel, THIRTY_SECOND_DURATION } from "./reels/ThirtySecondReel";
import { ProBriefReel, PRO_BRIEF_DURATION } from "./reels/ProBriefReel";
import { TraceLaunch, TRACE_LAUNCH_DURATION } from "./landscape/TraceLaunch";
import { TraceHighlight, TRACE_HIGHLIGHT_DURATION } from "./landscape/TraceHighlight";
import { LAND_FPS, LAND_H, LAND_W } from "./landscape/landscape-layout";

const REEL_W = 1080;
const REEL_H = 1920;

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Launch">
      <Composition
        id="TracePromo"
        component={TracePromo}
        durationInFrames={TRACE_PROMO_DURATION}
        fps={LAND_FPS}
        width={LAND_W}
        height={LAND_H}
      />
      <Composition
        id="TraceLaunch"
        component={TraceLaunch}
        durationInFrames={TRACE_LAUNCH_DURATION}
        fps={LAND_FPS}
        width={LAND_W}
        height={LAND_H}
      />
      <Composition
        id="TraceHighlight"
        component={TraceHighlight}
        durationInFrames={TRACE_HIGHLIGHT_DURATION}
        fps={LAND_FPS}
        width={LAND_W}
        height={LAND_H}
      />
    </Folder>

    <Folder name="Reels">
      <Composition
        id="DoomscrollReel"
        component={DoomscrollReel}
        durationInFrames={DOOMSCROLL_DURATION}
        fps={LAND_FPS}
        width={REEL_W}
        height={REEL_H}
      />
      <Composition
        id="ThirtySecondReel"
        component={ThirtySecondReel}
        durationInFrames={THIRTY_SECOND_DURATION}
        fps={LAND_FPS}
        width={REEL_W}
        height={REEL_H}
      />
      <Composition
        id="ProBriefReel"
        component={ProBriefReel}
        durationInFrames={PRO_BRIEF_DURATION}
        fps={LAND_FPS}
        width={REEL_W}
        height={REEL_H}
      />
    </Folder>
  </>
);