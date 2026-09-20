import { Composition } from "remotion";
import { registerRoot } from "remotion";
import { ProductLaunchVideo } from "./compositions/ProductLaunchVideo";
import { TraceVideoOpening } from "./compositions/TraceVideoOpening";
import { TraceBigThingsLaunch } from "./compositions/TraceBigThingsLaunch";
import { TraceLaunchApple } from "./compositions/TraceLaunchApple";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ProductLaunchVideo"
        component={ProductLaunchVideo}
        durationInFrames={1110}
        // 37s @ 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="TraceVideoOpening"
        component={TraceVideoOpening}
        durationInFrames={60}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="TraceBigThingsLaunch"
        component={TraceBigThingsLaunch}
        durationInFrames={780}
        // 26s @ 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="TraceLaunchApple"
        component={TraceLaunchApple}
        durationInFrames={600}
        // 20s @ 30fps — keynote style, landscape
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="TraceBigThingsLaunchVertical"
        component={TraceBigThingsLaunch}
        durationInFrames={780}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

registerRoot(RemotionRoot);
