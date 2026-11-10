import "./index.css";
import { Composition } from "remotion";
import { VideoComposition } from "./VideoComposition";
import { calculateVideoMetadata } from "./calculate-metadata";
import { FPS, HEIGHT, WIDTH } from "./config";
import { currentVideo } from "./data/current-video";

export const RemotionRoot: React.FC = () => {
  // Placeholder only — calculateMetadata replaces it with the real length.
  const minDuration = currentVideo.scenes.reduce((acc, scene) => acc + Math.ceil(scene.duration * FPS), 0);

  return (
    <Composition
      id="Video"
      component={VideoComposition}
      durationInFrames={minDuration}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ resolvedScenes: [] }}
      calculateMetadata={calculateVideoMetadata}
    />
  );
};
