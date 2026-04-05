import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { AiWarsComposition } from "./AiWarsComposition";
import { StitchComposition } from "./StitchComposition";
import { VideoComposition } from "./VideoComposition"; // New Generic Component
import { aiWarsScenes } from "./data/ai-wars-data";
import { currentVideo } from "./data/current-video";

export const RemotionRoot: React.FC = () => {
  const aiWarsDuration = aiWarsScenes.reduce((acc, scene) => acc + (scene.duration * 30), 0);

  // Calculate duration for the current generic video
  const currentVideoDuration = currentVideo.scenes.reduce((acc, scene) => acc + Math.ceil(scene.duration * 30), 0);

  return (
    <>
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={1260}
        fps={30}
        width={1280}
        height={720}
      />
      {/* Deprecated but kept for reference */}
      <Composition
        id="AiWars"
        component={AiWarsComposition}
        durationInFrames={9525}
        fps={30}
        width={1280}
        height={720}
      />

      {/* NEW GENERIC COMPOSITION */}
      <Composition
        id="Video" // Generic ID
        component={VideoComposition}
        durationInFrames={currentVideoDuration}
        fps={30}
        width={1280}
        height={720}
      />

      <Composition
        id="Stitch"
        component={StitchComposition}
        durationInFrames={7770}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
