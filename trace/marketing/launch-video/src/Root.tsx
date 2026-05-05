import { Composition } from "remotion";
import { TracePromo } from "./TracePromo";

// 300+240+240+210+180+150 - 25*5 = 1320 - 125 = 1195f ≈ 39.8s
const TOTAL = 300 + 240 + 240 + 210 + 180 + 150 - 25 * 5;

export const RemotionRoot: React.FC = () => (
  <Composition
    id="TracePromo"
    component={TracePromo}
    durationInFrames={TOTAL}
    fps={30}
    width={1920}
    height={1080}
  />
);
