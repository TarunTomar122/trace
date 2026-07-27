import { Composition } from "remotion";
import { registerRoot } from "remotion";
import { ProductLaunchVideo } from "./compositions/ProductLaunchVideo";
import { TraceVideoOpening } from "./compositions/TraceVideoOpening";

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
    </>
  );
};

registerRoot(RemotionRoot);
