import "./index.css";
import { Composition } from "remotion";
import { VideoComposition } from "./VideoComposition";
import { calculateVideoMetadata } from "./calculate-metadata";
import { DEFAULT_EPISODE, FPS, HEIGHT, WIDTH } from "./config";
import type { VideoProps } from "./types/props";

// Which episode is shown: Studio → props panel { "episode": "<series>/<NN>" },
// render → npm run render -- <series>/<NN>
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Video"
      component={VideoComposition}
      durationInFrames={FPS} // replaced by calculateMetadata
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ episode: DEFAULT_EPISODE } satisfies VideoProps}
      calculateMetadata={calculateVideoMetadata}
    />
  );
};
